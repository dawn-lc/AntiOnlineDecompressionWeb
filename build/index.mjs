/**
 * 构建入口
 *
 * 构建两个 bundle：
 *   1. dist/bundle.js  — 主线程
 *   2. dist/worker.js  — Web Worker（需要 wasm）
 *
 * 复制 src/ 下的静态文件到 dist/。
 *
 * 用法：
 *   node build/index.mjs        # 生产构建（压缩）
 *   node build/index.mjs --dev  # 开发构建（带 sourcemap）
 *   node build/index.mjs --no-lint  # 跳过 tsc 类型检查
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { ROOT, OUT_DIR } from './config.mjs';
import { buildBundle } from './bundle.mjs';

const isDev = process.argv.includes('dev');
const devOpts = isDev ? { sourcemap: true, minify: false } : {};
if (isDev) console.log('🔧 开发模式');

// 类型检查（可通过 --no-lint 跳过）
if (!process.argv.includes('--no-lint')) {
    console.log('🔍 正在检查 TypeScript 类型错误…');
    try {
        execSync('npx tsc --noEmit --project tsconfig.json', {
            cwd: ROOT,
            stdio: 'inherit',
        });
        console.log('✅ 类型检查通过');
    } catch {
        console.error('\n❌ 类型检查失败，请修复上述错误后重试。');
        console.error('   如需跳过类型检查，请使用 --no-lint 参数。');
        process.exit(1);
    }
}

// 确保输出目录存在
fs.mkdirSync(OUT_DIR, { recursive: true });

// 主线程（无 wasm）
await buildBundle('src/main/index.ts', 'bundle.js', devOpts);

// Web Worker（需要 wasm）
await buildBundle('src/worker/CryptoWorker.ts', 'worker.js', { ...devOpts, useWasm: true });

// 复制静态文件
fs.copyFileSync(path.resolve(ROOT, 'src/index.html'), path.resolve(OUT_DIR, 'index.html'));
fs.copyFileSync(path.resolve(ROOT, 'src/style.css'), path.resolve(OUT_DIR, 'style.css'));

console.log('✅ Build completed!');
