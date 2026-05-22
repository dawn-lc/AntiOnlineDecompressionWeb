/**
 * 文件读取和写入测试
 *
 * 规则：
 * - 仅允许使用 page.click() 和 page.locator().setInputFiles() 模拟用户操作
 * - 禁止使用 page.evaluate() 读取/操作 DOM 或 JS 环境
 * - 通过 waitForFile（Node.js fs）等待文件落盘后读取校验
 */

import path from 'path';
import fs from 'fs';
import { sleep, sha256, waitForFile, dismissAlertOverlay } from './testUtils.mjs';

/**
 * 加密写入测试
 * 模拟用户：选择文件 → 点击加密 → 等待 .aodk/.aodf 落盘
 * 落盘后通过 Node.js fs 读取文件头部进行校验
 */
export async function testEncryptFileWrite(page, testFilePath, tempDir) {
    console.log('💾 ====== 加密写入测试（仅模拟点击） ======');

    await page.click('.tab[data-tab="encrypt"]');
    await sleep(500);

    await page.locator('#fileInput').setInputFiles(testFilePath);
    await sleep(1000);

    await page.click('#encryptBtn');
    console.log('⏳ 等待加密文件落盘...');

    const aodkName = await waitForFile(tempDir, '.aodk', 180000);
    const aodfName = await waitForFile(tempDir, '.aodf', 180000);

    const aodkPath = path.join(tempDir, aodkName);
    const aodfPath = path.join(tempDir, aodfName);

    const aodkMagic = fs.readFileSync(aodkPath).slice(0, 4).toString();
    const aodfMagic = fs.readFileSync(aodfPath).slice(0, 4).toString();

    console.log(`   AODK: ${aodkName} (${fs.statSync(aodkPath).size} B) magic=${aodkMagic}`);
    console.log(`   AODF: ${aodfName} (${fs.statSync(aodfPath).size} B) magic=${aodfMagic}`);

    if (aodkMagic !== 'AODK') throw new Error(`AODK Magic 不匹配: ${aodkMagic}`);
    if (aodfMagic !== 'AODF') throw new Error(`AODF Magic 不匹配: ${aodfMagic}`);

    // 关闭完成提示层
    await dismissAlertOverlay(page);

    console.log('   ✅ 加密写入验证通过');
    return { aodkPath, aodfPath, aodkName, aodfName };
}

/**
 * 解密读取测试
 * 模拟用户：切换到解密 → 选择加密文件 → 点击解密 → 等待原始文件落盘
 * 落盘后通过 Node.js fs 计算 SHA256 并与原始文件比对
 */
export async function testDecryptFileRead(page, aodkPath, aodfPath, tempDir, origHash, origSize) {
    console.log('📖 ====== 解密读取测试（仅模拟点击） ======');

    await page.click('.tab[data-tab="decrypt"]');
    await sleep(500);

    await page.locator('#aodkInput').setInputFiles(aodkPath);
    await page.locator('#aodfInput').setInputFiles(aodfPath);
    await sleep(1000);

    await page.click('#decryptBtn');
    console.log('⏳ 等待解密文件落盘...');

    // 解密后的文件是原始文件名（不含 .aodk/.aodf），等待其出现
    let decFilePath = '';
    for (let i = 0; i < 300; i++) {
        const files = fs.readdirSync(tempDir).filter(f =>
            !f.endsWith('.aodk') && !f.endsWith('.aodf') && !f.endsWith('.crdownload')
        );
        if (files.length > 0) {
            decFilePath = path.join(tempDir, files[files.length - 1]);
            await sleep(1000);
            try {
                if (fs.statSync(decFilePath).size > 0) break;
            } catch { }
        }
        if (i % 30 === 0) console.log(`   等待解密文件... ${i + 1}s`);
        await sleep(1000);
    }
    if (!decFilePath) throw new Error('未找到解密文件');

    const decName = path.basename(decFilePath);
    const decContent = fs.readFileSync(decFilePath);
    const decHash = await sha256(decContent);
    const decSize = decContent.length;

    console.log(`   解密文件: ${decName} (${decSize} bytes)`);
    console.log(`   原始 SHA256: ${origHash}`);
    console.log(`   解密 SHA256: ${decHash}`);

    if (decSize !== origSize) throw new Error(`文件大小不匹配: ${decSize} vs ${origSize}`);
    if (decHash !== origHash) throw new Error(`文件内容不一致: SHA256 不匹配`);

    console.log('   ✅ 文件大小匹配');
    console.log('   ✅ 文件内容完全一致! SHA256 匹配');
    // 关闭完成提示层
    await dismissAlertOverlay(page);

    console.log('✅ 解密读取验证通过');
}
