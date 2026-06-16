// Settings store — manages user configuration
// Uses chrome.storage.sync for settings, chrome.storage.local for layout cache

import type { Settings } from '../../features/bookmarks/types';
import { getSync, setSync } from '../storage';
import * as debug from '../debug';

const SETTINGS_KEY = 'settings';

const defaults: Settings = {
  font: 'Sans-serif',
  fontSize: 18,
  fontWeight: 400,
  theme: 'default',
  fontColor: '#555555',
  backgroundColor: '#ffffff',
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
    currentSettings = { ...defaults };
  }
  initialized = true;
  debug.log('settings', 'initSettings', { fromStorage: !!stored, count: Object.keys(currentSettings).length });
  return currentSettings;
}

/** Check if settings have been loaded */
export function isSettingsInitialized(): boolean {
  return initialized;
}
