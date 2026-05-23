import type { LocaleMessages } from './types';

const fr: LocaleMessages = {
    'app.title': '🔐 Anti Décompression en Ligne',
    'app.subtitle': 'Séparez la clé des données — le cloud ne peut pas scanner vos fichiers',

    'tab.encrypt': '🔒 Chiffrer',
    'tab.decrypt': '🔓 Déchiffrer',

    'encrypt.drop.text': 'Déposez un fichier ici, ou <strong>cliquez pour sélectionner</strong>',
    'encrypt.drop.hint': 'Tout type de fichier, aucune limite de taille',
    'encrypt.btn': '🔒 Chiffrer le fichier',
    'encrypt.clear': '✕',

    'decrypt.selectKey': '① Sélectionner la clé',
    'decrypt.selectData': '② Sélectionner le fichier chiffré',
    'decrypt.keyPlaceholder': 'Cliquez pour sélectionner la clé',
    'decrypt.dataPlaceholder': 'Cliquez pour sélectionner le fichier chiffré',
    'decrypt.btn': '🔓 Déchiffrer le fichier',

    'common.cancel': '✕ Annuler',

    'progress.format': '{done} / {total} ({percent}%)',

    'error.selectFile': 'Veuillez d\'abord sélectionner un fichier',
    'error.selectBoth': 'Veuillez sélectionner la clé et le fichier chiffré',

    'console.loaded': 'Application chargée. Sélectionnez un fichier à chiffrer ou déchiffrer.',
    'console.encryptStart': 'Chiffrement du fichier : {name} ({size})',
    'console.encryptComplete': 'Chiffrement terminé ! Fichier de clé AODK et fichier chiffré AODF enregistrés.',
    'console.decryptStart': 'Déchiffrement du fichier : {name}',
    'console.decryptComplete': 'Déchiffrement terminé ! Fichier enregistré sous : {name}',
    'console.cancelled': 'Opération annulée',

    'alert.encryptComplete': 'Chiffrement terminé',
    'alert.decryptComplete': 'Déchiffrement terminé',
    'alert.ok': 'OK',

    'browser.unsupportedTitle': 'Navigateur non pris en charge',
    'browser.unsupportedDesc': 'Votre navigateur ne prend pas en charge la sauvegarde de fichiers.<br>Veuillez utiliser Chrome ou Edge pour accéder à cette page.',

    'browser.unsupportedHttpsTitle': 'HTTPS requis',
    'browser.unsupportedHttpsDesc': 'En raison des exigences de sécurité du navigateur, la fonction de sauvegarde nécessite une connexion sécurisée (HTTPS).<br>Veuillez accéder à cette page via HTTPS ou localhost.',

    'browser.openEdge': 'Ouvrir avec Microsoft Edge',
    'browser.openChrome': 'Ouvrir avec Google Chrome',
};

export default fr;
