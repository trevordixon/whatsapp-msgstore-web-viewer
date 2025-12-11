

export type EncryptionType = 'crypt12' | 'crypt14' | 'crypt15';


interface EncryptionParams {
    ivOffset: number;
    ivLength: number;
    dbStartOffset: number;
}



export const detectEncryptionType = (buffer: ArrayBuffer, fileName?: string): EncryptionType | null => {
    // Basic heuristic based on filename or checking simple markers
    if (fileName) {
        if (fileName.endsWith('.crypt12')) return 'crypt12';
        if (fileName.endsWith('.crypt14')) return 'crypt14';
        if (fileName.endsWith('.crypt15')) return 'crypt15';
    }

    // Heuristic via File Header
    const view = new DataView(buffer);
    if (view.byteLength > 67) {
        // Crypt12 signature/version logic is complex, rely on filename usually.
        // Crypt14/15 use protobuf.
        // Identify via first bytes? 
        // 87 01 08 01 -> Crypt15 field 1?
        if (view.getUint8(0) === 0x87 && view.getUint8(1) === 0x01) { // Very loose check
            // return 'crypt15'; // risking false positive
        }
    }

    return null;
};

// Update return type
export const extractKey = async (keyFileBuffer: ArrayBuffer): Promise<{ cryptoKey: CryptoKey, raw: Uint8Array }> => {
    let keyData: Uint8Array<ArrayBuffer>;

    if (keyFileBuffer.byteLength === 32) {
        keyData = new Uint8Array(keyFileBuffer);
    } else if (keyFileBuffer.byteLength === 158) {
        keyData = new Uint8Array(keyFileBuffer.slice(126, 126 + 32));
    } else {
        // Try HEX
        try {
            const text = new TextDecoder().decode(keyFileBuffer).trim();
            if (text.length === 64 && /^[0-9a-fA-F]+$/.test(text)) {
                const matches = text.match(/.{1,2}/g);
                if (matches) {
                    keyData = new Uint8Array(matches.map(b => parseInt(b, 16)));
                } else {
                    throw new Error("Invalid hex");
                }
            } else {
                // Java Serialized Object
                const view = new DataView(keyFileBuffer);
                if (view.byteLength > 4 && view.getUint32(0) === 0xaced0005) {
                    // Custom extraction for provided key file type (59 bytes)
                    if (keyFileBuffer.byteLength === 59) {
                        keyData = new Uint8Array(keyFileBuffer.slice(27, 59));
                    } else {
                        // Generic search (fallback)
                        let keyStart = -1;
                        const uint8 = new Uint8Array(keyFileBuffer);
                        for (let i = 0; i <= uint8.length - 36; i++) {
                            if (uint8[i] === 0 && uint8[i + 1] === 0 && uint8[i + 2] === 0 && uint8[i + 3] === 32) {
                                keyStart = i + 4;
                                break;
                            }
                        }
                        if (keyStart !== -1) {
                            keyData = new Uint8Array(keyFileBuffer.slice(keyStart, keyStart + 32));
                        } else {
                            if (keyFileBuffer.byteLength >= 32) {
                                keyData = new Uint8Array(keyFileBuffer.slice(keyFileBuffer.byteLength - 32));
                            } else {
                                throw new Error("Key file too small");
                            }
                        }
                    }
                } else {
                    throw new Error("Unknown key format");
                }
            }
        } catch (e) {
            throw new Error("Failed to parse key file");
        }
    }

    const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        'AES-GCM',
        true, // Make exportable just in case
        ['decrypt']
    );

    return { cryptoKey, raw: keyData! };
};

// Worker Wrapper
export const decryptDatabase = (
    encryptedBuffer: ArrayBuffer,
    key: CryptoKey,
    type: EncryptionType,
    rawKeyBytes?: Uint8Array,
    onProgress?: (status: string) => void
): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
        const worker = new Worker(new URL('../src/workers/decryption.worker.ts', import.meta.url), { type: 'module' });

        worker.onmessage = (e) => {
            const { type, status, buffer, message } = e.data;
            if (type === 'progress') {
                if (onProgress) onProgress(status);
            } else if (type === 'complete') {
                resolve(buffer);
                worker.terminate();
            } else if (type === 'error') {
                reject(new Error(message));
                worker.terminate();
            }
        };

        worker.onerror = (err) => {
            reject(new Error("Worker Error: " + err.message));
            worker.terminate();
        };

        // Send data
        worker.postMessage({
            fileBuffer: encryptedBuffer,
            keyBuffer: null,
            encryptionType: type,
            rawKeyBytes: rawKeyBytes
        }, [encryptedBuffer]);
    });
};
