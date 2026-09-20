// v1.3.4 (issue #19): one-shot cleanup for palette values that
// `saveThemeChange` used to *stamp* into the global Settings fields.
//
// Background — through v1.3.3, every theme switch or darkMode toggle
// captured the five palette colors that `applyTheme` had just written to
// `<html>`'s inline style and persisted them into the global
// `backgroundColor` / `fontColor` / `highlightColor` /
// `highlightFontColor` / `shadowColor` fields.
//
// Those fields are meant to hold *user* choices: they are the fallback
// layer beneath `themeOverrides[theme][mode]` in
// `features/settings/apply.ts → resolveEffectiveSettings()`, and they are
// deliberately mode-independent. A theme-rendered, mode-specific snapshot
// written there is a category error — with `darkMode: 'system'` a single
// snapshot can only ever describe one of the two variants.
//
// The user-visible symptom (issue #19) was that flipping the OS
// appearance changed the page background but left link / folder-title
// text on the old variant. `--newtab-link-color` is written only by
// `applySettingsToDOM` (from the resolved `fontColor`), so it kept
// re-asserting the stale snapshot while the background — one of the four
// variables `applyTheme` re-derives on every call — followed along.
//
// Detection — a stamp's values are *by construction* equal to the
// rendered palette of one (base theme, mode) variant, so we re-render
// both candidate variants of the active base theme and compare. Clearing
// a field whose stored value already equals what the theme would render
// is visually a no-op by definition, so a false positive is harmless:
// the page looks identical, the field simply follows the theme from then
// on instead of pinning a frozen copy.
//
// `linkBgColor` is deliberately NOT a trigger or a target: `saveThemeChange`
// read it from inline style, where a *user* value lives whenever one
// exists, so a non-empty `linkBgColor` may well be the user's own choice
// and must not be cleared.

import { getSetting, updateSettings } from '../../lib/storage/settings';
import type { Settings } from '../bookmarks/types';
import { hasDarkVariant, resolveCssColor } from './switcher';
import { log } from '../../lib/debug';

/**
 * The five global Settings fields `saveThemeChange` used to stamp. A
 * real stamp always writes all five (its `readVar` helper resolves a
 * value for each), so a missing one means "not a stamp".
 */
const STAMPED_KEYS = [
  'backgroundColor',
  'fontColor',
  'highlightColor',
  'highlightFontColor',
  'shadowColor',
] as const;

type StampedKey = (typeof STAMPED_KEYS)[number];

/**
 * Which `--newtab-*` variable each stamped field was sampled from.
 * Mirrors the `readVar` calls in `saveThemeChange` — note that
 * `shadowColor` was sourced from `--newtab-highlight` (the two shared a
 * CSS variable until v0.2.100), NOT from `--newtab-shadow`.
 */
const RENDERED_VAR: Readonly<Record<StampedKey, string>> = {
  backgroundColor: '--newtab-bg',
  fontColor: '--newtab-text',
  highlightColor: '--newtab-highlight',
  highlightFontColor: '--newtab-highlight-text',
  shadowColor: '--newtab-highlight',
};

/** The four variables `applyTheme` promotes to inline style. They have to
 *  be stashed during the variant probe — see `clearThemeStampedPalette`. */
const INLINE_PALETTE_VARS = [
  '--newtab-bg',
  '--newtab-text',
  '--newtab-highlight',
  '--newtab-highlight-text',
] as const;

/** Per-theme per-mode palette keys. Their presence means the user is
 *  actively working with the override layer (see module header). */
const PALETTE_OVERRIDE_KEYS = [
  'backgroundColor',
  'fontColor',
  'linkBgColor',
  'highlightColor',
  'highlightFontColor',
  'shadowColor',
] as const;

/**
 * Normalize any color string a stamp or the renderer may hold into a
 * comparable `#rrggbb`. `resolveCssColor` already turns CSS Color 4
 * functions (oklch / color-mix / …) into hex or `rgb()`, so the only
 * remaining work here is collapsing `rgb(r, g, b)` and shorthand hex
 * into the same shape and lower-casing.
 */
