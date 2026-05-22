/**
 * 测试工具函数
 */
import { spawn, execSync } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

/** 等待服务器就绪 */
export async function waitForServer(url, timeout = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        try {
            const resp = await fetch(url);
            if (resp.ok) return true;
        } catch { }
        await sleep(500);
    }
    throw new Error(`Server at ${url} did not start within ${timeout}ms`);
}

/** 等待文件下载完成 */
export async function waitForDownload(tempDir, filePath, timeout = 30000) {
    const target = path.resolve(tempDir, filePath);
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (fs.existsSync(target)) {
            const size1 = fs.statSync(target).size;
            await sleep(500);
            try {
                const size2 = fs.statSync(target).size;
                if (size2 === size1) return true;
            } catch { }
        }
        await sleep(500);
    }
    return fs.existsSync(target);
}

/** 延时 */
export function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * 关闭页面内 "操作完成" 提示层（点击"确定"/"OK"按钮）
 * 如果页面上没有提示层则直接返回
 */
export async function dismissAlertOverlay(page) {
    try {
        const btn = page.locator('#alertOverlayOk');
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await btn.click();
            console.log('    ✅ 提示层已关闭');
        }
    } catch { /* 没有提示层，忽略 */ }
}

/** 计算 SHA256 */
export async function sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

/** 等待文件出现（用于监听下载目录） */
export async function waitForFile(tempDir, ext, timeout = 60000) {
    for (let i = 0; i < timeout / 1000; i++) {
        const files = fs.readdirSync(tempDir).filter(f => f.endsWith(ext) && !f.endsWith('.crdownload'));
        if (files.length > 0) return files[0];
        await sleep(1000);
    }
    throw new Error(`未找到 ${ext} 文件`);
}

/** 清理临时目录（浏览器和服务器由 Playwright / spawn 自行管理生命周期） */
export function cleanupEnvironment(tempDir, port) {
    // 清理上一次测试的下载残留文件
    if (fs.existsSync(tempDir)) {
        for (const f of fs.readdirSync(tempDir)) {
            fs.rmSync(path.join(tempDir, f), { force: true, recursive: true });
        }
        fs.rmdirSync(tempDir);
    }
    fs.mkdirSync(tempDir, { recursive: true });
}

/** 构建项目 */
export async function buildProject() {
    console.log('\n🔨 构建项目...');
    const build = spawn('node', ['build/index.mjs'], {
        cwd: process.cwd(), stdio: 'pipe'
    });
    await new Promise((resolve, reject) => {
        let out = '';
        build.stdout.on('data', d => out += d);
        build.stderr.on('data', d => out += d);
        build.on('exit', (code) => code === 0 ? resolve() : reject(new Error(out)));
    });
    console.log('✅ 构建完成');
}

/** 启动测试服务器 */
export async function startServer(port) {
    console.log('\n🚀 启动服务器...');
    const server = spawn('cmd', ['/c', 'npx', 'serve', 'dist', '-p', String(port), '--no-clipboard', '--cors'], {
        cwd: process.cwd(), stdio: 'pipe'
    });
    server.stdout.on('data', d => process.stdout.write('[serve] ' + d));
    server.stderr.on('data', d => process.stderr.write('[serve-err] ' + d));
    await waitForServer(`http://localhost:${port}`);
    console.log('✅ 服务器已启动');
    return server;
}

/** 浏览器引擎启动器映射 */
const ENGINE_MAP = {
    chromium: { key: 'chromium', label: 'Chromium' },
    firefox: { key: 'firefox', label: 'Firefox' },
    webkit: { key: 'webkit', label: 'WebKit' },
};

/**
 * 启动浏览器并配置页面
 * @param {string} baseUrl
 * @param {string} tempDir
 * @param {object} [options]
 * @param {string} [options.browserType='chromium'] - 浏览器类型: chromium | firefox | webkit
 * @param {string|null} [options.device=null] - 设备名称（如 'iPhone 12'），null 表示桌面端
 */
export async function launchBrowser(baseUrl, tempDir, { browserType = 'chromium', device = null } = {}) {
    const engine = ENGINE_MAP[browserType];
    if (!engine) throw new Error(`未知浏览器类型: ${browserType}`);

    const deviceLabel = device ? ` (${device})` : '';
    console.log(`\n🤖 启动 Playwright [${engine.label}]${deviceLabel}...`);
    const playwright = await import('playwright');
    const { chromium, firefox, webkit } = playwright;

    const launcher = { chromium, firefox, webkit }[browserType];
    const browser = await launcher.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const contextOptions = {};
    if (device) {
        const deviceConfig = { ...playwright.devices[device] };
        // Firefox 不支持 isMobile / hasTouch，移除避免报错
        if (browserType === 'firefox') {
            delete deviceConfig.isMobile;
            delete deviceConfig.hasTouch;
        }
        Object.assign(contextOptions, deviceConfig);
        console.log(`📱 已模拟设备: ${device}`);
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // 监听下载事件，保存文件到 TEMP_DIR
    page.on('download', async (download) => {
        const filePath = path.join(tempDir, download.suggestedFilename());
        await download.saveAs(filePath);
        console.log(`[下载] ${download.suggestedFilename()} → ${filePath}`);
    });

    await page.evaluate(() => {
        window.__testLastError = '';
        const origError = console.error;
        console.error = (...args) => {
            window.__testLastError = args.join(' ');
            origError.apply(console, args);
        };
    });

    page.on('console', msg => {
        const t = msg.text();
        if (t.includes('[TEST]') || t.includes('error') || t.includes('[Worker]')
            || t.includes('[保存]') || t.includes('[加密]') || t.includes('[解密]')) {
            console.log(`[${engine.label}${deviceLabel}] ${t}`);
        }
    });
    page.on('pageerror', err => {
        console.log(`[${engine.label}${deviceLabel} 错误]`, err.message);
        page.evaluate((m) => { window.__testLastError = m; }, err.message).catch(() => { });
    });

    console.log(`📄 [${engine.label}] 打开页面...`);
    await page.goto(baseUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    console.log(`✅ [${engine.label}] 页面标题:`, await page.title());
    return { browser, page };
}


