/**
 * 使用 Web Worker 增量计算文件哈希（BLAKE2b）
 * 通过流式读取文件分块传递给 Worker，避免加载整个文件到内存
 */
export function computeFileHash(file: File): Promise<Uint8Array> {
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
                        chunk.buffer.byteLength > 0 ? { transfer: [chunk.buffer] } satisfies StructuredSerializeOptions : {}
                    );
                }
            }
        })().catch(reject);
    });
}
