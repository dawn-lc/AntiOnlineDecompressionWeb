export interface AODKHeader {
    magic: Uint8Array;           // 4 bytes  – "AODK"
    version: number;             // 2 bytes  – 格式版本
    headerSize: number;          // 4 bytes  – Header 总大小（不含 Filename / Attachment）
    key: Uint8Array;             // 32 bytes – XChaCha20 Key（随机生成）
    nonce: Uint8Array;           // 24 bytes – XChaCha20 Nonce（随机生成）
    uuid: Uint8Array;            // 32 bytes – 与 AODF 匹配的唯一标识
    fileHash: Uint8Array;        // 32 bytes – 原始文件 SHA-256 哈希
    originalFileSize: bigint;    // 8 bytes  – 原始文件大小（BigInt）
    filenameLength: number;      // 2 bytes  – 文件名 UTF-8 字节数
    filename: string;            // 可变    – 原始文件名（UTF-8）
    attachment?: Uint8Array;     // 可变    – 附件（不计入 HeaderSize）
}