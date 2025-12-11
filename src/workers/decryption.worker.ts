import pako from 'pako';
import forge from 'node-forge';

type EncryptionType = 'crypt12' | 'crypt14' | 'crypt15';

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

const toBinaryString = (bytes: Uint8Array): string => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return binary;
};

const deriveCrypt15Key = (rootKey: Uint8Array): Uint8Array => {
    const nullSeed = new Uint8Array(32);
    const hmacA = forge.hmac.create();
    hmacA.start('sha256', toBinaryString(nullSeed));

    hmacA.update(toBinaryString(rootKey));
    const privateKey = hmacA.digest().getBytes();

    const message = "backup encryption";
    const suffix = String.fromCharCode(0x01);
    const hmacB = forge.hmac.create();
    hmacB.start('sha256', privateKey);
    hmacB.update(message + suffix);
    const finalKey = hmacB.digest().getBytes();

    const len = finalKey.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = finalKey.charCodeAt(i);
    return arr;
};

self.onmessage = async (e: MessageEvent) => {
    const { fileBuffer, keyBuffer, encryptionType, rawKeyBytes } = e.data;
    const type = encryptionType as EncryptionType;

    try {
        self.postMessage({ type: 'progress', status: 'Deriving keys...' });

        // --- Key Preparation ---
        let workingKeyBytes: string;

        if (type === 'crypt15') {
            if (!rawKeyBytes) throw new Error("Crypt15 requires raw key bytes for derivation");
            const derivedKey = deriveCrypt15Key(rawKeyBytes);
            workingKeyBytes = toBinaryString(derivedKey);
        } else {
            // For older formats, we might be passed raw bytes or need to rely on what was passed.
            // If we passed rawKeyBytes (which we do now from extractKey), use them.
            if (rawKeyBytes) {
                workingKeyBytes = toBinaryString(rawKeyBytes);
            } else {
                // Fallback if we only passed the exported bits (should not happen with new logic)
                // But worker receives ArrayBuffers. 
                throw new Error("Raw key bytes required for worker");
            }
        }

        self.postMessage({ type: 'progress', status: 'Parsing file structure...' });

        const config = CRYPT_CONFIG[type];
        const view = new Uint8Array(fileBuffer);

        let iv: string;
        let ciphertext: Uint8Array<ArrayBuffer>;

        if (type === 'crypt15') {
            const viewData = new DataView(fileBuffer);
            let offset = 0;

            // 1. Header Size
            const protobufSize = viewData.getUint8(offset);
            offset++;

            // 2. Feature Flag Check
            const flagByte = viewData.getUint8(offset);
            if (flagByte === 1) offset++;

            const protobufStart = offset;
            const protobufEnd = offset + protobufSize;
            const protobufBuffer = new Uint8Array(fileBuffer).slice(protobufStart, protobufEnd);

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
                // Simplified Protobuf Parser (Copied from encryptionService)
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
            } catch (e) {
                // Warning ignored
            }

            if (foundIV) {
                iv = toBinaryString(foundIV);
            } else {
                iv = toBinaryString(view.slice(8, 24));
            }

            const tagStart = view.byteLength - 32;
            ciphertext = view.slice(protobufEnd, tagStart);
            const tag = view.slice(tagStart, view.byteLength - 16);

            self.postMessage({ type: 'progress', status: 'Decrypting AES-GCM...' });

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

            self.postMessage({ type: 'progress', status: 'Decompressing Zlib...' });

            try {
                const inflated = pako.inflate(arr).buffer;
                self.postMessage({ type: 'complete', buffer: inflated }, { transfer: [inflated] });
            } catch (e) {
                throw new Error("Decompression failed (Invalid Zlib data)");
            }
        } else {
            // Crypt12/14
            self.postMessage({ type: 'progress', status: 'Decrypting Legacy Format...' });

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
            decipher.finish();

            const decryptedBytes = decipher.output.getBytes();
            const arr = new Uint8Array(decryptedBytes.length);
            for (let i = 0; i < decryptedBytes.length; i++) arr[i] = decryptedBytes.charCodeAt(i);

            self.postMessage({ type: 'progress', status: 'Decompressing (Legacy)...' });

            try {
                const inflated = pako.inflate(arr).buffer;
                self.postMessage({ type: 'complete', buffer: inflated }, { transfer: [inflated] });
            } catch (e) {
                // Fallback raw
                self.postMessage({ type: 'complete', buffer: arr.buffer }, { transfer: [arr.buffer] });
            }
        }
    } catch (error: any) {
        self.postMessage({ type: 'error', message: error.message || "Unknown worker error" });
    }
};
