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
const USER_CSS_ELEMENT_ID = 'user-css';

/**
 * Settings that drive the four `--newtab-*` CSS variables representing
 * the active theme palette. Each key maps to the inline-style property
 * it writes; see `applyUserColorOverride` for the write path.
 *
 * `shadowColor` is included for backwards-compat with the legacy Settings
 * type, but in the current CSS the `box-shadow` color is sourced from
 * `--newtab-highlight` (see newtab.css). The settings panel keeps the
 * two fields in sync on theme switches via `saveThemeChange`, and
 * editing either ultimately sets the same inline property.
 */
const COLOR_KEYS = {
  backgroundColor: '--newtab-bg',
  fontColor: '--newtab-text',
  highlightColor: '--newtab-highlight',
  highlightFontColor: '--newtab-highlight-text',
  shadowColor: '--newtab-highlight',
} as const satisfies Partial<Record<keyof Settings, string>>;
type ColorKey = keyof typeof COLOR_KEYS;

/**
 * Settings that affect the generated `<style id="dynamic-styles">` block.
 * The five `COLOR_KEYS` are deliberately NOT in this set — their values
 * flow through inline style on `<html>` (specificity 1,0,0,0) so a theme
 * switch can wipe them and a per-color user override can win the cascade.
 * Including them here would emit a hardcoded `color: #...` rule that
 * would always trump both the theme and any later inline override.
 */
const STYLE_KEYS: ReadonlySet<keyof Settings> = new Set<keyof Settings>([
  'font', 'fontSize', 'fontWeight',
  'shadowBlur', 'highlightRound', 'fade', 'slide',
  'spacing', 'vMargin', 'width', 'hPos', 'autoScale',
]);

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

/** Build (or replace) the `<style id="dynamic-styles">` node from current settings. */
function rebuildDynamicStyles(): void {
  const settings = getSetting;
  const rules: string[] = [];

  // Font
  rules.push(`#main a { font-family: "${settings('font')}"; }`);
  rules.push(`#main a { font-size: ${settings('fontSize') / 10}em; }`);
  rules.push(`#main a { font-weight: ${settings('fontWeight')}; }`);

  // Note: text/highlight colors are NOT emitted here. They are written
  // as inline custom properties on <html> by `applyTheme` and
  // `applyUserColorOverride`, then resolved via the `var(--newtab-*)`
  // references in newtab.css (#main a / #main a:hover). Hardcoding them
  // in this <style> block would let dynamic-styles win the cascade and
  // freeze the colors regardless of theme or per-color user edits.

  // Shadow
  const shadowBlur = scale(settings('shadowBlur'), 7, 100);
  rules.push(`#main a:hover { box-shadow: 0 0 ${shadowBlur}px var(--newtab-highlight); }`);

  // Border radius
  const highlightRound = scale(settings('highlightRound'), 0.2, 1.5);
  rules.push(`#main a { border-radius: ${highlightRound}em; }`);

  // Fade transition
  const fadeMs = scale(settings('fade'), 200, 1000);
  rules.push(`#main a { transition-duration: ${fadeMs}ms; }`);

  // Slide transition
  const slideMs = scale(settings('slide'), 200, 1000);
  rules.push(`.wrap { transition-duration: ${slideMs}ms; }`);

  // Spacing
  const lineHeight = scale(settings('spacing'), 2, 5.6, 0.8);
  const paddingH = scale(settings('spacing'), 0.8, 2, 0.4);
  rules.push(`#main a { line-height: ${lineHeight}; padding-left: ${paddingH + 0.4}em; padding-right: ${paddingH}em; }`);

  // Width
  if (settings('autoScale')) {
    const widthPct = scale(settings('width'), 96, 100, 60);
    // Horizontal position: 0 = left, 1 = center, 2 = right.
    // hPos=1 must keep #main visually centered — that is, margin-left
    // = half the slack between widthPct and the viewport (100%).
    const slackPct = 100 - widthPct;
    const marginLeftPct = (settings('hPos') / 2) * slackPct;
    rules.push(`#main { width: ${widthPct}%; margin-left: ${marginLeftPct}%; }`);
  } else {
    const widthPx = scale(settings('width'), 1200, 3000, 800);
    // Fixed-width mode: margin-left is computed against 100vw so the
    // hPos=1 position remains centered even when the window resizes.
    rules.push(`#main { width: ${widthPx}px; margin-left: calc((${settings('hPos')} / 2) * (100vw - ${widthPx}px)); }`);
  }

  // Vertical margin
  if (settings('autoScale')) {
    const vMarginPct = scale(settings('vMargin'), 0, 5);
    rules.push(`#main { margin-top: ${vMarginPct}%; }`);
  } else {
    const vMarginPx = scale(settings('vMargin'), 0, 200);
    rules.push(`#main { margin-top: ${vMarginPx}px; }`);
  }

  const style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
    ?? Object.assign(document.createElement('style'), { id: STYLE_ELEMENT_ID });
  style.textContent = rules.join('\n');
  if (!style.isConnected) document.head.appendChild(style);
}

/** Update (or create) the `<style id="user-css">` node from current css setting. */
function rebuildUserCss(): void {
  const css = String(getSetting('css') ?? '');
  const el = document.getElementById(USER_CSS_ELEMENT_ID) as HTMLStyleElement | null
    ?? Object.assign(document.createElement('style'), { id: USER_CSS_ELEMENT_ID });
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
 * spacing, ...) and the user CSS node.
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
 */
export function applySettingsToDOM(): void {
  log('apply', 'applySettingsToDOM');
  for (const key of Object.keys(COLOR_KEYS) as ColorKey[]) {
    applyUserColorOverride(key);
  }
  rebuildDynamicStyles();
  rebuildUserCss();
}

/**
 * Apply a single setting change to the DOM without doing a full re-apply.
 *
 * - `theme` → `applyTheme` clears the inline color overrides and writes
 *   the new theme's palette to the inline `<html>` styles. The settings
 *   panel persists the resulting `{theme, 5 colors}` bundle via
 *   `updateSettings`; the storage.onChanged listener also re-runs
 *   `applySettingsToDOM` which reasserts the per-color overrides.
 * - any color key in `COLOR_KEYS` → `applyUserColorOverride` writes a
 *   single inline property. We do NOT call `rebuildDynamicStyles`
 *   here — the dynamic-styles block intentionally contains no color
 *   rules, so the page reflects the new value with no extra work.
 * - any other key in `STYLE_KEYS` → `rebuildDynamicStyles` regenerates
 *   the dynamic <style> block (font, size, weight, spacing, etc.).
 * - `css` → `rebuildUserCss` swaps the user CSS node.
 */
export function applySettingChange<K extends keyof Settings>(key: K): void {
  log('apply', 'applySettingChange', { key, value: getSetting(key) });
  if (key === 'theme') {
    applyTheme(String(getSetting('theme')));
  }
  if (key in COLOR_KEYS) {
    applyUserColorOverride(key as ColorKey);
  } else if (STYLE_KEYS.has(key)) {
    rebuildDynamicStyles();
  }
  if (key === 'css') {
    rebuildUserCss();
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
