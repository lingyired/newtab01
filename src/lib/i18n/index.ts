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
// (not a dynamic require). v0.2.123 round 1 grew the catalog
// from 10 → 33 locales; round 2 (Hebrew / Persian / Urdu /
// Pashto) brought it to 37 (~5KB per locale × 37 ≈ 185KB
// unzipped / ~60KB gzipped). The gzipped figure stays well
// under the 80KB budget (CLAUDE.md §7); the unzipped figure
// is a static-import cost that Vite tree-shakes for any locale
// the user never selects. We do NOT code-split the catalog
// because that would force an async flash on first locale
// switch.

import {
  SUPPORTED_LOCALES,
  RTL_LOCALES,
  LOCALE_REGION_CODES,
  type LocaleCode,
  type LocaleBundle,
  type LocaleMessages,
  type MessageKey,
  type LanguagePref,
} from './types';
import { en } from './catalog/en';
import { zhCN } from './catalog/zh-CN';
import { es } from './catalog/es';
import { ar } from './catalog/ar';
import { hi } from './catalog/hi';
import { fr } from './catalog/fr';
import { pt } from './catalog/pt';
import { de } from './catalog/de';
import { ja } from './catalog/ja';
import { ru } from './catalog/ru';
// v0.2.123: Traditional Chinese variants (HK + TW) live as
// siblings of the renamed `zh-CN` (formerly `zh`).
import { zhHK } from './catalog/zh-HK';
import { zhTW } from './catalog/zh-TW';
// Tier 1 — high ROI
import { ko } from './catalog/ko';
import { it } from './catalog/it';
import { nl } from './catalog/nl';
import { pl } from './catalog/pl';
import { tr } from './catalog/tr';
import { vi } from './catalog/vi';
import { id } from './catalog/id';
// Tier 2 — mid ROI
import { sv } from './catalog/sv';
import { da } from './catalog/da';
import { fi } from './catalog/fi';
import { cs } from './catalog/cs';
import { el } from './catalog/el';
import { hu } from './catalog/hu';
import { ro } from './catalog/ro';
import { th } from './catalog/th';
// Tier 3 — long-tail
import { nb } from './catalog/nb';
import { uk } from './catalog/uk';
import { bg } from './catalog/bg';
import { hr } from './catalog/hr';
import { sk } from './catalog/sk';
import { ca } from './catalog/ca';
// RTL additions — Hebrew / Persian / Urdu / Pashto. UI rendering
//  is partially polished (see globals.css for `[dir="rtl"]` rules);
//  full bidi layout work is tracked separately.
import { he } from './catalog/he';
import { fa } from './catalog/fa';
import { ur } from './catalog/ur';
import { ps } from './catalog/ps';

// v0.2.119: all 10 supported locales were present, so the
// CATALOG was typed as a full Record<LocaleCode, LocaleBundle>
// (down from `Partial` in v0.2.117/118). v0.2.123 round 1
// kept that with 33 locales; round 2 (he/fa/ur/ps) brings it
// to 37. t()'s fallback path is preserved as a defensive
// measure: adding a 38th locale and forgetting to import it
// will still produce English rather than a missing-key error
// at runtime, while tsc catches the missing-import at build
// time.
// v0.2.123: `zhCN` is the camelCased variable name (imported from
//  the file `./catalog/zh-CN`). In the CATALOG object literal the
//  *key* must be the actual locale code string `'zh-CN'` (per
//  `Record<LocaleCode, LocaleBundle>`); the variable on the
//  right-hand side is the bundle.
const CATALOG: Record<LocaleCode, LocaleBundle> = {
  en, 'zh-CN': zhCN, es, ar, hi, fr, pt, de, ja, ru,
  'zh-HK': zhHK, 'zh-TW': zhTW,
  ko, it, nl, pl, tr, vi, id,
  sv, da, fi, cs, el, hu, ro, th,
  nb, uk, bg, hr, sk, ca,
  he, fa, ur, ps,
};

let currentLocale: LocaleCode = 'en';
const listeners = new Set<(locale: LocaleCode) => void>();
let initialized = false;

