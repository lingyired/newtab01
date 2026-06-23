// v0.2.130: Theme picker — replaces the theme <select> dropdown with a
// list of theme-styled preview links. Each preview row shows the theme's
// page background as the outer container and a theme-styled link inside,
// giving the user a "what would the new tab look like if I picked this
// theme" preview before clicking.
//
// Architecture: the project's theme CSS uses `:root[data-theme="<id>"] { ... }`
// selectors that only match the html element, NOT nested DOM elements.
// To preview a theme inside a settings-panel list, we cannot just add
// `data-theme="x"` to a wrapper — the rule won't fire. Instead, we
// temporarily set `<html data-theme>` to each theme's resolved variant,
// read the computed CSS vars via getComputedStyle, then inject those
// values as INLINE CSS custom properties on a wrapper <li>. The inner
// <a> inherits them via the standard CSS cascade, so the preview renders
// identically to what the user would see after actually applying the
// theme.
//
// Performance: ~1ms per theme (sync data-theme swap + getComputedStyle
// read + restore). With 4-15 themes total, the picker builds in well
// under 20ms — well within the settings panel's open budget.
//
// Two public functions:
//   buildThemePicker(container, entries, darkMode, activeTheme, onSelect)
//     — clear the container and render a fresh preview list.
//   refreshThemePicker(container, activeTheme)
//     — toggle the active marker without rebuilding (cheap; called
//       from `refreshInputsFromSettings` on cross-tab storage sync).

import { resolveTheme } from './switcher';
import { t } from '../../lib/i18n';

export interface ThemePreviewEntry {
  /** Base theme id, no `-dark` suffix. e.g. 'default', 'mx-brutalist'. */
  value: string;
  /** Already-translated display label, e.g. 'Default' / '默认'. */
  label: string;
  isCustom: boolean;
}

/** CSS variables we copy from <html data-theme="..."> onto each preview
 *  wrapper. Picked so the preview renders the same palette as the live
 *  page would after applying the theme — see plan §"两层结构" for the
 *  outer-vs-inner mapping. */
const VARS_TO_COPY: readonly string[] = [
  '--background',
  '--foreground',
  '--primary',
  '--primary-foreground',
  '--muted',
  '--muted-foreground',
  '--border',
  '--ring',
  '--card',
  '--card-foreground',
  '--accent',
  '--accent-foreground',
  '--input',
  '--secondary',
  '--secondary-foreground',
  '--destructive',
  '--destructive-foreground',
  '--popover',
  '--popover-foreground',
  '--radius',
  '--shadow-xs',
  '--font-sans',
];

/** Container marker — settings-panel passes an element with this class
 *  when wiring the picker into a `createRow` row. We use it as a guard
 *  in `refreshInputsFromSettings` (so we don't try to .value-set a div
 *  that isn't a select). */
const PICKER_CLASS = 'sp-theme-picker';

/** Set the picker up on `container` with one <li class="sp-theme-preview-item">
 *  per entry. The caller is responsible for giving `container` an id
 *  (the settings panel uses `id="sp-theme"` to match the existing
 *  label[for=...] binding that `createRow` sets up).
 *
 *  `onSelect(themeId)` fires when the user clicks any preview — same
 *  callback signature as a `<select>`'s `change` handler, so the
 *  caller can `await saveThemeChange(themeId)` directly.
 *
 *  v0.2.132: `columns` (1 | 2) controls whether the previews are
 *  stacked single-column (default) or laid out in a 2-column grid
 *  (used when the surrounding row is vertical / label-on-top, so
 *  the picker has the full panel width to fill). */
export function buildThemePicker(
  container: HTMLElement,
  entries: readonly ThemePreviewEntry[],
  darkMode: 'system' | 'light' | 'dark',
  activeTheme: string,
  onSelect: (themeId: string) => void,
  columns: 1 | 2 = 1,
): void {
  container.textContent = '';
  container.setAttribute('role', 'listbox');
  container.setAttribute('aria-label', t('themePicker.previewAriaLabel'));
  // Defense in depth: the settings-panel row's `<label for="...">` only
  //  fires for form controls; our picker is a listbox so we explicitly
  //  set role to make the relationship discoverable to assistive tech.
  container.classList.toggle('sp-theme-picker--2col', columns === 2);
  for (const entry of entries) {
    container.appendChild(buildOnePreview(entry, darkMode, activeTheme, onSelect));
  }
}

/** Toggle the `--active` class on whichever preview matches `activeTheme`,
 *  AND re-stamp the inline CSS variables so the preview reflects the
 *  current `darkMode` (each preview shows the theme's light or dark
 *  variant; switching darkMode from the topbar must re-read the resolved
 *  theme vars from `<html>` and rewrite the inline `style="..."` on
 *  each `<li>`).
 *
 *  v0.2.134: this used to be a no-op for vars — it only toggled the
 *  active class, so toggling darkMode would leave the previews
 *  painted with the previous darkMode's palette until the user
 *  closed & re-opened the panel. Now we re-stamp on every refresh.
 *  Cost is ~1ms per theme (4-15 sync data-theme swap + getComputedStyle
 *  reads); refresh only fires on storage.onChanged and OS theme
 *  change, both rare events.
 *
 *  Called from `refreshInputsFromSettings` (settings-panel.ts) on
 *  every storage.onChanged, and from the matchMedia OS-theme
 *  listener when darkMode === 'system'. No-op if the picker isn't
 *  currently mounted. */
