/**
 * Simple i18n module for Obsidian Pi Plugin.
 * Supports English (en) and Chinese (zh) via JSON lookup.
 */

import en from './en.json';
import zh from './zh.json';

type LocaleModule = Record<string, string> | { default?: Record<string, string> };

function normalizeLocale(module: LocaleModule): Record<string, string> {
    if (module && typeof module === 'object' && 'default' in module) {
        const candidate = module.default;
        if (candidate && typeof candidate === 'object') {
            return candidate;
        }
    }
    return module as Record<string, string>;
}

const locales: Record<string, Record<string, string>> = {
    en: normalizeLocale(en as LocaleModule),
    zh: normalizeLocale(zh as LocaleModule),
};

/**
 * Detect Obsidian's language setting via moment.js locale.
 * moment is bundled by Obsidian and reflects the user's language preference.
 * Falls back to 'en' only when moment is unavailable (e.g. test environments).
 * Rule 28: Avoid localStorage.getItem('language') — use Obsidian's APIs.
 */
function getLang(): string {
    if (typeof window === 'undefined') {
        return 'en';
    }
    const w = window as unknown as Record<string, unknown>;
    const moment = w.moment as { locale?: () => string } | undefined;
    if (typeof moment?.locale === 'function') {
        const locale = moment.locale();
        if (typeof locale === 'string' && locale.toLowerCase().startsWith('zh')) return 'zh';
    }
    return 'en';
}

let currentLang = getLang();

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Translation function with optional interpolation.
 * Keys match entries in en.json/zh.json (e.g. 'settings.title').
 * Interpolation: {{var}} replaced by vars[var].
 */
export function t(key: string, vars?: Record<string, string | number>): string {
    const locale = locales[currentLang] ?? locales.en;
    let str = Object.prototype.hasOwnProperty.call(locale, key) ? locale[key] : locales.en[key];

    if (str === undefined) {
        console.warn(`[i18n] Missing translation key: ${key}`);
        str = key;
    }

    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            str = str.replace(new RegExp(escapeRegex(`{{${k}}}`), 'g'), String(v));
        }
    }
    return str;
}

/**
 * Update current language (call on Obsidian language change).
 */
export function setLang(lang: string): void {
    if (lang.startsWith('zh')) {
        currentLang = 'zh';
    } else if (locales[lang]) {
        currentLang = lang;
    } else {
        currentLang = 'en';
    }
}

/**
 * Get current language code.
 */
export function getLangCode(): string {
    return currentLang;
}
