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

    'about.title': '📖 Über dieses Tool',
    'why.title': '🤔 Warum Anti-Online-Dekompression?',
    'philosophy.what': 'Was ist «Anti-Online-Dekompression»?',
    'philosophy.whatDesc': 'Verhindert, dass Cloud-Speicher Ihre Dateien automatisch scannen. Wenn Sie Dateien hochladen, können diese im Hintergrund heimlich dekomprimiert und gescannt werden — ob Sie es wissen oder nicht.',
    'philosophy.problemTitle': 'Traditioneller Ansatz',
    'philosophy.problem.unencrypted': 'Normale Dateien werden direkt gescannt, der Inhalt ist vollständig transparent',
    'philosophy.problem.encrypted': 'Passwortgeschützte Archive scheinen sicher, aber sobald jemand die «Online-Dekompression» verwendet und das Passwort eingibt, kann der Dienst Ihr Archiv frei scannen',
    'philosophy.solution': 'Schlüssel-Daten-Trennung',
    'philosophy.solutionDesc1': 'Die Verschlüsselung erzeugt zwei Dateien: <strong>AODK (Schlüssel)</strong> und <strong>AODF (Verschlüsselte Daten)</strong> — beide werden zum Entschlüsseln benötigt',
    'philosophy.solutionDesc2': 'Die AODK-Datei ist winzig (nur wenige hundert Bytes) und sollte <strong>separat über Kanäle verteilt werden, die Sie für sicher halten</strong>, niemals zusammen mit den verschlüsselten Daten hochgeladen',
    'philosophy.solutionDesc3': 'Die AODF-Datei kann <strong>über jeden Kanal (Cloud-Speicher, E-Mail, Instant Messaging usw.) frei verteilt</strong> werden — der Dienstanbieter kann ihren Inhalt nicht scannen',
};

export default de;
