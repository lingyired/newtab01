// Custom theme import — users can paste a tweakcn registry item JSON
// directly into the settings panel, the JSON is stored in
// chrome.storage.local under "customThemes", and on every newtab/
// options/popup startup we emit a single <style id="custom-themes">
// block with one :root[data-theme="user-<kebab>"] { ... } selector
// per installed entry.
//
// As of v0.2.50 we preserve ALL tweakcn variables the source theme
// actually defined (radius, the shadow system, font families, letter-
// spacing, tracking tokens, spacing) — not just the 8 shadcn color
// variables. This matters because tweakcn themes encode their visual
// identity in those tokens: MX-Brutalist's 0px radius + 4px 4px 0 0
// shadow is the *whole point* of the theme, and dropping it on the
// floor left a generic 8px-radius shadowless search bar even when the
// user had imported MX-Brutalist. Themes that define only the 8 colors
// (older hand-written ones, partial pastes) still work — we just
// emit whatever non-empty vars are present.
//
// The 8 shadcn color variables remain the validation gate. The 6
// `--newtab-*` variables are NOT emitted here — globals.css already
// derives them from the 8 shadcn vars at the :where(:root) level
// (specificity 0,0,0), so any [data-theme="user-x"] block
// (specificity 0,1,0) wins for those vars and the derived 6 follow
// automatically. This matches the static themes under styles/themes/.
//
// Design spec: docs/superpowers/specs/2026-06-17-runtime-theme-import-design.md

import { log } from '../../lib/debug';
import { setHasDarkVariant } from './switcher';
import { getSetting, updateSettings } from '../../lib/storage/settings';
import type { Settings } from '../bookmarks/types';

/** The 8 shadcn color variables we REQUIRE for any theme. The validator
 *  rejects a paste that doesn't define all 8 — they are the
 *  irreducible palette that drives :where(:root) cascade wins and
 *  the 6 --newtab-* derivations. */
const THEME_VARS = [
  'background',
  'foreground',
  'primary',
  'primary-foreground',
  'muted',
  'muted-foreground',
  'border',
  'ring',
] as const;
type RequiredThemeVar = (typeof THEME_VARS)[number];

/** Optional tweakcn variables we PASS THROUGH if present. v0.2.50:
 *  we no longer drop these on the floor. The full list covers tweakcn
 *  themes' visual identity:
 *  - `--radius` — corner rounding (MX-Brutalist is 0px, the
 *    Codex/default is 0.5rem)
 *  - `--shadow-color / --shadow-opacity / --shadow-blur /
 *     --shadow-spread / --shadow-offset-x / --shadow-offset-y` —
 *     the shadow primitive that the preset vars below compose from
 *  - `--shadow / --shadow-2xs / --shadow-xs / --shadow-sm /
 *     --shadow-md / --shadow-lg / --shadow-xl / --shadow-2xl` —
 *     the composed shadow presets
 *  - `--font-sans / --font-mono / --font-serif` — type families
 *  - `--letter-spacing / --tracking-normal / --tracking-tighter /
 *     --tracking-tight / --tracking-wide / --tracking-wider /
 *     --tracking-widest` — letter spacing tokens
 *  - `--spacing` — base spacing unit
 *
 *  We deliberately do NOT carry through `chart-*` or `sidebar-*`
 *  because newtab01 doesn't render those surfaces. The other shadcn
 *  surface tokens (secondary / accent / destructive / card / popover
 *  / input + their foregrounds) ARE carried through — v0.2.53 added
 *  them because shadcn Button + Input reference them in their base
 *  classes (button hover uses `bg-accent text-accent-foreground`;
 *  input border uses `border-input`). Before the expansion our link
 *  hover fell back to `--newtab-highlight` (a 15% color-mix toward
 *  --primary, a newtab-only derivative) which the user explicitly
 *  asked to replace with the theme's own style. */
