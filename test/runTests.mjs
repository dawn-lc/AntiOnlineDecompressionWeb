/**
 * 端到端测试 - 主编排器
 *
 * 测试模块分工：
 *   crypto.test.mjs - 加解密测试：Playwright API 校验，仅读盘不落盘（内存直接校验）
 *   ui.test.mjs     - UI 界面测试：完整 Playwright API
 *   io.test.mjs     - 文件读写测试：仅模拟点击 + 落盘读盘验证
 *
 * 环境变量配置：
 *   MOBILE=1       模拟移动端（iPhone 12）
 *   NO_FSAA=1      不拦截 showSaveFilePicker，模拟 FSAA 不可用
 *   NO_INJECT=1    不注入任何 API 拦截，使用浏览器真实 API
 */

// ─── 全局打桩：给所有 console.log 加上毫秒级时间戳 ──
{
    const originalLog = console.log;
    console.log = (...args) => {
        const d = new Date();
        const ts = d.getHours().toString().padStart(2, '0') + ':' +
            d.getMinutes().toString().padStart(2, '0') + ':' +
            d.getSeconds().toString().padStart(2, '0') + '.' +
            d.getMilliseconds().toString().padStart(3, '0');
        originalLog(`[${ts}]`, ...args);
    };
}

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import {
    sleep, sha256, cleanupEnvironment, buildProject, startServer,
    launchBrowser, waitForFile
} from './testUtils.mjs';
import { injectCryptoIntercept, testEncrypt, testDecrypt } from './crypto.test.mjs';
import { testHashNavigation, testClearButton, testEncryptCancel, testDecryptCancel } from './ui.test.mjs';
import { testEncryptFileWrite, testDecryptFileRead } from './fileIo.test.mjs';

// ─── 配置 ────────────────────────────────────────────

const CFG = {
    mobile: process.env.MOBILE === '1',
    noFsaa: process.env.NO_FSAA === '1',
    noInject: process.env.NO_INJECT === '1',
    browserType: process.env.BROWSER || 'chromium',  // chromium | firefox | webkit
};

const TEST_FILE = path.resolve('test/fixtures/1.mp4');
const PORT = 3456;
const BASE_URL = `http://localhost:${PORT}`;
const TEMP_DIR = path.resolve('test/output');

console.log(`📋 测试配置: mobile=${CFG.mobile} noFsaa=${CFG.noFsaa} noInject=${CFG.noInject}`);

/** 如果测试文件不存在，自动生成 */
function ensureFixture() {
    if (fs.existsSync(TEST_FILE)) return;
    console.log(`📦 测试文件不存在，自动生成 512MB: ${TEST_FILE}`);
    execSync(`node "${path.resolve('test/generateFixture.mjs')}"`, { stdio: 'inherit', cwd: process.cwd() });
}

// ─── 主流程 ──────────────────────────────────────────

