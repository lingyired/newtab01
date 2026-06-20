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
  'mx-brutalist',
  'cyberpunk',
  'astrovista',
] as const;

export type ThemeId = (typeof THEMES)[number];

/** Built-in dark variant existence. All 4 built-in base themes have
 *  a `-dark` CSS rule in styles/themes/*.css, so the `xxx-dark`
 *  suffix is always available as a `data-theme` value. The user
 *  picks "light vs dark" via the separate `darkMode` setting; this
 *  set is consulted by `hasDarkVariant()` and `resolveTheme()`. */
const BUILT_IN_THEMES_WITH_DARK: ReadonlySet<string> = new Set(THEMES);

/** Custom themes with a dark variant. Maintained by custom-themes.ts
 *  on every install/remove — it's the single writer of the custom
 *  theme storage, so it's the natural place to keep the cache in
 *  sync. Lookup is sync, which applyTheme() needs. */
const customThemesWithDarkVariant: Set<string> = new Set();

/** User-visible dark mode preference. Independent from `theme`:
 *  resolves to an actual `data-theme` value via `resolveTheme()`. */
export type DarkMode = 'system' | 'light' | 'dark';

/** True iff the given base theme id has a `-dark` variant. Built-in
 *  themes always do; custom themes depend on storage (see
 *  `setHasDarkVariant` + the writers in custom-themes.ts). */
export function hasDarkVariant(baseTheme: string): boolean {
  if (BUILT_IN_THEMES_WITH_DARK.has(baseTheme)) return true;
  return customThemesWithDarkVariant.has(baseTheme);
}

/** Mark a custom theme's dark-variant availability. Called by
 *  custom-themes.ts whenever chrome.storage.local.customThemes
 *  is written. No-op for built-in themes. */
export function setHasDarkVariant(baseTheme: string, hasDark: boolean): void {
  if (hasDark) customThemesWithDarkVariant.add(baseTheme);
  else customThemesWithDarkVariant.delete(baseTheme);
}

/** Resolve a base theme id + user darkMode preference to the actual
 *  `data-theme` value the browser sees. Returns the base id (no
 *  suffix) when the resolved mode is light, or when dark is
 *  requested but the theme has no dark variant (fallback). */
export function resolveTheme(baseTheme: string, darkMode: DarkMode): string {
  const effective: 'light' | 'dark' =
    darkMode === 'system'
      ? (typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light')
      : darkMode;
  if (effective === 'dark' && hasDarkVariant(baseTheme)) {
    return baseTheme + '-dark';
  }
  return baseTheme;
}

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
 * As of v0.2.75 the `theme` argument is a BASE id (no `-dark` suffix);
 * the actual `data-theme` attribute is computed by `resolveTheme()` from
 * the base id + the user's `darkMode` setting read out of storage.
 * Listeners receive the resolved id, not the base id.
 *
 * No-op when called in a non-DOM environment (e.g. unit tests without jsdom).
 */
export function applyTheme(theme: string): void {
  const darkMode = String(getSetting('darkMode') ?? 'system') as DarkMode;
  const resolved = resolveTheme(theme, darkMode);
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
    //    the palette defined in styles/themes/<resolved>.css. `<resolved>`
    //    is the base id or `<base>-dark` depending on the user's
    //    `darkMode` setting + the theme's dark-variant availability.
    root.setAttribute('data-theme', resolved);

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
  log('theme', 'applyTheme', { from: prev, to: resolved, base: theme, darkMode });
  for (const cb of listeners) {
    cb(resolved);
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
  if (/^rgba?\(/i.test(v)) return v;
  if (typeof document === 'undefined') return v;

  // Primary path: canvas pixel rendering. The HTML Living Standard
  // mandates CanvasRenderingContext2D accepts any legal CSS color
  // value in the fillStyle setter (oklch / lab / color() / hsl /
  // named colors / etc.) and the canvas backing store is always
  // sRGB — so actually RENDERING a 1x1 rect and reading
  // getImageData(0, 0, 1, 1) returns a Uint8ClampedArray of
  // sRGB bytes, regardless of how the fillStyle getter round-trips
  // the value.
  //
  // v0.2.86 used `ctx.fillStyle` getter (set then read back) as
  // the canonical normalizer. That works in Chrome 111+ for most
  // inputs but **fails for CSS Color 4 functions** (oklch / oklab
  // / color() / lab) — the getter preserves the original function
  // form rather than serializing to rgb/rgba, so the regex check
  // `^#[0-9a-f]...|^rgba?...` fails and the function falls through
  // to the getComputedStyle fallback, which has the same
  // preservation behavior. Result: oklch values reach the color
  // input unchanged and trigger the browser's "does not conform
  // to the required format '#rrggbb'" warning.
  //
  // The fillRect + getImageData pipeline avoids the getter entirely
  // — the rasterizer converts the color to sRGB pixels (the only
  // format canvas supports) and getImageData returns the bytes
  // directly. This is the same trick used by html2canvas /
  // dom-to-image for cross-browser color conversion.
  //
  // Out-of-gamut oklch colors are clipped to sRGB by the
  // rasterizer — visually the "closest representable" color, but
  // always a valid hex. Acceptable for our use case (we need
  // *any* valid hex for `<input type="color">` and chrome.storage).
  // Alpha is ignored (data[3]); all current oklch values in our
  // theme files are opaque, and `<input type="color">` is hex6-only
  // anyway. If we ever need alpha support, switch to hex8
  // (`#rrggbbaa`).
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1).data;
      // `noUncheckedIndexedAccess: true` makes data[i] typed as
      // `number | undefined`. The 1×1 canvas always populates all 4
      // bytes (RGBA), so the `!` non-null assertion is safe.
      const toHex = (n: number | undefined): string =>
        (n ?? 0).toString(16).padStart(2, '0');
      return '#' + toHex(data[0]) + toHex(data[1]) + toHex(data[2]);
    }
  } catch {
    // canvas path threw (extremely rare — e.g. some sandboxed
    // contexts, or invalid CSS the setter can't parse). Fall
    // through to the getComputedStyle fallback below.
  }

  // Fallback: getComputedStyle on a detached span. Canvas doesn't
  // accept `var(--foo)` or `color-mix(...)` — these are valid CSS
  // colors that need the cascade-resolved form. The browser does
  // the resolution in computed style.
  const probe = document.createElement('span');
  probe.style.color = v;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return computed || v;
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
