/**
 * 提示层管理
 */
import { t, getLocale } from '../shared/i18n';

/** 生成 Android Intent URL */
function androidIntentUrl(packageName: string): string {
    const u = location;
    return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=https;package=${packageName};end`;
}

/** Chrome 下载地址：中文简体走 google.cn，否则走 google.com */
function chromeInstallUrl(): string {
    return getLocale() === 'zh-CN'
        ? 'https://www.google.cn/chrome/'
        : 'https://www.google.com/chrome/';
}

/** 替换"打开"按钮为"安装"按钮（点击后未跳转说明未安装） */
function replaceWithInstallBtn(launchBtnId: string, label: string, installUrl: string, delayMs = 1500): void {
    setTimeout(() => {
        const launchBtn = document.getElementById(launchBtnId);
        if (!launchBtn || !document.body.contains(launchBtn)) return;
        launchBtn.textContent = `安装 ${label}`;
        launchBtn.style.background = 'var(--danger)';
        launchBtn.onclick = () => { location.href = installUrl; };
    }, delayMs);
}

/** 显示 FSAA 不可用的阻塞提示层 */
export function showFSAAUnsupportedOverlay(opts?: { insecureContext?: boolean }): void {
    const isAndroid = /Android/.test(navigator.userAgent);
    const isWindows = /Windows/.test(navigator.userAgent);

    // 非安全上下文（HTTP）时提示 HTTPS，否则提示切换浏览器
    const titleKey = opts?.insecureContext ? 'browser.unsupportedHttpsTitle' : 'browser.unsupportedTitle';
    const descKey = opts?.insecureContext ? 'browser.unsupportedHttpsDesc' : 'browser.unsupportedDesc';

    const overlay = document.createElement('div');
    overlay.innerHTML = `
        <div class="builtin-overlay-backdrop"></div>
        <div class="builtin-overlay-card">
            <div class="builtin-overlay-icon">⚠️</div>
            <h2>${t(titleKey)}</h2>
            <p>${t(descKey)}</p>
            ${opts?.insecureContext ? '' : `
            <div class="launch-buttons">
                ${isAndroid ? `
                    <button class="builtin-overlay-close" id="launchEdgeBtn">${t('browser.openEdge')}</button>
                    <button class="builtin-overlay-close" id="launchChromeBtn" style="margin-top:8px;background:var(--accent-hover)">${t('browser.openChrome')}</button>
                ` : isWindows ? `
                    <button class="builtin-overlay-close" id="launchEdgeBtn">${t('browser.openEdge')}</button>
                ` : `<button class="builtin-overlay-close" id="launchBrowserBtn">${t('browser.openChrome')}</button>`}
            </div>`}
        </div>
    `;
    document.body.appendChild(overlay);

    // 复制当前地址到剪贴板（辅助兜底）
    navigator.clipboard?.writeText(location.href).catch(() => { });

    if (opts?.insecureContext) return; // HTTPS 提示不需要启动按钮

    if (isAndroid) {
        document.getElementById('launchChromeBtn')?.addEventListener('click', () => {
            location.href = androidIntentUrl('com.android.chrome');
            replaceWithInstallBtn('launchChromeBtn', 'Chrome', 'market://details?id=com.android.chrome');
        });
        document.getElementById('launchEdgeBtn')?.addEventListener('click', () => {
            location.href = androidIntentUrl('com.microsoft.emmx');
            replaceWithInstallBtn('launchEdgeBtn', 'Edge', 'market://details?id=com.microsoft.emmx');
        });
    } else if (isWindows) {
        document.getElementById('launchEdgeBtn')?.addEventListener('click', () => {
            location.href = `microsoft-edge:${location.href}`;
            replaceWithInstallBtn('launchEdgeBtn', 'Edge', 'https://www.microsoft.com/edge/download');
        });
    } else {
        // macOS → googlechrome: 协议
        document.getElementById('launchBrowserBtn')?.addEventListener('click', () => {
            location.href = `googlechrome://${location.host}${location.pathname}${location.search}`;
            replaceWithInstallBtn('launchBrowserBtn', 'Chrome', chromeInstallUrl());
        });
    }
}

// ====== 操作完成提示层 ======

/** 显示提示层，用户点击"确定"后关闭 */
export function showAlertOverlay(message: string, icon = '❓'): void {
    const overlay = document.createElement('div');
    overlay.innerHTML = `
        <div class="builtin-overlay-backdrop"></div>
        <div class="builtin-overlay-card">
            <div class="builtin-overlay-icon">${icon}</div>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <button class="builtin-overlay-close" id="alertOverlayOk">${t('alert.ok')}</button>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#alertOverlayOk')!.addEventListener('click', () => {
        overlay.remove();
    });
}
