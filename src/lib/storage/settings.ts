// Settings store — manages user configuration
// Uses chrome.storage.sync for settings, chrome.storage.local for layout cache

import type { Settings } from '../../features/bookmarks/types';
import { getSync, setSync, removeSync } from '../storage';
import { initLocale, resolveLocale } from '../i18n';
import * as debug from '../debug';

const SETTINGS_KEY = 'settings';

const defaults: Settings = {
  // v0.2.19X: rename `font` → `globalFont`. Default 'Sans-serif'
  //  matches the hardcoded fallback in `resolveEffectiveSettings` so
  //  the global input shows the actual default value (instead of
  //  empty + a placeholder hint). Empty string is still the "no
  //  override" sentinel — the cascade uses `||` so an empty value
  //  falls through to 'Sans-serif' (same hardcoded fallback), which
  //  means the visible rendering is identical. Migration in
  //  `initSettings` fills pre-v0.2.19X-era empty values with the
  //  hardcoded defaults so upgraders see the same UI as new users.
  globalFont: 'Sans-serif',
  // v0.2.19X: rename `fontSize` → `globalFontSize`. Default 16
  //  matches the hardcoded fallback in `resolveEffectiveSettings`.
  //  The `||` cascade in the resolver treats 0 the same as unset
  //  (falls through to 16) so the user can still clear the input
  //  to mean "use the theme default". v0.2.98 originally set 16
  //  as the default; v0.2.19X reverted to empty/0 briefly, then
  //  v0.2.22X settled on 16 here so the input shows a real value
  //  (matching user feedback: "也要加上默认值吧，不要留空").
  globalFontSize: 16,
  // v0.2.19X: rename `fontWeight` → `globalFontWeight`. Default
  //  400 matches the hardcoded fallback. Same `||` cascade
  //  semantics as globalFontSize.
  globalFontWeight: 400,
  theme: 'astrovista',
  darkMode: 'system',
  // The five palette fields are intentionally empty strings: `applyUserColorOverride`
  // treats `''` as "no override" and calls `removeProperty`, so the active
  // theme's CSS variables (defined in styles/themes/*.css) are what
  // render. Hardcoding hex values here would force white/grey defaults
  // to clobber the theme's actual palette on first install (no storage
  // yet -> currentSettings = { ...defaults } -> 5 overrides paint the
  // page in the hardcoded hex). Once a user explicitly edits a color
  // (or switches theme, which saveThemeChange stamps the new theme's
  // palette into storage), the field becomes a concrete hex value and
  // starts overriding the theme.
  fontColor: '',
  backgroundColor: '',
  // v1.0.16: empty by default — `applyUserColorOverride` treats '' as
  //  "no override" and removeProperty the CSS var so the link bg
  //  cascade falls through to the theme's --card (or --newtab-bg
  //  for older themes without --card). Same pattern as the other 5
  //  palette fields above.
  linkBgColor: '',
  backgroundImage: '',
  highlightColor: '',
  highlightFontColor: '',
  shadowColor: '',
  shadowBlur: 1,
  // v0.2.97: highlightRound is in px and the value `0` means
  //  "use the active theme's `.rounded-md`" (see
  //  rebuildDynamicStyles in features/settings/apply.ts).
  //  Pre-v0.2.97 the value was a 0..2 em-scale (1 = 1em) which
  //  clobbered the theme's --radius-derived rounded-md. 0 is
  //  the only sensible default now; users that want a different
  //  radius can set it via the per-theme per-mode options in
  //  the appearance panel.
  highlightRound: 0,
  spacing: 1,
  width: 1,
  hPos: 1,
  lock: 0,
  showTop: 1,
  showApps: 1,
  showRecent: 1,
  showClosed: 1,
  showDevices: 1,
  showRoot: 1,
  newtab: 0,
  rememberOpen: 1,
  autoClose: 0,
  autoScale: 1,
  // v0.2.102: the global `css` field was removed — custom CSS
  // is now per-theme per-mode under
  // `themeOverrides[themeId][mode].customCss`. initSettings()
  // migrates a non-empty pre-v0.2.102 value into the current
  // (theme, mode) bucket on first launch of the new build.
  numberTop: 10,
  numberClosed: 10,
  numberRecent: 10,
  lockColumns: 0,
  columnWidth: 'auto',
  align: 'left',
  debug: 0,
  folderActionConfirmThreshold: 10,
  // v0.2.117: language preference. Default 'auto' = follow the
  // browser's navigator.language. The actual `setLocale` call
  // happens in initSettings() (after storage load) and again in
  // the chrome.storage.onChanged listener in apply.ts so cross-tab
  // edits and the settings panel's "Language" dropdown both
  // take effect live.
  language: 'auto',
  // Note: `themeOverrides` (features/bookmarks/types.ts) is intentionally
  //  NOT in `defaults`. New users start with the field `undefined`; the
  //  per-theme per-mode resolver (features/settings/apply.ts →
  //  resolveEffectiveSettings) treats `undefined` as "no overrides"
  //  and falls back to the global settings values. This keeps v0.2.96
  //  storage shape compatible — no migration needed.
};

