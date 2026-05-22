/**
 * 加解密测试 - 仅读盘不落盘，使用 Playwright API 进行直接校验
 *
 * 规则：
 * - 允许使用 Playwright API（page.evaluate, page.click, page.locator 等）
 * - 仅读取磁盘上的原始 fixture 文件（读盘）
 * - 加解密输出通过拦截 showSaveFilePicker 捕获在内存中（不落盘）
 * - 使用 Web Crypto API 在浏览器内计算哈希，直接验证（直接校验）
 */

import fs from 'fs';
import { sleep, sha256, dismissAlertOverlay } from './testUtils.mjs';

/** AODF 固定头部大小 */
const AODF_HEADER_SIZE = 42;

/**
 * 在浏览器中拦截 showSaveFilePicker，将输出捕获到 `window.__testFiles`
 * @param {import('playwright').Page} page
 */
export async function injectCryptoIntercept(page) {
    console.log('🔧 注入加解密内存拦截...');
    await page.evaluate(() => { window.__testFiles = {}; });

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
        // 拦截 showDirectoryPicker，以内存存储模拟目录写入
        window.showDirectoryPicker = async () => {
            const files = new Map();
            return {
                getFileHandle: async (name, _opts) => {
                    let chunks = [];
                    return {
                        createWritable: async () => ({
                            write: async (data) => {
                                if (data instanceof ArrayBuffer) chunks.push(new Uint8Array(data));
                                else if (data.buffer) chunks.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                                else if (typeof data === 'number') { }
                                else chunks.push(new Uint8Array(data));
                            },
                            close: async () => {
                                const blob = new Blob(chunks);
                                window.__testFiles[name] = blob;
                                console.log('[TEST] Captured:', name, blob.size);
                            }
                        })
                    };
                }
            };
        };
    });
    await sleep(500);
}

/**
 * 等待加解密操作完成，在 `__testFiles` 中出现指定后缀的文件
 * @param {import('playwright').Page} page
 * @param {object} include - { keyName: suffix }，匹配以 suffix 结尾的文件
 * @param {string[]} [excludeSuffixes] - 排除以这些后缀结尾的文件（用于查找解密文件）
 * @param {number} timeout
 * @returns {Promise<object>} { keyName: fileName }
 */
async function waitForTestFiles(page, include, excludeSuffixes = [], timeout = 300000) {
    for (let i = 0; i < timeout / 1000; i++) {
        const state = await page.evaluate(({ inc, exc }) => {
            const files = window.__testFiles || {};
            const keys = Object.keys(files);
            const err = window.__testLastError || '';
            const matched = {};

            // 正向匹配：查找以指定后缀结尾的文件
            for (const [key, suffix] of Object.entries(inc)) {
                if (suffix === '__not__') {
                    // 特殊标记：查找不包含任何排除后缀的文件
                    const found = keys.find(k => !exc.some(e => k.endsWith(e)));
                    matched[key] = found || null;
                } else {
                    matched[key] = keys.find(k => k.endsWith(suffix)) || null;
                }
            }

            return { matched, keys, error: err };
        }, { inc: include, exc: excludeSuffixes });

        if (state.error) throw new Error('操作错误: ' + state.error);
        const allFound = Object.values(state.matched).every(v => v !== null);
        if (allFound) {
            console.log('✅ 捕获到文件:', state.keys.join(', '));
            return state.matched;
        }
        if (i % 20 === 0) console.log(`等待中... ${i + 1}s | ${state.keys.join(', ') || '无'}`);
        await sleep(1000);
    }
    throw new Error('等待测试文件超时');
}

/**
 * 在浏览器中计算 Blob 的 SHA256 哈希（使用 Web Crypto API）
 */
async function computeBrowserSha256(page, blobName) {
    const hashHex = await page.evaluate(async (name) => {
        const blob = window.__testFiles[name];
        if (!blob) return null;
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }, blobName);
    return hashHex;
}

/**
 * 在浏览器中读取 AODK 文件前几个字段进行校验
 */
