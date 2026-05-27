import type { LocaleMessages } from './types';

const zhCN: LocaleMessages = {
    'app.title': '🔐 反在线解压',
    'app.subtitle': '密钥与数据分离，网盘无法扫描你的文件',

    'tab.encrypt': '🔒 加密',
    'tab.decrypt': '🔓 解密',

    'encrypt.drop.text': '拖拽文件到此处，或 <strong>点击选择文件</strong>',
    'encrypt.drop.hint': '支持任意文件类型，不限大小',
    'encrypt.btn': '🔒 加密文件',
    'encrypt.clear': '✕',

    'decrypt.selectKey': '① 选择密钥文件',
    'decrypt.selectData': '② 选择加密文件',
    'decrypt.keyPlaceholder': '点击选择密钥文件',
    'decrypt.dataPlaceholder': '点击选择加密文件',
    'decrypt.btn': '🔓 解密文件',

    'common.cancel': '✕ 取消',

    'progress.format': '{done} / {total} ({percent}%)',

    'error.selectFile': '请先选择要加密的文件',
    'error.selectBoth': '请同时选择密钥文件和加密文件',

    'console.loaded': '应用已加载，请选择文件进行加密或解密操作',
    'console.encryptStart': '开始加密文件: {name} ({size})',
    'console.encryptComplete': '加密完成！AODK 密钥文件和 AODF 加密文件已保存。',
    'console.decryptStart': '开始解密文件: {name}',
    'console.decryptComplete': '解密完成！文件已保存为: {name}',
    'console.cancelled': '操作已取消',

    'alert.encryptComplete': '加密完成',
    'alert.decryptComplete': '解密完成',
    'alert.ok': '确定',

    'browser.unsupportedTitle': '浏览器不支持',
    'browser.unsupportedDesc': '当前浏览器不支持文件保存功能。<br>请使用 Chrome 或 Edge 访问此页面。',

    'browser.unsupportedHttpsTitle': '需要 HTTPS',
    'browser.unsupportedHttpsDesc': '受浏览器安全要求限制，文件保存功能需要安全连接 (HTTPS)。<br>请通过 HTTPS 或 localhost 访问此页面。',

    'browser.openEdge': '使用 Microsoft Edge 打开',
    'browser.openChrome': '使用 Google Chrome 打开',

    'about.title': '📖 关于本工具',
    'why.title': '🤔 为什么需要反在线解压？',
    'philosophy.what': '什么是「反在线解压」？',
    'philosophy.whatDesc': '防止某些网盘对文件的自动扫描。当你在网盘上传文件时，它们可能在后台偷偷解压并扫描你的内容——无论你是否知情。',
    'philosophy.problemTitle': '传统方案',
    'philosophy.problem.unencrypted': '普通文件会被直接扫描，内容完全透明',
    'philosophy.problem.encrypted': '带密码的加密压缩包看似安全，但只要有人使用了"在线解压"并输入密码，服务方就可以畅通无阻地扫描',
    'philosophy.solution': '密钥-数据分离设计',
    'philosophy.solutionDesc1': '加密后产生两个文件：<strong>AODK（密钥）</strong> 和 <strong>AODF（加密数据）</strong>，必须同时拥有才能解密',
    'philosophy.solutionDesc2': 'AODK 文件极小（仅几百字节），应在<strong>你确定安全的渠道</strong>单独分发，绝不随加密数据一起上传',
    'philosophy.solutionDesc3': 'AODF 文件即使上传至任何云存储，服务方也无法扫描其内容，可通过<strong>任意渠道（网盘、邮件、即时通讯等）</strong>自由分发',
};

export default zhCN;