let currentSettings: Settings = { ...defaults };
let initialized = false;

/** Get current settings (sync copy) */
export function getSettings(): Settings {
  return currentSettings;
}

/** Get a single setting value */
export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return currentSettings[key];
}

/**
 * Replace the in-memory settings cache with a fresh object from storage.
 * Used by the chrome.storage.onChanged listener to keep cross-tab edits
 * (and same-tab edits fired through `setSync` callbacks) visible to the
 * current tab without a full re-init.
 */
export function replaceSettings(next: Settings): void {
  currentSettings = next;
}

/**
 * Persist a partial update: patch the in-memory cache and write the full
 * settings object to chrome.storage.sync in a single set() call. Settings
 * not included in `partial` are preserved. Use this when a single
 * user-visible action (e.g. picking a theme) should atomically update
 * several related keys (theme + the 5 palette colors).
 */
export async function updateSettings(partial: Partial<Settings>): Promise<void> {
  Object.assign(currentSettings, partial);
  await setSync(SETTINGS_KEY, currentSettings);
  debug.log('settings', 'updateSettings', { partial });
}

/** Update a single setting and persist */
export async function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  const old = currentSettings[key];
  currentSettings[key] = value;
  await setSync(SETTINGS_KEY, currentSettings);
  debug.log('settings', `update ${String(key)}`, { from: old, to: value });
}

/** Prior fontSize defaults used in earlier versions — used to detect stale values to migrate.
 *  v0.2.98: removed 16 (now the current default; if a user has 16 it's the intended value,
 *  not a stale one to migrate away from). */
const PRIOR_FONT_SIZE_DEFAULTS = new Set<number>([17.5, 19, 22]);

/**
 * Legacy per-key settings written by older versions of options/app.ts.
 * Each entry maps a legacy chrome.storage.sync key to a function that converts
 * the raw stored value to the canonical Settings field value.
 */