const THEME_VARS_OPTIONAL = [
  'radius',
  'shadow-color',
  'shadow-opacity',
  'shadow-blur',
  'shadow-spread',
  'shadow-offset-x',
  'shadow-offset-y',
  'shadow',
  'shadow-2xs',
  'shadow-xs',
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'shadow-xl',
  'shadow-2xl',
  'font-sans',
  'font-mono',
  'font-serif',
  'letter-spacing',
  'tracking-normal',
  'tracking-tighter',
  'tracking-tight',
  'tracking-wide',
  'tracking-wider',
  'tracking-widest',
  'spacing',
  // v0.2.53: shadcn surface tokens that the button/input class
  // strings reference. `accent` + `accent-foreground` drive link
  // hover; `input` drives search-input border color; the rest are
  // kept for symmetry so a user importing a tweakcn theme gets the
  // full visual identity (cards, popovers, destructive states).
  'secondary',
  'secondary-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'input',
] as const;
type OptionalThemeVar = (typeof THEME_VARS_OPTIONAL)[number];

/** Every tweakcn variable key we know about. */
type ThemeVar = RequiredThemeVar | OptionalThemeVar;

/** The minimum subset of a tweakcn registry item JSON we care about.
 *  `light` must contain all 8 required color vars; the optional vars
 *  may be present or absent depending on what the source theme
 *  defined. `dark` follows the same shape. */
type TweakcnCssVarsBlock = {
  theme?: Record<string, string>;
  light: Record<RequiredThemeVar, string> & Partial<Record<OptionalThemeVar, string>>;
  dark?: Record<RequiredThemeVar, string> & Partial<Record<OptionalThemeVar, string>>;
};
// Exported so consumers (e.g. css-import.ts) can construct
// TweakcnJson objects without re-declaring the strict inner shape.
export type { TweakcnCssVarsBlock };

export type TweakcnJson = {
  name: string;
  type?: string;
  /** Always present on data we store (validateThemeJson ensures it).
   *  Optional only at the type level so we can read untrusted JSON
   *  and let the validator reject the bad case. */
  cssVars?: TweakcnCssVarsBlock;
};

export type CustomThemeEntry = {
  /** Original JSON (light variant) — kept verbatim so we can re-render
   *  CSS if the generator changes in future versions. */
  light: TweakcnJson;
  /** Original JSON (dark variant) — may be absent if user pasted a JSON
   *  with no cssVars.dark, in which case we only register the light theme. */
  dark?: TweakcnJson;
  installedAt: number;
  updatedAt: number;
  /**
   * v0.2.104: original source URL for themes installed via the
   *  "Import custom theme" URL path. Kept so the settings panel's
   *  "Export settings" can emit `{ name, url }` entries that
   *  re-install on import (fetch the URL again, run
   *  validateThemeJson + installCustomTheme) instead of forcing
   *  the user to re-paste. Themes installed via the CSS path
   *  (no URL ever existed) leave this undefined and are skipped
   *  on export. Optional + backward-compatible — pre-v0.2.104
   *  storage shape (no `sourceUrl` field) reads back as
   *  `undefined`, which export treats as "no URL, skip". */
  sourceUrl?: string;
};

export type CustomThemesMap = Record<string, CustomThemeEntry>;

/** Stable key for the custom-themes map — the JSON `name` field,
 *  unchanged. Lets us detect "same name pasted twice" as an update. */
export type CustomThemeName = string;

/** chrome.storage.local key. */
const STORAGE_KEY = 'customThemes';

/** Style element id. Kept stable so the buildCustomThemesStyle can
 *  re-write the same node on every update instead of stacking <style>. */
export const STYLE_ID = 'custom-themes';

/** Internal id prefix for custom themes. Always use kebabThemeId()
 *  to build the actual id — never string-template by hand. */
export const USER_THEME_PREFIX = 'user-';

/** Validation result. Either an entry ready to save, or a typed error
 *  that the settings panel renders as a status message. */
export type ValidationResult =
  | { ok: true; entry: CustomThemeEntry; isUpdate: boolean; warning?: string }
  | { ok: false; error: string; warning?: string };

/** Strict validation per spec § 8. Only type === "registry:style"
 *  is accepted. 8 variables must be present in cssVars.light. */
