import type { LocaleBundle } from './types';

const zhCN: LocaleBundle = {
    locale: 'zh-CN',
    label: '简体中文',
    messages: {
        'app.title': '🔐 反在线解压',
        'app.subtitle': '文件加密混淆工具',

        'tab.encrypt': '🔒 加密',
        'tab.decrypt': '🔓 解密',

        'encrypt.drop.text': '拖拽文件到此处，或 点击选择文件',
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
    },
};

export default zhCN;
