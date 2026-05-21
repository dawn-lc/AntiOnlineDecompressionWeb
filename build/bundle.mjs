/**
 * 单个 bundle 构建函数
 */
import esbuild from 'esbuild';
import { wasmLoader } from 'esbuild-plugin-wasm';
import { PLUGINS, COMMON_OPTS, OUT_DIR, TARGET } from './config.mjs';

/** WASM 加载插件（延迟初始化，仅 Worker bundle 需要） */
const WASM_PLUGIN = wasmLoader({ mode: 'deferred' });

/**
 * 构建一个入口 bundle
 * @param {string} entry - 相对于项目根目录的入口文件路径
 * @param {string} outfile - 输出文件名（相对于 dist/）
 * @param {object} [overrides] - 覆盖 COMMON_OPTS 的选项
 * @param {boolean} [overrides.useWasm] - 是否启用 wasm 插件
 */
export async function buildBundle(entry, outfile, overrides = {}) {
    const { useWasm = false, ...extraOpts } = overrides;
    const plugins = useWasm ? [...PLUGINS, WASM_PLUGIN] : PLUGINS;
    await esbuild.build({
        format: 'esm',
        target: TARGET,
        platform: 'browser',
        sourcemap: false,
        minify: true,
        bundle: true,
        ...extraOpts,
        entryPoints: [entry],
        outfile: `${OUT_DIR}/${outfile}`,
        plugins,
    });
}
