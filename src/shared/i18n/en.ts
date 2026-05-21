import type { LocaleBundle } from './types';

const en: LocaleBundle = {
    locale: 'en',
    label: 'English',
    messages: {
        'app.title': '🔐 Anti Online Decompression',
        'app.subtitle': 'File Encryption & Obfuscation Tool',

        'tab.encrypt': '🔒 Encrypt',
        'tab.decrypt': '🔓 Decrypt',

        'encrypt.drop.text': 'Drop file here, or click to select a file',
        'encrypt.drop.hint': 'Any file type, no size limit',
        'encrypt.btn': '🔒 Encrypt File',
        'encrypt.clear': '✕',

        'decrypt.selectKey': '① Select Key File',
        'decrypt.selectData': '② Select Encrypted File',
        'decrypt.keyPlaceholder': 'Click to select key file',
        'decrypt.dataPlaceholder': 'Click to select encrypted file',
        'decrypt.btn': '🔓 Decrypt File',

        'common.cancel': '✕ Cancel',

        'progress.format': '{done} / {total} ({percent}%)',

        'error.selectFile': 'Please select a file first',
        'error.selectBoth': 'Please select both the key file and the encrypted file',

        'console.loaded': 'App loaded. Select a file to encrypt or decrypt.',
        'console.encryptStart': 'Encrypting file: {name} ({size})',
        'console.encryptComplete': 'Encryption complete! AODK key file and AODF encrypted file saved.',
        'console.decryptStart': 'Decrypting file: {name}',
        'console.decryptComplete': 'Decryption complete! File saved as: {name}',
        'console.cancelled': 'Operation cancelled',
        'browser.hint': 'Recommended: Chrome / Edge ≥ 86',
        'browser.current': 'Your current browser is {browser}',
    },
};

export default en;
