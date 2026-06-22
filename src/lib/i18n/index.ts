// i18n runtime — translation function + locale switching.
//
// v0.2.117: lightweight, zero-dep, vanilla TS. State is kept in
// a module-level variable. A `subscribe()` channel lets static
// UI elements (topbar search placeholder, settings button title,
// etc.) re-paint themselves on locale change without rebuilding
// the whole DOM.
//
// The catalog is imported eagerly in the module top-level — TS
// tree-shaking keeps the unused locale bundles out of the
// production bundle via `import { en } from './catalog/en'`
// (not a dynamic require), and the total size is small enough
// (~5KB per locale × 10 = 50KB max, well under the 80KB
// gzipped budget) that we don't bother with locale code-splitting.

import {
  SUPPORTED_LOCALES,
  RTL_LOCALES,
  type LocaleCode,
  type LocaleBundle,
  type LocaleMessages,
  type MessageKey,
  type LanguagePref,
} from './types';
import { en } from './catalog/en';
import { zh } from './catalog/zh';
import { es } from './catalog/es';
import { ar } from './catalog/ar';
import { hi } from './catalog/hi';
import { fr } from './catalog/fr';
import { pt } from './catalog/pt';
import { de } from './catalog/de';
import { ja } from './catalog/ja';
import { ru } from './catalog/ru';

// v0.2.119: all 10 supported locales are now present, so the
// CATALOG can be typed as a full Record<LocaleCode, LocaleBundle>
// (down from `Partial` in v0.2.117/118). t()'s fallback path
// is preserved as a defensive measure — adding an 11th locale
// and forgetting to import it will still produce English rather
// than a missing-key error at runtime, while tsc catches the
// missing-import at build time.
const CATALOG: Record<LocaleCode, LocaleBundle> = {
  en, zh, es, ar, hi, fr, pt, de, ja, ru,
};

let currentLocale: LocaleCode = 'en';
const listeners = new Set<(locale: LocaleCode) => void>();
let initialized = false;

/**
 * Resolve a `LanguagePref` (`'auto' | LocaleCode`) to a concrete
 * LocaleCode. When pref is `'auto'` we read `navigator.language`
 * (the browser's preferred UI language). For tag matching:
 * 1. Exact match (`'zh'` → `'zh'`, `'zh-CN'` does NOT match `'zh'`)
 * 2. Primary subtag match (`'zh-CN'` → `'zh'`, `'es-MX'` → `'es'`)
 * 3. Fallback `'en'`
 *
 * Works in both browser tabs (newtab/popup) and the service worker
 * (background) — `navigator.language` is also defined in the SW
 * context.
 */
export function resolveLocale(pref: LanguagePref | string | undefined | null): LocaleCode {
  let tag: string;
  if (!pref || pref === 'auto') {
    tag = (typeof navigator !== 'undefined' ? navigator.language : 'en') || 'en';
  } else {
    tag = String(pref);
  }
  const normalized = tag.toLowerCase().replace('_', '-');
  // 1. Exact match
  if ((SUPPORTED_LOCALES as readonly string[]).includes(normalized)) {
    return normalized as LocaleCode;
  }
  // 2. Primary subtag match
  const primary = normalized.split('-')[0] ?? '';
  if (primary && (SUPPORTED_LOCALES as readonly string[]).includes(primary)) {
    return primary as LocaleCode;
  }
  // 3. Fallback
  return 'en';
}

/**
 * Switch the active locale. Idempotent — no-op if `locale` is
 * already current. On change:
 * 1. Update `currentLocale` (so subsequent `t()` calls return
 *    the new strings)
 * 2. Apply `<html lang="...">` and `dir="rtl"|"ltr"` to reflect
 *    the new locale immediately
 * 3. Notify all subscribers (the settings panel re-renders its
 *    open tab, the topbar refreshes placeholder/title/etc.)
 *
 * `initLocale` should be used during app startup (it forces
 * `currentLocale` to update even if the new value matches the
 * default; `setLocale` short-circuits on equality).
 */
export function setLocale(locale: LocaleCode): void {
  if (currentLocale === locale) return;
  currentLocale = locale;
  applyDocumentAttributes();
  for (const cb of listeners) cb(locale);
}

/** Like `setLocale` but always applies the document attributes
 *  and runs subscribers, even when `locale === currentLocale`.
 *  Used at startup so the very first paint of the page reflects
 *  the persisted language preference (otherwise the first paint
 *  uses the module-default 'en' until the first user interaction
 *  calls `setLocale` again). */
export function initLocale(locale: LocaleCode): void {
  const changed = currentLocale !== locale;
  currentLocale = locale;
  applyDocumentAttributes();
  if (changed || !initialized) {
    initialized = true;
    for (const cb of listeners) cb(locale);
  }
}

/** Current locale. */
export function getLocale(): LocaleCode {
  return currentLocale;
}

/** Subscribe to locale changes. Returns an unsubscribe function.
 *  Subscribers are called AFTER `currentLocale` is updated and
 *  `<html>` attrs are applied. */
export function subscribe(cb: (locale: LocaleCode) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Write `<html lang>` and `<html dir>` to reflect the active
 *  locale. The first <html> in document order is <html> at the
 *  top of the page; this is safe to call before <body> exists
 *  (during init). */
function applyDocumentAttributes(): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  html.lang = currentLocale;
  html.dir = RTL_LOCALES.has(currentLocale) ? 'rtl' : 'ltr';
}

/**
 * Translate a message key. Reads the active locale's bundle
 * first; if the key is missing (a missing translation in a
 * partial locale), falls back to the English bundle, then to
 * the raw key id. `params` substitutes `{name}` placeholders.
 *
 * Pure function — does not touch the DOM. Safe to call from
 * anywhere (init code, render loops, event handlers, SW).
 */
export function t(
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const bundle = CATALOG[currentLocale];
  let s: string | undefined = bundle?.messages?.[key];
  if (s === undefined) {
    // Missing translation in the active locale: fall back to English.
    s = en.messages[key];
  }
  if (s === undefined) {
    // English is missing too (shouldn't happen — en.ts is the
    // source of truth and tsc enforces it). Return the raw key
    // so the UI is at least grep-able.
    s = key;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}

/** Read the active locale's `messages` map. Useful for the
 *  settings panel's "language" dropdown, which lists every
 *  locale's `selfName` / `englishName` regardless of the
 *  active language. */
export function listLocales(): readonly LocaleBundle[] {
  const out: LocaleBundle[] = [];
  for (const code of SUPPORTED_LOCALES) {
    const b = CATALOG[code];
    if (b) out.push(b);
  }
  return out;
}

/** Type-only re-export so consumers don't have to drill into
 *  `./types` to import `MessageKey` / `LocaleCode`. */
export type { LocaleCode, LocaleBundle, LocaleMessages, MessageKey, LanguagePref };
export { SUPPORTED_LOCALES, RTL_LOCALES };
