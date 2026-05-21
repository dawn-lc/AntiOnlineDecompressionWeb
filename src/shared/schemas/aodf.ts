export interface AODFHeader {
    magic: Uint8Array;           // 4 bytes  – "AODF"
    version: number;             // 2 bytes  – 格式版本
    uuid: Uint8Array;            // 32 bytes – UUID
    headerSize: number;          // 4 bytes  – 整个 header 大小
}