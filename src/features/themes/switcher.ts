// Theme switcher — single source of truth for theme IDs, application, and
// change notification. Used by options/app.ts, newtab/settings-panel.ts and
// any future surface that needs to enumerate or apply themes.
//
// Adding a new theme:
//   1. Append its id to THEMES below.
//   2. Add a `[data-theme="<id>"] { ... }` block to a new file under
//      styles/themes/, and `@import` that file from styles/globals.css.
//   3. (Optional) Provide a Chinese label in settings-panel.ts's local label
//      map — the English fallback (capitalized id) is always available.

import { getSetting } from '../../lib/storage/settings';

/**
 * Canonical list of built-in themes. Order here drives insertion order; the
 * public `listThemes()` returns a sorted copy so the dropdown is stable.
 *
 * Adding a theme here without also adding the matching CSS file will leave
 * the new id rendering with the `:root` defaults until the CSS file lands.
 */
const THEMES = [
  'default',
  'slate',
  'rose',
  'dark',
  'zinc',
  'stone',
  'midnight',
  'mocha',
] as const;

export type ThemeId = (typeof THEMES)[number];

/** Subscribe here to react to theme application (e.g. re-render widgets). */
const listeners = new Set<(theme: string) => void>();

/** Sorted list of available theme identifiers. */
export function listThemes(): string[] {
  return [...THEMES].sort();
}

/**
 * Apply a theme by setting the `data-theme` attribute on the document root.
 * Fires every registered listener with the applied theme id.
 *
 * No-op when called in a non-DOM environment (e.g. unit tests without jsdom).
 */
export function applyTheme(theme: string): void {
  let prev: string | null = null;
  if (typeof document !== 'undefined') {
    prev = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', theme);
  }
  // Direct console.log (not gated by debug module) so this is visible in
  // the production build — this is the source of "theme change has no
  // effect" reports and we need to confirm it actually fires.
  console.log('[newtab01:theme] applyTheme', { from: prev, to: theme });
  for (const cb of listeners) {
    cb(theme);
  }
}

/**
 * Read the currently configured theme from the unified settings store.
 * Lazy: only resolves when called, so callers can defer storage access.
 */
export function getCurrentTheme(): string {
  return String(getSetting('theme'));
}

/**
 * Subscribe to theme application events. Returns an unsubscribe function.
 * Listeners are called synchronously from `applyTheme()` — keep callbacks
 * cheap and non-throwing.
 */
export function onThemeChange(cb: (theme: string) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
