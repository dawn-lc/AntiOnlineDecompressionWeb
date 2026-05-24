import type { LocaleMessages } from './types';

const en: LocaleMessages = {
    'app.title': '🔐 Anti Online Decompression',
    'app.subtitle': 'Key-data separation — cloud storage can\'t scan your files',

    'tab.encrypt': '🔒 Encrypt',
    'tab.decrypt': '🔓 Decrypt',

    'encrypt.drop.text': 'Drop file here, or <strong>click to select a file</strong>',
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

    'alert.encryptComplete': 'Encryption complete',
    'alert.decryptComplete': 'Decryption complete',
    'alert.ok': 'OK',

    'browser.unsupportedTitle': 'Browser Not Supported',
    'browser.unsupportedDesc': 'Your browser does not support the file saving feature.<br>Please use Chrome or Edge to access this page.',

    'browser.unsupportedHttpsTitle': 'HTTPS Required',
    'browser.unsupportedHttpsDesc': 'Due to browser security requirements, the file saving feature requires a secure connection (HTTPS).<br>Please access this page via HTTPS or localhost.',

    'browser.openEdge': 'Open with Microsoft Edge',
    'browser.openChrome': 'Open with Google Chrome',

    'about.title': '📖 About This Tool',
    'why.title': '🤔 Why Anti Online Decompression?',
    'philosophy.what': 'What is "Anti Online Decompression"?',
    'philosophy.whatDesc': 'Preventing cloud storage services from automatically scanning your files. When you upload files to certain cloud drives, they may secretly decompress and scan your content in the background — whether you know it or not.',
    'philosophy.problemTitle': 'Traditional Approach',
    'philosophy.problem.unencrypted': 'Plain files are scanned directly, content is completely transparent',
    'philosophy.problem.encrypted': 'Password-protected archives seem safe, but once someone uses "online decompression" and enters the password, the service can scan your archive freely',
    'philosophy.solution': 'Key-Data Separation Design',
    'philosophy.solutionDesc1': 'Encryption produces two files: <strong>AODK (Key)</strong> and <strong>AODF (Encrypted Data)</strong> — both are required to decrypt',
    'philosophy.solutionDesc2': 'The AODK file is tiny (only a few hundred bytes) and should be <strong>distributed separately via channels you trust to be secure</strong>, never uploaded alongside the encrypted data',
    'philosophy.solutionDesc3': 'The AODF file can be freely distributed via <strong>any channel (cloud storage, email, instant messaging, etc.)</strong> — the service provider cannot scan its contents',
};

export default en;
