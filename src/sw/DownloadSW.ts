/**
 * ServiceWorker - 流式文件下载
 *
 * 通过在 SW 中维护 ReadableStream，主线程发送解密后的分块，
 * SW 将分块通过流式 Response 返回给浏览器下载请求，
 * 全程无需在内存中累积完整文件。
 *
 * 协议（主线程 ↔ SW）：
 *   PREPARE_DOWNLOAD { id, filename } → SW 创建流，回复 DOWNLOAD_READY
 *   WRITE_CHUNK      { id, chunk }    → 将数据块写入流
 *   CLOSE_STREAM     { id }           → 关闭流，下载完成
 *
 * 浏览器请求 /sw-stream/<id> 时，SW 以流式 Response 响应，
 * 设置 Content-Disposition 触发下载。
 */

// @ts-nocheck — ServiceWorker 全局类型与 DOM lib 冲突，esbuild 构建无影响
/// <reference lib="webworker" />

interface StreamEntry {
    readable: ReadableStream<Uint8Array>;
    controller: ReadableStreamDefaultController<Uint8Array>;
    filename: string;
}

const streams = new Map<string, StreamEntry>();

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
        case 'PREPARE_DOWNLOAD': {
            const { id, filename } = msg;
            let controller: ReadableStreamDefaultController<Uint8Array>;
            const readable = new ReadableStream<Uint8Array>({
                start(c) { controller = c; },
                cancel() { streams.delete(id); },
            });
            streams.set(id, { readable, controller: controller!, filename });
            (event.source as any)?.postMessage({ type: 'DOWNLOAD_READY', id });
            break;
        }
        case 'WRITE_CHUNK': {
            const entry = streams.get(msg.id);
            if (!entry) break;
            const chunk = msg.chunk instanceof ArrayBuffer
                ? new Uint8Array(msg.chunk)
                : new Uint8Array(msg.chunk);
            try {
                entry.controller.enqueue(chunk);
            } catch { /* ignore */ }
            break;
        }
        case 'CLOSE_STREAM': {
            const entry = streams.get(msg.id);
            if (!entry) break;
            try { entry.controller.close(); } catch { /* ignore */ }
            streams.delete(msg.id);
            break;
        }
    }
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const match = url.pathname.match(/^\/sw-stream\/([a-f0-9-]+)$/);
    if (!match) return;

    const id = match[1];

    const respond = async (): Promise<Response> => {
        for (let i = 0; i < 600; i++) {
            const entry = streams.get(id);
            if (entry) {
                return new Response(entry.readable, {
                    headers: {
                        'Content-Disposition': `attachment; filename="${encodeURIComponent(entry.filename)}"`,
                        'Content-Type': 'application/octet-stream',
                        'Cache-Control': 'no-store',
                    },
                });
            }
            await new Promise(r => setTimeout(r, 100));
        }
        return new Response('Stream timeout', { status: 408 });
    };

    event.respondWith(respond());
});
