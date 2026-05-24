import { CHUNK_SIZE } from '../shared/constants';
import { HeaderSerializer } from '../shared/schemas/serializer';
import type { AODKHeader } from '../shared/schemas/aodk';

// ====== FSAA 保存 ======

export interface FileSaver {
    write(data: ArrayBuffer | Uint8Array): Promise<void>;
    close(): Promise<void>;
}

/** 标记表示浏览器不支持 FSAA，而非用户取消 */
export class FSAAUnsupportedError extends Error {
    constructor() {
        super('FSAA_UNSUPPORTED');
        this.name = 'FSAAUnsupportedError';
    }
}

/** showSaveFilePicker 超时（毫秒），超过视为 API 不可用（如微信 X5 内核的假函数挂起） */
const FSAA_TIMEOUT = 10_000;

/** 单个文件保存（使用 showSaveFilePicker） */
export async function createFileSaver(suggestedName: string): Promise<FileSaver> {
    if (!('showSaveFilePicker' in window) || typeof (window as any).showSaveFilePicker !== 'function') {
        throw new FSAAUnsupportedError();
    }
    const start = performance.now();
    try {
        const handle = await withTimeout(
            window.showSaveFilePicker!({ suggestedName }),
            FSAA_TIMEOUT,
            'showSaveFilePicker 超时',
        );
        const writable = await handle.createWritable();
        console.info(`[保存] FSAA showSaveFilePicker → ${suggestedName}`);
        return {
            write: async (data) => { await writable.write(data); },
            close: async () => { await writable.close(); },
        };
    } catch (err: any) {
        // 用户点击取消：AbortError 且耗时足够长（>200ms 说明对话框已正常显示）
        if (err.name === 'AbortError' && performance.now() - start > 200) {
            throw err; // 正常用户取消，往上抛
        }
        // 其他所有情况（TypeError / SecurityError / 快速 AbortError / 超时）→ API 不可用
        throw new FSAAUnsupportedError();
    }
}

/** 对 Promise 添加超时，超时时抛出 TimeoutError */
async function withTimeout<T>(promise: Promise<T>, ms: number, label?: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
            const err = new Error(label ?? '超时');
            err.name = 'TimeoutError';
            reject(err);
        }, ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

/** 一次性选择目录，同时创建 AODK + AODF 两个文件的 FileSaver
 * 避免连续两次 showSaveFilePicker 在部分平台（如 Android）上第二个调用失败的问题。
 * 若 showDirectoryPicker 不可用，降级为两次独立的 showSaveFilePicker。 */
export async function createFileSaverPair(
    aodkName: string,
    aodfName: string,
): Promise<[FileSaver, FileSaver]> {
    // 优先使用 showDirectoryPicker ─ 一次选择，写入两个文件
    if ('showDirectoryPicker' in window && typeof (window as any).showDirectoryPicker === 'function') {
        try {
            const dirHandle = await withTimeout(
                window.showDirectoryPicker!({ mode: 'readwrite' }),
                FSAA_TIMEOUT,
                'showDirectoryPicker 超时',
            );
            const aodkHandle = await dirHandle.getFileHandle(aodkName, { create: true });
            const aodfHandle = await dirHandle.getFileHandle(aodfName, { create: true });
            const aodkWritable = await aodkHandle.createWritable();
            const aodfWritable = await aodfHandle.createWritable();
            console.info(`[保存] showDirectoryPicker → ${aodkName}, ${aodfName}`);
            const make = (w: FileSystemWritableFileStream): FileSaver => ({
                write: async (data) => { await w.write(data); },
                close: async () => { await w.close(); },
            });
            return [make(aodkWritable), make(aodfWritable)];
        } catch (err: any) {
            // 目录选择器被取消或不可用，降级到两次 showSaveFilePicker
            if (err.name === 'AbortError' || err.name === 'SecurityError' || err.name === 'TimeoutError') {
                console.info('[保存] showDirectoryPicker 不可用，降级到 showSaveFilePicker');
            } else {
                throw err;
            }
        }
    }

    // 降级：两次独立的 showSaveFilePicker
    return [
        await createFileSaver(aodkName),
        await createFileSaver(aodfName),
    ];
}

export class FileIOManager {
    /** 读取并解析 AODK 密钥文件 */
    async parseAODKFile(file: File): Promise<AODKHeader> {
        const buffer = await file.arrayBuffer();
        const header = HeaderSerializer.deserializeAODK(buffer);
        if (!HeaderSerializer.validateAODKMagic(header.magic)) {
            throw new Error('无效的 AODK 文件：Magic 字节不匹配');
        }
        return header;
    }

    /** 从用户选择的文件中读取指定长度的字节（用于读取 AODK/AODF 头部） */
    async readHeaderFromFile(file: File, size: number): Promise<ArrayBuffer> {
        const blob = file.slice(0, size);
        return await blob.arrayBuffer();
    }

    /** 将 ReadableStream 包装为 AsyncGenerator，弥补 TS 类型对 ReadableStream async iterable 的支持缺口 */
    private async *iterateStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
        const reader = stream.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) return;
                yield value;
            }
        } finally {
            reader.releaseLock();
        }
    }

    /** 将文件流式读入并分块发送到 Worker */
    async readAndProcess(file: File, onChunk: (chunk: Uint8Array, isLast: boolean) => void | Promise<void>, signal?: AbortSignal): Promise<void> {
        const buf = new Uint8Array(CHUNK_SIZE * 2);
        let pos = 0;

        for await (const value of this.iterateStream(file.stream())) {
            if (signal?.aborted) return;

            let offset = 0;
            while (offset < value.length) {
                const space = buf.length - pos;
                const copyLen = Math.min(value.length - offset, space);
                buf.set(value.subarray(offset, offset + copyLen), pos);
                pos += copyLen;
                offset += copyLen;

                if (pos >= CHUNK_SIZE) {
                    const chunk = new Uint8Array(buf.subarray(0, CHUNK_SIZE));
                    const remaining = pos - CHUNK_SIZE;
                    if (remaining > 0) buf.copyWithin(0, CHUNK_SIZE, pos);
                    pos = remaining;
                    await onChunk(chunk, false);
                }
            }
        }

        await onChunk(
            pos > 0 ? new Uint8Array(buf.subarray(0, pos)) : new Uint8Array(0),
            true
        );
    }

}