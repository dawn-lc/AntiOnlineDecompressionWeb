/**
 * 浏览器检测
 *
 * 检查 FSAA API 是否存在，以及是否为已知不支持 FSAA 的浏览器。
 *
 * showSaveFilePicker 在非安全上下文（HTTP、非 localhost）中不可用，
 * 即使浏览器本身支持 FSAA。需通过 isInsecureContext 区分。
 *
 * 部分浏览器（如微信/QQ 内置浏览器）可能在 window 上暴露
 * showSaveFilePicker 属性（原型链或 stub），但实际调用会失败，
 * 需要额外通过 UA 和 typeof 检测排除。
 */

/** 是否为微信/QQ 等已知不支持 FSAA 的内置浏览器 */
export function isKnownUnsupportedBrowser(): boolean {
    const ua = navigator.userAgent;
    // 微信：MicroMessenger 是通用标识，WeChat/Weixin 作为补充
    const isWeChat = /MicroMessenger|WeChat|Weixin/i.test(ua);
    // QQ 内置浏览器或 QQ 浏览器（均基于 X5 内核，不支持 FSAA）
    const isQQ = /MQQBrowser| QQ\b/i.test(ua);
    return isWeChat || isQQ;
}

/** 页面是否运行在非安全上下文（HTTP 而非 HTTPS/localhost） */
export function isInsecureContext(): boolean {
    return !window.isSecureContext;
}

/**
 * FSAA（File System Access API）是否不可用。
 * 包括三种情况：
 * 1. window 上没有 showSaveFilePicker
 * 2. showSaveFilePicker 存在但不是函数（如 WeChat X5 内核的 stub）
 * 3. 已知不支持 FSAA 的内置浏览器（微信/QQ 等）
 */
export function isFSAAUnsupported(): boolean {
    // 已知不支持的内置浏览器
    if (isKnownUnsupportedBrowser()) return true;
    // API 完全不存在
    if (!('showSaveFilePicker' in window)) return true;
    // 存在但不是函数（某些浏览器的虚假属性）
    if (typeof (window as any).showSaveFilePicker !== 'function') return true;
    return false;
}
