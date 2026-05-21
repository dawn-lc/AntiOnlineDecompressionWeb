import { EventBus } from '../shared/EventBus';
import { FileIOManager } from './FileIOManager';
import { KeyFileManager } from './KeyFileManager';
import { AppController } from './AppController';
import { UI } from './UI';
import { setForceFallback, initSWDownload, requestRequiredPermissions } from './SaveHelper';

// 主入口：初始化各模块并绑定 UI 事件
function main() {
    // 注册 ServiceWorker（用于流式下载回退）
    initSWDownload();
    // 申请浏览器所需权限（持久化存储等）
    requestRequiredPermissions();
    const eventBus = new EventBus();
    const fileIO = new FileIOManager();
    const keyFile = new KeyFileManager();
    const controller = new AppController(eventBus, fileIO, keyFile);
    const ui = new UI(eventBus);

    // 暴露测试接口（移动端模拟等）
    (window as any).__testHelpers = { forceSaveFallback: setForceFallback };

    // 绑定加密按钮
    ui.onEncryptClick(async (file: File) => {
        await controller.encrypt(file);
    });

    // 绑定解密按钮事件
    ui.onDecryptClick(async (aodkFile: File, aodfFile: File) => {
        await controller.decrypt(aodkFile, aodfFile);
    });

    console.log('应用已加载，请选择文件进行加密或解密操作');
}

// DOM 加载完成后启动
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}