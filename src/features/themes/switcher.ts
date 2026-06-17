// Theme switcher — single source of truth for theme IDs, application, and
// change notification. Used by options/app.ts, newtab/settings-panel.ts and
// any future surface that needs to enumerate or apply themes.
//
// Adding a new BUILT-IN theme (e.g. one copied from tweakcn):
//   1. Append its id to THEMES below.
//   2. Add a new file under styles/themes/ with the format
//      `:root[data-theme="<id>"] { 8 shadcn variables }`. The 6 `--newtab-*`
//      variables are derived from these 8 in styles/globals.css, so no
//      newtab-specific edits are required.
//   3. Add the file to the @import list at the top of styles/globals.css.
//   4. Add a Chinese label in settings-panel.ts's THEME_LABELS map (English
//      id is the fallback if no label is provided).
//   5. (Once runtime import lands) see docs/themes-from-tweakcn.md —
//      prefer the import flow over adding a built-in.
//
// RUNTIME-IMPORTED themes (tweakcn JSON pasted in settings) are not in
// this list — they live in chrome.storage.local and are merged into the
// dropdown at render time via listAllThemes(). See
// docs/superpowers/specs/2026-06-17-runtime-theme-import-design.md.

import { getSetting } from '../../lib/storage/settings';
import { log } from '../../lib/debug';
import { listAllThemes, type ThemeListEntry } from './custom-themes';

/**
 * Canonical list of built-in themes. All built-in themes are sourced
 * from tweakcn (https://tweakcn.com). Other tweakcn themes can be
 * installed at runtime via the settings panel — see
 * `custom-themes.ts` and docs/superpowers/specs/2026-06-17-runtime-theme-import-design.md.
 *
 * Adding a new built-in theme (rare — prefer runtime import):
 *   1. Append its id to THEMES below.
 *   2. Add a new file under styles/themes/ with the format
 *      `:root[data-theme="<id>"] { 8 shadcn variables }`. The 6 `--newtab-*`
 *      variables are derived from these 8 in styles/globals.css, so no
 *      newtab-specific edits are required.
 *   3. Add the file to the @import list at the top of styles/globals.css.
 *   4. Add a Chinese label in settings-panel.ts's THEME_LABELS map (English
 *      id is the fallback if no label is provided).
 *
 * RUNTIME-IMPORTED themes (tweakcn JSON pasted in settings) are not in
 * this list — they live in chrome.storage.local and are merged into the
 * dropdown at render time via listAllThemes(). See
 * docs/superpowers/specs/2026-06-17-runtime-theme-import-design.md.
 */
const THEMES = [
  'default',
  'default-dark',
  'mx-brutalist',
  'mx-brutalist-dark',
  'cyberpunk',
  'cyberpunk-dark',
  'astrovista',
  'astrovista-dark',
] as const;

export type ThemeId = (typeof THEMES)[number];

/** Subscribe here to react to theme application (e.g. re-render widgets). */
const listeners = new Set<(theme: string) => void>();

/** Sorted list of available BUILT-IN theme identifiers. */
export function listThemes(): string[] {
  return [...THEMES].sort();
}

/** Async — returns built-in + custom themes merged, with labels and a
 *  flag distinguishing the two. Use this from any UI that needs to
 *  enumerate themes for the user (settings dropdown, etc.).
 *
 *  labels: a map of id → display label. Only used for built-ins.
 *  Pass THEME_LABELS from settings-panel.ts. */
export async function listAllThemesWithLabels(
  labels: Readonly<Record<string, string>>,
): Promise<ThemeListEntry[]> {
  return listAllThemes([...THEMES], labels);
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
    //    to overwrite. `resolveCssColor` is required here because
    //    `getComputedStyle().getPropertyValue('--newtab-highlight')`
    //    returns a CSS expression (e.g. `color-mix(in srgb, #fffcf5,
    //    #008f47 15%)`) with var() refs substituted but the function
    //    itself preserved — and `<input type="color">` rejects anything
    //    that isn't `#rrggbb`. Without resolution, saveThemeChange would
    //    write the expression straight into chrome.storage and the next
    //    settings-panel render would fail the color input's format
    //    validation.
    const styles = getComputedStyle(root);
    const bg = resolveCssColor(styles.getPropertyValue('--newtab-bg').trim());
    const text = resolveCssColor(styles.getPropertyValue('--newtab-text').trim());
    const highlight = resolveCssColor(styles.getPropertyValue('--newtab-highlight').trim());
    const highlightText = resolveCssColor(styles.getPropertyValue('--newtab-highlight-text').trim());
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
 * Resolve any CSS color expression (hex, rgb(), hsl(), oklch(),
 * color(), color-mix(), var()-bearing expressions, ...) to a concrete
 * `rgb(r, g, b)` or `rgba(r, g, b, a)` string the browser has
 * already evaluated. This is the only thing that satisfies
 * `<input type="color">` (which requires exactly `#rrggbb`) and
 * chrome.storage (which we'd rather keep as a real color string,
 * not a CSS expression).
 *
 * Implementation: stamp the expression onto a throwaway element's
 * `style.color` and let the browser do the resolution. `getComputedStyle`
 * on the color property returns a concrete rgb()/rgba() value for
 * most input formats — but for the new CSS Color 4 forms
 * (`color(srgb ...)`, `oklch(...)`, `oklab(...)`, etc.) Chrome 111+
 * returns the value **preserved in its original function form**
 * (per spec, `getComputedStyle` does not serialize color functions).
 * To handle those, we do a second probe round-trip: stamp the
 * already-resolved value back into `style.color` and read the
 * computed style a second time. By the second hop the browser has
 * normalized the value into `rgb()` form.
 *
 * Fast path: a value that's already a simple `rgb()` / `rgba()` / hex
 * is returned unchanged (the temp-DOM round-trip is ~0.1ms each but
 * not free on every settings render).
 */
export function resolveCssColor(cssValue: string): string {
  const v = cssValue.trim();
  if (!v) return '';
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (/^(rgb|rgba)\(/i.test(v)) return v;
  if (typeof document === 'undefined') return v;
  const probe = document.createElement('span');
  probe.style.color = v;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const first = getComputedStyle(probe).color;
  document.body.removeChild(probe);

  // If the first pass already returned an rgb()/rgba() form, we're done.
  if (/^rgba?\(/i.test(first)) return first;

  // Otherwise the browser preserved the CSS Color 4 form. Re-stamp and
  // re-read — by the second hop the value is in `rgb()` form. The
  // `style.color` setter on a <span> accepts every color function and
  // outputs an rgb() when serialized via getComputedStyle on the same
  // element. Two hops are needed because the *first* hop preserves the
  // input; the *second* hop (where the input is now the preserved
  // function form) is what triggers the rgb() normalization in Chrome.
  const probe2 = document.createElement('span');
  probe2.style.color = first;
  probe2.style.display = 'none';
  document.body.appendChild(probe2);
  const second = getComputedStyle(probe2).color;
  document.body.removeChild(probe2);
  return second || first || v;
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
