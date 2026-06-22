// Apply settings to the DOM as CSS custom properties and dynamic styles.
// Used at startup (newtab/app.ts) and re-invoked on every settings change
// (settings-panel.ts) so font/color/animation tweaks take effect without a
// page reload. Also installs a chrome.storage.onChanged listener so other
// tabs that update settings propagate here live.

import type { Settings } from '../bookmarks/types';
import { getSetting, replaceSettings } from '../../lib/storage/settings';
import { applyTheme } from '../themes/switcher';
import { log } from '../../lib/debug';

const STYLE_ELEMENT_ID = 'dynamic-styles';
// v0.2.102: removed `user-css` (replaced by `user-theme-css`).
//  The legacy `<style id="user-css">` was sourced from
//  `Settings.css` (the global custom-CSS field, also removed in
//  v0.2.102). Custom CSS is now per-theme per-mode, stored under
//  `themeOverrides[themeId][mode].customCss` and injected into
//  `user-theme-css` by `rebuildUserThemeCss`. The node lives
//  AFTER `dynamic-styles` in the head so its rules win the
//  cascade for any selector that doesn't already use
//  `!important`.
const USER_THEME_CSS_ELEMENT_ID = 'user-theme-css';

/**
 * Settings that drive the four `--newtab-*` CSS variables representing
 * the active theme palette. Each key maps to the inline-style property
 * it writes; see `applyUserColorOverride` for the write path.
 *
 * v0.2.100: `shadowColor` was previously aliased to
 * `--newtab-highlight` (shared with `highlightColor`) because the
 * v0.2.45-v0.2.52 hover-glow effect used the same color for both
 * the highlight background and the box-shadow. The glow effect was
 * removed in v0.2.53 but the alias stayed, which meant editing
 * "shadow color" silently clobbered the folder / menu / undo
 * button hover backgrounds. Now decoupled: `shadowColor` writes to
 * `--newtab-shadow`, which is its own CSS var (globals.css:97),
 * and the box-shadow rule in `rebuildDynamicStyles` falls back to
 * `--newtab-highlight` only when shadowColor is unset.
 */
const COLOR_KEYS = {
  backgroundColor: '--newtab-bg',
  fontColor: '--newtab-text',
  highlightColor: '--newtab-highlight',
  highlightFontColor: '--newtab-highlight-text',
  // v0.2.100: shadowColor was aliased to --newtab-highlight (shared
  // with highlightColor) since the v0.2.45 hover-glow effect. The
  // glow was removed in v0.2.53 but the alias stayed, which made
  // editing "shadow color" silently clobber the folder/menu/undo
  // button hover backgrounds. Decouple: shadowColor now controls
  // only the box-shadow color on `#main a:hover` (see
  // rebuildDynamicStyles), with a chained-fallback to
  // --newtab-highlight when unset (globals.css:97) so a fresh
  // install still shows the accent glow.
  shadowColor: '--newtab-shadow',
} as const satisfies Partial<Record<keyof Settings, string>>;
type ColorKey = keyof typeof COLOR_KEYS;

/**
 * Settings that affect the generated `<style id="dynamic-styles">` block.
 * The five `COLOR_KEYS` are deliberately NOT in this set — their values
 * flow through inline style on `<html>` (specificity 1,0,0,0) so a theme
 * switch can wipe them and a per-color user override can win the cascade.
 * Including them here would emit a hardcoded `color: #...` rule that
 * would always trump both the theme and any later inline override.
 *
 * `themeOverrides` is included (v0.2.97) so that editing a per-theme
 * per-mode value (e.g. while the user is typing into the appearance
 * panel's `<details>` input) re-runs the resolver rather than
 * silently keeping the stale `dynamic-styles` block.
 */
const STYLE_KEYS: ReadonlySet<keyof Settings> = new Set<keyof Settings>([
  'font', 'fontSize', 'fontWeight',
  'shadowBlur', 'highlightRound',
  'spacing', 'width', 'hPos', 'autoScale',
  'align',
  'themeOverrides',
]);

