import { isFSAAUnsupported, isInsecureContext } from '../shared/browserDetect';
import { showFSAAUnsupportedOverlay } from './Overlays';
import { EventBus } from '../shared/EventBus';
import { FileIOManager } from './FileIOManager';
import { AppController } from './AppController';
import { UI } from './UI';

function main() {
    // 检查 FSAA API 是否存在
    if (isFSAAUnsupported()) {
        showFSAAUnsupportedOverlay({ insecureContext: isInsecureContext() });
        return;
    }

    const eventBus = new EventBus();
    const fileIO = new FileIOManager();
    const controller = new AppController(eventBus, fileIO);
    const ui = new UI(eventBus);

    ui.onEncryptClick(async (file: File) => {
        await controller.encrypt(file);
    });

    ui.onDecryptClick(async (aodkFile: File, aodfFile: File) => {
        await controller.decrypt(aodkFile, aodfFile);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