export function validateThemeJson(
  raw: unknown,
  existing: CustomThemesMap,
): ValidationResult {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, error: 'Not a valid JSON object' };
  }
  const json = raw as Partial<TweakcnJson>;

  if (json.type !== 'registry:style') {
    return { ok: false, error: "Only type 'registry:style' is supported" };
  }
  if (typeof json.name !== 'string' || !json.name.trim()) {
    return { ok: false, error: 'Missing or empty "name" field' };
  }
  const cv = json.cssVars;
  if (!cv || typeof cv !== 'object' || !cv.light || typeof cv.light !== 'object') {
    return { ok: false, error: 'Missing cssVars.light' };
  }
  const lightBlock = cv.light as Record<string, unknown>;
  const missing: ThemeVar[] = [];
  for (const v of THEME_VARS) {
    const val = lightBlock[v];
    if (typeof val !== 'string' || !val.trim()) missing.push(v);
  }
  if (missing.length) {
    return { ok: false, error: `Missing cssVars.light fields: ${missing.join(', ')}` };
  }

  // dark is optional. If present, must be an object with all 8 vars.
  let darkBlock: Record<string, unknown> | undefined;
  if (cv.dark !== undefined) {
    if (typeof cv.dark !== 'object' || cv.dark === null) {
      return { ok: false, error: 'cssVars.dark must be an object when present' };
    }
    darkBlock = cv.dark as Record<string, unknown>;
    const missingDark: ThemeVar[] = [];
    for (const v of THEME_VARS) {
      const val = darkBlock[v];
      if (typeof val !== 'string' || !val.trim()) missingDark.push(v);
    }
    if (missingDark.length) {
      return {
        ok: false,
        error: `Missing cssVars.dark fields: ${missingDark.join(', ')}`,
      };
    }
  }

  const name = json.name.trim();
  const now = Date.now();
  const isUpdate = Object.prototype.hasOwnProperty.call(existing, name);
  const prev = existing[name];

  // Normalize the JSON we store. We re-emit a clean object that
  // contains the 8 required shadcn color vars + any optional tweakcn
  // vars the source theme defined (radius, shadow-*, font-*, letter-
  // spacing, tracking-*, spacing) + the name + type. We drop the
  // surfaces newtab01 doesn't render: chart-*, sidebar-*, card*,
  // popover*, secondary, accent, destructive, input, and any css /
  // files. Keeping storage small (~1-2KB/entry) and reducing the XSS
  // surface: anything we serialize is then injected into a CSS <style>
  // tag (not HTML), and we only ever interpolate the keys we either
  // validated as required or as optional + non-empty strings.
  const lightNormalized: TweakcnJson = {
    name,
    type: 'registry:style',
    cssVars: {
      theme: cv.theme ?? {},
      light: pickVars(lightBlock as Partial<Record<ThemeVar, string>>),
    },
  };
  let darkNormalized: TweakcnJson | undefined;
  if (darkBlock) {
    // The dark variant of a TweakcnJson carries cssVars.dark, not
    // cssVars.light. TweakcnCssVarsBlock requires `light` to be
    // present for the type to be valid, so we satisfy that with a
    // pointer to the same validated block — it never serializes to
    // CSS (only cssVars.dark is read at emit time).
    darkNormalized = {
      name,
      type: 'registry:style',
      cssVars: {
        theme: cv.theme ?? {},
        light: pickVars(darkBlock as Partial<Record<ThemeVar, string>>),
        dark: pickVars(darkBlock as Partial<Record<ThemeVar, string>>),
      },
    };
  }

  const entry: CustomThemeEntry = {
    light: lightNormalized,
    ...(darkNormalized ? { dark: darkNormalized } : {}),
    installedAt: prev?.installedAt ?? now,
    updatedAt: now,
  };

  if (cv.dark === undefined) {
    return {
      ok: true,
      entry,
      isUpdate,
      warning: 'No cssVars.dark provided, dark variant will fall back to built-in dark theme',
    };
  }
  return { ok: true, entry, isUpdate };
}

function pickVars(
  block: Partial<Record<ThemeVar, string>>,
): Record<ThemeVar, string> {
  const out = {} as Record<ThemeVar, string>;
  for (const v of THEME_VARS) {
    const val = block[v];
    if (typeof val === 'string' && val.trim()) out[v] = val;
  }
  for (const v of THEME_VARS_OPTIONAL) {
    const val = block[v];
    if (typeof val === 'string' && val.trim()) out[v] = val;
  }
  return out;
}

// --- Storage I/O ---

/** Read the full custom themes map. Returns {} on any error so callers
 *  can treat the absence of custom themes as the default state. */
