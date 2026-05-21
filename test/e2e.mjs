/**
 * 端到端测试 - 加密/解密完整流程
 *
 * 使用 Puppeteer 模拟用户操作，覆盖：
 *   - URL hash 导航
 *   - 文件加密 + 清除按钮
 *   - 文件解密 + 完整性校验
 *   - 操作中取消
 *
 * 环境变量配置：
 *   MOBILE=1       模拟移动端（iPhone 12），测试 OPFS / Blob 下载回退路径
 *   SAVER=fallback 强制使用内存 Blob 下载回退（模拟 FSAA/OPFS/SW 均不可用）
 *   NO_FSAA=1      不拦截 showSaveFilePicker，模拟 FSAA 不可用
 *   NO_INJECT=1    不注入任何 API 拦截，使用浏览器真实 API（需在支持的环境中）
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import {
    sleep, sha256, cleanupEnvironment, buildProject, startServer,
    launchBrowser, waitForDownload, waitForFile
} from './helpers.mjs';

// ─── 配置（通过环境变量控制） ────────────────────────────

const CFG = {
    /** 移动端模式 */
    mobile: process.env.MOBILE === '1',
    /** 强制使用内存 Blob 下载回退 */
    forceFallback: process.env.SAVER === 'fallback',
    /** 不拦截 showSaveFilePicker（模拟 FSAA 不可用） */
    noFsaa: process.env.NO_FSAA === '1',
    /** 不注入任何 API 拦截 */
    noInject: process.env.NO_INJECT === '1',
};

const TEST_FILE = path.resolve('test/fixtures/1.mp4');
const PORT = 3456;
const BASE_URL = `http://localhost:${PORT}`;
const TEMP_DIR = path.resolve('test/output');

/** 如果测试文件不存在，自动生成 512MB */
function ensureFixture() {
    if (fs.existsSync(TEST_FILE)) return;
    console.log(`📦 测试文件不存在，自动生成 512MB: ${TEST_FILE}`);
    execSync(`node "${path.resolve('test/generate-fixture.mjs')}"`, { stdio: 'inherit', cwd: process.cwd() });
}

console.log(`📋 测试配置: mobile=${CFG.mobile} fallback=${CFG.forceFallback} noFsaa=${CFG.noFsaa} noInject=${CFG.noInject}`);

// ─── 测试区块 ────────────────────────────────────────────

