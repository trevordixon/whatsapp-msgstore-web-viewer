import pako from 'pako';
import forge from 'node-forge';

export type EncryptionType = 'crypt12' | 'crypt14' | 'crypt15';


interface EncryptionParams {
    ivOffset: number;
    ivLength: number;
    dbStartOffset: number;
}

const CRYPT_CONFIG: Record<EncryptionType, EncryptionParams> = {
    'crypt12': {
        ivOffset: 51,
        ivLength: 16,
        dbStartOffset: 67
    },
    'crypt14': {
        ivOffset: 67,
        ivLength: 16,
        dbStartOffset: 190
    },
    'crypt15': {
        ivOffset: 8,
        ivLength: 16,
        dbStartOffset: 122
    }
};

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

// ... (helper)
// Helper to avoid Buffer in browser
const toBinaryString = (bytes: Uint8Array): string => {
    let binary = '';
    const len = bytes.byteLength;
    // Chunking to avoid stack overflow with String.fromCharCode.apply if large
    // But for keys/IVs (small), simple loop is fine. 
    // For data, we shouldn't convert to binary string if avoidable, or use limit.
    // Forge createBuffer accepts Uint8Array directly.
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return binary;
};

// HELPER: Key Derivation for Crypt15
const deriveCrypt15Key = (rootKey: Uint8Array): Uint8Array => {
    // Algo:
    // 1. PrivateKey = HMAC-SHA256(Key=32_NULL, Msg=RootKey)
    // 2. FinalKey = HMAC-SHA256(Key=PrivateKey, Msg="backup encryption" || 0x01)

    // Step A
    const nullSeed = new Uint8Array(32); // 32 nulls
    const hmacA = forge.hmac.create();
    hmacA.start('sha256', forge.util.createBuffer(nullSeed)); // Key (Uint8Array works?)
    // Forge expects string key usually. If we pass buffer object?
    // Docs: "key: string key".
    // So we MUST convert key to binary string.
    hmacA.start('sha256', toBinaryString(nullSeed));

    hmacA.update(toBinaryString(rootKey));
    const privateKey = hmacA.digest().getBytes(); // Binary string

    // Step B
    const message = "backup encryption";
    const suffix = String.fromCharCode(0x01);
    const hmacB = forge.hmac.create();
    hmacB.start('sha256', privateKey); // privateKey is already binary string
    hmacB.update(message + suffix);
    const finalKey = hmacB.digest().getBytes(); // Binary String

    // Convert binary string to Uint8Array
    const len = finalKey.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = finalKey.charCodeAt(i);
    return arr;
};