const LEGACY_KEY_MAP: Record<string, (raw: unknown) => [keyof Settings, unknown] | null> = {
  theme: (raw) => (typeof raw === 'string' ? ['theme', raw] : null),
  // v0.2.19X: legacy bare-key `font` migrates to the renamed
  //  Settings.globalFont (was Settings.font pre-rename).
  font: (raw) => (typeof raw === 'string' ? ['globalFont', raw] : null),
  textColor: (raw) => (typeof raw === 'string' ? ['fontColor', raw] : null),
  backgroundColor: (raw) => (typeof raw === 'string' ? ['backgroundColor', raw] : null),
  backgroundImage: (raw) => (typeof raw === 'string' ? ['backgroundImage', raw] : null),
  highlightColor: (raw) => (typeof raw === 'string' ? ['highlightColor', raw] : null),
  highlightTextColor: (raw) => (typeof raw === 'string' ? ['highlightFontColor', raw] : null),
  shadowBlur: (raw) => (typeof raw === 'number' ? ['shadowBlur', raw] : null),
  highlightRound: (raw) => (typeof raw === 'number' ? ['highlightRound', raw] : null),
  spacing: (raw) => (typeof raw === 'number' ? ['spacing', raw] : null),
  columnWidth: (raw) => (typeof raw === 'string' ? ['columnWidth', raw] : null),
  align: (raw) => (typeof raw === 'string' ? ['align', raw] : null),
  lockColumns: (raw) => (typeof raw === 'boolean' ? ['lockColumns', raw ? 1 : 0] : null),
  showTopLevel: (raw) => (typeof raw === 'boolean' ? ['showTop', raw ? 1 : 0] : null),
  autoScale: (raw) => (typeof raw === 'boolean' ? ['autoScale', raw ? 1 : 0] : null),
  numberTop: (raw) => (typeof raw === 'number' ? ['numberTop', raw] : null),
  numberRecent: (raw) => (typeof raw === 'number' ? ['numberRecent', raw] : null),
  showOtherDevices: (raw) => (typeof raw === 'boolean' ? ['showDevices', raw ? 1 : 0] : null),
  openInNewTab: (raw) => {
    if (raw === 'same' || raw === 'foreground' || raw === 'background') {
      return ['newtab', raw === 'same' ? 0 : raw === 'foreground' ? 1 : 2];
    }
    return null;
  },
  // v0.2.102: removed. The bare `customCSS` key was mapped here
  //  → ['css', raw]. The global `Settings.css` field is gone in
  //  v0.2.102; legacy values are now migrated by
  //  initSettings → migrateLegacyGlobalCss into the current
  //  (theme, mode) bucket's `customCss` field. Leaving the entry
  //  here would break `migrateLegacySettings` with a TS error
  //  ('css' is no longer a `keyof Settings`).
};

/**
 * Migrate legacy per-key chrome.storage.sync entries into the unified `settings` object.
 * Runs once on init. After successful merge, the legacy keys are removed.
 * No-op when the unified object already exists or no legacy keys are present.
 */
export async function migrateLegacySettings(): Promise<boolean> {
  const unified = await getSync<Settings>(SETTINGS_KEY);
  if (unified) {
    debug.log('settings', 'migrateLegacySettings: unified settings already present, skip');
    return false;
  }

  const patches: Record<string, unknown> = {};
  const found: string[] = [];
  for (const [legacyKey, convert] of Object.entries(LEGACY_KEY_MAP)) {
    const raw = await getSync<unknown>(legacyKey);
    if (raw === undefined) continue;
    const result = convert(raw);
    if (!result) continue;
    const [canonicalKey, value] = result;
    patches[canonicalKey] = value;
    found.push(legacyKey);
  }

  if (found.length === 0) {
    debug.log('settings', 'migrateLegacySettings: no legacy keys found');
    return false;
  }

  await setSync(SETTINGS_KEY, { ...defaults, ...patches } as Settings);
  for (const key of found) {
    await removeSync(key);
  }
  debug.log('settings', 'migrateLegacySettings complete', { migratedKeys: found });
  return true;
}

/**
 * Settings that, in the pre-0.2.30 codebase, were stored in the unified
 * settings object as concrete hex defaults (`#ffffff`, `#57b0ff`, etc.)
 * but had no UI wiring — they were dead values. In 0.2.30 we wired them
 * up through inline custom properties, so any pre-existing storage that
 * still carries the dead defaults now overrides the active theme's
 * palette (most visibly: backgroundColor `#ffffff` repaints the page
 * white even on the `default` theme whose `--newtab-bg` is `#f1f5f9`).
 *
 * Detected here by literal equality with the historical defaults: if a
 * user actively edited a color in 0.2.30+, the value will no longer
 * match, and we leave it alone.
 */
