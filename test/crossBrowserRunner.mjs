/**
 * 跨浏览器 + 移动端测试运行器
 *
 * 依次使用 Chromium、Firefox、WebKit 的桌面端 + 移动端运行完整 E2E 测试。
 *
 * 用法：
 *   node test/crossBrowserRunner.mjs
 */

import { execSync } from 'child_process';

const scenarios = [
    { browser: 'chromium', mobile: false, label: 'Chromium 桌面端' },
    { browser: 'firefox', mobile: false, label: 'Firefox 桌面端' },
    { browser: 'webkit', mobile: false, label: 'WebKit 桌面端' },
    { browser: 'chromium', mobile: true, label: 'Chromium 移动端 (iPhone 12)' },
    { browser: 'firefox', mobile: true, label: 'Firefox 移动端 (iPhone 12)' },
    { browser: 'webkit', mobile: true, label: 'WebKit 移动端 (iPhone 12)' },
];

let allPassed = true;

for (const { browser, mobile, label } of scenarios) {
    console.log('\n' + '='.repeat(60));
    console.log(`  🤖 ${label}`);
    console.log('='.repeat(60));

    try {
        const output = execSync(
            `node test/runTests.mjs`,
            {
                cwd: process.cwd(),
                shell: true,
                timeout: 600_000,
                stdio: ['ignore', 'pipe', 'pipe'],
                encoding: 'utf8',
                env: {
                    ...process.env,
                    BROWSER: browser,
                    MOBILE: mobile ? '1' : '0',
                },
            }
        );

        if (output.includes('🎉 所有测试通过!')) {
            console.log(output.split('\n').slice(-6).join('\n'));
            console.log(`\n  ✅ ${label} 通过\n`);
        } else {
            console.log(output);
            console.log(`\n  ❌ ${label} 失败\n`);
            allPassed = false;
        }
    } catch (err) {
        console.error(`\n  ❌ ${label} 错误: ${err.message}\n`);
        allPassed = false;
    }
}

console.log('\n' + '='.repeat(60));
if (allPassed) {
    console.log('  🎉 所有浏览器测试通过!');
} else {
    console.log('  ❌ 部分浏览器测试失败');
}
console.log('='.repeat(60));

process.exit(allPassed ? 0 : 1);
