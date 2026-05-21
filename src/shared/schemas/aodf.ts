export interface AODFHeader {
    magic: Uint8Array;           // 4 bytes  – "AODF"
    version: number;             // 2 bytes  – 格式版本
    headerSize: number;          // 4 bytes  – 整个 header 大小
    uuid: Uint8Array;            // 32 bytes – 与 AODK 匹配的唯一标识
}