const LEGACY_DEFAULT_PALETTE = {
  fontColor: '#555555',
  backgroundColor: '#ffffff',
  highlightColor: '#e4f4ff',
  highlightFontColor: '#000000',
  shadowColor: '#57b0ff',
} as const satisfies Partial<Record<keyof Settings, string>>;

function looksLikeLegacyPaletteDefaults(s: Settings): boolean {
  return (Object.entries(LEGACY_DEFAULT_PALETTE) as Array<[keyof Settings, string]>).every(
    ([k, v]) => s[k] === v,
  );
}

/** Load settings from chrome.storage.sync, falling back to defaults */
export async function initSettings(): Promise<Settings> {
  const stored = await getSync<Settings>(SETTINGS_KEY);
  if (stored) {
    const merged: Settings = { ...defaults, ...stored };
    // v0.2.19X: migrate the legacy `font` / `fontSize` / `fontWeight`
    //  top-level fields to `globalFont` / `globalFontSize` /
    //  `globalFontWeight`. Pre-rename users have these names in their
    //  chrome.storage.sync — the unified Settings object reads them
    //  via the spread above, but `fontSize` / etc. are no longer keys
    //  on the Settings type, so the spread just puts them into
    //  `merged` as orphan keys (TS happily accepts object literals
    //  with extra fields). Without this migration, an existing user's
    //  font setting would silently disappear on first launch of the
    //  new build (the cascade falls through to 'Sans-serif' / 16 / 400
    //  hardcoded fallbacks). Old per-theme bucket keys under
    //  `themeOverrides[theme][mode].font` are intentionally NOT migrated
    //  here — the per-theme `<details>` is rarely touched and the
    //  cascade fallback is acceptable for that rare edge case.
    let renamedFont = false;
    if (typeof (merged as Settings & { font?: unknown }).font === 'string'
      && typeof merged.globalFont !== 'string') {
      const legacyFont = (merged as Settings & { font?: string }).font!;
      if (legacyFont) {
        merged.globalFont = legacyFont;
        renamedFont = true;
      }
    }
    if (typeof (merged as Settings & { fontSize?: unknown }).fontSize === 'number'
      && typeof merged.globalFontSize !== 'number') {
      const legacyFs = (merged as Settings & { fontSize?: number }).fontSize!;
      merged.globalFontSize = legacyFs;
      renamedFont = true;
    }
    if (typeof (merged as Settings & { fontWeight?: unknown }).fontWeight === 'number'
      && typeof merged.globalFontWeight !== 'number') {
      const legacyFw = (merged as Settings & { fontWeight?: number }).fontWeight!;
      merged.globalFontWeight = legacyFw;
      renamedFont = true;
    }
    if (renamedFont) {
      await setSync(SETTINGS_KEY, merged);
      debug.log('settings', 'migrate font → globalFont (legacy rename)', {
        globalFont: merged.globalFont,
        globalFontSize: merged.globalFontSize,
        globalFontWeight: merged.globalFontWeight,
      });
    }
    // v0.2.22X: previous defaults for the 3 global font fields
    //  were '' / 0 / 0 (matching the "no override" sentinel for
    //  the cascade). New defaults are 'Sans-serif' / 16 / 400 to
    //  match the hardcoded fallbacks. Migration: fill empty / 0
    //  values with the hardcoded defaults so upgraders from
    //  v1.0.20/21 see the same UI as new users (inputs not empty
    //  by default). The cascade still treats '' / 0 as "no override"
    //  for users who deliberately clear the input after upgrade —
    //  the migration is one-time and only acts on the existing
    //  stored value, not on subsequent user edits.
    let filledDefaults = false;
    if (merged.globalFont === '') {
      merged.globalFont = 'Sans-serif';
      filledDefaults = true;
    }
    if (merged.globalFontSize === 0) {
      merged.globalFontSize = 16;
      filledDefaults = true;
    }
    if (merged.globalFontWeight === 0) {
      merged.globalFontWeight = 400;
      filledDefaults = true;
    }
    if (filledDefaults) {
      await setSync(SETTINGS_KEY, merged);
      debug.log('settings', 'migrate font defaults → hardcoded fallbacks', {
        globalFont: merged.globalFont,
        globalFontSize: merged.globalFontSize,
        globalFontWeight: merged.globalFontWeight,
      });
    }
    // v0.2.19X: check the old `fontSize` field for legacy migration
    //  (pre-rename users still have it in storage). `globalFontSize`
    //  would be undefined for those users and the `typeof` check
    //  below would not fire — we want the migration to run on
    //  stored.fontSize so PRIOR_FONT_SIZE_DEFAULTS catches them.
    //  After rename, new storage writes use `globalFontSize` directly.
    const legacyFontSize = (stored as Settings & { fontSize?: number }).fontSize;
    const storedFontSize = typeof stored.globalFontSize === 'number'
      ? stored.globalFontSize
      : (typeof legacyFontSize === 'number' ? legacyFontSize : undefined);
    if (typeof storedFontSize === 'number') {
      const isPriorDefault = PRIOR_FONT_SIZE_DEFAULTS.has(storedFontSize);
      const isOutOfRange = storedFontSize < 12 || storedFontSize > 32;
      if (isPriorDefault || isOutOfRange) {
        merged.globalFontSize = defaults.globalFontSize;
        await setSync(SETTINGS_KEY, merged);
        debug.log('settings', 'migrate globalFontSize', { from: storedFontSize, to: defaults.globalFontSize });
      }
    }
    // v0.2.97: highlightRound unit changed from em-scale (0..2)
    //  to px. Old em-scale value 1 → 1em = 16px (browsers) or
    //  10px (62.5% root font-size). Under the new interpretation
    //  the same stored value (1) would render as 1px, which is
    //  visually almost identical to 0 (the new "use theme
    //  default" sentinel). Migrating 1 → 0 keeps the
    //  theme's `.rounded-md` as the effective default for
    //  upgraders, which matches the pre-v0.2.97 intent of
    //  the scale(1) "use the midpoint" semantic.
    if (stored.highlightRound === 1) {
      merged.highlightRound = 0;
      await setSync(SETTINGS_KEY, merged);
      debug.log('settings', 'migrate highlightRound 1 → 0 (em-scale → px, use theme default)');
    }
    // See LEGACY_DEFAULT_PALETTE: clear dead pre-0.2.30 hex values so the
    // active theme's palette can render through (applyUserColorOverride
    // treats '' as "no override" and removeProperty's the inline value).
    if (looksLikeLegacyPaletteDefaults(merged)) {
      for (const k of Object.keys(LEGACY_DEFAULT_PALETTE) as Array<keyof Settings>) {
        // The five keys in LEGACY_DEFAULT_PALETTE are all string fields;
        // the cast drops the Settings[keyof Settings] union so we can
        // assign '' without the TS compiler complaining.
        (merged as unknown as Record<string, unknown>)[k] = '';
      }
      await setSync(SETTINGS_KEY, merged);
      debug.log('settings', 'migrate legacy palette defaults -> empty (theme takes over)');
    }
    // Coerce settings whose declared type is number but whose stored
    // value is a string. Pre-0.2.95 saveSetting wrote the raw
    // HTMLSelectElement.value (always string) directly, so e.g.
    // `newtab` ended up as '0'/'1'/'2' instead of 0/1/2. Without this
    // rewrite, every `getSetting('newtab') === 1` strict comparison in
    // consumers (link click handler, etc.) silently failed. The fix
    // mirrors coerceToSettingType in settings-panel.ts; doing it here
    // also covers users who loaded the bad values before the panel
    // was reopened.
    const typed = coerceNumberSettings(merged);
    if (typed.dirty) {
      await setSync(SETTINGS_KEY, typed.next);
      debug.log('settings', 'migrate string-typed number settings', typed.dirtyKeys);
    }
    // v0.2.102: the global `css` field is gone — move a leftover
    // pre-v0.2.102 value (either in the unified storage under
    // `css` or in the bare `customCSS` key) into the per-theme
    // per-mode `themeOverrides[theme][mode].customCss` bucket.
    // The migration picks the (theme, mode) bucket that the user
    // was *currently* on so the global styles survive the field
    // removal in the most intuitive place.
    const cssMigrated = await migrateLegacyGlobalCss(typed.next);
    if (cssMigrated.dirty) {
      await setSync(SETTINGS_KEY, cssMigrated.next);
      debug.log('settings', 'migrate global CSS to per-theme per-mode', {
        theme: cssMigrated.next.theme,
        mode: cssMigrated.next.darkMode,
        length: cssMigrated.length,
      });
    }
    currentSettings = cssMigrated.next;
  } else {
    await migrateLegacySettings();
    // v0.2.102: bare `customCSS` key might also have survived
    //  migrateLegacySettings (it was removed from LEGACY_KEY_MAP in
    //  this version). Move it into the freshly-defaults settings
    //  object under `themeOverrides[default][system].customCss`.
    const after = await getSync<Settings>(SETTINGS_KEY);
    const fresh = after ?? { ...defaults };
    const cssMigrated = await migrateLegacyGlobalCss(fresh);
    if (cssMigrated.dirty) {
      await setSync(SETTINGS_KEY, cssMigrated.next);
      debug.log('settings', 'migrate bare customCSS to per-theme per-mode', {
        length: cssMigrated.length,
      });
    }
    currentSettings = cssMigrated.next;
  }
  initialized = true;
  // v0.2.117: initialize the i18n module with the persisted
  //  preference. Uses `initLocale` (not `setLocale`) so the document
  //  attributes get applied even on first paint and subscribers
  //  see a notification on the very first call.
  initLocale(resolveLocale(currentSettings.language));
  debug.log('settings', 'initSettings', { fromStorage: !!stored, count: Object.keys(currentSettings).length });
  return currentSettings;
}

