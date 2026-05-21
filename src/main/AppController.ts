import { EventBus } from '../shared/EventBus';
import { FileIOManager } from './FileIOManager';
import { KeyFileManager } from './KeyFileManager';
import { HeaderSerializer } from '../shared/schemas/serializer';
import type { MainThreadMessage } from '../shared/MessageTypes';
import { AODF_HEADER_SIZE, CHUNK_SIZE, ABYTES } from '../shared/constants';
import { createFileSaver } from './SaveHelper';
import type { FileSaver } from './SaveHelper';
import { formatBytes } from '../shared/formatBytes';

export class AppController {
    private worker: Worker | null = null;
    private abortController: AbortController | null = null;

    // Promise resolve/reject 回调
    private resolveWorkerReady: ((value: { header: Uint8Array; key: Uint8Array }) => void) | null = null;
    private resolveChunkProcessed: ((data: Uint8Array) => void) | null = null;
    private resolveDecryptReady: (() => void) | null = null;
    private rejectWorkerError: ((err: Error) => void) | null = null;

    constructor(
        private eventBus: EventBus,
        private fileIO: FileIOManager,
        private keyFile: KeyFileManager,
    ) {
        // 监听取消事件，中断正在进行的加解密
        eventBus.on('cancel', () => {
            this.abortController?.abort();
        });
    }

    /** 初始化 Worker */
    private async initWorker(): Promise<void> {
        this.worker = new Worker('worker.js', { type: 'module' });

        this.worker.onmessage = (e: MessageEvent<MainThreadMessage>) => {
            const msg = e.data;
            switch (msg.type) {
                case 'READY': {
                    console.log('[AppController] Worker READY: key=', msg.key.length, 'header=', msg.header.length);
                    this.resolveWorkerReady?.({ header: msg.header, key: msg.key });
                    break;
                }
                case 'CHUNK_RESULT': {
                    this.resolveChunkProcessed?.(msg.data);
                    break;
                }
                case 'HASH_RESULT': {
                    console.log(`[Hash] 文件哈希计算完成: ${Array.from(msg.hash).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)}...`);
                    break;
                }
                case 'DECRYPT_READY': {
                    console.log('[AppController] DECRYPT_READY 收到');
                    this.resolveDecryptReady?.();
                    break;
                }
                case 'ERROR': {
                    console.error('[AppController] Worker 错误:', msg.message);
                    this.eventBus.emit('error', msg.message);
                    this.rejectWorkerError?.(new Error(msg.message));
                    break;
                }
            }
        };

        this.worker.onerror = (err) => {
            const msg = `Worker 错误: ${err.message}`;
            this.eventBus.emit('error', msg);
            this.rejectWorkerError?.(new Error(msg));
        };
    }

