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
  fontColor: '#555555',
  backgroundColor: '#ffffff',
  backgroundImage: '',
  highlightColor: '#e4f4ff',
  highlightFontColor: '#000000',
  shadowColor: '#57b0ff',
  shadowBlur: 1,
  highlightRound: 1,
  fade: 1,
  spacing: 1,
  width: 1,
  hPos: 1,
  vMargin: 1,
  slide: 1,
  hideOptions: 0,
  lock: 0,
  showTop: 1,
  showApps: 1,
  showRecent: 1,
  showClosed: 1,
  showDevices: 1,
  showRoot: 1,
  showSearch: 1,
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
  fadeMs: (raw) => (typeof raw === 'number' ? ['fade', raw] : null),
  slideMs: (raw) => (typeof raw === 'number' ? ['slide', raw] : null),
  spacing: (raw) => (typeof raw === 'number' ? ['spacing', raw] : null),
  vMargin: (raw) => (typeof raw === 'number' ? ['vMargin', raw] : null),
  columnWidth: (raw) => (typeof raw === 'string' ? ['columnWidth', raw] : null),
  align: (raw) => (typeof raw === 'string' ? ['align', raw] : null),
  lockColumns: (raw) => (typeof raw === 'boolean' ? ['lockColumns', raw ? 1 : 0] : null),
  showTopLevel: (raw) => (typeof raw === 'boolean' ? ['showTop', raw ? 1 : 0] : null),
  autoScale: (raw) => (typeof raw === 'boolean' ? ['autoScale', raw ? 1 : 0] : null),
  hideOptions: (raw) => (typeof raw === 'boolean' ? ['hideOptions', raw ? 1 : 0] : null),
  numberTop: (raw) => (typeof raw === 'number' ? ['numberTop', raw] : null),
  numberRecent: (raw) => (typeof raw === 'number' ? ['numberRecent', raw] : null),
  showOtherDevices: (raw) => (typeof raw === 'boolean' ? ['showDevices', raw ? 1 : 0] : null),
  showSearchBar: (raw) => (typeof raw === 'boolean' ? ['showSearch', raw ? 1 : 0] : null),
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
    currentSettings = merged;
  } else {
    await migrateLegacySettings();
    const after = await getSync<Settings>(SETTINGS_KEY);
    currentSettings = after ?? { ...defaults };
  }
  initialized = true;
  debug.log('settings', 'initSettings', { fromStorage: !!stored, count: Object.keys(currentSettings).length });
  return currentSettings;
}

/** Check if settings have been loaded */
export function isSettingsInitialized(): boolean {
  return initialized;
}
