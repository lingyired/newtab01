// Apply settings to the DOM as CSS custom properties and dynamic styles.
// Used at startup (newtab/app.ts) and re-invoked on every settings change
// (settings-panel.ts) so font/color/animation tweaks take effect without a
// page reload. Also installs a chrome.storage.onChanged listener so other
// tabs that update settings propagate here live.

import type { Settings } from '../bookmarks/types';
import { getSetting, replaceSettings } from '../../lib/storage/settings';
import { applyTheme } from '../themes/switcher';

const STYLE_ELEMENT_ID = 'dynamic-styles';
const USER_CSS_ELEMENT_ID = 'user-css';

/** Settings that affect the generated `<style id="dynamic-styles">` block. */
const STYLE_KEYS: ReadonlySet<keyof Settings> = new Set<keyof Settings>([
  'font', 'fontSize', 'fontWeight',
  'fontColor', 'backgroundColor', 'highlightColor', 'highlightFontColor', 'shadowColor',
  'shadowBlur', 'highlightRound', 'fade', 'slide',
  'spacing', 'vMargin', 'width', 'hPos', 'autoScale',
]);

/** Build (or replace) the `<style id="dynamic-styles">` node from current settings. */
function rebuildDynamicStyles(): void {
  const settings = getSetting;
  const rules: string[] = [];

  // Font
  rules.push(`#main a { font-family: "${settings('font')}"; }`);
  rules.push(`#main a { font-size: ${settings('fontSize') / 10}em; }`);
  rules.push(`#main a { font-weight: ${settings('fontWeight')}; }`);

  // Colors
  rules.push(`#main a { color: var(--newtab-text); }`);
  rules.push(`#main a:hover { color: var(--newtab-highlight-text); background-color: var(--newtab-highlight); }`);

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
 * Re-apply all settings to the DOM. Safe to call repeatedly — replaces the
 * existing dynamic-styles node in place rather than appending duplicates.
 */
export function applySettingsToDOM(): void {
  applyTheme(String(getSetting('theme')));
  rebuildDynamicStyles();
  rebuildUserCss();
}

/**
 * Apply a single setting change to the DOM without doing a full re-apply.
 * Themed settings call `applyTheme` first so the data-theme attribute
 * updates before the dynamic-styles block is regenerated.
 */
export function applySettingChange<K extends keyof Settings>(key: K): void {
  if (key === 'theme') {
    applyTheme(String(getSetting('theme')));
  }
  if (STYLE_KEYS.has(key)) {
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
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    if (!changes['settings']) return;
    // Re-read the unified settings object so getSetting() in this tab
    // returns the value updated by another tab.
    const newValue = changes['settings'].newValue as Settings | undefined;
    if (newValue) {
      replaceSettings(newValue);
    }
    applySettingsToDOM();
  });
}
