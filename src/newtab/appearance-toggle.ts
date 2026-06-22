// Topbar 3-state appearance toggle (亮 / 跟随系统 / 暗).
// Synced bidirectionally with Settings.darkMode via chrome.storage.onChanged.
// The 3 segments write to the same setting the settings panel's
// 暗色模式 select reads from — no new settings, no new storage keys.
// CLAUDE.md §6 "dark variant 与 darkMode 设置解耦" — resolveTheme() is
// the single source for "which data-theme value gets written to <html>".

import { getSetting, updateSetting } from '../lib/storage/settings';
import { applyTheme } from '../features/themes/switcher';
import { t } from '../lib/i18n';

type DarkMode = 'system' | 'light' | 'dark';

interface Option {
  value: DarkMode;
  titleKey: 'appearanceToggle.light' | 'appearanceToggle.system' | 'appearanceToggle.dark';
  icon: string;
}

// Lucide icons. ISC-licensed, same as the v0.2.85 settings gear.
// stroke=currentColor picks up the theme's --newtab-text, so the
// toggle inverts correctly between light and dark themes.
const ICONS = {
  sun: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  zap: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  moon: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
} as const;

const OPTIONS: ReadonlyArray<Option> = [
  { value: 'light', titleKey: 'appearanceToggle.light', icon: ICONS.sun },
  { value: 'system', titleKey: 'appearanceToggle.system', icon: ICONS.zap },
  { value: 'dark', titleKey: 'appearanceToggle.dark', icon: ICONS.moon },
];

// chrome.storage.sync key for the settings blob — see settings.ts.
// Doubles as the key chrome.storage.onChanged reports under; we
// filter the event by both this key and the `darkMode` field to
// avoid reacting to irrelevant setting changes (theme, columns, etc.).
const STORAGE_FULL_KEY = 'newtab01.settings';

let toggleEl: HTMLDivElement | null = null;
let buttonEls: HTMLButtonElement[] = [];
let storageListenerInstalled = false;

function updateSelection(): void {
  if (!toggleEl) return;
  const current = String(getSetting('darkMode') ?? 'system') as DarkMode;
  for (const btn of buttonEls) {
    const isSelected = btn.dataset.value === current;
    btn.setAttribute('aria-checked', String(isSelected));
  }
}

/** v0.2.118: refresh the toggle's tooltip strings (`title` +
 *  `aria-label` on each button + the radiogroup's `aria-label`)
 *  for the active locale. Called from `applyLocaleToDom`
 *  (newtab/main.ts) on `setLocale()`. The CSS-only `::after`
 *  tooltips elsewhere pick up the active theme's --muted color
 *  automatically, so re-painting the title attribute is enough —
 *  no DOM rebuild. */
export function updateAppearanceToggleStrings(): void {
  if (toggleEl) {
    toggleEl.setAttribute('aria-label', t('appearanceToggle.groupAriaLabel'));
  }
  for (const btn of buttonEls) {
    const value = btn.dataset.value as DarkMode | undefined;
    if (!value) continue;
    const opt = OPTIONS.find((o) => o.value === value);
    if (!opt) continue;
    const label = t(opt.titleKey);
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }
}

function handleClick(value: DarkMode): void {
  if (String(getSetting('darkMode')) === value) return;
  void updateSetting('darkMode', value).then(() => {
    // Re-resolve data-theme: resolveTheme() in switcher.ts reads
    // darkMode + hasDarkVariant cache, writes <html data-theme>.
    // No-op if the resolved data-theme didn't change (e.g. user
    // re-selected system while OS already dark).
    void applyTheme(String(getSetting('theme')));
  });
}

function onSettingsStorageChanged(
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
): void {
  if (areaName !== 'sync') return;
  const change = changes[STORAGE_FULL_KEY];
  if (!change) return;
  const oldDm = (change.oldValue as { darkMode?: DarkMode } | undefined)?.darkMode;
  const newDm = (change.newValue as { darkMode?: DarkMode } | undefined)?.darkMode;
  if (oldDm === newDm) return;
  updateSelection();
}

function installStorageListener(): void {
  if (storageListenerInstalled) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener(onSettingsStorageChanged);
  storageListenerInstalled = true;
}

/** Build the 3-segment appearance toggle. The returned element
 *  should be appended to the topbar BEFORE the settings button
 *  (so absolute positioning at right: 80px sits left of the
 *  settings button at right: 2%). */
export function createAppearanceToggle(): HTMLDivElement {
  toggleEl = document.createElement('div');
  toggleEl.classList.add('sp-appearance-toggle');
  toggleEl.setAttribute('role', 'radiogroup');
  toggleEl.setAttribute('aria-label', t('appearanceToggle.groupAriaLabel'));

  for (const opt of OPTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.classList.add('sp-appearance-toggle-btn');
    btn.dataset.value = opt.value;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    const label = t(opt.titleKey);
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = opt.icon;
    btn.addEventListener('click', () => handleClick(opt.value));
    toggleEl.appendChild(btn);
    buttonEls.push(btn);
  }

  updateSelection();
  installStorageListener();

  return toggleEl;
}
