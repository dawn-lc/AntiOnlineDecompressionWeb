import type { LocaleMessages } from './types';

const de: LocaleMessages = {
    'app.title': '🔐 Anti Online-Dekomprimierung',
    'app.subtitle': 'Schlüssel und Daten trennen — Cloud-Speicher kann Ihre Dateien nicht scannen',

    'tab.encrypt': '🔒 Verschlüsseln',
    'tab.decrypt': '🔓 Entschlüsseln',

    'encrypt.drop.text': 'Datei hier ablegen oder <strong>klicken zum Auswählen</strong>',
    'encrypt.drop.hint': 'Beliebiger Dateityp, keine Größenbeschränkung',
    'encrypt.btn': '🔒 Datei verschlüsseln',
    'encrypt.clear': '✕',

    'decrypt.selectKey': '① Schlüsseldatei auswählen',
    'decrypt.selectData': '② Verschlüsselte Datei auswählen',
    'decrypt.keyPlaceholder': 'Klicken zur Auswahl der Schlüsseldatei',
    'decrypt.dataPlaceholder': 'Klicken zur Auswahl der verschlüsselten Datei',
    'decrypt.btn': '🔓 Datei entschlüsseln',

    'common.cancel': '✕ Abbrechen',

    'progress.format': '{done} / {total} ({percent}%)',

    'error.selectFile': 'Bitte wählen Sie zuerst eine Datei aus',
    'error.selectBoth': 'Bitte wählen Sie sowohl die Schlüsseldatei als auch die verschlüsselte Datei aus',

    'console.loaded': 'App geladen. Wählen Sie eine Datei zum Verschlüsseln oder Entschlüsseln.',
    'console.encryptStart': 'Verschlüssle Datei: {name} ({size})',
    'console.encryptComplete': 'Verschlüsselung abgeschlossen! AODK-Schlüsseldatei und AODF-verschlüsselte Datei gespeichert.',
    'console.decryptStart': 'Entschlüssle Datei: {name}',
    'console.decryptComplete': 'Entschlüsselung abgeschlossen! Datei gespeichert als: {name}',
    'console.cancelled': 'Vorgang abgebrochen',

    'alert.encryptComplete': 'Verschlüsselung abgeschlossen',
    'alert.decryptComplete': 'Entschlüsselung abgeschlossen',
    'alert.ok': 'OK',

    'browser.unsupportedTitle': 'Browser nicht unterstützt',
    'browser.unsupportedDesc': 'Ihr Browser unterstützt die Dateispeicherfunktion nicht.<br>Bitte verwenden Sie Chrome oder Edge, um auf diese Seite zuzugreifen.',

    'browser.unsupportedHttpsTitle': 'HTTPS erforderlich',
    'browser.unsupportedHttpsDesc': 'Aufgrund von Browser-Sicherheitsanforderungen erfordert die Dateispeicherfunktion eine sichere Verbindung (HTTPS).<br>Bitte greifen Sie über HTTPS oder localhost auf diese Seite zu.',

    'browser.openEdge': 'Mit Microsoft Edge öffnen',
    'browser.openChrome': 'Mit Google Chrome öffnen',
};

export default de;
