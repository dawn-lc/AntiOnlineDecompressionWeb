/**
 * UI 和界面逻辑测试 - 允许使用完整的 Playwright API
 *
 * 覆盖：哈希导航、面板切换、清除按钮、取消操作等
 */

import { sleep } from './testUtils.mjs';

/**
 * 哈希导航测试
 * - 默认显示加密面板
 * - #decrypt 切换到解密面板
 * - #encrypt 切换到加密面板
 * - 直接打开 #decrypt URL 显示解密面板
 * @param {import('playwright').Page} page
 * @param {string} baseUrl - 用于测试直接 URL 导航
 */
export async function testHashNavigation(page, baseUrl) {
    console.log('📍 ====== 哈希导航测试 ======');

    const getActivePanel = () => {
        const ep = document.getElementById('encrypt');
        const dp = document.getElementById('decrypt');
        return getComputedStyle(ep).display !== 'none' ? 'encrypt' : 'decrypt';
    };

    let active = await page.evaluate(getActivePanel);
    if (active !== 'encrypt') throw new Error('默认面板不是 encrypt');
    console.log('   ✅ 默认面板: 加密');

    await page.evaluate(() => { location.hash = 'decrypt'; });
    await sleep(500);
    active = await page.evaluate(getActivePanel);
    if (active !== 'decrypt') throw new Error('#decrypt 后不是解密面板');
    console.log('   ✅ #decrypt → 解密面板');

    await page.evaluate(() => { location.hash = 'encrypt'; });
    await sleep(500);
    active = await page.evaluate(getActivePanel);
    if (active !== 'encrypt') throw new Error('#encrypt 后不是加密面板');
    console.log('   ✅ #encrypt → 加密面板');

    // 直接打开 #decrypt URL
    await page.goto(`${baseUrl}/#decrypt`, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(500);
    active = await page.evaluate(getActivePanel);
    if (active !== 'decrypt') throw new Error('直接打开 #decrypt 不是解密面板');
    console.log('   ✅ 直接打开 #decrypt → 解密面板');

    await page.evaluate(() => { location.hash = 'encrypt'; });
    await sleep(300);
}

/**
 * 加密面板清除按钮测试
 */
export async function testClearButton(page, testFilePath) {
    console.log('🧹 ====== 清除按钮测试 ======');

    await page.evaluate(() => { location.hash = 'encrypt'; });
    await sleep(300);

    // 选择文件
    await page.locator('#fileInput').setInputFiles(testFilePath);
    await sleep(1000);

    // 验证文件已选择
    const info = await page.evaluate(() => ({
        name: document.getElementById('encryptFileName')?.textContent,
        btnDisabled: document.getElementById('encryptBtn')?.disabled,
        fileInfoVisible: document.getElementById('encryptFileInfo')?.classList.contains('visible'),
        dropVisible: document.getElementById('encryptDrop')?.style.display !== 'none',
    }));
    if (!info.name) throw new Error('文件选择失败');
    if (info.btnDisabled) throw new Error('选择文件后加密按钮应启用');
    if (!info.fileInfoVisible) throw new Error('文件信息应可见');
    if (info.dropVisible) throw new Error('拖拽区域应隐藏');
    console.log('   ✅ 文件选择成功');

    // 点击清除按钮
    console.log('   🔄 点击清除按钮...');
    await page.evaluate(() => document.getElementById('encryptClearBtn').click());
    await sleep(300);

    const afterClear = await page.evaluate(() => ({
        fileInfoVisible: document.getElementById('encryptFileInfo')?.classList.contains('visible'),
        btnDisabled: document.getElementById('encryptBtn')?.disabled,
        dropVisible: document.getElementById('encryptDrop')?.style.display !== 'none',
    }));
    if (afterClear.fileInfoVisible) throw new Error('清除后文件信息仍可见');
    if (!afterClear.btnDisabled) throw new Error('清除后加密按钮应禁用');
    if (!afterClear.dropVisible) throw new Error('清除后拖拽区域应重新显示');
    console.log('   ✅ 清除按钮测试通过');

    // 清除后不选文件直接点击加密 → 无效
    console.log('   🔄 测试清除后不选文件直接加密...');
    await page.evaluate(() => document.getElementById('encryptBtn').click());
    await sleep(500);
    const noFile = await page.evaluate(() => ({
        btnDisabled: document.getElementById('encryptBtn')?.disabled,
        progressVisible: document.getElementById('progressSection')?.classList.contains('visible'),
    }));
    if (!noFile.btnDisabled) throw new Error('清除后未选文件，加密按钮应保持禁用');
    if (noFile.progressVisible) throw new Error('清除后未选文件，不应开始加密');
    console.log('   ✅ 清除后不选文件点击加密无效');

    // 重新选择文件
    await page.locator('#fileInput').setInputFiles(testFilePath);
    await sleep(1000);
    const reSelected = await page.evaluate(() => ({
        name: document.getElementById('encryptFileName')?.textContent,
        btnDisabled: document.getElementById('encryptBtn')?.disabled,
    }));
    if (!reSelected.name) throw new Error('清除后重新选择文件失败');
    if (reSelected.btnDisabled) throw new Error('清除后重新选择文件，加密按钮应启用');
    console.log('   ✅ 清除后可继续选择文件并加密');
}

/**
 * 加密取消操作测试
 */
export async function testEncryptCancel(page, testFilePath) {
    console.log('\n🛑 ====== 加密取消测试 ======');

    await page.click('.tab[data-tab="encrypt"]');
    await sleep(200);
    await page.locator('#fileInput').setInputFiles(testFilePath);
    await sleep(1000);

    const encryptBtnReady = await page.evaluate(() => !document.getElementById('encryptBtn')?.disabled);
    if (!encryptBtnReady) throw new Error('加密按钮未启用');

    await page.evaluate(() => document.getElementById('encryptBtn').click());
    await sleep(500);

    const progressVisible = await page.evaluate(() =>
        document.getElementById('progressSection')?.classList.contains('visible')
    );
    if (!progressVisible) throw new Error('进度条未显示');

    await page.evaluate(() => document.getElementById('encryptBtn').click());
    await sleep(500);

    const r1 = await page.evaluate(() => ({
        v: document.getElementById('progressSection')?.classList.contains('visible'),
        d: document.getElementById('encryptBtn').disabled,
    }));
    if (r1.v) throw new Error('取消后进度条应隐藏');
    console.log('   ✅ 加密取消测试通过');
}

/**
 * 解密取消操作测试（使用内存中的加密文件）
 * @param {import('playwright').Page} page
 * @param {string} aodkName - 内存中 __testFiles 里的 AODK 文件名
 * @param {string} aodfName - 内存中 __testFiles 里的 AODF 文件名
 */
export async function testDecryptCancel(page, aodkName, aodfName) {
    console.log('\n🛑 ====== 解密取消测试 ======');

    await page.click('.tab[data-tab="decrypt"]');
    await sleep(200);

    // 使用 DataTransfer 设置内存中的加密文件（通过原生 setter 避免 "Cannot redefine property"）
    await page.evaluate(async ({ aodk, aodf }) => {
        const files = window.__testFiles;
        const f1 = new File([files[aodk]], aodk);
        const f2 = new File([files[aodf]], aodf);
        const i1 = document.getElementById('aodkInput');
        const i2 = document.getElementById('aodfInput');

        const setFiles = (input, file) => {
            const dt = new DataTransfer();
            dt.items.add(file);
            const nativeSetter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype, 'files'
            )?.set;
            if (nativeSetter) {
                nativeSetter.call(input, dt.files);
            } else {
                // 回退：直接定义属性（旧浏览器）
                Object.defineProperty(input, 'files', { value: dt.files });
            }
        };

        setFiles(i1, f1);
        setFiles(i2, f2);
        i1.dispatchEvent(new Event('change'));
        i2.dispatchEvent(new Event('change'));
    }, { aodk: aodkName, aodf: aodfName });
    await sleep(1000);

    // 确认解密按钮已启用
    const btnReady = await page.evaluate(() => !document.getElementById('decryptBtn')?.disabled);
    if (!btnReady) throw new Error('解密按钮未启用，无法开始取消测试');

    // 开始解密
    await page.evaluate(() => document.getElementById('decryptBtn').click());
    // 等待进度条出现
    let progressFound = false;
    for (let i = 0; i < 10; i++) {
        await sleep(500);
        const visible = await page.evaluate(() =>
            document.getElementById('progressSection')?.classList.contains('visible')
        );
        if (visible) { progressFound = true; break; }
    }
    if (!progressFound) throw new Error('进度条未显示');

    // 点击取消（按钮已变为取消按钮）
    await page.evaluate(() => document.getElementById('decryptBtn').click());
    await sleep(500);

    const r2 = await page.evaluate(() => ({
        v: document.getElementById('progressSection')?.classList.contains('visible'),
        d: document.getElementById('decryptBtn').disabled,
        r: document.getElementById('decryptAodkName')?.classList.contains('empty'),
    }));
    if (r2.v) throw new Error('取消后进度条应隐藏');
    console.log('   ✅ 解密取消测试通过');
}