export function refreshThemePicker(
  container: HTMLElement | null,
  activeTheme: string,
  darkMode: 'system' | 'light' | 'dark' = 'system',
): void {
  if (!container || !container.classList.contains(PICKER_CLASS)) return;
  for (const child of Array.from(container.children) as HTMLElement[]) {
    const themeValue = child.dataset.themeValue;
    if (!themeValue) continue;
    // 1. Active marker
    child.classList.toggle('sp-theme-preview-item--active', themeValue === activeTheme);
    // 2. Re-read the resolved theme's CSS vars and stamp them onto
    //    the wrapper. This is what makes the preview follow the
    //    current darkMode live (without it, darkMode toggles from
    //    the topbar would leave the previews stale until the panel
    //    is closed and reopened).
    stampThemeVars(child, themeValue, darkMode);
  }
}

/** Read the 19 CSS variables for the resolved variant of `themeId`
 *  from `<html data-theme="...">` and stamp them as inline custom
 *  properties on `li`. Both build (one-time) and refresh (per
 *  storage / OS change) use this — the previous inlined version
 *  was only called from `buildOnePreview` and left refresh-time
 *  updates broken.
 *
 *  Implementation: temporarily swap `<html data-theme>` to the
 *  resolved variant of the target theme, read the computed vars
 *  via getComputedStyle (one layout flush for all 19 reads), then
 *  restore the original data-theme. The whole sequence is sync
 *  and ~1ms per call. */
function stampThemeVars(
  li: HTMLElement,
  themeId: string,
  darkMode: 'system' | 'light' | 'dark',
): void {
  const root = document.documentElement;
  const originalDataTheme = root.getAttribute('data-theme');
  const resolved = resolveTheme(themeId, darkMode);
  root.setAttribute('data-theme', resolved);

  const styles = getComputedStyle(root);
  const inlinePairs: string[] = [];
  for (const name of VARS_TO_COPY) {
    const v = styles.getPropertyValue(name).trim();
    if (v) inlinePairs.push(`${name}: ${v}`);
  }

  if (originalDataTheme === null) {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', originalDataTheme);
  }

  li.style.cssText = inlinePairs.join('; ');
}

function buildOnePreview(
  entry: ThemePreviewEntry,
  darkMode: 'system' | 'light' | 'dark',
  activeTheme: string,
  onSelect: (themeId: string) => void,
): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'sp-theme-preview-item';
  if (entry.value === activeTheme) {
    li.classList.add('sp-theme-preview-item--active');
  }
  li.dataset.themeValue = entry.value;
  // Custom themes get a small visual hint so the user can distinguish
  // them from built-ins at a glance — the row title gets a small
  // "user" suffix badge via an inner element below.
  li.dataset.themeCustom = entry.isCustom ? '1' : '0';

  // v0.2.134: stamp inline CSS vars via the shared helper. The same
  //  helper is called from refreshThemePicker on every storage /
  //  OS-theme change, so the build path and the refresh path stay
  //  in lockstep — if either breaks, the other surfaces it.
  stampThemeVars(li, entry.value, darkMode);

  // --- 6. Render the inner preview link ---
  //    Uses the wrapper's inline vars via CSS cascade. We render an
  //    <a> (not <button>) for two reasons:
  //    a) the existing bookmark link in the newtab uses <a>, so
  //       styling parity is the closest semantic match;
  //    b) clicking a <button> would trigger Chrome's default
  //       space-bar activation even when focus is on a sibling — <a>
  //       only activates on Enter, matching the newtab's link UX.
  const a = document.createElement('a');
  a.className = 'sp-theme-preview-link';
  a.href = '#';
  a.dataset.themeId = entry.value;
  a.setAttribute('role', 'option');
  a.setAttribute('aria-selected', String(entry.value === activeTheme));
  a.setAttribute('aria-label', entry.label);
  a.textContent = entry.label;
  a.addEventListener('click', (e) => {
    e.preventDefault();
    onSelect(entry.value);
  });
  li.appendChild(a);

  // v0.2.131: click anywhere in the row (including the padding
  //  area around the link) also switches the theme — not just the
  //  link itself. The handler is gated on `e.target === li` so it
  //  does NOT fire when the click lands on the inner <a> (that path
  //  is already handled by the <a>'s own listener above, and we
  //  don't want to double-fire). The padding around the link is the
  //  <li>'s own padding, not a child element, so clicks on it bubble
  //  up with `e.target === li` — this single check is enough.
  li.addEventListener('click', (e) => {
    if (e.target === li) {
      e.preventDefault();
      onSelect(entry.value);
    }
  });

  return li;
}