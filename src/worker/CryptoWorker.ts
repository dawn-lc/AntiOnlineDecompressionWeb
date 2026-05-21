import { getSodium } from './WasmLoader';
import { StreamEncryptor } from './StreamEncryptor';
import { StreamDecryptor } from './StreamDecryptor';
import { HashCalculator } from './HashCalculator';
import type { WorkerMessage, MainThreadMessage } from '../shared/MessageTypes';

let encryptor: StreamEncryptor | null = null;
let decryptor: StreamDecryptor | null = null;
let hasher: HashCalculator | null = null;

function postToMain(msg: MainThreadMessage): void {
    self.postMessage(msg);
}

let chunkCounter = 0;
let byteCounter = 0;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const msg = e.data;

    try {
        switch (msg.type) {
            case 'INIT_ENCRYPT': {
                chunkCounter = 0;
                byteCounter = 0;
                console.log('[Worker] INIT_ENCRYPT 开始...');
                const sodium = await getSodium();
                console.log('[Worker] Sodium 加载完成, 创建 StreamEncryptor...');
                encryptor = await StreamEncryptor.create(sodium);
                const header = encryptor.getHeader();
                const key = encryptor.key;
                console.log(`[Worker] StreamEncryptor 创建完成, header=${header.length}bytes, key=${key.length}bytes`);
                // 发送 header 和 key 到主线程
                postToMain({ type: 'READY', header, key });
                break;
            }
            case 'ENCRYPT_CHUNK': {
                if (!encryptor) {
                    postToMain({ type: 'ERROR', message: '加密器未初始化' });
                    break;
                }
                chunkCounter++;
                byteCounter += msg.chunk.length;
                if (chunkCounter % 10 === 1) {
                    console.log(`[Worker] ENCRYPT_CHUNK #${chunkCounter}, size=${msg.chunk.length}, total=${byteCounter}, isLast=${msg.isLast}`);
                }
                const encrypted = encryptor.push(msg.chunk, msg.isLast);
                if (msg.isLast) {
                    console.log(`[Worker] 加密完成! 共 ${chunkCounter} 个chunk, ${byteCounter} bytes`);
                }
                postToMain({ type: 'CHUNK_RESULT', data: encrypted, isLast: msg.isLast });
                break;
            }
            case 'INIT_DECRYPT': {
                chunkCounter = 0;
                byteCounter = 0;
                console.log(`[Worker] INIT_DECRYPT 开始... key=${msg.key?.length}bytes, header=${msg.header?.length}bytes`);
                const sodium = await getSodium();
                console.log('[Worker] Sodium 加载完成, 创建 StreamDecryptor...');
                decryptor = StreamDecryptor.create(sodium, msg.key, msg.header);
                console.log('[Worker] StreamDecryptor 创建完成');
                postToMain({ type: 'DECRYPT_READY' });
                break;
            }
            case 'DECRYPT_CHUNK': {
                if (!decryptor) {
                    postToMain({ type: 'ERROR', message: '解密器未初始化' });
                    break;
                }
                chunkCounter++;
                byteCounter += msg.chunk.length;
                if (chunkCounter % 10 === 1) {
                    console.log(`[Worker] DECRYPT_CHUNK #${chunkCounter}, size=${msg.chunk.length}, total=${byteCounter}, isLast=${msg.isLast}`);
                }
                const result = decryptor.pull(msg.chunk);
                if (!result || !result.message) {
                    // pull 返回空结果，可能是数据不完整或验证失败
                    postToMain({ type: 'ERROR', message: `解密块 #${chunkCounter} 失败: pull 返回空结果` });
                    break;
                }
                const isLast = decryptor.isFinalTag(result.tag);
                if (chunkCounter % 10 === 1) {
                    console.log(`[Worker] DECRYPT_CHUNK #${chunkCounter} 结果: message=${result.message.length}bytes, tag=${result.tag}, isLast=${isLast}`);
                }
                postToMain({ type: 'CHUNK_RESULT', data: result.message, isLast });
                break;
            }
            case 'COMPUTE_HASH': {
                const sodium = await getSodium();
                if (!hasher) {
                    hasher = HashCalculator.create(sodium);
                    console.log('[Worker] HashCalculator 创建完成');
                }
                hasher.update(msg.chunk);
                if (msg.isLast) {
                    const hash = hasher.final();
                    hasher = null; // reset for next use
                    console.log(`[Worker] 哈希计算完成: ${hash.length}bytes`);
                    postToMain({ type: 'HASH_RESULT', hash });
                }
                break;
            }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Worker] 错误:', message);
        postToMain({ type: 'ERROR', message });
    }
};

// 暴露 getSodium 以便其他模块使用（如果有需要）
console.log('[Worker] CryptoWorker 已加载');