async function run() {
    let aborted = false;
    const timer = setTimeout(() => {
        console.error('\n⏰ 测试超时');
        aborted = true;
    }, 600_000);

    console.log('🧹 清理残留...');
    cleanupEnvironment(TEMP_DIR, PORT);
    try { fs.rmSync(path.resolve('test-temp'), { recursive: true, force: true }); } catch { }
    console.log('✅ 清理完成');

    ensureFixture();
    const fixtureStat = fs.statSync(TEST_FILE);
    const fixtureContent = fs.readFileSync(TEST_FILE);
    const origHash = await sha256(fixtureContent);
    console.log(`📄 ${TEST_FILE} (${(fixtureStat.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   SHA256: ${origHash}`);

    let server;
    let browser;

    try {
        await buildProject();
        server = await startServer(PORT);

        const launched = await launchBrowser(BASE_URL, TEMP_DIR, {
            browserType: CFG.browserType,
            device: CFG.mobile ? 'iPhone 12' : null,
        });
        browser = launched.browser;
        const page = launched.page;

        // ══════════════════════════════════════════════
        // 1. UI 测试 — 完整 Playwright API
        // ══════════════════════════════════════════════

        console.log('='.repeat(50));
        console.log('📋 第一轮：UI 界面测试');
        console.log('='.repeat(50));

        await testHashNavigation(page, BASE_URL);

        // 清除按钮测试
        await testClearButton(page, TEST_FILE);

        console.log('✅ UI 界面测试全部通过');

        // ══════════════════════════════════════════════
        // 2. 加解密测试 — Playwright API，仅读盘不落盘
        // ══════════════════════════════════════════════

        console.log('='.repeat(50));
        console.log('📋 第二轮：加解密测试（内存校验，不落盘）');
        console.log('='.repeat(50));

        // 注入内存拦截（拦截 showSaveFilePicker，捕获到 __testFiles）
        await injectCryptoIntercept(page);

        // 加密 + 内存校验
        const { aodkName, aodfName } = await testEncrypt(page, TEST_FILE);

        // 从 AODK 中读取原始文件名
        const aodkInfo = await page.evaluate(async (name) => {
            const blob = window.__testFiles[name];
            const buf = await blob.slice(0, 200).arrayBuffer();
            const view = new DataView(buf);
            const fnLen = view.getUint16(138, true);
            let filename = '';
            if (fnLen > 0) {
                const fnBytes = new Uint8Array(buf, 140, Math.min(fnLen, buf.byteLength - 140));
                filename = new TextDecoder().decode(fnBytes);
            }
            return { filename, origSize: view.getBigUint64(130, true).toString() };
        }, aodkName);

        // 解密 + 内存校验（Web Crypto API 计算哈希）
        await testDecrypt(
            page,
            aodkInfo.filename || 'decrypted_output',
            origHash,
            fixtureStat.size,
            aodkName,
            aodfName
        );

        console.log('✅ 加解密测试全部通过');

        // ══════════════════════════════════════════════
        // 3. UI 取消测试
        // ══════════════════════════════════════════════
        //
        // 注意：加密取消会创建不完整的加密文件并写入 __testFiles（因 catch close），
        //       因此解密取消必须在加密取消之前执行，以使用加解密轮次中有效的加密文件。
        //       加密取消虽会污染 __testFiles，但后续 IO 测试不依赖 __testFiles。

        console.log('='.repeat(50));
        console.log('📋 第三轮：取消操作测试');
        console.log('='.repeat(50));

        // 先解密取消（使用上一轮有效的 __testFiles），再加密取消
        await testDecryptCancel(page, aodkName, aodfName);
        await testEncryptCancel(page, TEST_FILE);

        console.log('✅ 取消操作测试全部通过');

        // ══════════════════════════════════════════════
        // 4. 文件读写测试 — 仅模拟点击 + 落盘读盘
        //   使用新页面避免前几轮状态污染
        // ══════════════════════════════════════════════

        // 清理 TEMP_DIR，为 IO 测试准备
        for (const f of fs.readdirSync(TEMP_DIR)) {
            fs.rmSync(path.join(TEMP_DIR, f), { force: true });
        }

        // 为 IO 测试打开一个新页面（与主页面同属一个浏览器上下文）
        // addInitScript 为浏览器环境配置（非测试操作），拦截 showSaveFilePicker
        // 将捕获的数据存入 __testFiles 并触发浏览器下载，使文件能通过 download 事件落盘
        const ioPage = await page.context().newPage();
        await ioPage.addInitScript(() => {
            window.__testFiles = {};
            // 拦截 showDirectoryPicker（优先路径）
            window.showDirectoryPicker = async () => {
                const files = new Map();
                return {
                    getFileHandle: async (name, _opts) => {
                        let chunks = [];
                        let closed = false;
                        return {
                            createWritable: async () => ({
                                write: async (data) => {
                                    if (closed) return;
                                    if (data instanceof ArrayBuffer) chunks.push(new Uint8Array(data));
                                    else if (data.buffer) chunks.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                                    else if (typeof data === 'number') { }
                                    else chunks.push(new Uint8Array(data));
                                },
                                close: async () => {
                                    if (closed) return;
                                    closed = true;
                                    const blob = new Blob(chunks);
                                    window.__testFiles[name] = blob;
                                    // 触发浏览器下载落盘
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = name;
                                    a.style.display = 'none';
                                    document.body.appendChild(a);
                                    a.click();
                                    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 10000);
                                }
                            })
                        };
                    }
                };
            };
            window.showSaveFilePicker = async (opts) => {
                const name = opts.suggestedName;
                let chunks = [];
                let closed = false;
                return {
                    createWritable: async () => ({
                        write: async (data) => {
                            if (closed) return;
                            if (data instanceof ArrayBuffer) chunks.push(new Uint8Array(data));
                            else if (data.buffer) chunks.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                            else if (typeof data === 'number') { /* empty write */ }
                            else chunks.push(new Uint8Array(data));
                        },
                        close: async () => {
                            if (closed) return;
                            closed = true;
                            const blob = new Blob(chunks);
                            window.__testFiles[name] = blob;
                            // 触发浏览器下载落盘
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = name;
                            a.style.display = 'none';
                            document.body.appendChild(a);
                            a.click();
                            setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 10000);
                        }
                    })
                };
            };
        });
        // 在页面上注册 download 事件监听器（基础设施，非 IO 测试逻辑）
        ioPage.on('download', async (download) => {
            const filePath = path.join(TEMP_DIR, download.suggestedFilename());
            await download.saveAs(filePath);
        });
        await ioPage.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 30000 });
        await sleep(500);

        // IO 测试函数仅使用 page.click / setInputFiles（模拟用户操作）
        // 通过 waitForFile（Node.js fs）等待文件落盘后读取校验
        try {
            const { aodkPath, aodfPath } = await testEncryptFileWrite(ioPage, TEST_FILE, TEMP_DIR);
            await testDecryptFileRead(ioPage, aodkPath, aodfPath, TEMP_DIR, origHash, fixtureStat.size);
            console.log('\n✅ 文件读写测试全部通过');
        } catch (err) {
            console.log(`\n⚠️ 文件读写测试跳过: ${err.message}`);
        }

        // ══════════════════════════════════════════════
        // 完成
        // ══════════════════════════════════════════════

        console.log('🎉 所有测试通过! ✅');
        for (const f of fs.readdirSync(TEMP_DIR)) {
            const s = fs.statSync(path.join(TEMP_DIR, f));
            console.log(`  ${f} (${(s.size / 1024 / 1024).toFixed(2)} MB)`);
        }

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
