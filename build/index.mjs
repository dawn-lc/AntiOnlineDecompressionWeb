/**
 * 构建入口
 *
 * 构建三个 bundle：
 *   1. dist/bundle.js  — 主线程
 *   2. dist/worker.js  — Web Worker（需要 wasm）
 *   3. dist/sw.js      — ServiceWorker
 *
 * 并将 public/ 下的静态文件复制到 dist/
 *
 * 用法：
 *   node build/index.mjs        # 生产构建（压缩）
 *   node build/index.mjs --dev  # 开发构建（带 sourcemap）
 */
import fs from 'fs';
import path from 'path';
import { ROOT, OUT_DIR } from './config.mjs';
import { buildBundle } from './bundle.mjs';

const isDev = process.argv.includes('--dev');
const devOpts = isDev ? { sourcemap: true, minify: false } : {};
if (isDev) console.log('🔧 开发模式');

// 确保输出目录存在
fs.mkdirSync(OUT_DIR, { recursive: true });

// 主线程（无 wasm）
await buildBundle('src/main/index.ts', 'bundle.js', devOpts);

// Web Worker（需要 wasm）
await buildBundle('src/worker/CryptoWorker.ts', 'worker.js', { ...devOpts, useWasm: true });

// ServiceWorker（无 wasm）
await buildBundle('src/sw/DownloadSW.ts', 'sw.js', devOpts);

// 复制静态文件
fs.copyFileSync(path.resolve(ROOT, 'src/index.html'), path.resolve(OUT_DIR, 'index.html'));
fs.copyFileSync(path.resolve(ROOT, 'src/style.css'), path.resolve(OUT_DIR, 'style.css'));

console.log('✅ Build completed!');
