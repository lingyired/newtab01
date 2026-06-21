// Settings store — manages user configuration
// Uses chrome.storage.sync for settings, chrome.storage.local for layout cache

import type { Settings } from '../../features/bookmarks/types';
import { getSync, setSync, removeSync } from '../storage';
import * as debug from '../debug';

const SETTINGS_KEY = 'settings';

const defaults: Settings = {
  font: 'Sans-serif',
  fontSize: 18,
  fontWeight: 400,
  theme: 'default',
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
  backgroundImage: '',
  highlightColor: '',
  highlightFontColor: '',
  shadowColor: '',
  shadowBlur: 1,
  highlightRound: 1,
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
  css: '',
  numberTop: 10,
  numberClosed: 10,
  numberRecent: 10,
  lockColumns: 0,
  columnWidth: 'auto',
  align: 'left',
  debug: 0,
  folderActionConfirmThreshold: 10,
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

/** Prior fontSize defaults used in earlier versions — used to detect stale values to migrate */
const PRIOR_FONT_SIZE_DEFAULTS = new Set<number>([16, 17.5, 19, 22]);

/**
 * Legacy per-key settings written by older versions of options/app.ts.
 * Each entry maps a legacy chrome.storage.sync key to a function that converts
 * the raw stored value to the canonical Settings field value.
 */
const LEGACY_KEY_MAP: Record<string, (raw: unknown) => [keyof Settings, unknown] | null> = {
  theme: (raw) => (typeof raw === 'string' ? ['theme', raw] : null),
  font: (raw) => (typeof raw === 'string' ? ['font', raw] : null),
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
  customCSS: (raw) => (typeof raw === 'string' ? ['css', raw] : null),
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
    if (typeof stored.fontSize === 'number') {
      const isPriorDefault = PRIOR_FONT_SIZE_DEFAULTS.has(stored.fontSize);
      const isOutOfRange = stored.fontSize < 12 || stored.fontSize > 32;
      if (isPriorDefault || isOutOfRange) {
        merged.fontSize = defaults.fontSize;
        await setSync(SETTINGS_KEY, merged);
        debug.log('settings', 'migrate fontSize', { from: stored.fontSize, to: defaults.fontSize });
      }
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
    currentSettings = typed.next;
  } else {
    await migrateLegacySettings();
    const after = await getSync<Settings>(SETTINGS_KEY);
    currentSettings = after ?? { ...defaults };
  }
  initialized = true;
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
