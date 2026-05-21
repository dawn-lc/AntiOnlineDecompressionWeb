import { EventBus } from '../shared/EventBus';
import { FileIOManager } from './FileIOManager';
import { AppController } from './AppController';
import { UI } from './UI';
import { setForceFallback, initSWDownload, requestRequiredPermissions } from './SaveHelper';
import { applyI18nToDOM, renderLocaleSwitcher, t } from '../shared/i18n';

function getBrowserInfo(): string {
    const ua = navigator.userAgent;
    let name = 'Unknown';
    let ver = '';
    if (ua.includes('Edg/')) { name = 'Edge'; ver = ua.match(/Edg\/([\d.]+)/)?.[1] ?? ''; }
    else if (ua.includes('Chrome/')) { name = 'Chrome'; ver = ua.match(/Chrome\/([\d.]+)/)?.[1] ?? ''; }
    else if (ua.includes('Firefox/')) { name = 'Firefox'; ver = ua.match(/Firefox\/([\d.]+)/)?.[1] ?? ''; }
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) { name = 'Safari'; ver = ua.match(/Version\/([\d.]+)/)?.[1] ?? ''; }
    return `${name} ${ver}`;
}

function main() {
    function updateBrowserInfo(): void {
        const browserInfo = getBrowserInfo();
        const browserEl = document.getElementById('browserDetect');
        if (browserEl) browserEl.textContent = t('browser.current', { browser: browserInfo });
    }

    applyI18nToDOM();
    renderLocaleSwitcher('localeSwitcher', () => { applyI18nToDOM(); updateBrowserInfo(); });

    updateBrowserInfo();

    initSWDownload();
    requestRequiredPermissions();
    const eventBus = new EventBus();
    const fileIO = new FileIOManager();
    const controller = new AppController(eventBus, fileIO);
    const ui = new UI(eventBus);

    (window as any).__testHelpers = { forceSaveFallback: setForceFallback };

    ui.onEncryptClick(async (file: File) => {
        await controller.encrypt(file);
    });

    ui.onDecryptClick(async (aodkFile: File, aodfFile: File) => {
        await controller.decrypt(aodkFile, aodfFile);
    });

    console.info(t('console.loaded'));
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}