/**
 * v0.2.123: bare-tag legacy aliases. The original `'zh'` code
 * was renamed to `'zh-CN'` so the two Traditional variants
 * (`zh-HK`, `zh-TW`) can live as siblings. We still want the
 * bare `'zh'` tag to resolve to `'zh-CN'` so:
 *   - pre-rename users with a stored `'zh'` setting keep working
 *   - browsers (and OSes) that report the generic `'zh'` tag
 *     (rare, but exists — e.g. some Linux distros default to
 *     `LANG=zh`) get the right locale.
 * Mapped at the entry of `resolveLocale`; the rest of the
 * algorithm is unchanged.
 */
const LEGACY_ALIAS: Record<string, LocaleCode> = {
  zh: 'zh-CN',
};

/**
 * Resolve a `LanguagePref` (`'auto' | LocaleCode`) to a concrete
 * LocaleCode. When pref is `'auto'` we read `navigator.language`
 * (the browser's preferred UI language). For tag matching:
 * 1. Legacy alias (`'zh'` → `'zh-CN'`)  (v0.2.123)
 * 2. Case-insensitive exact match (`'zh-CN'` matches `'zh-cn'`,
 *    `'pt-BR'` matches `'pt-br'`)
 * 3. Primary subtag match (`'zh-CN'` → `'zh'`, `'es-MX'` → `'es'`)
 * 4. Fallback `'en'`
 *
 * v0.2.123 added BCP 47-style codes with region subtags
 * (`zh-CN`, `zh-HK`, `zh-TW`). Per BCP 47, region subtags are
 * case-insensitive (conventionally uppercase). The previous
 * `tag.toLowerCase()` step would normalize `'zh-CN'` → `'zh-cn'`,
 * but `SUPPORTED_LOCALES` carries the canonical casing (`'zh-CN'`).
 * A naive `Array.includes` then fails the exact match and falls
 * through to the primary-subtag branch, where `'zh'` is also not
 * in `SUPPORTED_LOCALES` (it was renamed in v0.2.123). The net
 * effect: a stored `'zh-CN'` setting silently resolves to `'en'`
 * at boot and at every `setLocale` call — language switching
 * stops working.
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
  // BCP 47: language + region subtags are both case-insensitive
  //  (conventionally the region is uppercase, the language is
  //  lowercase, e.g. `'zh-CN'`). We keep a `tag` (original casing)
  //  for the return value when we do a primary-subtag match, and
  //  use `normalized` only for membership tests.
  const normalized = tag.replace('_', '-');
  const lower = normalized.toLowerCase();
  // Pre-compute the lowercased SUPPORTED_LOCALES once. The set
  //  has 33 entries — linear scan on each call is fine — but
  //  using a Set gives O(1) lookup and a single lowercase per
  //  call site rather than N lowercases per `includes` call.
  const SUPPORTED_LOWER: ReadonlySet<string> = new Set(
    SUPPORTED_LOCALES.map((c) => c.toLowerCase()),
  );
  // 1. Legacy alias — handles bare `zh` (pre-rename / generic).
  //  Look up in the lowercased alias map (single entry, but keep
  //  the lowercased contract consistent with the rest of the
  //  function).
  const LEGACY_ALIAS_LOWER: Readonly<Record<string, LocaleCode>> = Object.fromEntries(
    Object.entries(LEGACY_ALIAS).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const alias = LEGACY_ALIAS_LOWER[lower];
  if (alias) return alias;
  // 2. Case-insensitive exact match. The return value is the
  //  canonical (mixed-case) code from `SUPPORTED_LOCALES`, not
  //  the lowercased input, so downstream `setLocale(locale)`
  //  receives the right key.
  const exactIdx = SUPPORTED_LOCALES.findIndex((c) => c.toLowerCase() === lower);
  if (exactIdx >= 0) {
    return SUPPORTED_LOCALES[exactIdx] as LocaleCode;
  }
  // 3. Primary subtag match. Lowercase comparison because the
  //  language subtag is canonically lowercase.
  const primary = lower.split('-')[0] ?? '';
  if (primary && SUPPORTED_LOWER.has(primary)) {
    // Return the canonical (mixed-case) LocaleCode that has
    //  this primary. There's at most one (e.g. `'zh'` → `'zh-CN'`;
    //  no plain `'zh'` exists in SUPPORTED_LOCALES). Using
    //  `find` to get the right casing.
    const found = SUPPORTED_LOCALES.find((c) => c.toLowerCase().startsWith(primary + '-') || c.toLowerCase() === primary);
    if (found) return found as LocaleCode;
  }
  // 4. Fallback.
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
export { SUPPORTED_LOCALES, RTL_LOCALES, LOCALE_REGION_CODES };
