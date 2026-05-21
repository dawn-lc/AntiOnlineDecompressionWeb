import { EventBus } from '../shared/EventBus';
import { FileIOManager } from './FileIOManager';
import { HeaderSerializer } from '../shared/schemas/serializer';
import type { MainThreadMessage } from '../shared/MessageTypes';
import { AODF_HEADER_SIZE, CHUNK_SIZE, ABYTES } from '../shared/constants';
import { createFileSaver } from './SaveHelper';
import type { FileSaver } from './SaveHelper';
import { formatBytes } from '../shared/formatBytes';
import { computeFileHash } from '../shared/computeFileHash';
import { compareUUID } from '../shared/compareUUID';
import { t } from '../shared/i18n';

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
                    console.debug('[AppController] Worker READY: key=', msg.key.length, 'header=', msg.header.length);
                    this.resolveWorkerReady?.({ header: msg.header, key: msg.key });
                    break;
                }
                case 'CHUNK_RESULT': {
                    this.resolveChunkProcessed?.(msg.data);
                    break;
                }
                case 'HASH_RESULT': {
                    console.debug(`[Hash] 文件哈希计算完成: ${Array.from(msg.hash).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)}...`);
                    break;
                }
                case 'DECRYPT_READY': {
                    console.debug('[AppController] DECRYPT_READY 收到');
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
        console.info(t('console.encryptStart', { name: file.name, size: formatBytes(file.size) }));

        let aodkSaver = await createFileSaver(`${file.name}.aodk`);
        let aodfSaver = await createFileSaver(`${file.name}.aodf`);

        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        try {
            await this.initWorker();
            const { key, header: streamHeader } = await this.sendAndWaitForEncryptReady();
            console.debug(`[AppController] 得到真实加密 key: ${key.length}bytes, streamHeader: ${streamHeader.length}bytes`);

            const uuid = crypto.getRandomValues(new Uint8Array(32));
            const aodfHeaderBuf = HeaderSerializer.serializeAODF({
                magic: new Uint8Array([0x41, 0x4F, 0x44, 0x46]),
                version: 1,
                headerSize: AODF_HEADER_SIZE,
                uuid,
            });
            await aodfSaver.write(aodfHeaderBuf.slice(0) as ArrayBuffer);

            console.info(`[AppController] 开始流式加密, 文件大小: ${file.size}bytes`);
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

            if (signal.aborted) {
                throw new DOMException('操作已取消', 'AbortError');
            }

            await aodfSaver.close();
            aodfSaver = null as any;
            this.eventBus.emit('progressUpdate', file.size, file.size);

            // 计算文件哈希
            const originalFileSize = BigInt(file.size);
            const filenameBytes = new TextEncoder().encode(file.name);
            const fileHash = await computeFileHash(file);

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
                attachment: undefined,
            };
            const aodkBuffer = HeaderSerializer.serializeAODK(aodkHeader);
            const aodkBuf = aodkBuffer.slice(0) as ArrayBuffer;
            await aodkSaver.write(aodkBuf);
            await aodkSaver.close();
            aodkSaver = null as any;

            this.cleanupWorker();
            console.info(`[加密] 密钥文件已保存: ${file.name}.aodk`);
            console.info(t('console.encryptComplete'));
            this.eventBus.emit('complete');
            this.eventBus.emit('statusChange', 'done');
        } catch (err: any) {
            try { aodfSaver?.close(); } catch { }
            try { aodkSaver?.close(); } catch { }
            if (err.name === 'AbortError') {
                console.warn(t('console.cancelled'));
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
        console.info(t('console.decryptStart', { name: aodfFile.name }));

        this.abortController = new AbortController();
        const signal = this.abortController.signal;
        let outputSaver: FileSaver | null = null;

        try {
            const aodkHeader = await this.fileIO.parseAODKFile(aodkFile);
            const key = aodkHeader.key;
            const streamHeader = aodkHeader.nonce;
            const originalFilename = aodkHeader.filename;

            console.info(`[Decrypt] 原始文件名: ${originalFilename}`);
            console.info(`[Decrypt] 原始文件大小: ${formatBytes(Number(aodkHeader.originalFileSize))}`);

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
            if (!compareUUID(aodkUUID, aodfUUID)) {
                throw new Error('AODK 文件与 AODF 文件的 UUID 不匹配，无法解密');
            }
            console.info('[Decrypt] UUID 验证通过');

            // 5. 发送 INIT_DECRYPT 到 Worker 并等待 DECRYPT_READY
            console.debug(`[AppController] 发送 INIT_DECRYPT: key=${key.length}bytes, streamHeader=${streamHeader.length}bytes`);
            await this.sendDecryptInit(key, streamHeader);

            // 6. 使用 ReadableStream 流式解密（跳过 AODF Header）
            const bodyOffset = AODF_HEADER_SIZE;
            console.info(`[AppController] 读取加密体, offset=${bodyOffset}, 文件总大小=${aodfFile.size}`);
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

            // 检查是否被取消
            if (signal?.aborted) {
                throw new DOMException('操作已取消', 'AbortError');
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
            console.info(t('console.decryptComplete', { name: originalFilename }));
            this.eventBus.emit('statusChange', 'done');
        } catch (err: any) {
            try { outputSaver?.close(); } catch { }
            if (err.name === 'AbortError' || err.name === 'SecurityError') {
                console.warn(t('console.cancelled'));
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

    /** 清理 Worker */
    private cleanupWorker(): void {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }

}