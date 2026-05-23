/**
 * 浏览器检测 — 仅检查 FSAA API 是否存在。
 * 真正的可用性在调用时通过耗时区分（<200ms 的 AbortError 视为损坏）。
 *
 * showSaveFilePicker 在非安全上下文（HTTP、非 localhost）中不可用，
 * 即使浏览器本身支持 FSAA。需通过 isInsecureContext 区分。
 */

export function isFSAAUnsupported(): boolean {
    return !('showSaveFilePicker' in window);
}

/** 页面是否运行在非安全上下文（HTTP 而非 HTTPS/localhost） */
export function isInsecureContext(): boolean {
    return !window.isSecureContext;
}