/**
 * Walk the merged settings and rewrite any field whose declared type
 * (per the `defaults` shape) is number but whose stored value is a
 * numeric string. Returns a flag + key list so the caller can persist
 * only when something actually changed.
 */
function coerceNumberSettings(merged: Settings): { next: Settings; dirty: boolean; dirtyKeys: string[] } {
  let dirty = false;
  const dirtyKeys: string[] = [];
  const next: Settings = { ...merged };
  // `themeOverrides` is intentionally not iterated here — it is an object,
  //  not a number, and is not in `defaults` (so Object.keys(defaults)
  //  never surfaces it). v0.2.97 introduced the field; the
  //  resolveEffectiveSettings resolver in features/settings/apply.ts
  //  is the only place that reads it, and it tolerates `undefined`
  //  as well as partial buckets.
  for (const k of Object.keys(defaults) as Array<keyof Settings>) {
    const reference = defaults[k];
    if (typeof reference !== 'number') continue;
    const v = next[k] as unknown;
    if (typeof v === 'string' && v !== '') {
      const num = Number(v);
      if (!Number.isNaN(num)) {
        // Cast drops the union so we can assign a narrowed number;
        // we just verified typeof defaults[k] === 'number' above.
        (next as unknown as Record<string, unknown>)[k] = num;
        dirty = true;
        dirtyKeys.push(String(k));
      }
    }
  }
  return { next, dirty, dirtyKeys };
}

