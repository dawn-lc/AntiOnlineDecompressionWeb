import type { LocaleMessages } from './types';

const ko: LocaleMessages = {
    'app.title': '🔐 온라인 압축해제 방지',
    'app.subtitle': '키와 데이터 분리 — 클라우드가 파일을 스캔할 수 없습니다',

    'tab.encrypt': '🔒 암호화',
    'tab.decrypt': '🔓 복호화',

    'encrypt.drop.text': '파일을 드롭하거나 <strong>클릭하여 선택</strong>',
    'encrypt.drop.hint': '모든 파일 형식, 크기 제한 없음',
    'encrypt.btn': '🔒 파일 암호화',
    'encrypt.clear': '✕',

    'decrypt.selectKey': '① 키 파일 선택',
    'decrypt.selectData': '② 암호화된 파일 선택',
    'decrypt.keyPlaceholder': '클릭하여 키 파일 선택',
    'decrypt.dataPlaceholder': '클릭하여 암호화된 파일 선택',
    'decrypt.btn': '🔓 파일 복호화',

    'common.cancel': '✕ 취소',

    'progress.format': '{done} / {total} ({percent}%)',

    'error.selectFile': '파일을 먼저 선택하세요',
    'error.selectBoth': '키 파일과 암호화된 파일을 모두 선택하세요',

    'console.loaded': '앱이 로드되었습니다. 암호화 또는 복호화할 파일을 선택하세요.',
    'console.encryptStart': '파일 암호화 중: {name} ({size})',
    'console.encryptComplete': '암호화 완료! AODK 키 파일과 AODF 암호화 파일이 저장되었습니다.',
    'console.decryptStart': '파일 복호화 중: {name}',
    'console.decryptComplete': '복호화 완료! 파일이 저장되었습니다: {name}',
    'console.cancelled': '작업이 취소되었습니다',

    'alert.encryptComplete': '암호화 완료',
    'alert.decryptComplete': '복호화 완료',
    'alert.ok': '확인',

    'browser.unsupportedTitle': '지원되지 않는 브라우저',
    'browser.unsupportedDesc': '현재 브라우저는 파일 저장 기능을 지원하지 않습니다.<br>Chrome 또는 Edge를 사용하여 접속해 주세요.',

    'browser.unsupportedHttpsTitle': 'HTTPS 필요',
    'browser.unsupportedHttpsDesc': '브라우저 보안 요구사항으로 인해 파일 저장 기능을 사용하려면 보안 연결(HTTPS)이 필요합니다.<br>HTTPS 또는 localhost를 통해 접속해 주세요.',

    'browser.openEdge': 'Microsoft Edge로 열기',
    'browser.openChrome': 'Google Chrome으로 열기',
};

export default ko;
