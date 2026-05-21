import { EventBus } from '../shared/EventBus';
import { FileIOManager } from './FileIOManager';
import { AppController } from './AppController';
import { UI } from './UI';
import { setForceFallback, initSWDownload, requestRequiredPermissions } from './SaveHelper';
import { applyI18nToDOM, renderLocaleSwitcher, t } from '../shared/i18n';

function main() {
    applyI18nToDOM();
    renderLocaleSwitcher('localeSwitcher', applyI18nToDOM);

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