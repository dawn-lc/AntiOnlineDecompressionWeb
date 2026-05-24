import type { LocaleMessages } from './types';

const ja: LocaleMessages = {
    'app.title': '🔐 オンライン解凍防止',
    'app.subtitle': '鍵とデータを分離 — クラウドストレージにスキャンされない',

    'tab.encrypt': '🔒 暗号化',
    'tab.decrypt': '🔓 復号',

    'encrypt.drop.text': 'ファイルをドロップするか、<strong>クリックして選択</strong>',
    'encrypt.drop.hint': 'あらゆるファイル形式、サイズ制限なし',
    'encrypt.btn': '🔒 ファイルを暗号化',
    'encrypt.clear': '✕',

    'decrypt.selectKey': '① 鍵ファイルを選択',
    'decrypt.selectData': '② 暗号化ファイルを選択',
    'decrypt.keyPlaceholder': 'クリックして鍵ファイルを選択',
    'decrypt.dataPlaceholder': 'クリックして暗号化ファイルを選択',
    'decrypt.btn': '🔓 ファイルを復号',

    'common.cancel': '✕ キャンセル',

    'progress.format': '{done} / {total} ({percent}%)',

    'error.selectFile': 'ファイルを選択してください',
    'error.selectBoth': '鍵ファイルと暗号化ファイルの両方を選択してください',

    'console.loaded': 'アプリを読み込みました。ファイルを選択して暗号化または復号してください。',
    'console.encryptStart': 'ファイルを暗号化中: {name} ({size})',
    'console.encryptComplete': '暗号化完了！AODK鍵ファイルとAODF暗号化ファイルを保存しました。',
    'console.decryptStart': 'ファイルを復号中: {name}',
    'console.decryptComplete': '復号完了！ファイルを保存しました: {name}',
    'console.cancelled': '操作をキャンセルしました',

    'alert.encryptComplete': '暗号化完了',
    'alert.decryptComplete': '復号完了',
    'alert.ok': 'OK',

    'browser.unsupportedTitle': '未対応ブラウザ',
    'browser.unsupportedDesc': 'お使いのブラウザはファイル保存機能に対応していません。<br>Chrome または Edge をご利用ください。',

    'browser.unsupportedHttpsTitle': 'HTTPS が必要です',
    'browser.unsupportedHttpsDesc': 'ブラウザのセキュリティ要件により、ファイル保存機能にはセキュアな接続 (HTTPS) が必要です。<br>HTTPS または localhost でアクセスしてください。',

    'browser.openEdge': 'Microsoft Edge で開く',
    'browser.openChrome': 'Google Chrome で開く',

    'about.title': '📖 このツールについて',
    'why.title': '🤔 なぜ「オンライン解凍防止」が必要なのか？',
    'philosophy.what': '「オンライン解凍防止」とは？',
    'philosophy.whatDesc': 'クラウドストレージによるファイルの自動スキャンを防ぎます。ファイルをアップロードすると、バックグラウンドで密かに解凍・スキャンされる可能性があります——あなたの知らないところで。',
    'philosophy.problemTitle': '従来の方法',
    'philosophy.problem.unencrypted': '通常のファイルは直接スキャンされ、内容が完全に公開されます',
    'philosophy.problem.encrypted': 'パスワード付きアーカイブも、「オンライン解凍」でパスワードが入力されればサービス側が自由にスキャンできます',
    'philosophy.solution': 'キー-データ分離設計',
    'philosophy.solutionDesc1': '暗号化後、<strong>AODK（鍵）</strong> と <strong>AODF（暗号化データ）</strong> の2つのファイルが生成され、両方が揃わないと復号できません',
    'philosophy.solutionDesc2': 'AODKファイルはわずか数百バイトで、<strong>あなたが安全だと確信できる経路で別途配布</strong>し、暗号化データと一緒に絶対にアップロードしないでください',
    'philosophy.solutionDesc3': 'AODFファイルは<strong>あらゆる経路（クラウドストレージ、メール、SNS等）で自由に配布</strong>でき、サービス側は内容をスキャンできません',
};

export default ja;
