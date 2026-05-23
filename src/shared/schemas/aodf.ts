export interface AODFHeader {
    magic: Uint8Array;           // 4 bytes  – "AODF"
    version: number;             // 2 bytes  – 格式版本
    headerSize: number;          // 4 bytes  – 整个 header 大小
    encryptedUuid: Uint8Array;   // 49 bytes – 经 XChaCha20 加密的 UUID（不可关联）
}