export async function readCustomThemes(): Promise<CustomThemesMap> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return {};
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const raw = result[STORAGE_KEY];
    if (!raw || typeof raw !== 'object') return {};
    return raw as CustomThemesMap;
  } catch (e) {
    log('custom-themes', 'readCustomThemes: storage read failed', String(e));
    return {};
  }
}
/** Persist a single entry. Merges with existing map (keyed by name).
 *
 *  v0.2.104: accepts an optional 2nd `options` arg; when `sourceUrl`
 *  is provided it's stamped onto the entry (overwriting any previous
 *  value, so an upgrade from URL → CSS paste → URL again correctly
 *  tracks the latest URL). CSS-path installs omit the arg and
 *  `entry.sourceUrl` stays undefined. The merged `CustomThemeEntry`
 *  type still permits `sourceUrl?: string` so the field is optional
 *  on the storage side. */
export async function installCustomTheme(
  entry: CustomThemeEntry,
  options?: { sourceUrl?: string },
): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    throw new Error('chrome.storage.local is not available');
  }
  const current = await readCustomThemes();
  // Stamp sourceUrl onto the entry if the caller supplied one.
  //  - v0.2.104: a same-name re-install (isUpdate=true) that was
  //    originally URL-installed then later re-pasted via CSS will
  //    pass undefined for sourceUrl; we drop the previous URL in
  //    that case (the user "moved" the theme to a CSS source) so
  //    the export pipeline doesn't resurrect a URL the user
  //    considers obsolete.
  const nextEntry: CustomThemeEntry =
    options?.sourceUrl !== undefined
      ? { ...entry, sourceUrl: options.sourceUrl }
      : entry;
  current[nextEntry.light.name] = nextEntry;
  await chrome.storage.local.set({ [STORAGE_KEY]: current });
  // Keep the dark-variant cache in switcher.ts in sync — applyTheme()
  // consults this to decide whether to append `-dark` to the data-theme
  // value when the user is in dark mode.
  setHasDarkVariant(userThemeId(nextEntry.light.name, 'light'), nextEntry.dark != null);
}

/** Remove an entry by name. Returns true if it was present, false otherwise. */
export async function removeCustomTheme(name: CustomThemeName): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return false;
  const current = await readCustomThemes();
  if (!Object.prototype.hasOwnProperty.call(current, name)) return false;
  delete current[name];
  await chrome.storage.local.set({ [STORAGE_KEY]: current });
  // Clear the cache entry too — the theme is gone, hasDarkVariant
  // would otherwise still return true (stale) until next applyCustomThemes.
  setHasDarkVariant(userThemeId(name, 'light'), false);

  // v0.2.97: also evict the per-theme per-mode override bucket
  //  for this theme id, so chrome.storage.sync doesn't keep dead
  //  weight around. The `themeOverrides` map is keyed by the
  //  SAME id the dropdown uses (`user-<kebab>`), so we look up
  //  by that id. Both light and dark buckets for this theme
  //  disappear in one delete. We don't reapply the theme here
  //  — the caller (settings-panel remove handler) will trigger
  //  the theme switch / applySettingsToDOM as needed.
  const themeId = userThemeId(name, 'light');
  const all = getSetting('themeOverrides');
  if (all && typeof all === 'object' && Object.prototype.hasOwnProperty.call(all, themeId)) {
    // Clone the per-theme override map and drop the dead theme id.
    // The cast stays narrow — `next` is still typed as
    // `Settings.themeOverrides` so the spread/delete doesn't
    // widen to `Record<string, unknown>`, which the Settings
    // type would reject.
    const next: Settings['themeOverrides'] = { ...(all as NonNullable<Settings['themeOverrides']>) };
    delete next[themeId];
    void updateSettings({ themeOverrides: next });
  }

  return true;
}

// --- Naming ---

/** Build the kebab-case CSS id used for both storage and the
 *  data-theme attribute. Spec § 5: lowercase + collapse any non
 *  [a-z0-9] run to a single '-' + trim leading/trailing '-'. */
export function kebabThemeId(name: CustomThemeName): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `[name]` → `user-<kebab>`. Light and dark variants of the same
 *  theme share the base id; the dark variant adds `-dark`. */
export function userThemeId(name: CustomThemeName, variant: 'light' | 'dark' = 'light'): string {
  const base = `${USER_THEME_PREFIX}${kebabThemeId(name)}`;
  return variant === 'light' ? base : `${base}-dark`;
}

// --- CSS generation ---

