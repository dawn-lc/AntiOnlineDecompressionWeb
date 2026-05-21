/** 保存文件辅助模块，按 FSAA → OPFS → SW → 内存 Blob 优先级自动降级 */

export interface FileSaver {
    write(data: ArrayBuffer | Uint8Array): Promise<void>;
    close(): Promise<void>;
}

let swReady = false;
let popupAllowed = false;

/** 注册 ServiceWorker（不阻塞主流程），用于流式下载回退 */
export function initSWDownload(): void {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then(reg => {
        if (reg.active) {
            swReady = true;
        } else {
            reg.addEventListener('activate', () => { swReady = true; });
        }
    }).catch(() => { });
}

/** 检测并请求弹窗权限，需在用户手势中调用（如首次点击按钮时） */
export function requestPopupPermission(): void {
    if (popupAllowed || isFirefox) return; // Firefox 弹窗拦截严格，跳过
    try {
        const win = window.open('', '_blank', 'width=1,height=1');
        if (win) {
            popupAllowed = true;
            win.close();
            console.info('[权限] 弹窗: ✅ 已允许');
        } else {
            console.warn('[权限] 弹窗: ❌ 被拦截，请允许此网站弹出窗口以使用流式下载');
        }
    } catch {
        console.warn('[权限] 弹窗检测失败');
    }
}

function isSWReady(): boolean {
    return swReady && navigator.serviceWorker.controller !== null;
}

/** 申请持久化存储等浏览器权限，不阻塞主流程 */
export async function requestRequiredPermissions(): Promise<void> {
    // 1. 持久化存储（OPFS/IndexedDB 数据不被自动清除）
    if (typeof navigator !== 'undefined' && 'storage' in navigator && 'persist' in navigator.storage) {
        try {
            const isPersisted = await navigator.storage.persisted();
            if (!isPersisted) {
                const granted = await navigator.storage.persist();
                console.info(`[权限] 持久化存储: ${granted ? '✅ 已授予' : '❌ 被拒绝'}`);
            } else {
                console.info('[权限] 持久化存储: ✅ 已有权限');
            }
        } catch (e) {
            console.warn('[权限] 持久化存储申请失败:', e);
        }
    }

    // 2. 查询 File System Access 权限状态（仅用于日志）
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
        try {
            // 查询 window-management / file-system 权限（部分浏览器支持）
            const permNames = ['persistent-storage' as PermissionName];
            for (const name of permNames) {
                const status = await navigator.permissions.query({ name });
                console.debug(`[权限] ${name}: ${status.state}`);
            }
        } catch { /* 浏览器不支持查询 */ }
    }
}

const isFirefox = typeof navigator !== 'undefined' && navigator.userAgent.includes('Firefox');

let forceFallback = false;
export function setForceFallback(v: boolean): void { forceFallback = v; }