/** Check if settings have been loaded */
export function isSettingsInitialized(): boolean {
  return initialized;
}

/**
 * v0.2.102: move a pre-v0.2.102 global custom-CSS value into the
 * per-theme per-mode `themeOverrides[theme][mode].customCss` bucket.
 *
 * Sources of legacy data:
 * 1. `Settings.css` — the unified storage field that was removed in
 *    v0.2.102. We can't read it via the `Settings` type (the field
 *    is gone), so we read the raw stored object and pull `css` off
 *    via a cast.
 * 2. Bare `customCSS` key — the pre-unified storage key that
 *    `migrateLegacySettings` used to map to `['css', raw]`. Removed
 *    from `LEGACY_KEY_MAP` in v0.2.102 (because `css` is no longer
 *    a `Settings` key), so the bare value may still be in
 *    `chrome.storage.sync` for users who upgrade from a very old
 *    build.
 *
 * The migration picks the (theme, mode) bucket that the user was
 * *currently* on (`merged.theme` + `merged.darkMode`, resolved
 * against `prefers-color-scheme` for 'system'). The styles survive
 * the field removal in the most intuitive place — the theme the
 * user is actually looking at.
 *
 * If both sources are empty, returns `{ next: merged, dirty: false }`
 * and the caller skips the `setSync` write.
 */
