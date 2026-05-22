/**
 * 生成测试用的大文件
 *
 * 用法： node test/generateFixture.mjs [size_in_MB]
 * 默认生成 512MB
 */

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

const sizeMB = parseInt(process.argv[2], 10) || 512;
const size = sizeMB * 1024 * 1024;
const dest = path.resolve('test/fixtures/1.mp4');

console.log(`正在生成 ${sizeMB}MB 测试文件: ${dest} ...`);

const buf = Buffer.alloc(1048576, 0);
crypto.randomFillSync(buf);
const fd = fs.openSync(dest, 'w');
let written = 0;
while (written < size) {
    const chunk = written + buf.length > size ? buf.slice(0, size - written) : buf;
    fs.writeSync(fd, chunk, 0, chunk.length);
    written += chunk.length;
}
fs.closeSync(fd);

const stat = fs.statSync(dest);
console.log(`已生成: ${(stat.size / 1024 / 1024).toFixed(0)} MB`);
