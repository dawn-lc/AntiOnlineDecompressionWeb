import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import zhCN from './zh-CN';
import en from './en';
import ja from './ja';
import ko from './ko';
import fr from './fr';
import de from './de';
import type { LocaleMessages, Locale } from './types';

i18next.use(LanguageDetector);

/** 翻译所有 data-i18n 元素（保证 i18next 已就绪后调用） */
function translateDOM(): void {
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n') as keyof LocaleMessages;
        el.innerHTML = i18next.t(key);
    });
    console.debug(`[i18n] 已翻译 data-i18n 元素`);
}

// 语言切换后更新 <html lang> 和 DOM 翻译
// languageChanged 在 init 完成前也会触发（此时 namespace 未就绪，t() 不可用）
// 故需要等到 initialized 后再翻译
let i18nReady = false;
i18next.on('initialized', () => { i18nReady = true; });

i18next.on('languageChanged', (lng) => {
    const resolved = i18next.resolvedLanguage || 'zh-CN';
    console.debug(`[i18n] languageChanged → detected="${lng}" resolved="${resolved}" readyState="${document.readyState}"`);
    document.documentElement.lang = resolved;

    if (!i18nReady) {
        console.debug('[i18n] i18next 尚未初始化完毕，延迟到 initialized 事件后翻译');
        const onInit = () => { i18next.off('initialized', onInit); translateDOM(); };
        i18next.on('initialized', onInit);
        return;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', translateDOM, { once: true });
    } else {
        translateDOM();
    }
});

i18next.init({
    debug: true,
    resources: {
        'zh-CN': { translation: zhCN },
        'en': { translation: en },
        'ja': { translation: ja },
        'ko': { translation: ko },
        'fr': { translation: fr },
        'de': { translation: de },
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

/** 返回当前使用的语言代码（i18next 内置 fallback 链已将变体归一为主语言） */
export function getLocale(): Locale {
    const rl = i18next.resolvedLanguage;
    const supported: Locale[] = ['zh-CN', 'en', 'ja', 'ko', 'fr', 'de'];
    const result = (rl && supported.includes(rl as Locale) ? rl : 'zh-CN') as Locale;
    console.debug(`[i18n] getLocale() → resolvedLanguage="${rl}" return="${result}"`);
    return result;
}

/** 类型安全的翻译函数 */
export function t(key: keyof LocaleMessages, params?: Record<string, string | number>): string {
    const val = i18next.t(key, params);
    if (val === key) {
        console.warn(`[i18n] 翻译缺失 key="${key}" language="${i18next.language}" resolved="${i18next.resolvedLanguage}"`);
    }
    return val;
}