async function validateAodkHeaderInBrowser(page, aodkName) {
    return await page.evaluate(async (name) => {
        const blob = window.__testFiles[name];
        if (!blob) throw new Error(`未找到 ${name}`);
        const buf = await blob.slice(0, 200).arrayBuffer();
        const view = new DataView(buf);

        // magic (4 bytes)
        const magic = String.fromCharCode(
            new Uint8Array(buf, 0, 1)[0],
            new Uint8Array(buf, 1, 1)[0],
            new Uint8Array(buf, 2, 1)[0],
            new Uint8Array(buf, 3, 1)[0]
        );

        // version (uint16 LE)
        const version = view.getUint16(4, true);

        // headerSize (uint32 LE)
        const headerSize = view.getUint32(6, true);

        // key (32 bytes)
        const key = new Uint8Array(buf, 10, 32);
        const keyHex = Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('');

        // nonce (24 bytes) - 从 offset 42 开始
        const nonce = new Uint8Array(buf, 42, 24);
        const nonceHex = Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('');

        // uuid (32 bytes) - 从 offset 66 开始
        const uuid = new Uint8Array(buf, 66, 32);
        const uuidHex = Array.from(uuid).map(b => b.toString(16).padStart(2, '0')).join('');

        // fileHash (32 bytes) - 从 offset 98 开始
        const fileHash = new Uint8Array(buf, 98, 32);
        const fileHashHex = Array.from(fileHash).map(b => b.toString(16).padStart(2, '0')).join('');

        // originalFileSize (uint64 LE) - 从 offset 130 开始
        const originalFileSize = view.getBigUint64(130, true);

        // filenameLength (uint16 LE) - 从 offset 138 开始
        const filenameLength = view.getUint16(138, true);

        // filename - 从 offset 140 开始
        let filename = '';
        if (filenameLength > 0) {
            const fnBytes = new Uint8Array(buf, 140, Math.min(filenameLength, buf.byteLength - 140));
            filename = new TextDecoder().decode(fnBytes);
        }

        return {
            magic,
            version,
            headerSize,
            keyHex,
            nonceHex,
            uuidHex,
            fileHashHex,
            originalFileSize: originalFileSize.toString(),
            filenameLength,
            filename,
            blobSize: blob.size,
        };
    }, aodkName);
}

/**
 * 在浏览器中读取 AODF 文件头部进行校验
 */
async function validateAodfHeaderInBrowser(page, aodfName) {
    return await page.evaluate(async ({ name, expectedHeaderSize }) => {
        const blob = window.__testFiles[name];
        if (!blob) throw new Error(`未找到 ${name}`);
        const buf = await blob.slice(0, expectedHeaderSize).arrayBuffer();
        const view = new DataView(buf);

        const magic = String.fromCharCode(
            new Uint8Array(buf, 0, 1)[0],
            new Uint8Array(buf, 1, 1)[0],
            new Uint8Array(buf, 2, 1)[0],
            new Uint8Array(buf, 3, 1)[0]
        );
        const version = view.getUint16(4, true);
        const hdrSize = view.getUint32(6, true);
        const uuid = new Uint8Array(buf, 10, 32);
        const uuidHex = Array.from(uuid).map(b => b.toString(16).padStart(2, '0')).join('');

        return { magic, version, headerSize: hdrSize, uuidHex, blobSize: blob.size };
    }, aodfName);
}

/**
 * 完整加密测试（读盘 + 内存校验）
 * @param {import('playwright').Page} page
 * @param {string} testFilePath - 原始测试文件路径
 * @returns {Promise<{aodkName: string, aodfName: string}>} 内存中的文件名
 */
export async function testEncrypt(page, testFilePath) {
    console.log('\n🔒 ====== 加密测试（内存校验） ======');

    const origStat = fs.statSync(testFilePath);

    // 选择文件（Playwright API - 允许）
    await page.locator('#fileInput').setInputFiles(testFilePath);
    await sleep(1000);

    // 验证文件被选中
    const fileInfo = await page.evaluate(() => ({
        name: document.getElementById('encryptFileName')?.textContent,
        btnDisabled: document.getElementById('encryptBtn')?.disabled,
    }));
    console.log('文件已选择:', fileInfo.name);
    if (!fileInfo.name) throw new Error('文件选择失败');
    if (fileInfo.btnDisabled) throw new Error('加密按钮应启用');

    // 执行加密
    console.log('点击加密按钮...');
    await page.click('#encryptBtn');

    // 等待加密完成，捕获 AODK + AODF
    const matched = await waitForTestFiles(page, {
        aodk: '.aodk',
        aodf: '.aodf',
    });

    const aodkName = matched.aodk;
    const aodfName = matched.aodf;

    // ─── 内存校验 AODK Header ───
    console.log('📋 校验 AODK 文件头...');
    const aodkInfo = await validateAodkHeaderInBrowser(page, aodkName);
    console.log(`   Magic: ${aodkInfo.magic} (期望: AODK)`);
    console.log(`   Version: ${aodkInfo.version}`);
    console.log(`   HeaderSize: ${aodkInfo.headerSize}`);
    console.log(`   文件名: ${aodkInfo.filename}`);
    console.log(`   原始文件大小: ${aodkInfo.originalFileSize}`);
    console.log(`   文件大小: ${(aodkInfo.blobSize / 1024).toFixed(0)} KB`);

    if (aodkInfo.magic !== 'AODK') throw new Error(`AODK Magic 不匹配: ${aodkInfo.magic}`);
    if (aodkInfo.version !== 1) throw new Error(`AODK Version 不匹配: ${aodkInfo.version}`);

    // ─── 内存校验 AODF Header ───
    console.log('📋 校验 AODF 文件头...');
    const aodfInfo = await validateAodfHeaderInBrowser(page, { name: aodfName, expectedHeaderSize: AODF_HEADER_SIZE });
    console.log(`   Magic: ${aodfInfo.magic} (期望: AODF)`);
    console.log(`   Version: ${aodfInfo.version}`);
    console.log(`   HeaderSize: ${aodfInfo.headerSize}`);
    console.log(`   文件大小: ${(aodfInfo.blobSize / 1024 / 1024).toFixed(2)} MB`);

    if (aodfInfo.magic !== 'AODF') throw new Error(`AODF Magic 不匹配: ${aodfInfo.magic}`);
    if (aodfInfo.version !== 1) throw new Error(`AODF Version 不匹配: ${aodfInfo.version}`);

    // ─── 校验 UUID 一致性 ───
    if (aodkInfo.uuidHex !== aodfInfo.uuidHex) {
        throw new Error('AODK 与 AODF UUID 不匹配');
    }
    console.log('   ✅ UUID 一致');

    // 校验原始文件大小
    if (BigInt(aodkInfo.originalFileSize) !== BigInt(origStat.size)) {
        throw new Error(`原始文件大小不匹配: ${aodkInfo.originalFileSize} vs ${origStat.size}`);
    }
    console.log('   ✅ 原始文件大小匹配');

    // 关闭完成提示层
    await dismissAlertOverlay(page);

    console.log('✅ 加密测试通过（内存校验）');
    return { aodkName, aodfName };
}