/**
 * Resolve the 10 appearance-tab options for the *currently active*
 * theme + appearance mode. Theme/darkMode/width/hPos/align/spacing/
 * columnWidth/etc. are intentionally NOT resolved here — they remain
 * global (see `ThemeModeOverrides` in features/bookmarks/types.ts).
 *
 * Resolution order, per key:
 *   1. `themeOverrides[baseTheme][mode]?.[key]`  (per-theme per-mode override)
 *   2. `Settings[key]`                            (global value)
 *   3. hardcoded default in this function         (only for keys where
 *      the global `Settings` value might still be the v0.2.96 default
 *      that no longer makes sense — currently none, all 10 have a real
 *      Settings default).
 *
 * `baseTheme` is the value of `Settings.theme` (no `-dark` suffix;
 * `applyTheme` already normalizes that). `mode` is the resolved
 * appearance mode (light / dark) derived from `darkMode` +
 * `prefers-color-scheme` — same logic as `applyTheme.resolveTheme`
 * in features/themes/switcher.ts. We re-derive it here rather than
 * passing it in so the resolver is self-contained and safe to call
 * from any context.
 */
function resolveEffectiveSettings(): {
  font: string;
  fontSize: number;
  fontWeight: number;
  fontColor: string;
  backgroundColor: string;
  highlightColor: string;
  highlightFontColor: string;
  shadowColor: string;
  shadowBlur: number;
  highlightRound: number;
} {
  const baseTheme = String(getSetting('theme') ?? 'default');
  const darkMode = String(getSetting('darkMode') ?? 'system');
  const mode: 'light' | 'dark' = darkMode === 'dark'
    ? 'dark'
    : darkMode === 'light'
      ? 'light'
      : (typeof window !== 'undefined'
          && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light';
  const allOverrides = (getSetting('themeOverrides') ?? {}) as Record<string, { light?: Partial<Settings>; dark?: Partial<Settings> }>;
  const overrides = allOverrides[baseTheme]?.[mode] as Partial<Settings> | undefined;

  return {
    font: overrides?.font ?? String(getSetting('font') ?? 'Sans-serif'),
    fontSize: overrides?.fontSize ?? Number(getSetting('fontSize') ?? 16),
    fontWeight: overrides?.fontWeight ?? Number(getSetting('fontWeight') ?? 400),
    fontColor: overrides?.fontColor ?? String(getSetting('fontColor') ?? ''),
    backgroundColor: overrides?.backgroundColor ?? String(getSetting('backgroundColor') ?? ''),
    highlightColor: overrides?.highlightColor ?? String(getSetting('highlightColor') ?? ''),
    highlightFontColor: overrides?.highlightFontColor ?? String(getSetting('highlightFontColor') ?? ''),
    shadowColor: overrides?.shadowColor ?? String(getSetting('shadowColor') ?? ''),
    shadowBlur: overrides?.shadowBlur ?? Number(getSetting('shadowBlur') ?? 1),
    // `highlightRound` is now stored in px (v0.2.97). 0 = "use the
    // active theme's `.rounded-md`" (newtab.css:105's
    // `var(--newtab-link-radius, calc(var(--radius) - 2px))` kicks
    // in). Positive values override the theme's rounded-md with a
    // user px value.
    highlightRound: overrides?.highlightRound ?? Number(getSetting('highlightRound') ?? 0),
  };
}

/**
 * Write a single user color override as an inline custom property on the
 * document root. Inline style beats both the `:where(:root)` defaults and
 * the `[data-theme="..."]` blocks, so the user value is what renders.
 *
 * `applyTheme` must have run at least once before this is called so the
 * CSS variable already resolves to the active theme's value; otherwise
 * we'd be writing a property that the cascade has no source for.
 *
 * `shadowColor` is a legacy Settings field whose CSS source is
 * `--newtab-highlight` (see newtab.css: `box-shadow: 0 0 var(--newtab-shadow-blur) var(--newtab-highlight)`),
 * so its inline override MUST be sourced from the `highlightColor`
 * setting rather than its own — otherwise storage's `shadowColor`
 * default (`#57b0ff`) would clobber a `highlightColor` override the
 * user just made on every `applySettingsToDOM` (which re-runs all five
 * overrides on every storage change).
 */
export function applyUserColorOverride(key: ColorKey): void {
  if (typeof document === 'undefined') return;
  const cssVar = COLOR_KEYS[key];
  const sourceKey: ColorKey = key === 'shadowColor' ? 'highlightColor' : key;
  const value = String(getSetting(sourceKey) ?? '').trim();
  if (!value) {
    document.documentElement.style.removeProperty(cssVar);
    return;
  }
  document.documentElement.style.setProperty(cssVar, value);
  log('apply', 'applyUserColorOverride', { key, cssVar, sourceKey, value });
}

/**
 * Write one resolved color value as an inline custom property. Unlike
 * `applyUserColorOverride`, this takes a string directly (the value
 * returned by `resolveEffectiveSettings`) so it can be used in the
 * per-theme per-mode path without going back through `Settings`.
 * `key` is the COLOR_KEYS key (selects which `--newtab-*` CSS var to
 * write) — pass the global Settings key, not the override bucket key,
 * since the bucket uses the same Settings key names.
 */
function writeResolvedColor(key: ColorKey, value: string): void {
  if (typeof document === 'undefined') return;
  const cssVar = COLOR_KEYS[key];
  const v = String(value ?? '').trim();
  if (!v) {
    document.documentElement.style.removeProperty(cssVar);
    return;
  }
  document.documentElement.style.setProperty(cssVar, v);
}

/** Build (or replace) the `<style id="dynamic-styles">` node from current settings. */
export function rebuildDynamicStyles(): void {
  const eff = resolveEffectiveSettings();
  const rules: string[] = [];

  // Font (v0.2.97: fontSize is now stored in px directly, no more
  //  `/ 10 em` trick. The old `${fontSize / 10}em` + 62.5% root
  //  font-size made Devtools show 1.8em instead of 18px, which
  //  obscured coverage from the user's perspective. Direct px also
  //  makes the "user sees what they set" promise explicit.)
  rules.push(`#main a { font-family: "${eff.font}"; }`);
  rules.push(`#main a { font-size: ${eff.fontSize}px; }`);
  rules.push(`#main a { font-weight: ${eff.fontWeight}; }`);

  // Note: text/highlight colors are NOT emitted here. They are written
  // as inline custom properties on <html> by `applyTheme` and
  // `applyUserColorOverride`, then resolved via the `var(--newtab-*)`
  // references in newtab.css (#main a / #main a:hover). Hardcoding them
  // in this <style> block would let dynamic-styles win the cascade and
  // freeze the colors regardless of theme or per-color user edits.

  // Shadow
  const shadowBlur = scale(eff.shadowBlur, 7, 100);
  // v0.2.100: shadowColor was previously `--newtab-highlight`
  // (aliased to highlightColor). Decoupled — `var(--newtab-shadow,
  // var(--newtab-highlight))` keeps the default glow in sync with the
  // highlight color (when shadowColor is empty / unset) but lets a
  // user-set shadowColor paint the box-shadow independently of the
  // folder/menu/undo button backgrounds.
  rules.push(`#main a:hover { box-shadow: 0 0 ${shadowBlur}px var(--newtab-shadow, var(--newtab-highlight)); }`);

  // Border radius (v0.2.97: highlightRound is in px, written as
  //  `--newtab-link-radius` on `:root`. newtab.css:105 reads
  //  `var(--newtab-link-radius, calc(var(--radius) - 2px))`, so
  //  if we DON'T emit a value here, the theme's `.rounded-md`
  //  fallback kicks in. We only emit the rule when the user has
  //  set a positive value — leaving the property unset is what
  //  actually means "use theme default". `0` as an explicit value
  //  would force a sharp 0px corner (the previous em-scale
  //  behavior), which is the opposite of what we want.
  //  The OLD implementation emitted `#main a { border-radius:
  //  ${scale(highlightRound, 0.2, 1.5)}em }` which clobbered
  //  the theme's --radius-derived value entirely.)
  if (eff.highlightRound > 0) {
    rules.push(`:root { --newtab-link-radius: ${eff.highlightRound}px; }`);
  }

  // Spacing — drives the inter-row gap (--newtab-spacing), not the
  // line-height of each link. The v0.2.45-era implementation wrote
  // `line-height` + horizontal padding to `#main a`, but the row gap
  // is the more intuitive "行间距" semantic (the visual space between
  // two adjacent link items). Writing to `:root --newtab-spacing`
  // (specificity 0,1,0) overrides the :where(:root) default in
  // globals.css (specificity 0) and cascades into the `gap` rules
  // in newtab.css. Scale 0.5/1/1.5 → 4px/10px/20px.
  const rowGap = scale(Number(getSetting('spacing')), 10, 20, 4);
  rules.push(`:root { --newtab-spacing: ${rowGap}px; }`);

  // Width (global; per-theme per-mode override does not apply to
  //  width/hPos per user decision — see docs/.../appearance-theme-
  //  overrides-plan.md §4. These two are always read from the
  //  global Settings object.)
  if (getSetting('autoScale')) {
    const widthPct = scale(Number(getSetting('width')), 96, 100, 60);
    // Horizontal position: 0 = left, 1 = center, 2 = right.
    // hPos=1 must keep #main visually centered — that is, margin-left
    // = half the slack between widthPct and the viewport (100%).
    const slackPct = 100 - widthPct;
    const marginLeftPct = (Number(getSetting('hPos')) / 2) * slackPct;
    rules.push(`#main { width: ${widthPct}%; margin-left: ${marginLeftPct}%; }`);
  } else {
    const widthPx = scale(Number(getSetting('width')), 1200, 3000, 800);
    // Fixed-width mode: margin-left is computed against 100vw so the
    // hPos=1 position remains centered even when the window resizes.
    rules.push(`#main { width: ${widthPx}px; margin-left: calc((${Number(getSetting('hPos'))} / 2) * (100vw - ${widthPx}px)); }`);
  }

  // Vertical margin — removed in v0.2.93 (per user feedback that
  // the setting was confusing and not particularly useful). The
  // topbar's own `padding: 16px` (newtab.css) and `#main`'s flow
  // provide enough top whitespace without an extra setting.

  // Align — drives the column group's horizontal alignment via
  // `text-align` on `#main`. Columns are `display: inline-block`,
  // so they flow as text-level content and respect parent's
  // text-align. The setting only has visible effect when columns
  // don't fill `#main`'s full width (i.e., `columnWidth` is set
  // to a fixed value); with `columnWidth: auto` the group fills
  // 100% and the alignment is a no-op. This matches HNTP's
  // behavior — `align` is meaningful when columns are sized
  // smaller than the available space.
  rules.push(`#main { text-align: ${String(getSetting('align'))}; }`);

  const style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
    ?? Object.assign(document.createElement('style'), { id: STYLE_ELEMENT_ID });
  style.textContent = rules.join('\n');
  if (!style.isConnected) document.head.appendChild(style);
}

/**
 * Write the per-theme per-mode custom CSS to `<style id="user-theme-css">`.
 *
 * v0.2.102: source of truth is
 * `themeOverrides[baseTheme][mode].customCss` — see
 * `ThemeModeOverrides` in `features/bookmarks/types.ts`. Empty
 * string clears the node's textContent so the theme defaults
 * render through. Resolution of `(baseTheme, mode)` mirrors
 * `resolveEffectiveSettings` (same darkMode / matchMedia logic)
 * so the panel and the DOM write to the same bucket.
 *
 * The element is created lazily on first non-empty write and
 * reused thereafter. When the resolved CSS is empty, we still
 * keep the element around with `textContent = ''` so a subsequent
 * non-empty write is just a string assignment (no DOM churn).
 */
function rebuildUserThemeCss(): void {
  const baseTheme = String(getSetting('theme') ?? 'default');
  const darkMode = String(getSetting('darkMode') ?? 'system');
  const mode: 'light' | 'dark' = darkMode === 'dark'
    ? 'dark'
    : darkMode === 'light'
      ? 'light'
      : (typeof window !== 'undefined'
          && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light';
  const allOverrides = (getSetting('themeOverrides') ?? {}) as Record<
    string,
    { light?: { customCss?: string }; dark?: { customCss?: string } }
  >;
  const css = String(allOverrides[baseTheme]?.[mode]?.customCss ?? '');
  const el = document.getElementById(USER_THEME_CSS_ELEMENT_ID) as HTMLStyleElement | null
    ?? Object.assign(document.createElement('style'), { id: USER_THEME_CSS_ELEMENT_ID });
  el.textContent = css;
  if (!el.isConnected) document.head.appendChild(el);
}

/** Scale a value from [0,1,2] to [min,mid,max] (or [min,max] if mid omitted). */
function scale(value: number, mid: number, max: number, min: number = 0): number {
  if (value > 1) {
    return mid + (value - 1) * (max - mid);
  }
  return min + value * (mid - min);
}

/**
 * Re-apply the non-palette parts of the current settings to the DOM.
 * Specifically: rebuild the dynamic-styles block (font, size, weight,
 * spacing, ...) and the per-theme custom CSS node.
 *
 * Palette settings (`backgroundColor`, `fontColor`, `highlightColor`,
 * `highlightFontColor`, `shadowColor`) and the `theme` setting are
 * NOT touched here — those flow through inline custom properties on
 * `<html>`, and the corresponding setters (`applyTheme`,
 * `applyUserColorOverride`) are called by the live-edit paths
 * (settings-panel saveSetting, initApp startup, the storage
 * onChanged listener — and only that listener, only when `theme`
 * changed). Calling `applyTheme` from this function would wipe
 * legitimate per-color user overrides every time any other setting
 * was edited.
 *
 * v0.2.97: 5 palette colors now read from `resolveEffectiveSettings`
 * so per-theme per-mode overrides take effect on theme/darkMode
 * changes. The colors are written via `writeResolvedColor` (a
 * string-in / inline-style-out helper) rather than re-calling
 * `applyUserColorOverride` (which would re-read the global
 * `Settings` key, defeating the per-theme resolution).
 *
 * v0.2.102: also rebuild `user-theme-css` (replaces the
 * v0.2.101 `rebuildUserCss` + global `Settings.css` field).
 */
export function applySettingsToDOM(): void {
  log('apply', 'applySettingsToDOM');
  const eff = resolveEffectiveSettings();
  // Write all five palette colors from the resolved (per-theme
  //  per-mode) values. Empty string → removeProperty so the
  //  active theme's CSS variable renders through.
  writeResolvedColor('backgroundColor', eff.backgroundColor);
  writeResolvedColor('fontColor', eff.fontColor);
  writeResolvedColor('highlightColor', eff.highlightColor);
  writeResolvedColor('highlightFontColor', eff.highlightFontColor);
  // shadowColor shares the highlightColor CSS var.
  writeResolvedColor('shadowColor', eff.shadowColor);
  rebuildDynamicStyles();
  rebuildUserThemeCss();
}

/**
 * Apply a single setting change to the DOM without doing a full re-apply.
 *
 * - `theme` → `applyTheme` clears the inline color overrides and writes
 *   the new theme's palette to the inline `<html>` styles. The settings
 *   panel persists the resulting `{theme, 5 colors}` bundle via
 *   `updateSettings`; the storage.onChanged listener also re-runs
 *   `applySettingsToDOM` which reasserts the per-color overrides.
 *   v0.2.97: `applyTheme` (themes/switcher.ts) now also calls
 *   `rebuildDynamicStyles` at the end so the
 *   `--newtab-link-radius` (and any other per-theme dynamic rule)
 *   stays in sync with the new theme's `--radius`.
 * - `darkMode` (v0.2.97) → since changing darkMode flips the
 *   `mode` key in `themeOverrides`, a re-resolution of the 10
 *   appearance values is needed. The simplest correct path is
 *   a full `applySettingsToDOM` (color + dynamic-styles + user-css).
 *   `applyTheme` also runs so the `<html data-theme>` attribute
 *   tracks the new mode.
 * - any color key in `COLOR_KEYS` → `applyUserColorOverride` writes a
 *   single inline property. We do NOT call `rebuildDynamicStyles`
 *   here — the dynamic-styles block intentionally contains no color
 *   rules, so the page reflects the new value with no extra work.
 *   v0.2.97 note: this path now uses the GLOBAL Settings value, not
 *   the per-theme per-mode override. The settings-panel live-edit
 *   for a per-theme color goes through `writePerThemeValue`, which
 *   persists to `themeOverrides` and triggers a full
 *   `applySettingsToDOM` (so the resolver runs end-to-end).
 * - any other key in `STYLE_KEYS` → `rebuildDynamicStyles` regenerates
 *   the dynamic <style> block (font, size, weight, spacing, etc.).
 *   This calls `resolveEffectiveSettings`, so per-theme values are
 *   honored on the very next render.
 * - `themeOverrides` change (v0.2.97 + v0.2.102) → in addition to
 *   `rebuildDynamicStyles` (which re-resolves the 10 appearance
 *   options), also call `rebuildUserThemeCss` so the per-theme
 *   per-mode custom CSS (v0.2.102) follows the (theme, mode) change
 *   live. Without this, the injected styles would still belong to
 *   the previous bucket until the next full `applySettingsToDOM`.
 *   v0.2.102 note: the v0.2.101 branch
 *   `if (key === 'css') { rebuildUserCss(); }` is gone — `css` is
 *   no longer a `Settings` key.
 */
export function applySettingChange<K extends keyof Settings>(key: K): void {
  log('apply', 'applySettingChange', { key, value: getSetting(key) });
  if (key === 'theme') {
    applyTheme(String(getSetting('theme')));
  }
  if (key === 'darkMode') {
    // darkMode change → re-resolve theme + mode, then re-apply
    //  the whole thing (palette + dynamic-styles + user-css).
    applyTheme(String(getSetting('theme')));
    applySettingsToDOM();
    return;
  }
  if (key in COLOR_KEYS) {
    applyUserColorOverride(key as ColorKey);
  } else if (STYLE_KEYS.has(key)) {
    rebuildDynamicStyles();
    // themeOverrides is in STYLE_KEYS (so the 10 per-theme
    //  appearance options re-resolve on change). A change to
    //  themeOverrides can also move the resolved per-theme
    //  per-mode customCss bucket — re-inject that as well.
    if (key === 'themeOverrides') {
      rebuildUserThemeCss();
    }
  }
}

/**
 * Install a chrome.storage.onChanged listener so settings updated in one
 * tab propagate here live. Idempotent. The storage module also updates its
 * in-memory cache (via initSettings' lazy re-read) so getSetting() returns
 * the new value before we re-apply styles.
 */
let storageListenerInstalled = false;
export function installSettingsChangeListener(): void {
  if (storageListenerInstalled) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  storageListenerInstalled = true;
  // The chrome.storage.onChanged key is the literal key passed to
  // chrome.storage.sync.set, which is STORAGE_PREFIX + SETTINGS_KEY
  // = 'newtab01.settings' (see lib/storage/index.ts and settings.ts).
  // Listening for the bare 'settings' key never matches.
  const FULL_KEY = 'newtab01.settings';
  log('apply', 'installSettingsChangeListener (listening for)', FULL_KEY);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    log('apply', 'storage.onChanged fired', { areaName, keys: Object.keys(changes) });
    if (areaName !== 'sync') return;
    if (!changes[FULL_KEY]) {
      log('apply', 'storage.onChanged ignored: key mismatch, expected', FULL_KEY);
      return;
    }
    const newValue = changes[FULL_KEY].newValue as Settings | undefined;
    const oldValue = changes[FULL_KEY].oldValue as Settings | undefined;
    if (newValue) {
      replaceSettings(newValue);
    }
    // If `theme` changed, re-apply the theme (which clears the inline
    // color overrides and writes the new theme's palette to <html>).
    // For every other key change, `applySettingsToDOM` is enough — it
    // reasserts the per-color overrides and rebuilds the dynamic-styles
    // block without touching the theme.
    if (newValue && oldValue && newValue.theme !== oldValue.theme) {
      applyTheme(String(newValue.theme));
    }
    applySettingsToDOM();
  });
}
