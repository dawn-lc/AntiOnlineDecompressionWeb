import type { Locale, LocaleMessages, LocaleBundle } from './types';
import zhCN from './zh-CN';
import en from './en';

const bundles: Record<Locale, LocaleBundle> = { 'zh-CN': zhCN, 'en': en };

let currentLocale: Locale = 'zh-CN';
let currentMessages: LocaleMessages = zhCN.messages;

function detectLocale(): Locale {
    if (typeof navigator === 'undefined') return 'zh-CN';
    const lang = navigator.language;
    if (lang.startsWith('zh')) return 'zh-CN';
    if (lang.startsWith('en')) return 'en';
    return 'zh-CN';
}

currentLocale = detectLocale();
currentMessages = bundles[currentLocale].messages;

export function setLocale(locale: Locale, onChanged?: () => void): void {
    if (!bundles[locale]) return;
    currentLocale = locale;
    currentMessages = bundles[locale].messages;
    document.documentElement.lang = locale;
    onChanged?.();
}

export function getLocale(): Locale { return currentLocale; }
export function getBundles(): LocaleBundle[] { return Object.values(bundles); }

export function t(key: keyof LocaleMessages, params?: Record<string, string | number>): string {
    let msg = currentMessages[key];
    if (msg === undefined) return key;
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            msg = msg.replace(`{${k}}`, String(v));
        }
    }
    return msg;
}

/** 将 data-i18n 属性替换为对应翻译 */
export function applyI18nToDOM(): void {
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n') as keyof LocaleMessages;
        const translated = t(key);
        if (el.childElementCount > 0) {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
            const textNode = walker.firstChild();
            if (textNode) textNode.textContent = translated;
        } else {
            el.textContent = translated;
        }
    });
}

/** 渲染语言选择器 */
export function renderLocaleSwitcher(containerId: string, onChanged?: () => void): void {
    const container = document.getElementById(containerId);
    if (!container) return;
    getBundles().forEach(bundle => {
        const btn = document.createElement('button');
        btn.className = `locale-btn${bundle.locale === currentLocale ? ' active' : ''}`;
        btn.textContent = bundle.label;
        btn.addEventListener('click', () => {
            setLocale(bundle.locale, () => {
                applyI18nToDOM();
                container.querySelectorAll('.locale-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                onChanged?.();
            });
        });
        container.appendChild(btn);
    });
}
