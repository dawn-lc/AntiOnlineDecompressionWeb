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

    'about.title': '📖 이 도구에 대하여',
    'why.title': '🤔 왜 온라인 압축해제 방지가 필요한가?',
    'philosophy.what': '「온라인 압축해제 방지」란?',
    'philosophy.whatDesc': '클라우드 스토리지가 파일을 자동으로 스캔하는 것을 방지합니다. 파일을 업로드하면 백그라운드에서 몰래 압축을 풀고 내용을 스캔할 수 있습니다——여러분이 알든 모르든.',
    'philosophy.problemTitle': '기존 방식',
    'philosophy.problem.unencrypted': '일반 파일은 직접 스캔되며, 내용이 완전히 투명합니다',
    'philosophy.problem.encrypted': '암호로 보호된 압축 파일도 누군가 "온라인 압축해제"를 사용하여 암호를 입력하면 서비스가 자유롭게 스캔할 수 있습니다',
    'philosophy.solution': '키-데이터 분리 설계',
    'philosophy.solutionDesc1': '암호화 후 <strong>AODK(키)</strong>와 <strong>AODF(암호화 데이터)</strong> 두 파일이 생성되며, 둘 다 있어야 복호화할 수 있습니다',
    'philosophy.solutionDesc2': 'AODK 파일은 수백 바이트에 불과하며, <strong>안전하다고 확신하는 채널을 통해 별도로 배포</strong>하고 암호화 데이터와 함께 절대 업로드하지 마세요',
    'philosophy.solutionDesc3': 'AODF 파일은 <strong>모든 채널(클라우드 스토리지, 이메일, 메신저 등)을 통해 자유롭게 배포</strong>할 수 있으며, 서비스 제공자는 내용을 스캔할 수 없습니다',
};

export default ko;