function canonicalHex(value: string): string {
  const resolved = resolveCssColor(value).trim();
  if (/^#[0-9a-f]{3}$/i.test(resolved)) {
    const [r, g, b] = resolved.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^#[0-9a-f]{6}$/i.test(resolved)) return resolved.toLowerCase();
  const rgb = /^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i.exec(resolved);
  if (rgb) {
    const toHex = (n: string | undefined): string =>
      Math.round(Number(n ?? 0)).toString(16).padStart(2, '0');
    return `#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`;
  }
  return resolved.toLowerCase();
}

/** Candidate `data-theme` values for the active base theme. A stamp can
 *  only ever match the variant that was rendered when it was written, so
 *  both are worth probing. */
function candidateVariants(baseTheme: string): string[] {
  return hasDarkVariant(baseTheme) ? [baseTheme, `${baseTheme}-dark`] : [baseTheme];
}

/** Read the five palette variables off the currently active variant. */
function renderedPalette(root: HTMLElement): Record<StampedKey, string> {
  const styles = getComputedStyle(root);
  const out = {} as Record<StampedKey, string>;
  for (const key of STAMPED_KEYS) {
    out[key] = canonicalHex(styles.getPropertyValue(RENDERED_VAR[key]));
  }
  return out;
}

/** True when the user has any non-empty per-theme per-mode palette
 *  override for the active base theme (either mode). */
function hasAnyPaletteOverride(baseTheme: string): boolean {
  const all = getSetting('themeOverrides') as
    | Record<string, { light?: Record<string, unknown>; dark?: Record<string, unknown> }>
    | undefined;
  const buckets = all?.[baseTheme];
  if (!buckets) return false;
  for (const mode of ['light', 'dark'] as const) {
    const bucket = buckets[mode];
    if (!bucket) continue;
    if (PALETTE_OVERRIDE_KEYS.some((key) => String(bucket[key] ?? '').trim() !== '')) {
      return true;
    }
  }
  return false;
}

/**
 * Clear the five global palette fields when they hold a theme-rendered
 * stamp rather than a user choice. Returns `true` when storage was
 * rewritten (callers should re-apply the theme afterwards so the cleared
 * values take effect without waiting for the `storage.onChanged`
 * round-trip).
 *
 * Safe to call on every startup: a no-op for fresh installs (the fields
 * are `''`), for users who never switched a theme, and for users with a
 * per-theme per-mode override in play.
 */
export async function clearThemeStampedPalette(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const baseTheme = String(getSetting('theme') ?? '');
  if (!baseTheme) return false;

  const stored: Partial<Record<StampedKey, string>> = {};
  for (const key of STAMPED_KEYS) {
    const raw = String(getSetting(key) ?? '').trim();
    if (!raw) return false;
    stored[key] = canonicalHex(raw);
  }

  // The override layer wins over the global fields (`??` in
  // resolveEffectiveSettings), so clearing them would buy nothing and
  // risks touching a setup the user is deliberately running.
  if (hasAnyPaletteOverride(baseTheme)) return false;

  const root = document.documentElement;
  const previousTheme = root.getAttribute('data-theme');

  // `applyTheme` promotes the four derived variables to inline style
  // (specificity 1,0,0,0). Inline wins over every `[data-theme="..."]`
  // block, so leaving them in place would make both probe iterations read
  // the *currently rendered* variant — precisely the value we're trying to
  // look past when the OS has already flipped. Stash them, probe the
  // theme CSS alone, then put them back.
  const stashedInline = INLINE_PALETTE_VARS.map(
    (name) => [name, root.style.getPropertyValue(name)] as const,
  );
  for (const [name] of stashedInline) root.style.removeProperty(name);

  let isStamp = false;
  try {
    for (const variant of candidateVariants(baseTheme)) {
      // Both iterations, the restore below, and the caller's re-apply all
      // happen inside one task, so the browser never paints an
      // intermediate variant.
      root.setAttribute('data-theme', variant);
      const rendered = renderedPalette(root);
      if (STAMPED_KEYS.every((key) => rendered[key] === stored[key])) {
        isStamp = true;
        break;
      }
    }
  } finally {
    if (previousTheme === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', previousTheme);
    for (const [name, value] of stashedInline) {
      if (value) root.style.setProperty(name, value);
    }
  }

  if (!isStamp) return false;

  const cleared: Partial<Settings> = {};
  for (const key of STAMPED_KEYS) {
    (cleared as Record<string, string>)[key] = '';
  }
  await updateSettings(cleared);
  log('theme', 'cleared theme-stamped palette (issue #19 migration)', {
    theme: baseTheme,
    keys: [...STAMPED_KEYS],
  });
  return true;
}