async function testHashNavigation(page) {
    console.log('\n📍 ====== 哈希导航测试 ======');

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

    await page.goto(`${BASE_URL}/#decrypt`, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(500);
    active = await page.evaluate(getActivePanel);
    if (active !== 'decrypt') throw new Error('直接打开 #decrypt 不是解密面板');
    console.log('   ✅ 直接打开 #decrypt → 解密面板');

    await page.evaluate(() => { location.hash = 'encrypt'; });
    await sleep(300);
}

async function injectApis(page) {
    if (CFG.noInject) {
        console.log('\n🔧 跳过 API 拦截，使用浏览器真实 API');
        return;
    }

    const mode = CFG.forceFallback ? '强制内存 Blob 回退' : CFG.mobile ? '移动端' : '桌面端';
    console.log(`\n🔧 模式: ${mode}`);
    await page.evaluate(() => { window.__testFiles = {}; });

    if (CFG.forceFallback) {
        // 强制 SaveHelper 使用内存 Blob 下载回退
        await page.evaluate(() => {
            if (window.__testHelpers?.forceSaveFallback) {
                window.__testHelpers.forceSaveFallback(true);
            }
        });
    }

    // 始终拦截 showSaveFilePicker 以捕获文件到内存，方便测试验证
    // SAVER=fallback 虽设置 forceSaveFallback 使 FSAA 不可用，但仍需拦截以捕获输出
    await page.evaluate(() => {
        window.showSaveFilePicker = async (opts) => {
            const name = opts.suggestedName;
            console.log('[TEST] showSaveFilePicker:', name);
            let chunks = [];
            return {
                createWritable: async () => ({
                    write: async (data) => {
                        if (data instanceof ArrayBuffer) chunks.push(new Uint8Array(data));
                        else if (data.buffer) chunks.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                        else if (typeof data === 'number') { /* empty write */ }
                        else chunks.push(new Uint8Array(data));
                    },
                    close: async () => {
                        const blob = new Blob(chunks);
                        window.__testFiles[name] = blob;
                        console.log('[TEST] Captured:', name, blob.size);
                    }
                })
            };
        };
    });
    await sleep(1000);
}

async function testEncrypt(page, fileInput) {
    console.log('\n🔒 ====== 加密测试 ======');

    await fileInput.uploadFile(TEST_FILE);
    await sleep(1000);

    const info = await page.evaluate(() => ({
        name: document.getElementById('encryptFileName')?.textContent,
        btnDisabled: document.getElementById('encryptBtn')?.disabled
    }));
    console.log('文件已选择:', info.name, '按钮启用:', !info.btnDisabled);
    if (!info.name) throw new Error('文件选择失败');

    // 清除按钮测试
    console.log('   🔄 测试清除按钮...');
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

    // 清除后不选文件直接加密 → 无效
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

    // 重新选择
    await fileInput.uploadFile(TEST_FILE);
    await sleep(1000);
    const reSelected = await page.evaluate(() => ({
        name: document.getElementById('encryptFileName')?.textContent,
        btnDisabled: document.getElementById('encryptBtn')?.disabled,
    }));
    if (!reSelected.name) throw new Error('清除后重新选择文件失败');
    if (reSelected.btnDisabled) throw new Error('清除后重新选择文件，加密按钮应启用');
    console.log('   ✅ 清除后可继续选择文件并加密');

    // 执行加密
    console.log('点击加密按钮...');
    await page.click('#encryptBtn');

    let encryptDone = false;
    let maxProgressWidth = 0;
    for (let i = 0; i < 300; i++) {
        await sleep(1000);
        const state = await page.evaluate(() => {
            const section = document.getElementById('progressSection');
            const fill = document.getElementById('progressBarFill');
            const files = window.__testFiles || {};
            const keys = Object.keys(files);
            return {
                progressVisible: section?.classList.contains('visible') || false,
                width: fill ? parseFloat(fill.style.width) : 0,
                hasAodk: keys.some(k => k.endsWith('.aodk')),
                hasAodf: keys.some(k => k.endsWith('.aodf')),
                files: keys,
            };
        });

        if (state.progressVisible && state.width > maxProgressWidth) maxProgressWidth = state.width;
        if (i % 10 === 0) console.log(`等待中... ${i + 1}s | ${state.files.join(', ') || '无'}`);
        if (state.hasAodk && state.hasAodf) {
            console.log('✅ 加密完成! 捕获:', state.files.join(', '));
            encryptDone = true;
            break;
        }
    }
    if (!encryptDone) throw new Error('加密超时');
    if (maxProgressWidth < 100) console.log(`📊 进度条最大宽度: ${maxProgressWidth}%`);
    else console.log(`📊 进度条最大宽度: ${maxProgressWidth}%，显示正常`);

    // 从内存下载到磁盘
    const names = await page.evaluate(() => {
        const f = window.__testFiles || {};
        const k = Object.keys(f);
        return { aodk: k.find(x => x.endsWith('.aodk')) || '', aodf: k.find(x => x.endsWith('.aodf')) || '' };
    });
    console.log('下载加密文件到磁盘...');
    await page.evaluate(async (a, b) => {
        const files = window.__testFiles;
        for (const name of [a, b]) {
            const blob = files[name];
            if (!blob) continue;
            const url = URL.createObjectURL(blob);
            const el = document.createElement('a');
            el.href = url; el.download = name;
            el.style.display = 'none';
            document.body.appendChild(el); el.click();
            document.body.removeChild(el);
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        }
    }, names.aodk, names.aodf);
    const aodkDisk = await waitForFile(TEMP_DIR, '.aodk');
    const aodfDisk = await waitForFile(TEMP_DIR, '.aodf');
    console.log('加密文件已保存:', aodkDisk, aodfDisk);
    return { aodk: aodkDisk, aodf: aodfDisk };
}

async function testDecrypt(page, aodkName, aodfName) {
    console.log('\n🔓 ====== 解密测试 ======');
    await page.click('.tab[data-tab="decrypt"]');
    await sleep(500);

    const aodkPath = path.join(TEMP_DIR, aodkName);
    const aodfPath = path.join(TEMP_DIR, aodfName);

    if (CFG.mobile) {
        const i1 = await page.$('#aodkInput');
        const i2 = await page.$('#aodfInput');
        await i1.uploadFile(aodkPath);
        await i2.uploadFile(aodfPath);
        await sleep(1000);
    } else {
        await page.evaluate(async (a, b) => {
            const files = window.__testFiles;
            const f1 = new File([files[a]], a);
            const f2 = new File([files[b]], b);
            const i1 = document.getElementById('aodkInput');
            const i2 = document.getElementById('aodfInput');
            const d1 = new DataTransfer(); d1.items.add(f1);
            Object.defineProperty(i1, 'files', { value: d1.files });
            const d2 = new DataTransfer(); d2.items.add(f2);
            Object.defineProperty(i2, 'files', { value: d2.files });
            i1.dispatchEvent(new Event('change'));
            i2.dispatchEvent(new Event('change'));
        }, aodkName, aodfName);
    }

    console.log('点击解密按钮...');
    await page.evaluate(() => document.getElementById('decryptBtn').click());
    await sleep(2000);

    let decryptDone = false;
    let fileName = '';
    for (let i = 0; i < 300; i++) {
        await sleep(1000);
        const state = await page.evaluate(() => {
            const files = window.__testFiles || {};
            const keys = Object.keys(files);
            const err = window.__testLastError || '';
            const dec = keys.find(k => !k.endsWith('.aodk') && !k.endsWith('.aodf') && k !== 'encryptError');
            return { hasDecrypted: !!dec, decFileName: dec || '', files: keys, error: err };
        });
        if (i % 10 === 0) console.log(`等待中... ${i + 1}s | ${state.files.join(', ') || '无'}`);
        if (state.error) throw new Error('解密错误: ' + state.error);
        if (state.hasDecrypted) {
            console.log('✅ 解密完成! 捕获:', state.files.join(', '));
            decryptDone = true;
            fileName = state.decFileName;
            break;
        }
    }
    if (!decryptDone) throw new Error('解密超时');
    return fileName;
}

async function testVerify(origStat, origHash, decFileName) {
    console.log('\n✅ ====== 验证结果 ======');
    const decPath = path.join(TEMP_DIR, decFileName);
    const decStat = fs.statSync(decPath);
    const decHash = await sha256(fs.readFileSync(decPath));

    console.log('   原始:', origStat.size, 'bytes, SHA256:', origHash);
    console.log('   解密:', decStat.size, 'bytes, SHA256:', decHash);
    if (origStat.size !== decStat.size) throw new Error('大小不匹配');
    console.log('   ✅ 文件大小匹配');

    if (origHash !== decHash) throw new Error('内容不一致');
    console.log('   ✅ 文件内容完全一致! SHA256 匹配');
}

async function testCancel(page) {
    console.log('\n🛑 ====== 取消操作测试 ======');

    // 加密取消
    console.log('\n🛑 加密取消...');
    await page.click('.tab[data-tab="encrypt"]');
    await sleep(200);
    const fi = await page.$('#fileInput');
    await fi.uploadFile(TEST_FILE);
    await sleep(1000);

    if (!(await page.evaluate(() => !document.getElementById('encryptBtn')?.disabled))) throw new Error('加密按钮未启用');
    await page.evaluate(() => document.getElementById('encryptBtn').click());
    await sleep(500);

    if (!(await page.evaluate(() => document.getElementById('progressSection')?.classList.contains('visible')))) throw new Error('进度条未显示');
    await page.evaluate(() => document.getElementById('encryptBtn').click());
    await sleep(500);

    const r1 = await page.evaluate(() => ({
        v: document.getElementById('progressSection')?.classList.contains('visible'),
        d: document.getElementById('encryptBtn').disabled,
    }));
    if (r1.v) throw new Error('取消后进度条应隐藏');
    console.log('   ✅ 加密取消测试通过');

    // 解密取消
    console.log('\n🛑 解密取消...');
    const c1 = fs.readdirSync(TEMP_DIR).find(f => f.endsWith('.aodk'));
    const c2 = fs.readdirSync(TEMP_DIR).find(f => f.endsWith('.aodf'));
    if (!c1 || !c2) throw new Error('未找到加密文件');

    await page.click('.tab[data-tab="decrypt"]');
    await sleep(200);
    const i1 = await page.$('#aodkInput');
    const i2 = await page.$('#aodfInput');
    await i1.uploadFile(path.join(TEMP_DIR, c1));
    await i2.uploadFile(path.join(TEMP_DIR, c2));
    await sleep(1000);

    // 确认解密按钮已启用
    const btnReady = await page.evaluate(() => !document.getElementById('decryptBtn')?.disabled);
    if (!btnReady) throw new Error('解密按钮未启用，无法开始取消测试');

    await page.evaluate(() => document.getElementById('decryptBtn').click());
    // 等待进度条出现（解密启动需要时间）
    let progressFound = false;
    for (let i = 0; i < 10; i++) {
        await sleep(500);
        const visible = await page.evaluate(() => document.getElementById('progressSection')?.classList.contains('visible'));
        if (visible) { progressFound = true; break; }
    }
    if (!progressFound) throw new Error('进度条未显示');
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

async function run() {
    // 全局超时：10 分钟后强制退出，防止异常挂起
    const timer = setTimeout(() => {
        console.error('\n⏰ 测试超时，强制退出');
        process.exit(1);
    }, 600_000);

    console.log('🧹 清理残留...');
    cleanupEnvironment(TEMP_DIR, PORT);
    // 清理旧版 test-temp 目录
    try { fs.rmSync(path.resolve('test-temp'), { recursive: true, force: true }); } catch { }
    console.log('✅ 清理完成');

    ensureFixture();
    const origStat = fs.statSync(TEST_FILE);
    console.log(`📄 ${TEST_FILE} (${(origStat.size / 1024 / 1024).toFixed(2)} MB)`);
    const origHash = await sha256(fs.readFileSync(TEST_FILE));
    console.log('   SHA256:', origHash);

    let server;
    let browser;

    try {
        await buildProject();
        server = await startServer(PORT);

        const launched = await launchBrowser(BASE_URL, TEMP_DIR, CFG.mobile);
        browser = launched.browser;
        const page = launched.page;

        await testHashNavigation(page);
        await injectApis(page);

        // 加密
        const fileInput = await page.$('#fileInput');
        const { aodk: aodkName, aodf: aodfName } = await testEncrypt(page, fileInput);

        // 验证文件头
        const aodkPath = path.join(TEMP_DIR, aodkName);
        const aodfPath = path.join(TEMP_DIR, aodfName);
        const h1 = fs.readFileSync(aodkPath).slice(0, 4).toString();
        const h2 = fs.readFileSync(aodfPath).slice(0, 4).toString();
        console.log(`AODK: ${aodkName} (${fs.statSync(aodkPath).size} B) magic=${h1}`);
        console.log(`AODF: ${aodfName} (${fs.statSync(aodfPath).size} B) magic=${h2}`);
        if (h1 !== 'AODK') throw new Error('AODK Magic 不匹配');
        if (h2 !== 'AODF') throw new Error('AODF Magic 不匹配');

        await sleep(500);

        // 解密
        const decFileName = await testDecrypt(page, aodkName, aodfName);

        // 下载解密结果到磁盘
        await page.evaluate(async (name) => {
            const blob = window.__testFiles[name];
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const el = document.createElement('a');
            el.href = url; el.download = name;
            el.style.display = 'none';
            document.body.appendChild(el); el.click();
            document.body.removeChild(el);
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        }, decFileName);
        await waitForDownload(TEMP_DIR, decFileName);

        // 验证
        await testVerify(origStat, origHash, decFileName);

        console.log('\n🎉 加密解密测试全部通过!');
        for (const f of fs.readdirSync(TEMP_DIR)) {
            const s = fs.statSync(path.join(TEMP_DIR, f));
            console.log(`  ${f} (${(s.size / 1024 / 1024).toFixed(2)} MB)`);
        }

        // 取消测试
        await testCancel(page);
        console.log('\n🎉 所有测试通过! ✅');
    } finally {
        clearTimeout(timer);
        if (browser) try { await browser.close(); } catch { }
        if (server) try { server.kill(); } catch { }
    }
}

run().catch(err => {
    console.error('\n❌ 测试失败:', err.message);
    process.exit(1);
}).then(() => process.exit(0));
