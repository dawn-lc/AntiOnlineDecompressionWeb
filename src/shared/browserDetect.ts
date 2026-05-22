/**
 * 浏览器检测 — 仅检查 FSAA API 是否存在。
 * 真正的可用性在调用时通过耗时区分（<200ms 的 AbortError 视为损坏）。
 */

export function isFSAAUnsupported(): boolean {
    return !('showSaveFilePicker' in window);
}
