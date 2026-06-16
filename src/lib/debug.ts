// Debug logger — gated console output for development
// Enable via:
//   1. URL query `?debug=1` (highest priority — works in dev, test, and prod for one-off debugging)
//   2. Storage setting `debug` (user toggle in settings panel, only shown in dev/test builds)
//   3. Auto: ON when MODE !== 'production' (i.e. `vite` dev server OR `vite build --mode development`)

import { getSync, setSync } from './storage';

const SETTINGS_KEY = 'settings';
const DEBUG_FIELD = 'debug';
const PREFIX = '[newtab01]';
// `vite build` defaults to MODE=production (debug OFF).
// `vite` (dev server) and `vite build --mode development` set MODE=development (debug ON).
const IS_DEV = import.meta.env.MODE !== 'production';

let enabled = false;
let initialized = false;
let sessionOverride: boolean | null = null;

/** Initialize debug state from storage + URL override */
export async function initDebug(): Promise<void> {
  if (initialized) return;

  // 1. URL query — highest priority, works in both dev and prod
  try {
    const params = new URLSearchParams(window.location.search);
    const queryDebug = params.get('debug');
    if (queryDebug === '1' || queryDebug === 'true') {
      sessionOverride = true;
    } else if (queryDebug === '0' || queryDebug === 'false') {
      sessionOverride = false;
    }
  } catch {
    // No window.location (e.g. service worker)
  }

  // 2. Pull persistent setting
  let storedDebug: unknown;
  try {
    const stored = await getSync<Record<string, unknown>>(SETTINGS_KEY);
    storedDebug = stored?.[DEBUG_FIELD];
  } catch {
    // ignore
  }

  // 3. Resolve effective enabled state
  if (sessionOverride !== null) {
    // URL override always wins
    enabled = sessionOverride;
  } else if (typeof storedDebug === 'number') {
    // Stored setting only matters in dev (prod should not ship user-toggleable debug)
    enabled = IS_DEV && storedDebug !== 0;
  } else {
    // Fall back to dev/prod default
    enabled = IS_DEV;
  }

  initialized = true;

  // Expose to console for easy toggling
  try {
    (globalThis as unknown as Record<string, unknown>).__newtab01_debug = api;
  } catch {
    // ignore
  }

  if (enabled) {
    log('debug', `Debug mode ENABLED (${IS_DEV ? 'dev' : 'prod via ?debug=1'})`, {
      sessionOverride,
      storedDebug,
      isDev: IS_DEV,
      location: typeof window !== 'undefined' ? window.location.href : 'sw',
    });
  }
}

/** Synchronous check — safe to call from any hot path */
export function isEnabled(): boolean {
  return enabled;
}

/** Programmatic toggle. If persist=true, also writes to chrome.storage.sync */
export async function setEnabled(value: boolean, persist = false): Promise<void> {
  // In prod, refuse to enable via runtime call (URL ?debug=1 still works)
  if (value && !IS_DEV && sessionOverride !== true) {
    return;
  }
  enabled = value;
  sessionOverride = value ? true : sessionOverride;
  if (persist) {
    try {
      const stored = (await getSync<Record<string, unknown>>(SETTINGS_KEY)) ?? {};
      stored[DEBUG_FIELD] = value ? 1 : 0;
      await setSync(SETTINGS_KEY, stored);
    } catch (err) {
      warn('debug', 'Failed to persist debug setting', err);
    }
  }
  if (enabled) {
    log('debug', 'Debug mode toggled ON');
  }
}

/** console.log with prefix and tag */
export function log(tag: string, message: string, ...data: unknown[]): void {
  if (!enabled) return;
  if (data.length > 0) {
    console.log(`${PREFIX}:${tag}`, message, ...data);
  } else {
    console.log(`${PREFIX}:${tag}`, message);
  }
}

/** console.warn with prefix and tag */
export function warn(tag: string, message: string, ...data: unknown[]): void {
  if (!enabled) return;
  if (data.length > 0) {
    console.warn(`${PREFIX}:${tag}`, message, ...data);
  } else {
    console.warn(`${PREFIX}:${tag}`, message);
  }
}

/** console.error — always shown (bypasses the gate so errors are never silenced) */
export function error(tag: string, message: string, ...data: unknown[]): void {
  if (data.length > 0) {
    console.error(`${PREFIX}:${tag}`, message, ...data);
  } else {
    console.error(`${PREFIX}:${tag}`, message);
  }
}

/** Collapsed group */
export function group(tag: string, label: string): void {
  if (!enabled) return;
  console.group(`${PREFIX}:${tag} ${label}`);
}

export function groupEnd(): void {
  if (!enabled) return;
  console.groupEnd();
}

/** Performance timing — uses console.time/timeEnd */
export function time(label: string): void {
  if (!enabled) return;
  console.time(`${PREFIX} ${label}`);
}

export function timeEnd(label: string): void {
  if (!enabled) return;
  console.timeEnd(`${PREFIX} ${label}`);
}

/** Dump a value to console with a stable label */
export function inspect(label: string, value: unknown): void {
  if (!enabled) return;
  log('inspect', label, value);
}

/** Dump current state in a copy-paste friendly format */
export async function dump(): Promise<void> {
  if (!enabled) {
    console.log(`${PREFIX} debug mode is OFF — call __newtab01_debug.setEnabled(true) first`);
    return;
  }
  group('dump', 'current state');
  try {
    const settingsMod = await import('./storage/settings');
    log('dump', 'settings', settingsMod.getSettings());
  } catch (err) {
    warn('dump', 'settings unavailable in this context', err);
  }
  try {
    const layoutMod = await import('../features/drag-drop/layout-ops');
    log('dump', 'columns', layoutMod.getColumns());
    const coordsMap: Record<string, { x: number; y: number }> = {};
    for (const col of layoutMod.getColumns()) {
      for (const id of col) {
        const c = layoutMod.getCoords(id);
        if (c) coordsMap[id] = c;
      }
    }
    log('dump', 'coords', coordsMap);
  } catch (err) {
    warn('dump', 'layout unavailable in this context', err);
  }
  groupEnd();
}

/** Public API exposed to globalThis */
const api = {
  isEnabled,
  setEnabled,
  log,
  warn,
  error,
  group,
  groupEnd,
  time,
  timeEnd,
  dump,
  inspect,
  /** Force re-init from storage (rarely needed) */
  reinit: initDebug,
};