    /** 加密主流程 */
    async encrypt(file: File): Promise<void> {
        this.eventBus.emit('start');
        console.log(`[加密] 开始加密文件: ${file.name} (${formatBytes(file.size)})`);

        // 必须在任何 await 之前弹出保存对话框（浏览器要求 showSaveFilePicker 在用户手势中调用）
        // 移动端不支持 showSaveFilePicker，回退到 Blob 下载
        let aodkSaver = await createFileSaver(`${file.name}.aodk`);
        let aodfSaver = await createFileSaver(`${file.name}.aodf`);

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
            // 1. 初始化 Worker
            await this.initWorker();

            // 2. 发送 INIT_ENCRYPT 到 Worker，等待返回 stream header 和 key
            const { key, header: streamHeader } = await this.sendAndWaitForEncryptReady();
            console.log(`[AppController] 得到真实加密 key: ${key.length}bytes, streamHeader: ${streamHeader.length}bytes`);

            // 3. 写入 AODF Header + stream header 到输出
            const uuid = crypto.getRandomValues(new Uint8Array(32));
            const aodfHeaderBuf = HeaderSerializer.serializeAODF({
                magic: new Uint8Array([0x41, 0x4F, 0x44, 0x46]),
                version: 1,
                uuid,
                headerSize: AODF_HEADER_SIZE,
            });
            await aodfSaver.write(aodfHeaderBuf.slice(0) as ArrayBuffer);
            const streamHeaderBuf = streamHeader.slice(0).buffer as ArrayBuffer;
            await aodfSaver.write(streamHeaderBuf);

            // 4. 流式加密
            console.log(`[AppController] 开始流式加密, 文件大小: ${file.size}bytes`);
            this.eventBus.emit('progressUpdate', 0, file.size);
            let encryptBytesDone = 0;
            let lastProgressTime = 0;
            const PROGRESS_THROTTLE = 200;
            await this.fileIO.readAndProcess(file, async (chunk, isLast) => {
                const chunkLen = chunk.length;
                const encrypted = await this.sendChunkToWorker(chunk, isLast);
                if (encrypted.length > 0) {
                    await aodfSaver.write(encrypted);
                }
                if (chunkLen > 0) {
                    encryptBytesDone += chunkLen;
                    const now = Date.now();
                    if (now - lastProgressTime >= PROGRESS_THROTTLE) {
                        lastProgressTime = now;
                        this.eventBus.emit('progressUpdate', encryptBytesDone, file.size);
                    }
                }
            }, signal);

            // 5. 关闭 AODF 输出
            await aodfSaver.close();
            aodfSaver = null as any;

            // 6. 确保进度条显示 100%
            this.eventBus.emit('progressUpdate', file.size, file.size);

            // 7. 计算文件哈希
            const originalFileSize = BigInt(file.size);
            const filenameBytes = new TextEncoder().encode(file.name);
            const fileHash = await this.computeFileHash(file);

            // 8. 构建并写入 AODK 密钥文件
            const aodkHeader = {
                magic: new Uint8Array([0x41, 0x4F, 0x44, 0x4B]),
                version: 1,
                headerSize: 0,
                key,
                nonce: streamHeader,
                uuid,
                fileHash,
                originalFileSize,
                filenameLength: filenameBytes.length,
                filename: file.name,
            };
            const aodkBuffer = HeaderSerializer.serializeAODK(aodkHeader);
            const aodkBuf = aodkBuffer.slice(0) as ArrayBuffer;
            await aodkSaver.write(aodkBuf);
            await aodkSaver.close();
            aodkSaver = null as any;

            // 9. 清理
            this.cleanupWorker();
            console.log(`[加密] 密钥文件已保存: ${file.name}.aodk`);
            console.log('[加密] 加密完成！AODK 密钥文件和 AODF 加密文件已保存。');
            this.eventBus.emit('complete');
            this.eventBus.emit('statusChange', 'done');
        } catch (err: any) {
            try { aodfSaver?.close(); } catch { }
            try { aodkSaver?.close(); } catch { }
            if (err.name === 'AbortError') {
                console.log('[加密] 操作已取消');
            } else {
                const msg = err instanceof Error ? err.message : String(err);
                this.eventBus.emit('error', `加密失败: ${msg}`);
            }
            this.cleanupWorker();
            this.eventBus.emit('statusChange', 'idle');
        }
    }

    /** 解密主流程 */
    async decrypt(aodkFile: File, aodfFile: File): Promise<void> {
        this.eventBus.emit('start');
        console.log(`[解密] 开始解密文件: ${aodfFile.name}`);

        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        let outputSaver: FileSaver | null = null;

        try {
            // 1. 解析 AODK 文件，获取原始文件名
            const aodkHeader = await this.keyFile.parseAODKFile(aodkFile);
            const key = aodkHeader.key;
            const streamHeader = aodkHeader.nonce;
            const originalFilename = aodkHeader.filename;

            console.log(`[Decrypt] 原始文件名: ${originalFilename}`);
            console.log(`[Decrypt] 原始文件大小: ${formatBytes(Number(aodkHeader.originalFileSize))}`);

            // 使用原始文件名作为保存文件名（后缀名自动保留）
            const suggestedName = originalFilename || 'decrypted_output';
            outputSaver = await createFileSaver(suggestedName);

            // 2. 初始化 Worker
            await this.initWorker();

            // 3. 读取 AODF Header 验证 UUID
            const aodfHeaderBuf = await this.fileIO.readHeaderFromFile(aodfFile, AODF_HEADER_SIZE);
            const aodfHeader = HeaderSerializer.deserializeAODF(aodfHeaderBuf);

            // 4. 验证 UUID 匹配
            const aodkUUID = aodkHeader.uuid;
            const aodfUUID = aodfHeader.uuid;
            if (!this.compareUUID(aodkUUID, aodfUUID)) {
                throw new Error('AODK 文件与 AODF 文件的 UUID 不匹配，无法解密');
            }
            console.log('[Decrypt] UUID 验证通过');

            // 5. 发送 INIT_DECRYPT 到 Worker 并等待 DECRYPT_READY
            console.log(`[AppController] 发送 INIT_DECRYPT: key=${key.length}bytes, streamHeader=${streamHeader.length}bytes`);
            await this.sendDecryptInit(key, streamHeader);

            // 6. 使用 ReadableStream 流式解密（跳过 AODF Header + stream header）
            const bodyOffset = AODF_HEADER_SIZE + streamHeader.length;
            console.log(`[AppController] 读取加密体, offset=${bodyOffset}, 文件总大小=${aodfFile.size}`);
            this.eventBus.emit('progressUpdate', 0, aodfFile.size - bodyOffset);

            const totalBodySize = aodfFile.size - bodyOffset;
            const origSizeNum = Number(aodkHeader.originalFileSize);
            const ABYTES_VAL = ABYTES;
            const totalDataChunks = Math.ceil(origSizeNum / CHUNK_SIZE);
            let lastDecProgressTime = 0;
            const DEC_PROGRESS_THROTTLE = 200;

            // 创建 ReadableStream 逐块读取，避免 Blob.slice().arrayBuffer() 的中间对象开销
            const stream = aodfFile.stream();
            const reader = stream.getReader();
            let buffer = new Uint8Array(0);
            let bytesProcessed = 0;

            // 跳过头部（注意：stream 返回的块可能跨越 header/body 边界）
            let skipRemaining = bodyOffset;
            while (skipRemaining > 0) {
                if (signal?.aborted) { this.eventBus.emit('cancel'); break; }
                const { done, value } = await reader.read();
                if (done) throw new Error('读取加密文件头部时意外结束');
                if (value.length > skipRemaining) {
                    // 当前块包含 header 尾部 + body 头部，将 body 部分保留到 buffer
                    const excess = value.slice(skipRemaining);
                    const newBuf = new Uint8Array(buffer.length + excess.length);
                    newBuf.set(buffer);
                    newBuf.set(excess, buffer.length);
                    buffer = newBuf;
                    skipRemaining = 0;
                } else {
                    skipRemaining -= value.length;
                }
            }

            // 从流中读取精确字节数的辅助函数
            const readExact = async (size: number): Promise<Uint8Array> => {
                while (buffer.length < size) {
                    if (signal?.aborted) { this.eventBus.emit('cancel'); return new Uint8Array(0); }
                    const { done, value } = await reader.read();
                    if (done) break;
                    const newBuf = new Uint8Array(buffer.length + value.length);
                    newBuf.set(buffer);
                    newBuf.set(value, buffer.length);
                    buffer = newBuf;
                }
                const chunk = buffer.slice(0, size);
                buffer = buffer.slice(size);
                return chunk;
            };

            // 计算第 i 个加密分块的大小
            const getEncChunkSize = (chunkIndex: number): number => {
                const isLastDataChunk = chunkIndex >= totalDataChunks - 1;
                const plainSize = isLastDataChunk
                    ? (origSizeNum % CHUNK_SIZE || CHUNK_SIZE)
                    : CHUNK_SIZE;
                return plainSize + ABYTES_VAL;
            };

            // 流水线：预读下一个分块，与 Worker 处理重叠
            let nextReadPromise: Promise<Uint8Array> = readExact(getEncChunkSize(0));

            for (let chunkIndex = 0; chunkIndex < totalDataChunks; chunkIndex++) {
                if (signal?.aborted) { this.eventBus.emit('cancel'); break; }

                // 等待当前分块读取完成
                const encChunk = await nextReadPromise;
                if (encChunk.length === 0 && signal?.aborted) break;

                // 预读下一个分块（与后续 Worker 处理并行）
                if (chunkIndex < totalDataChunks - 1) {
                    nextReadPromise = readExact(getEncChunkSize(chunkIndex + 1));
                }

                bytesProcessed += encChunk.length;

                // 发送到 Worker 解密
                const decrypted = await this.sendDecryptChunkToWorker(encChunk, false);
                if (decrypted && decrypted.length > 0) {
                    await outputSaver.write(decrypted);
                }

                const now = Date.now();
                if (now - lastDecProgressTime >= DEC_PROGRESS_THROTTLE) {
                    lastDecProgressTime = now;
                    this.eventBus.emit('progressUpdate', bytesProcessed, totalBodySize);
                }
            }

            // 消费流中可能剩余的尾部数据（安全兜底）
            if (!signal?.aborted) {
                while (buffer.length > 0) {
                    const remaining = buffer;
                    buffer = new Uint8Array(0);
                    const finalResult = await this.sendDecryptChunkToWorker(remaining, true);
                    if (finalResult && finalResult.length > 0) {
                        await outputSaver.write(finalResult);
                    }
                }
                // 继续读完流，确保 reader 释放前流被消耗完
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (value.length > 0) {
                        const finalResult = await this.sendDecryptChunkToWorker(value, true);
                        if (finalResult && finalResult.length > 0) {
                            await outputSaver.write(finalResult);
                        }
                    }
                }
            }

            // 释放流
            try { reader.releaseLock(); } catch { /* ignore */ }

            await outputSaver.close();
            outputSaver = null as any;

            this.eventBus.emit('progressUpdate', totalBodySize, totalBodySize);

            this.cleanupWorker();
            this.eventBus.emit('complete');
            console.log(`[解密] 解密完成！文件已保存为: ${originalFilename}`);
            this.eventBus.emit('statusChange', 'done');
        } catch (err: any) {
            try { outputSaver?.close(); } catch { }
            if (err.name === 'AbortError' || err.name === 'SecurityError') {
                console.log('[解密] 操作已取消');
            } else {
                const msg = err instanceof Error ? err.message : String(err);
                this.eventBus.emit('error', `解密失败: ${msg}`);
            }
            this.cleanupWorker();
            this.eventBus.emit('statusChange', 'idle');
        }
    }



    /** 发送 INIT_ENCRYPT 并等待 HEADER + KEY 回复 */
    private sendAndWaitForEncryptReady(): Promise<{ header: Uint8Array; key: Uint8Array }> {
        return new Promise((resolve, reject) => {
            this.resolveWorkerReady = (value) => {
                this.resolveWorkerReady = null;
                resolve(value);
            };
            this.rejectWorkerError = (err) => {
                this.rejectWorkerError = null;
                reject(err);
            };
            this.worker?.postMessage({ type: 'INIT_ENCRYPT' });
        });
    }

    /** 发送一个 chunk 到 Worker 加密并等待结果 */
    private sendChunkToWorker(chunk: Uint8Array, isLast: boolean): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            this.resolveChunkProcessed = (data) => {
                this.resolveChunkProcessed = null;
                resolve(data);
            };
            this.rejectWorkerError = (err) => {
                this.rejectWorkerError = null;
                reject(err);
            };
            const transfer = chunk.buffer.byteLength > 0 ? [chunk.buffer] : [];
            this.worker?.postMessage(
                { type: 'ENCRYPT_CHUNK', chunk, isLast },
                { transfer }
            );
        });
    }

    /** 发送 INIT_DECRYPT 到 Worker，并等待 DECRYPT_READY */
    private sendDecryptInit(key: Uint8Array, header: Uint8Array): Promise<void> {
        return new Promise((resolve, reject) => {
            this.resolveDecryptReady = () => {
                this.resolveDecryptReady = null;
                resolve();
            };
            this.rejectWorkerError = (err) => {
                this.rejectWorkerError = null;
                reject(err);
            };
            // 注意：key 和 header 可能共享同一个 ArrayBuffer（来自 AODK 文件解析）
            // 需要复制两者，避免 transfer 时 duplicate ArrayBuffer 错误
            const keyCopy = key.slice();
            const headerCopy = header.slice();
            this.worker?.postMessage(
                { type: 'INIT_DECRYPT', key: keyCopy, header: headerCopy },
                { transfer: [keyCopy.buffer, headerCopy.buffer] }
            );
        });
    }

    /** 发送解密 chunk 到 Worker 并等待结果 */
    private sendDecryptChunkToWorker(chunk: Uint8Array, isLast: boolean): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            this.resolveChunkProcessed = (data) => {
                this.resolveChunkProcessed = null;
                resolve(data);
            };
            this.rejectWorkerError = (err) => {
                this.rejectWorkerError = null;
                reject(err);
            };
            const transfer = chunk.buffer.byteLength > 0 ? [chunk.buffer] : [];
            this.worker?.postMessage(
                { type: 'DECRYPT_CHUNK', chunk, isLast },
                { transfer }
            );
        });
    }

    /** 计算文件哈希（BLAKE2b 增量哈希） */
    private async computeFileHash(file: File): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            const stream = file.stream();
            const reader = stream.getReader();

            const hashWorker = new Worker('worker.js', { type: 'module' });

            hashWorker.onmessage = (e: MessageEvent<any>) => {
                const msg = e.data;
                if (msg.type === 'HASH_RESULT') {
                    hashWorker.terminate();
                    resolve(msg.hash);
                } else if (msg.type === 'ERROR') {
                    hashWorker.terminate();
                    reject(new Error(msg.message));
                }
            };

            hashWorker.onerror = (err) => {
                hashWorker.terminate();
                reject(new Error(`Hash Worker 错误: ${err.message}`));
            };

            hashWorker.postMessage({ type: 'INIT_ENCRYPT' });

            (async () => {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        hashWorker.postMessage({ type: 'COMPUTE_HASH', chunk: new Uint8Array(0), isLast: true });
                        break;
                    }
                    let offset = 0;
                    while (offset < value.length) {
                        const end = Math.min(offset + 65536, value.length);
                        const chunk = value.slice(offset, end);
                        offset = end;
                        hashWorker.postMessage(
                            { type: 'COMPUTE_HASH', chunk, isLast: false },
                            chunk.buffer.byteLength > 0 ? { transfer: [chunk.buffer] } as any : {}
                        );
                    }
                }
            })().catch(reject);
        });
    }

    /** 比较两个 UUID 是否相等 */
    private compareUUID(a: Uint8Array, b: Uint8Array): boolean {
        if (a.length !== b.length) return false;
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a[i] ^ b[i];
        }
        return result === 0;
    }

    /** 清理 Worker */
    private cleanupWorker(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }

}