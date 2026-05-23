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
};

export default zhCN;