export function isFileSystemAccessSupported(): boolean {
    if (forceFallback) return false;
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

/** FSAA: File System Access API */
async function createFSAASaver(suggestedName: string): Promise<FileSaver> {
    const handle = await (window as any).showSaveFilePicker({ suggestedName });
    const writable = await handle.createWritable();
    return {
        write: async (data: ArrayBuffer | Uint8Array) => {
            // writable.write() 直接接受 BufferSource，无需拷贝
            await writable.write(data);
        },
        close: async () => { await writable.close(); },
    };
}

/** showDirectoryPicker + OPFS（Chrome Android） */
async function createDirectorySaver(suggestedName: string): Promise<FileSaver | null> {
    try {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        const fileHandle = await dirHandle.getFileHandle(suggestedName, { create: true });
        const writable = await fileHandle.createWritable();
        let closed = false;
        return {
            write: async (data: ArrayBuffer | Uint8Array) => {
                await writable.write(normalizeChunk(data));
            },
            close: async () => {
                if (closed) return;
                closed = true;
                await writable.close();
            },
        };
    } catch (err: any) {
        // AbortError = 用户取消选择目录，不抛错，让上层降级
        if (err.name === 'AbortError' || err.name === 'SecurityError') return null;
        throw err;
    }
}

/** ServiceWorker 流式下载 */
async function createSWSaver(suggestedName: string): Promise<FileSaver | null> {
    if (!isSWReady()) return null;

    const id = crypto.randomUUID();
    const controller = navigator.serviceWorker.controller!;

    // 1. 通知 SW 准备流
    controller.postMessage({ type: 'PREPARE_DOWNLOAD', id, filename: suggestedName });

    // 2. 等待 SW 确认就绪
    const ready = new Promise<void>((resolve, reject) => {
        const onMessage = (e: MessageEvent) => {
            if (e.data?.type === 'DOWNLOAD_READY' && e.data?.id === id) {
                navigator.serviceWorker.removeEventListener('message', onMessage);
                resolve();
            }
        };
        navigator.serviceWorker.addEventListener('message', onMessage);
        // 超时保护
        setTimeout(() => { navigator.serviceWorker.removeEventListener('message', onMessage); reject(new Error('SW ready timeout')); }, 10000);
    });

    await ready;

    // 3. 立即在当前用户手势上下文中打开下载窗口（同步操作）
    const win = window.open(`/sw-stream/${id}`, '_blank');
    if (!win) {
        // 弹窗被拦截，降级
        controller.postMessage({ type: 'CLOSE_STREAM', id });
        return null;
    }

    let closed = false;
    return {
        write: async (data: ArrayBuffer | Uint8Array) => {
            if (closed) return;
            const transferOpts: StructuredSerializeOptions = {};
            if (data instanceof ArrayBuffer) {
                transferOpts.transfer = [data];
            } else if (data.buffer.byteLength > 0) {
                transferOpts.transfer = [data.buffer];
            }
            controller.postMessage(
                { type: 'WRITE_CHUNK', id, chunk: data },
                transferOpts
            );
        },
        close: async () => {
            if (closed) return;
            closed = true;
            controller.postMessage({ type: 'CLOSE_STREAM', id });
        },
    };
}

/** OPFS 中间存储 + Blob URL */
async function createOPFSSaver(suggestedName: string): Promise<FileSaver> {
    const root = await navigator.storage.getDirectory();
    const tmpName = `_tmp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const fileHandle = await root.getFileHandle(tmpName, { create: true });
    const writable = await fileHandle.createWritable();
    let closed = false;

    return {
        write: async (data: ArrayBuffer | Uint8Array) => {
            await writable.write(normalizeChunk(data));
        },
        close: async () => {
            if (closed) return;
            closed = true;
            await writable.close();
            const opfsFile = await fileHandle.getFile();
            // 触发下载，下载完成后自动清理 OPFS 临时文件
            triggerDownload(opfsFile, suggestedName, () => {
                root.removeEntry(tmpName).catch(() => { });
            });
        },
    };
}

/** 确保返回普通 ArrayBuffer 支撑的 Uint8Array，消除 SharedArrayBuffer 兼容问题 */
function normalizeChunk(data: ArrayBuffer | Uint8Array): Uint8Array<ArrayBuffer> {
    const raw = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (raw.buffer instanceof SharedArrayBuffer) {
        return new Uint8Array(raw) as Uint8Array<ArrayBuffer>;
    }
    return raw as Uint8Array<ArrayBuffer>;
}

/** 纯内存 Blob（最终回退） */
function createMemorySaver(suggestedName: string): FileSaver {
    const chunks: BlobPart[] = [];
    let closed = false;
    return {
        write: async (data: ArrayBuffer | Uint8Array) => {
            if (closed) return;
            chunks.push(new Uint8Array(data));
        },
        close: async () => {
            if (closed) return;
            closed = true;
            const blob = new Blob(chunks);
            triggerDownload(blob, suggestedName);
        },
    };
}

/**
 * 触发浏览器下载
 * 创建隐藏的 <a> 链接并模拟点击，所有浏览器统一使用延迟清理。
 * 延迟 10 秒足够 Firefox 启动下载，对 Chrome 也无影响。
 */
function triggerDownload(blobOrFile: Blob | File, filename: string, onDone?: () => void): void {
    const url = URL.createObjectURL(blobOrFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    // 统一延迟清理：Firefox 需保留元素到下载启动，其他浏览器同样安全
    setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
        onDone?.();
    }, 10000);
}

/** 根据浏览器能力自动选择最优方案创建 FileSaver */
export async function createFileSaver(suggestedName: string): Promise<FileSaver> {
    // 1. File System Access API（桌面端 + 部分移动端 Chrome）
    if (isFileSystemAccessSupported()) {
        return await createFSAASaver(suggestedName);
    }

    // 2. showDirectoryPicker + OPFS（Chrome Android 86+）
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        const saver = await createDirectorySaver(suggestedName);
        if (saver) return saver;
    }

    // 3. OPFS 中间存储 + Blob URL（处理过程低内存）
    try {
        return await createOPFSSaver(suggestedName);
    } catch {
        // OPFS 不可用，降级
    }

    // 4. ServiceWorker 流式下载（弹窗方案，同样保持低内存）
    if (!isFirefox && popupAllowed && isSWReady()) {
        try {
            const swSaver = await createSWSaver(suggestedName);
            if (swSaver) return swSaver;
        } catch { /* 失败则降级 */ }
    }

    // 5. 纯内存 Blob（高内存占用，仅作为最终回退）
    return createMemorySaver(suggestedName);
}
