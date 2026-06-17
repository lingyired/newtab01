// Theme switcher — single source of truth for theme IDs, application, and
// change notification. Used by options/app.ts, newtab/settings-panel.ts and
// any future surface that needs to enumerate or apply themes.
//
// Adding a new theme (e.g. one copied from tweakcn):
//   1. Append its id to THEMES below.
//   2. Add a new file under styles/themes/ with the format
//      `:root[data-theme="<id>"] { 8 shadcn variables }`. The 6 `--newtab-*`
//      variables are derived from these 8 in styles/globals.css, so no
//      newtab-specific edits are required.
//   3. Add the file to the @import list at the top of styles/globals.css.
//   4. Add a Chinese label in settings-panel.ts's THEME_LABELS map (English
//      id is the fallback if no label is provided).
// See docs/themes-from-tweakcn.md for a tweakcn-specific walkthrough.

import { getSetting } from '../../lib/storage/settings';
import { log } from '../../lib/debug';

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
  'midnight',
  'mocha',
  'mx-brutalist',
  'blue',
  'green',
  'purple',
  'orange',
] as const;

export type ThemeId = (typeof THEMES)[number];

/** Subscribe here to react to theme application (e.g. re-render widgets). */
const listeners = new Set<(theme: string) => void>();

/** Sorted list of available theme identifiers. */
export function listThemes(): string[] {
  return [...THEMES].sort();
}

/**
 * Apply a theme by setting the `data-theme` attribute on the document root
 * and writing the theme's palette to inline custom properties on the same
 * element. Inline style has specificity (1,0,0,0), which beats both
 * `:where(:root)` (0) and `[data-theme="..."]` (0,1,0) — so the user can
 * later override any individual color from the settings panel via
 * `applyUserColorOverride` and the new value will win the cascade.
 *
 * The four CSS variables written here are the single source of truth for
 * the page background, body text, and hover highlight. The shadow color
 * is a legacy field (`shadowColor`) that shares `--newtab-highlight`
 * (see newtab.css `box-shadow: 0 0 var(--newtab-shadow-blur) var(--newtab-highlight)`);
 * we keep it in storage for backwards compat but it is not exposed as a
 * separate override.
 *
 * `applyTheme` deliberately does NOT mutate `currentSettings`. The five
 * legacy color fields belong to the user's stored choices; overwriting
 * them with theme defaults on every switch would discard the user's
 * per-color overrides. The settings-panel path persists a fresh
 * `{theme, 5 colors}` bundle on user action (see `saveThemeChange`),
 * and `applyUserColorOverride` writes the user's choices on top of the
 * theme baseline at startup and on every other settings change.
 *
 * No-op when called in a non-DOM environment (e.g. unit tests without jsdom).
 */
export function applyTheme(theme: string): void {
  let prev: string | null = null;
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    prev = root.getAttribute('data-theme');

    // 1. Drop any user overrides so the new theme's palette starts from a
    //    known baseline. Otherwise a previously-saved `backgroundColor`
    //    inline value would survive the theme switch and mute the change.
    root.style.removeProperty('--newtab-bg');
    root.style.removeProperty('--newtab-text');
    root.style.removeProperty('--newtab-highlight');
    root.style.removeProperty('--newtab-highlight-text');

    // 2. Activate the theme CSS so the four variables now resolve to
    //    the palette defined in styles/themes/<theme>.css.
    root.setAttribute('data-theme', theme);

    // 3. Promote the resolved values to inline style (specificity 1,0,0,0)
    //    so subsequent `applyUserColorOverride` calls have a known target
    //    to overwrite.
    const styles = getComputedStyle(root);
    const bg = styles.getPropertyValue('--newtab-bg').trim();
    const text = styles.getPropertyValue('--newtab-text').trim();
    const highlight = styles.getPropertyValue('--newtab-highlight').trim();
    const highlightText = styles.getPropertyValue('--newtab-highlight-text').trim();
    if (bg) root.style.setProperty('--newtab-bg', bg);
    if (text) root.style.setProperty('--newtab-text', text);
    if (highlight) root.style.setProperty('--newtab-highlight', highlight);
    if (highlightText) root.style.setProperty('--newtab-highlight-text', highlightText);
  }
  log('theme', 'applyTheme', { from: prev, to: theme });
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
