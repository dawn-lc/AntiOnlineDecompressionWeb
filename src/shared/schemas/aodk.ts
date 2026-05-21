export interface AODKHeader {
    magic: Uint8Array;           // 4 bytes  – "AODK"
    version: number;             // 2 bytes  – 格式版本
    headerSize: number;          // 4 bytes  – 整个 Header 大小
    key: Uint8Array;             // 32 bytes – XChaCha20 Key（随机生成）
    nonce: Uint8Array;           // 24 bytes – XChaCha20 Nonce（随机生成）
    uuid: Uint8Array;            // 32 bytes – AODF UUID
    fileHash: Uint8Array;        // 32 bytes – 原文件 SHA-256
    originalFileSize: bigint;    // 8 bytes  – 原文件大小（BigInt）
    filenameLength: number;      // 2 bytes  – 文件名 UTF-8 字节数
    filename: string;            // N bytes  – 原文件文件名（UTF-8）
}