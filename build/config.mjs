/**
 * 共享构建配置
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

/** 浏览器目标 */
export const TARGET = 'es2022';

/** 输出目录 */
export const OUT_DIR = path.resolve(ROOT, 'dist');

/** esbuild 通用选项 */
export const COMMON_OPTS = {
    format: 'esm',
    target: TARGET,
    platform: 'browser',
    sourcemap: false,
    minify: true,
    bundle: true,
};

/**
 * 自定义 resolve 插件：将 libsodium-wrappers ESM 中的 `./libsodium.mjs`
 * 映射到 node_modules/libsodium/dist/modules-esm/libsodium.mjs
 */
export const resolveLibsodiumPlugin = {
    name: 'resolve-libsodium',
    setup(build) {
        // 当解析 ./libsodium.mjs 时（在 libsodium-wrappers 的上下文中）
        build.onResolve({ filter: /^\.\/libsodium\.mjs$/ }, (args) => {
            return {
                path: path.resolve(ROOT, 'node_modules/libsodium/dist/modules-esm/libsodium.mjs'),
                external: false,
            };
        });
        // 当 libsodium.mjs 内部引用自身相对路径资源时
        build.onResolve({ filter: /^\.\// }, (args) => {
            if (args.importer.includes('libsodium')) {
                const resolved = path.resolve(path.dirname(args.importer), args.path);
                if (fs.existsSync(resolved)) {
                    return { path: resolved, external: false };
                }
            }
            return undefined;
        });
    },
};

export const PLUGINS = [resolveLibsodiumPlugin];
