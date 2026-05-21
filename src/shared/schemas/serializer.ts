import { AODKHeader } from './aodk';
import { AODFHeader } from './aodf';
import {
    AODK_MAGIC, AODK_VERSION, AODK_HEADER_SIZE,
    AODF_MAGIC, AODF_VERSION, AODF_HEADER_SIZE,
} from '../constants';

export class HeaderSerializer {
    /** 序列化 AODK 固定前段 140 字节 + 可变文件名段 + Attachment */
    static serializeAODK(header: AODKHeader): ArrayBuffer {
        const filenameBytes = new TextEncoder().encode(header.filename);
        const attachmentBytes = header.attachment ?? new Uint8Array(0);
        const totalSize = AODK_HEADER_SIZE + filenameBytes.length + attachmentBytes.length;
        const buffer = new ArrayBuffer(totalSize);
        const view = new DataView(buffer);
        let offset = 0;

        // magic – 4 bytes
        new Uint8Array(buffer, offset, 4).set(AODK_MAGIC);
        offset += 4;

        // version – uint16 LE
        view.setUint16(offset, AODK_VERSION, true);
        offset += 2;

        // headerSize – uint32 LE
        view.setUint32(offset, AODK_HEADER_SIZE, true);
        offset += 4;

        // key – 32 bytes
        new Uint8Array(buffer, offset, 32).set(header.key);
        offset += 32;

        // nonce – 24 bytes
        new Uint8Array(buffer, offset, 24).set(header.nonce);
        offset += 24;

        // uuid – 32 bytes
        new Uint8Array(buffer, offset, 32).set(header.uuid);
        offset += 32;

        // fileHash – 32 bytes
        new Uint8Array(buffer, offset, 32).set(header.fileHash);
        offset += 32;

        // originalFileSize – uint64 LE (BigInt)
        view.setBigUint64(offset, header.originalFileSize, true);
        offset += 8;

        // filenameLength – uint16 LE
        view.setUint16(offset, filenameBytes.length, true);
        offset += 2;

        // filename – UTF-8 bytes
        new Uint8Array(buffer, offset).set(filenameBytes);
        offset += filenameBytes.length;

        // attachment – 可变（不计入 HeaderSize）
        if (attachmentBytes.length > 0) {
            new Uint8Array(buffer, offset).set(attachmentBytes);
        }

        return buffer;
    }

    /** 反序列化 AODK（先读固定前段，再根据 filenameLength 读可变段） */
    static deserializeAODK(buffer: ArrayBuffer): AODKHeader {
        const view = new DataView(buffer);
        let offset = 0;

        const magic = new Uint8Array(buffer, offset, 4);
        offset += 4;

        const version = view.getUint16(offset, true);
        offset += 2;

        const headerSize = view.getUint32(offset, true);
        offset += 4;

        const key = new Uint8Array(buffer, offset, 32);
        offset += 32;

        const nonce = new Uint8Array(buffer, offset, 24);
        offset += 24;

        const uuid = new Uint8Array(buffer, offset, 32);
        offset += 32;

        const fileHash = new Uint8Array(buffer, offset, 32);
        offset += 32;

        const originalFileSize = view.getBigUint64(offset, true);
        offset += 8;

        const filenameLength = view.getUint16(offset, true);
        offset += 2;

        const filenameBytes = new Uint8Array(buffer, offset, filenameLength);
        const filename = new TextDecoder().decode(filenameBytes);
        offset += filenameLength;

        // attachment – 剩余字节为附件（不计入 HeaderSize）
        let attachment: Uint8Array | undefined;
        if (offset < buffer.byteLength) {
            attachment = new Uint8Array(buffer, offset, buffer.byteLength - offset);
        }

        return {
            magic, version, headerSize, key, nonce, uuid,
            fileHash, originalFileSize, filenameLength, filename,
            attachment,
        };
    }

    /** 序列化 AODF Header（固定 42 字节） */
    static serializeAODF(header: AODFHeader): ArrayBuffer {
        const buffer = new ArrayBuffer(AODF_HEADER_SIZE);
        const view = new DataView(buffer);
        let offset = 0;

        new Uint8Array(buffer, offset, 4).set(AODF_MAGIC);
        offset += 4;
        view.setUint16(offset, AODF_VERSION, true);
        offset += 2;
        view.setUint32(offset, AODF_HEADER_SIZE, true);
        offset += 4;
        new Uint8Array(buffer, offset, 32).set(header.uuid);
        offset += 32;

        return buffer;
    }

    /** 反序列化 AODF Header */
    static deserializeAODF(buffer: ArrayBuffer): AODFHeader {
        const view = new DataView(buffer);
        let offset = 0;
        const magic = new Uint8Array(buffer, offset, 4);
        offset += 4;
        const version = view.getUint16(offset, true);
        offset += 2;
        const headerSize = view.getUint32(offset, true);
        offset += 4;
        const uuid = new Uint8Array(buffer, offset, 32);
        offset += 32;
        return { magic, version, headerSize, uuid };
    }

    /** 验证 AODK Magic */
    static validateAODKMagic(magic: Uint8Array): boolean {
        return magic.length === AODK_MAGIC.length &&
            magic.every((b, i) => b === AODK_MAGIC[i]);
    }

}