/** Generate a single :root[data-theme="user-xxx"] { ... } block.
 *  Values are emitted as-is (OKLCH / hex / color-mix all pass through
 *  to the CSS engine). The outer block is the only place we interpolate
 *  user-provided data into a CSS string — and we only do that for the
 *  vars we explicitly validated above (8 required + any non-empty
 *  optional), with values that were checked to be non-empty strings.
 *  Iterating the keys of `vars` (instead of THEME_VARS) means we
 *  automatically pick up the optional ones when the source theme
 *  defined them and skip them when it didn't — no per-key branching. */
function emitBlock(id: string, vars: Record<string, string>): string {
  const lines: string[] = [`:root[data-theme="${id}"] {`];
  for (const k of THEME_VARS) {
    if (vars[k]) lines.push(`  --${k}: ${vars[k]};`);
  }
  for (const k of THEME_VARS_OPTIONAL) {
    if (vars[k]) lines.push(`  --${k}: ${vars[k]};`);
  }
  lines.push('}');
  return lines.join('\n');
}

/** Build the full <style id="custom-themes"> body from the map.
 *  Returns '' for an empty map so the node is removed (cleaner DOM). */
export function buildCustomThemesStyle(map: CustomThemesMap): string {
  const blocks: string[] = [];
  for (const name of Object.keys(map)) {
    const entry = map[name];
    if (!entry) continue;
    const lightCv = entry.light.cssVars;
    if (!lightCv) continue;
    const lightId = userThemeId(name, 'light');
    blocks.push(emitBlock(lightId, lightCv.light));
    if (entry.dark) {
      const darkCv = entry.dark.cssVars;
      if (!darkCv) continue;
      const darkId = userThemeId(name, 'dark');
      blocks.push(emitBlock(darkId, darkCv.dark ?? darkCv.light));
    }
  }
  return blocks.join('\n\n');
}

// --- DOM injection ---

/** Inject (or remove) the <style id="custom-themes"> node. Safe to
 *  call multiple times — the second call replaces the previous body.
 *  No-op outside a DOM environment (e.g. unit tests without jsdom). */
export function injectCustomThemesStyle(cssBody: string): void {
  if (typeof document === 'undefined') return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!cssBody) {
    if (style) style.remove();
    return;
  }
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    // Append to head — must be after globals.css (which is the
    // first <link> in <head>), otherwise our selectors lose the
    // specificity race. With raw textContent + last position in
    // <head> we always win over <link> stylesheets.
    document.head.appendChild(style);
  }
  style.textContent = cssBody;
}

/** Top-level entry: read storage → generate CSS → inject. Called
 *  once on newtab / options / popup startup. Also syncs the
 *  `hasDarkVariant` cache in switcher.ts with current storage
 *  so applyTheme() can do sync variant lookups. */
export async function applyCustomThemes(): Promise<void> {
  const map = await readCustomThemes();
  injectCustomThemesStyle(buildCustomThemesStyle(map));
  for (const [name, entry] of Object.entries(map)) {
    if (!entry) continue;
    setHasDarkVariant(userThemeId(name, 'light'), entry.dark != null);
  }
}

// --- Listing ---

/** Drop-in replacement for listThemes() that also surfaces custom
 *  themes. Used by the settings panel to populate the dropdown.
 *  Custom themes appear AFTER built-in themes in insertion order. */
export type ThemeListEntry = {
  value: string;
  label: string;
  isCustom: boolean;
};

export async function listAllThemes(
  builtIn: string[],
  builtInLabels: Readonly<Record<string, string>>,
): Promise<ThemeListEntry[]> {
  const map = await readCustomThemes();
  const out: ThemeListEntry[] = builtIn.map((t) => ({
    value: t,
    label: builtInLabels[t] ?? t,
    isCustom: false,
  }));
  for (const name of Object.keys(map)) {
    const entry = map[name];
    if (!entry) continue;
    // v0.2.75 + v0.2.78: dark variants are not listed as separate
    // dropdown entries. The user picks "light vs dark" via the
    // separate `darkMode` setting; resolveTheme() picks the actual
    // data-theme value at apply time. Keeping the dark entry in the
    // dropdown would (a) duplicate UX, (b) let users "select" a dark
    // theme whose base id is the same as the light one's, which
    // would crash resolveTheme() (it'd see "user-xxx-dark" as a
    // base id and look up a non-existent CSS selector).
    out.push({ value: userThemeId(name, 'light'), label: name, isCustom: true });
  }
  return out;
}