async function migrateLegacyGlobalCss(merged: Settings): Promise<{
  next: Settings;
  dirty: boolean;
  length: number;
}> {
  // 1. Read raw unified storage to pluck the legacy `css` field.
  //    The field is not in `Settings` anymore, so we read it through
  //    the bare `getSync<unknown>` path and cast.
  const storedRaw = (await getSync<unknown>(SETTINGS_KEY)) as
    | (Settings & { css?: unknown })
    | undefined;
  const unifiedCss = typeof storedRaw?.css === 'string' ? storedRaw.css : '';

  // 2. Read the bare `customCSS` key (pre-unified storage).
  const bareRaw = await getSync<unknown>('customCSS');
  const bareCss = typeof bareRaw === 'string' ? bareRaw : '';

  // The unified value wins if both exist — it represents the most
  // recent user edit (migrateLegacySettings copies the bare value
  // to unified on every launch). Fall back to bare if unified is
  // empty so pre-unified upgrades still preserve their CSS.
  const legacyCss = unifiedCss || bareCss;
  if (!legacyCss.trim()) {
    return { next: merged, dirty: false, length: 0 };
  }

  // Resolve the bucket to write to. `merged.theme` is the base
  // theme id (no `-dark` suffix); `merged.darkMode` is the user's
  // intent ('system' / 'light' / 'dark'). For 'system' we mirror
  // the same matchMedia check used by `applyTheme.resolveTheme`
  // and `resolveEffectiveSettings` so the migration lands in the
  // bucket the user is *actually* seeing on screen right now.
  const theme = String(merged.theme ?? 'default');
  const darkMode = String(merged.darkMode ?? 'system');
  const mode: 'light' | 'dark' = darkMode === 'dark'
    ? 'dark'
    : darkMode === 'light'
      ? 'light'
      : (typeof window !== 'undefined'
          && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light';

  // Build the new themeOverrides tree without mutating the input.
  // We follow the same shallow-copy-on-each-level pattern as
  // settings-panel.ts:writePerThemeValue (see that file for
  // rationale — chrome.storage.onChanged + the panel's own
  // refresh both expect a fresh object reference to detect the
  // change).
  const allOverrides = { ...(merged.themeOverrides ?? {}) } as Record<
    string,
    { light?: Record<string, unknown>; dark?: Record<string, unknown> }
  >;
  const themeBucket = { ...(allOverrides[theme] ?? {}) };
  const modeBucket = { ...(themeBucket[mode] ?? {}) };
  modeBucket.customCss = legacyCss;
  themeBucket[mode] = modeBucket;
  allOverrides[theme] = themeBucket;

  // Strip the legacy `css` field from the in-memory object so a
  //  subsequent `setSync(SETTINGS_KEY, next)` doesn't write it back.
  //  The bare `customCSS` key is removed via `removeSync` below.
  //  `Settings` has no string index signature, so go through
  //  `unknown` before the cast.
  const next: Settings = { ...merged, themeOverrides: allOverrides };
  delete (next as unknown as Record<string, unknown>).css;

  if (bareCss) {
    await removeSync('customCSS');
  }

  return { next, dirty: true, length: legacyCss.length };
}
