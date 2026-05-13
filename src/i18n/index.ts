/**
 * Simple i18n module for Obsidian Pi Plugin.
 * Supports English (en) and Chinese (zh) via JSON lookup.
 */

import en from './en.json';
import zh from './zh.json';

const locales: Record<string, unknown> = { en, zh };

/**
 * Get a nested string value from a JSON object using a dot-path key.
 * Returns undefined if the path doesn't resolve to a string.
 */
function getNested(obj: unknown, path: string): string | undefined {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
        if (current == null || typeof current !== 'object') {
            return undefined;
        }
        current = (current as Record<string, unknown>)[part];
    }
    return typeof current === 'string' ? current : undefined;
}

/**
 * Detect Obsidian's language setting from moment.js locale.
 */
function getLang(): string {
    // Handle test environment where moment or localStorage doesn't exist
    if (typeof window === 'undefined') {
        return 'en';
    }
    // Try moment.js locale first (Obsidian bundles moment)
    const momentLang = (window as unknown as Record<string, unknown>).moment
        ? ((window as unknown as Record<string, unknown>).moment as { locale?: () => string })?.locale?.()
        : undefined;
    const lang = momentLang ?? localStorage.getItem('language') ?? 'en';
    const normalized = String(lang).toLowerCase();
    if (normalized.startsWith('zh')) return 'zh';
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
 * Keys match dot-paths in en.json/zh.json (e.g. 'settings.title').
 * Interpolation: {{var}} replaced by vars[var].
 */
export function t(key: string, vars?: Record<string, string | number>): string {
    let str = getNested(locales[currentLang], key) ?? getNested(locales['en'], key);

    if (str === undefined) {
        // eslint-disable-next-line no-console
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