/**
 * 完整解密测试（内存校验）
 * @param {import('playwright').Page} page
 * @param {string} origFilename - 原始文件名（用于验证解密结果文件名）
 * @param {string} origHash - 原始文件 SHA256
 * @param {number} origSize - 原始文件大小
 * @param {string} aodkName - 内存中的 AODK 文件名
 * @param {string} aodfName - 内存中的 AODF 文件名
 */
export async function testDecrypt(page, origFilename, origHash, origSize, aodkName, aodfName) {
    console.log('🔓 ====== 解密测试（内存校验） ======');

    // 切换到解密面板
    await page.click('.tab[data-tab="decrypt"]');
    await sleep(500);

    // 使用 DataTransfer 将内存中的 Blob 设置到文件输入框
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
                Object.defineProperty(input, 'files', { value: dt.files });
            }
        };

        setFiles(i1, f1);
        setFiles(i2, f2);
        i1.dispatchEvent(new Event('change'));
        i2.dispatchEvent(new Event('change'));
    }, { aodk: aodkName, aodf: aodfName });

    await sleep(500);

    // 验证解密按钮可用
    const btnReady = await page.evaluate(() => !document.getElementById('decryptBtn')?.disabled);
    if (!btnReady) throw new Error('解密按钮未启用');

    // 执行解密
    console.log('点击解密按钮...');
    await page.click('#decryptBtn');

    // 等待解密完成，捕获解密后的文件（排除 .aodk/.aodf 后缀）
    const matched = await waitForTestFiles(page, {
        decrypted: '__not__',
    }, ['.aodk', '.aodf']);

    const decFileName = matched.decrypted;
    console.log(`解密输出文件名: ${decFileName}`);

    // 从 AODK 中读取原始文件名进行比对
    const aodkInfo = await validateAodkHeaderInBrowser(page, aodkName);
    if (decFileName !== aodkInfo.filename) {
        console.log(`   ⚠️ 解密文件名 "${decFileName}" 与 AODK 记录的 "${aodkInfo.filename}" 不同（可能为附加处理）`);
    }

    // ─── 内存校验：计算解密后文件的 SHA256 ───
    console.log('📋 计算解密文件哈希（浏览器内 Web Crypto API）...');
    const decHash = await computeBrowserSha256(page, decFileName);
    const decSize = await page.evaluate((name) => {
        const blob = window.__testFiles[name];
        return blob ? blob.size : -1;
    }, decFileName);

    console.log(`   原始大小: ${origSize} bytes`);
    console.log(`   解密大小: ${decSize} bytes`);
    console.log(`   原始 SHA256: ${origHash}`);
    console.log(`   解密 SHA256: ${decHash}`);

    if (decSize !== origSize) throw new Error(`文件大小不匹配: ${decSize} vs ${origSize}`);
    console.log('   ✅ 文件大小匹配');

    if (decHash !== origHash) throw new Error(`文件内容不一致: SHA256 不匹配`);
    console.log('   ✅ 文件内容完全一致! SHA256 匹配');

    // 关闭完成提示层
    await dismissAlertOverlay(page);

    console.log('✅ 解密测试通过（内存校验）');
}
