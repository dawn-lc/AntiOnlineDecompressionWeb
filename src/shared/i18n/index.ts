import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zhCN from './zh-CN';
import en from './en';
import type { LocaleMessages, Locale } from './types';

const LOCALE_LABELS: Record<Locale, string> = {
    'zh-CN': '简体中文',
    'en': 'English',
};

i18next.use(LanguageDetector).init({
    resources: {
        'zh-CN': { translation: zhCN },
        'en': { translation: en },
    },
    fallbackLng: 'zh-CN',
    interpolation: {
        prefix: '{',
        suffix: '}',
    },
    detection: {
        order: ['navigator', 'localStorage'],
        caches: ['localStorage'],
    },
});

export function setLocale(locale: Locale, onChanged?: () => void): void {
    document.documentElement.lang = locale;
    i18next.changeLanguage(locale, onChanged);
}

export function getLocale(): Locale {
    return i18next.language as Locale;
}

export function getBundles(): { locale: Locale; label: string }[] {
    return (Object.entries(LOCALE_LABELS) as [Locale, string][]).map(([locale, label]) => ({
        locale,
        label,
    }));
}

export function t(key: keyof LocaleMessages, params?: Record<string, string | number>): string {
    const msg = i18next.t(key, params);
    return msg;
}

/** 将 data-i18n 属性替换为对应翻译 */
export function applyI18nToDOM(): void {
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n') as keyof LocaleMessages;
        const translated = t(key);
        el.innerHTML = translated;
    });
}

/** 渲染语言选择器 */
export function renderLocaleSwitcher(containerId: string, onChanged?: () => void): void {
    const container = document.getElementById(containerId);
    if (!container) return;
    getBundles().forEach(bundle => {
        const btn = document.createElement('button');
        btn.className = `locale-btn${bundle.locale === getLocale() ? ' active' : ''}`;
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