export const decryptDatabase = async (
    encryptedBuffer: ArrayBuffer,
    key: CryptoKey,
    type: EncryptionType,
    rawKeyBytes?: Uint8Array
): Promise<ArrayBuffer> => {

    let workingKeyBytes: string;

    if (type === 'crypt15') {
        if (!rawKeyBytes) throw new Error("Crypt15 requires raw key bytes for derivation");
        const derivedKey = deriveCrypt15Key(rawKeyBytes);
        workingKeyBytes = toBinaryString(derivedKey);
    } else {
        if (rawKeyBytes) {
            workingKeyBytes = toBinaryString(rawKeyBytes);
        } else {
            const exported = await window.crypto.subtle.exportKey('raw', key);
            workingKeyBytes = toBinaryString(new Uint8Array(exported));
        }
    }

    const config = CRYPT_CONFIG[type];
    const view = new Uint8Array(encryptedBuffer);

    let iv: string;
    let ciphertext: Uint8Array<ArrayBuffer>;

    if (type === 'crypt15') {
        const viewData = new DataView(encryptedBuffer);
        let offset = 0;

        // 1. Header Size
        const protobufSize = viewData.getUint8(offset);
        offset++;

        // 2. Feature Flag Check
        const flagByte = viewData.getUint8(offset);
        if (flagByte === 1) offset++;

        const protobufStart = offset;
        const protobufEnd = offset + protobufSize;
        const protobufBuffer = new Uint8Array(encryptedBuffer).slice(protobufStart, protobufEnd);

        // 3. Parse Protobuf
        let pbOffset = 0;
        const pbView = new DataView(protobufBuffer.buffer);
        let foundIV: Uint8Array | null = null;

        const readVarint = () => {
            let tag = 0;
            let shift = 0;
            while (true) {
                if (pbOffset >= protobufBuffer.byteLength) throw new Error("EOF");
                const b = pbView.getUint8(pbOffset);
                pbOffset++;
                tag |= (b & 0x7F) << shift;
                if ((b & 0x80) === 0) break;
                shift += 7;
            }
            return tag;
        };

        try {
            while (pbOffset < protobufBuffer.byteLength) {
                const tag = readVarint();
                const wireType = tag & 0x07;
                const fieldNum = tag >>> 3;

                if (wireType === 2) {
                    const len = readVarint();
                    const payload = new Uint8Array(protobufBuffer.slice(pbOffset, pbOffset + len));
                    if (fieldNum === 3) { // c15_iv
                        let subOffset = 0;
                        const subView = new DataView(payload.buffer);
                        while (subOffset < payload.byteLength) {
                            let sTag = 0; let sShift = 0;
                            while (true) {
                                const b = subView.getUint8(subOffset); subOffset++;
                                sTag |= (b & 0x7F) << sShift;
                                if ((b & 0x80) === 0) break;
                                sShift += 7;
                            }
                            const sWire = sTag & 0x07;
                            const sField = sTag >>> 3;
                            if (sField === 1 && sWire === 2) {
                                let sLen = 0; let slShift = 0;
                                while (true) {
                                    const b = subView.getUint8(subOffset); subOffset++;
                                    sLen |= (b & 0x7F) << slShift;
                                    if ((b & 0x80) === 0) break;
                                    slShift += 7;
                                }
                                if (sLen === 16) foundIV = new Uint8Array(payload.slice(subOffset, subOffset + 16));
                                subOffset += sLen;
                            } else {
                                if (sWire === 2) {
                                    let sLen = 0; let slShift = 0;
                                    while (true) {
                                        const b = subView.getUint8(subOffset); subOffset++;
                                        sLen |= (b & 0x7F) << slShift;
                                        if ((b & 0x80) === 0) break;
                                        slShift += 7;
                                    }
                                    subOffset += sLen;
                                } else break;
                            }
                        }
                    }
                    pbOffset += len;
                } else if (wireType === 0) while ((pbView.getUint8(pbOffset++) & 0x80) !== 0);
                else if (wireType === 1) pbOffset += 8;
                else if (wireType === 5) pbOffset += 4;
                else break;
            }
        } catch (e) { console.warn("Protobuf parse warning:", e); }

        if (foundIV) {
            iv = toBinaryString(foundIV);
        } else {
            iv = toBinaryString(view.slice(8, 24));
        }

        const tagStart = view.byteLength - 32;
        ciphertext = view.slice(protobufEnd, tagStart);
        const tag = view.slice(tagStart, view.byteLength - 16);

        const decipher = forge.cipher.createDecipher('AES-GCM', workingKeyBytes);
        decipher.start({
            iv: iv,
            tag: forge.util.createBuffer(tag.buffer),
            tagLength: 128
        });
        decipher.update(forge.util.createBuffer(ciphertext.buffer));

        const success = decipher.finish();
        if (!success) throw new Error("Decryption failed (Forge Auth Mismatch)");

        const decryptedBytes = decipher.output.getBytes();
        const arr = new Uint8Array(decryptedBytes.length);
        for (let i = 0; i < decryptedBytes.length; i++) arr[i] = decryptedBytes.charCodeAt(i);

        try {
            return pako.inflate(arr).buffer;
        } catch (e) {
            console.warn("Decompression failed", e);
            throw new Error("Decompression failed (Invalid Zlib data)");
        }

    } else {
        // Crypt12/14 Logic reused
        const rawIv = view.slice(config.ivOffset, config.ivOffset + config.ivLength);
        iv = toBinaryString(rawIv);

        if (type === 'crypt14') {
            ciphertext = view.slice(config.dbStartOffset);
        } else {
            ciphertext = view.slice(config.dbStartOffset, view.length - 20);
        }

        const decipher = forge.cipher.createDecipher('AES-GCM', workingKeyBytes);
        decipher.start({ iv: iv });
        decipher.update(forge.util.createBuffer(ciphertext.buffer));
        decipher.finish(); // Check pass?

        const decryptedBytes = decipher.output.getBytes();
        const arr = new Uint8Array(decryptedBytes.length);
        for (let i = 0; i < decryptedBytes.length; i++) arr[i] = decryptedBytes.charCodeAt(i);

        try {
            return pako.inflate(arr).buffer;
        } catch (e) {
            console.warn("Decompression failed (fallback raw)", e);
            return arr.buffer;
        }
    }
};
