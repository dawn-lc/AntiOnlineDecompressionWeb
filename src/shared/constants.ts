/** 分块大小：2 MB */
export const CHUNK_SIZE = 2 * 1024 * 1024;

/** AODK Magic Bytes */
export const AODK_MAGIC = new Uint8Array([0x41, 0x4F, 0x44, 0x4B]);
/** AODF Magic Bytes */
export const AODF_MAGIC = new Uint8Array([0x41, 0x4F, 0x44, 0x46]);

export const AODK_VERSION = 1;
export const AODF_VERSION = 2;

export const AODK_HEADER_SIZE = 140;
/** AODF 头部：magic(4) + version(2) + headerSize(4) + encryptedUUID(32+17) */
export const AODF_HEADER_SIZE = 59;

/** libsodium secretstream 每块额外开销（Poly1305 认证标签） */
export const ABYTES = 17;