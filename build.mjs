import esbuild from 'esbuild';
import { wasmLoader } from 'esbuild-plugin-wasm';
import path from 'path';
import fs from 'fs';

/**
 * 自定义 resolve 插件：将 libsodium-wrappers ESM 中的 `./libsodium.mjs` 
 * 映射到 node_modules/libsodium/dist/modules-esm/libsodium.mjs
 */
const resolveLibsodiumPlugin = {
  name: 'resolve-libsodium',
  setup(build) {
    // 当解析 ./libsodium.mjs 时（在 libsodium-wrappers 的上下文中）
    build.onResolve({ filter: /^\.\/libsodium\.mjs$/ }, (args) => {
      return {
        path: path.resolve('node_modules/libsodium/dist/modules-esm/libsodium.mjs'),
        external: false,
      };
    });
    // 当 libsodium.mjs 内部引用自身相对路径资源时
    build.onResolve({ filter: /^\.\// }, (args) => {
      // 仅在 libsodium 包内处理
      if (args.importer.includes('libsodium')) {
        const resolved = path.resolve(path.dirname(args.importer), args.path);
        if (fs.existsSync(resolved)) {
          return { path: resolved, external: false };
        }
      }
      return undefined; // 让 esbuild 默认处理
    });
  },
};

const plugins = [resolveLibsodiumPlugin, wasmLoader({ mode: 'deferred' })];

// 主线程构建
await esbuild.build({
  entryPoints: ['src/main/index.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  sourcemap: false,
  minify: true,
  plugins,
});

// Worker 线程构建
await esbuild.build({
  entryPoints: ['src/worker/CryptoWorker.ts'],
  bundle: true,
  outfile: 'dist/worker.js',
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  sourcemap: false,
  minify: true,
  plugins,
});

// ServiceWorker 构建
await esbuild.build({
  entryPoints: ['src/sw/DownloadSW.ts'],
  bundle: true,
  outfile: 'dist/sw.js',
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  sourcemap: false,
  minify: true,
  plugins,
});

// 将 public/index.html 和 style.css 复制到 dist/
fs.copyFileSync('public/index.html', 'dist/index.html');
fs.copyFileSync('public/style.css', 'dist/style.css');
console.log('✅ Build completed!');
