import { CHUNK_SIZE } from '../shared/constants';

export class FileIOManager {
    /** 从用户选择的文件中读取指定长度的字节（用于读取 AODK/AODF 头部） */
    async readHeaderFromFile(file: File, size: number): Promise<ArrayBuffer> {
        const blob = file.slice(0, size);
        return await blob.arrayBuffer();
    }

    /** 将加密文件流式读入并分块发送到 Worker */
    async readAndProcess(
        file: File,
        onChunk: (chunk: Uint8Array, isLast: boolean) => void,
        signal?: AbortSignal
    ): Promise<void> {
        const stream = file.stream();
        const reader = stream.getReader();
        let buffer = new Uint8Array(0);

        try {
            while (true) {
                if (signal?.aborted) {
                    return;
                }

                const { done, value } = await reader.read();
                if (done) {
                    // 发送剩余数据作为最后一块
                    if (buffer.length > 0) {
                        await onChunk(buffer, true);
                    } else {
                        await onChunk(new Uint8Array(0), true);
                    }
                    break;
                }

                // 合并到缓冲区
                const newBuf = new Uint8Array(buffer.length + value.length);
                newBuf.set(buffer);
                newBuf.set(value, buffer.length);
                buffer = newBuf;

                // 只发送完整的 CHUNK_SIZE 块，确保加密块大小一致
                while (buffer.length >= CHUNK_SIZE) {
                    const chunk = buffer.slice(0, CHUNK_SIZE);
                    buffer = buffer.slice(CHUNK_SIZE);
                    await onChunk(chunk, false);
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

}