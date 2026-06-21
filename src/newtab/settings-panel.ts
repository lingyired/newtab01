// Floating settings panel — rendered as a right-side drawer on the newtab page

import { getSettings, getSetting, updateSetting, updateSettings } from '../lib/storage/settings';
import type { Settings } from '../features/bookmarks/types';
import { applyTheme, listAllThemesWithLabels, resolveCssColor } from '../features/themes/switcher';
import {
  buildCustomThemesStyle,
  injectCustomThemesStyle,
  installCustomTheme,
  readCustomThemes,
  removeCustomTheme,
  validateThemeJson,
} from '../features/themes/custom-themes';
import { detectInputFormat, parseCssTheme } from '../features/themes/css-import';
import { detectTweakcnUrl, toTweakcnJsonUrl } from '../features/themes/url-import';
import { sendMessage } from '../lib/chrome/messages';
import { applySettingChange, applyUserColorOverride } from '../features/settings/apply';
import * as debug from '../lib/debug';
import { renderColumns } from '../features/bookmarks/board';

/** Chinese labels for the theme dropdown in this panel. Theme ids without an
 *  entry fall back to the English id — see renderAppearanceTab. */
const THEME_LABELS: Readonly<Record<string, string>> = {
  default: '默认',
  'default-dark': '默认·暗',
  'mx-brutalist': 'MX-Brutalist',
  'mx-brutalist-dark': 'MX-Brutalist Dark',
  cyberpunk: '赛博朋克',
  'cyberpunk-dark': '赛博朋克·暗',
  astrovista: 'AstroVista',
  'astrovista-dark': 'AstroVista·暗',
};

type SettingsTab = 'layout' | 'appearance' | 'custom-themes' | 'features' | 'advanced';

/** Settings that affect column rendering — require re-render after change */
const RERENDER_KEYS: ReadonlySet<keyof Settings> = new Set([
  'showRoot',
  'showTop',
  'showApps',
  'showRecent',
  'showClosed',
  'showDevices',
  'numberTop',
  'numberRecent',
  'numberClosed',
  'lockColumns',
  'columnWidth',
  'rememberOpen',
  'autoClose',
]);

let panelEl: HTMLElement | null = null;
let overlayEl: HTMLElement | null = null;
let currentTab: SettingsTab = 'layout';

/** Open the floating settings panel */
export function openSettingsPanel(): void {
  if (panelEl) {
    panelEl.remove();
    panelEl = null;
  }
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }

  // Overlay
  overlayEl = document.createElement('div');
  overlayEl.classList.add('sp-overlay');
  overlayEl.addEventListener('click', closeSettingsPanel);

  // Panel
  panelEl = document.createElement('div');
  panelEl.classList.add('sp-panel');

  // Header
  const header = document.createElement('div');
  header.classList.add('sp-header');

  const title = document.createElement('span');
  title.classList.add('sp-title');
  title.textContent = '设置';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.classList.add('sp-close-btn');
  closeBtn.setAttribute('aria-label', '关闭设置');
  closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  closeBtn.addEventListener('click', closeSettingsPanel);

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Body: nav + content
  const body = document.createElement('div');
  body.classList.add('sp-body');

  const nav = document.createElement('nav');
  nav.classList.add('sp-nav');
  renderNav(nav);

  const content = document.createElement('div');
  content.classList.add('sp-content');
  content.id = 'sp-content';
  renderContent(content);

  body.appendChild(nav);
  body.appendChild(content);

  panelEl.appendChild(header);
  panelEl.appendChild(body);

  document.body.appendChild(overlayEl);
  document.body.appendChild(panelEl);

  // Subscribe to storage.onChanged so cross-tab edits (and same-tab edits
  // from `saveThemeChange`) update the color inputs and theme dropdown
  // in place — see `refreshInputsFromSettings`. Removed on close.
  installStorageListener();

  // Trigger animation
  requestAnimationFrame(() => {
    overlayEl?.classList.add('sp-overlay--visible');
    panelEl?.classList.add('sp-panel--open');
  });
}

/** Close the floating settings panel */
export function closeSettingsPanel(): void {
  uninstallStorageListener();
  if (overlayEl) overlayEl.classList.remove('sp-overlay--visible');
  if (panelEl) panelEl.classList.remove('sp-panel--open');

  setTimeout(() => {
    overlayEl?.remove();
    panelEl?.remove();
    overlayEl = null;
    panelEl = null;
  }, 200);
}

/**
 * Settings keys whose UI controls are <input type="color">. We refresh
 * these specifically (rather than re-rendering the whole tab) because
 * re-rendering blows away the user's focus and selection — relevant
 * when the change is coming from `saveThemeChange` (the theme dropdown
 * is on the same tab) or from a cross-tab storage.onChanged event.
 */
const COLOR_INPUT_KEYS: ReadonlyArray<keyof Settings> = [
  'backgroundColor',
  'fontColor',
  'highlightColor',
  'highlightFontColor',
  'shadowColor',
];

/**
 * Push the current `currentSettings` values into the visible <input>
 * elements without rebuilding the DOM. No-op for inputs that don't
 * exist (panel closed) or whose value already matches storage.
 *
 * The `shadowColor` input is displayed using the `highlightColor`
 * value because the two share a single CSS variable (`--newtab-highlight`)
 * — the user sees what is actually being rendered.
 */
function refreshInputsFromSettings(): void {
  for (const key of COLOR_INPUT_KEYS) {
    const input = document.getElementById(`sp-${key}`) as HTMLInputElement | null;
    if (!input || input.type !== 'color') continue;
    const sourceKey: keyof Settings = key === 'shadowColor' ? 'highlightColor' : key;
    // `resolveCssColor` is a no-op for plain hex/rgb (the common case)
    // and rescues us from a stored `var()`/`color-mix()` string — which
    // <input type="color"> would otherwise reject with "does not conform
    // to the required format '#rrggbb'".
    const next = resolveCssColor(String(getSetting(sourceKey) ?? ''));
    if (input.value !== next) input.value = next;
  }
  // Theme + darkMode selects live on the same tabs as the color inputs;
  // keep them in sync. v0.2.75: both tabs (外观 + 自定义主题) carry a
  // `sp-theme` and `sp-darkMode` select with the same id; only one tab
  // is in the DOM at a time so getElementById resolves to whichever is
  // currently rendered.
  const themeSelect = document.getElementById('sp-theme') as HTMLSelectElement | null;
  if (themeSelect) {
    const next = String(getSetting('theme') ?? '');
    if (themeSelect.value !== next) themeSelect.value = next;
  }
  const darkModeSelect = document.getElementById('sp-darkMode') as HTMLSelectElement | null;
  if (darkModeSelect) {
    const next = String(getSetting('darkMode') ?? 'system');
    if (darkModeSelect.value !== next) darkModeSelect.value = next;
  }
}

// Named (not inline) so we can pass the same reference to both
// addListener and removeListener. The key prefix matches the one used
// in lib/storage/index.ts (`newtab01.`).
const STORAGE_FULL_KEY = 'newtab01.settings';
function onSettingsStorageChanged(changes: Record<string, chrome.storage.StorageChange>, areaName: string): void {
  if (areaName !== 'sync') return;
  if (!changes[STORAGE_FULL_KEY]) return;
  debug.log('settings-panel', 'storage.onChanged -> refreshInputs', {
    keysChanged: Object.keys(changes),
  });
  refreshInputsFromSettings();
}

let storageListenerInstalled = false;
function installStorageListener(): void {
  if (storageListenerInstalled) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.addListener(onSettingsStorageChanged);
  storageListenerInstalled = true;
}

function uninstallStorageListener(): void {
  if (!storageListenerInstalled) return;
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return;
  chrome.storage.onChanged.removeListener(onSettingsStorageChanged);
  storageListenerInstalled = false;
}

// --- Helpers ---

function el(tag: string, className?: string): HTMLElement {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

function renderNav(nav: HTMLElement): void {
  nav.textContent = '';

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'layout', label: '布局' },
    { id: 'appearance', label: '外观' },
    { id: 'custom-themes', label: '自定义主题' },
    { id: 'features', label: '功能' },
    { id: 'advanced', label: '高级' },
  ];

  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sp-nav-item';
    if (tab.id === currentTab) btn.classList.add('sp-nav-item--active');
    btn.textContent = tab.label;
    btn.addEventListener('click', () => setActiveTab(tab.id));
    nav.appendChild(btn);
  }
}

/** Switch to a different tab and re-render the nav + content.
 *  Used by the nav buttons AND by the "管理自定义主题 →" button in
 *  the appearance tab — extracting this keeps both call sites in
 *  sync (if we ever add scroll-restore, transition, etc.). */
function setActiveTab(tab: SettingsTab): void {
  if (currentTab === tab) return;
  currentTab = tab;
  const nav = panelEl?.querySelector('.sp-nav') as HTMLElement | null;
  if (nav) renderNav(nav);
  const content = document.getElementById('sp-content');
  if (content) renderContent(content);
}

function renderContent(container: HTMLElement): void {
  container.textContent = '';

  switch (currentTab) {
    case 'layout':
      container.appendChild(renderLayoutTab());
      break;
    case 'appearance':
      // renderAppearanceTab is async because it lists installed custom
      // themes (chrome.storage.local read) to populate the dropdown.
      // We render a placeholder synchronously, then swap the children
      // in once the async work resolves — keeps the rest of the panel
      // responsive.
      container.appendChild(renderAppearanceTabSyncPlaceholder());
      void renderAppearanceTab().then((content) => {
        // Only swap if the user hasn't navigated away in the meantime.
        if (currentTab === 'appearance' && container.firstChild) {
          container.textContent = '';
          container.appendChild(content);
        }
      });
      break;
    case 'custom-themes':
      // Same async pattern as appearance — renderCustomThemesTab reads
      // chrome.storage.local for the installed list. The placeholder
      // keeps the panel from flashing empty.
      container.appendChild(renderCustomThemesTabSyncPlaceholder());
      void renderCustomThemesTab().then((content) => {
        if (currentTab === 'custom-themes' && container.firstChild) {
          container.textContent = '';
          container.appendChild(content);
        }
      });
      break;
    case 'features':
      container.appendChild(renderFeaturesTab());
      break;
    case 'advanced':
      container.appendChild(renderAdvancedTab());
      break;
  }
}

/** Empty shell rendered immediately when the user opens the appearance
 *  tab, replaced by the real content once listAllThemesWithLabels
 *  resolves. Avoids a flash of unstyled dropdown options. */
function renderAppearanceTabSyncPlaceholder(): HTMLElement {
  return el('div', 'sp-tab-content sp-tab-content--loading');
}

// --- Setting row helpers ---

function createRow(
  label: string,
  input: HTMLElement,
  key: keyof Settings,
  description?: string | HTMLElement,
): HTMLElement {
  const row = el('div', 'sp-row');
  if (description) row.classList.add('sp-row--with-desc');

  const labelEl = el('label', 'sp-label');
  labelEl.textContent = label;
  labelEl.setAttribute('for', `sp-${key}`);

  const inputWrap = el('div', 'sp-input');

  const revertBtn = el('button', 'sp-revert') as HTMLButtonElement;
  revertBtn.type = 'button';
  revertBtn.title = '恢复默认';
  revertBtn.textContent = '↩';
  revertBtn.addEventListener('click', () => {
    const defaults = getDefaults();
    const defaultVal = defaults[key];
    if (input instanceof HTMLInputElement) {
      if (input.type === 'checkbox') {
        input.checked = Number(defaultVal) !== 0;
      } else {
        input.value = String(defaultVal);
      }
    } else if (input instanceof HTMLSelectElement) {
      input.value = String(defaultVal);
    } else if (input instanceof HTMLTextAreaElement) {
      input.value = String(defaultVal);
    }
    saveSetting(key);
  });

  inputWrap.appendChild(input);
  inputWrap.appendChild(revertBtn);

  row.appendChild(labelEl);
  row.appendChild(inputWrap);

  if (description) {
    const desc = el('p', 'sp-desc');
    if (typeof description === 'string') {
      desc.textContent = description;
    } else {
      // HTMLElement path — caller built a rich description (text + link,
      // text + icon, etc.). Used by the theme row, which embeds an inline
      // <a> that switches to the dedicated "自定义主题" tab.
      desc.appendChild(description);
    }
    row.appendChild(desc);
  }

  return row;
}

function getDefaults(): Settings {
  return {
    font: 'Sans-serif',
    fontSize: 18,
    fontWeight: 400,
    theme: 'default',
    darkMode: 'system',
    // The five palette fields are intentionally empty strings: see the
    // matching block in src/lib/storage/settings.ts. `applyUserColorOverride`
    // treats `''` as "no override" and removeProperty's the inline value;
    // a non-empty hex would force a permanent override that clobbers the
    // active theme's palette. Match storage defaults exactly so the revert
    // button (↩) clears the override instead of stamping a hex.
    fontColor: '',
    backgroundColor: '',
    backgroundImage: '',
    highlightColor: '',
    highlightFontColor: '',
    shadowColor: '',
    shadowBlur: 1,
    highlightRound: 1,
    spacing: 1,
    width: 1,
    hPos: 1,
    lock: 0,
    showTop: 1,
    showApps: 1,
    showRecent: 1,
    showClosed: 1,
    showDevices: 1,
    showRoot: 1,
    newtab: 0,
    rememberOpen: 1,
    autoClose: 0,
    autoScale: 1,
    css: '',
    numberTop: 10,
    numberClosed: 10,
    numberRecent: 10,
    lockColumns: 0,
    columnWidth: 'auto',
    align: 'left',
    debug: 0,
    folderActionConfirmThreshold: 10,
  };
}

function saveSetting(key: keyof Settings): void {
  const input = document.getElementById(`sp-${key}`);
  if (!input) return;

  let value: unknown;
  if (input instanceof HTMLInputElement) {
    if (input.type === 'checkbox') {
      value = input.checked ? 1 : 0;
    } else if (input.type === 'number') {
      value = Number(input.value);
    } else if (input.type === 'color') {
      value = input.value;
    } else {
      value = input.value;
    }
  } else if (input instanceof HTMLSelectElement) {
    value = input.value;
  } else if (input instanceof HTMLTextAreaElement) {
    value = input.value;
  }

  // Capture before/after for the debug log.
  const before = getSetting(key);

  // Theme changes are special: a single user action must atomically
  // persist the new theme id plus the five palette colors that the theme
  // just stamped onto the inline `<html>` styles. Persisting only `theme`
  // would leave the five colors in storage pointing at the previous
  // theme, so the next page load (or any other tab receiving the
  // onChanged event) would re-apply the wrong palette.
  if (key === 'theme') {
    void saveThemeChange(String(value));
    return;
  }

  // Dark mode changes are similar: the rendered variant flipped (light
  // <-> dark) but the base theme id didn't change, so the 5 color
  // overrides in storage are stale — they were captured at the old
  // variant. Update darkMode first, then re-apply the theme so saveThemeChange
  // re-reads the 5 colors from the newly-applied variant selector.
  if (key === 'darkMode') {
    void updateSetting('darkMode', value as Settings['darkMode']).then(() => {
      void saveThemeChange(String(getSetting('theme')));
    });
    return;
  }

  // shadowColor shares --newtab-highlight with highlightColor in the CSS
  // (see newtab.css `box-shadow: 0 0 var(--newtab-shadow-blur) var(--newtab-highlight)`).
  // Editing only shadowColor would leave highlightColor stale, so the
  // shared CSS variable would still render the old highlight color and
  // a subsequent applySettingsToDOM (e.g. on a different storage edit)
  // would write the old highlightColor back into --newtab-highlight.
  // Mirror the value into highlightColor in a single atomic write.
  if (key === 'shadowColor') {
    void saveShadowColorChange(String(value));
    return;
  }

  void updateSetting(key, value as Settings[keyof Settings]);
  debug.log('settings-panel', 'saveSetting', { key, before, after: getSetting(key) });

  // Re-apply this single setting to the DOM so font/theme/animation tweaks
  // take effect immediately, without waiting for chrome.storage.onChanged
  // to fire (which would still arrive later as a safety net). Settings that
  // change which columns render need a re-render in addition.
  applySettingChange(key);

  if (RERENDER_KEYS.has(key)) {
    void renderColumns();
  }
}

/**
 * Persist a shadowColor edit by mirroring it into highlightColor (the
 * CSS source for both the highlight background and the box-shadow color)
 * and re-asserting the inline `--newtab-highlight` override so the page
 * reflects the new value without waiting for the storage round-trip.
 */
async function saveShadowColorChange(value: string): Promise<void> {
  const beforeShadow = getSetting('shadowColor');
  const beforeHighlight = getSetting('highlightColor');
  await updateSettings({ shadowColor: value, highlightColor: value });
  // applyUserColorOverride('highlightColor') reads from getSetting, which
  // has just been updated by updateSettings, so it writes the new value
  // into the inline --newtab-highlight.
  applyUserColorOverride('highlightColor');
  debug.log('settings-panel', 'saveShadowColorChange', {
    from: { shadowColor: beforeShadow, highlightColor: beforeHighlight },
    to: { shadowColor: value, highlightColor: value },
  });
}

/**
 * Persist a theme switch: apply the theme's palette to the inline
 * `<html>` styles, read those values back from the DOM, and write the
 * whole `{theme, 5 colors}` bundle to chrome.storage in a single
 * `setSync` call. We read from the DOM (not from `getSetting`) because
 * `applyTheme` writes the resolved palette to inline style and those
 * values are guaranteed to be in sync by the time control returns.
 */
async function saveThemeChange(theme: string): Promise<void> {
  const before = getSetting('theme');
  applyTheme(theme);
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // Resolve the values via the browser before reading them back. After
  // `applyTheme` writes resolved hex/rgb() to inline style, this is a
  // pass-through; but if anyone in the chain ever writes a `var()` or
  // `color-mix()` expression here, this layer normalizes it to a string
  // the <input type="color"> (and chrome.storage) will accept.
  const readVar = (name: string): string =>
    resolveCssColor(root.style.getPropertyValue(name).trim());
  const bundle: Partial<Settings> = {
    theme,
    // v0.2.75: dark mode is a separate setting. Persisted together with
    // the theme + 5-color bundle so a single user action (theme switch
    // OR dark mode toggle) writes a coherent snapshot. The 5 colors are
    // captured from the actually-rendered variant (light or dark) inside
    // applyTheme()'s `resolved` selector, so they always match what the
    // user sees after the switch.
    darkMode: (String(getSetting('darkMode') ?? 'system') as 'system' | 'light' | 'dark'),
    backgroundColor: readVar('--newtab-bg'),
    fontColor: readVar('--newtab-text'),
    highlightColor: readVar('--newtab-highlight'),
    highlightFontColor: readVar('--newtab-highlight-text'),
    shadowColor: readVar('--newtab-highlight'),
  };
  await updateSettings(bundle);
  debug.log('settings-panel', 'saveThemeChange', { from: before, to: theme, bundle });
}

function createNumberInput(key: keyof Settings): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.id = `sp-${key}`;
  input.value = String(getSetting(key));
  // All scale()-driven settings accept fractional inputs (0.5, 1.5, etc.)
  // — default `step="1"` would reject those as `stepMismatch` and make the
  // browser show a validation error on commit. `step="0.1"` lets the user
  // type any one-decimal-place value; values outside [0,1,2] still work
  // because `change` fires regardless of validity and the scale() curve
  // extrapolates linearly past the ends.
  input.step = '0.1';
  input.addEventListener('change', () => saveSetting(key));
  return input;
}

function createTextInput(key: keyof Settings): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.id = `sp-${key}`;
  input.value = String(getSetting(key));
  input.addEventListener('change', () => saveSetting(key));
  return input;
}

function createCheckboxInput(key: keyof Settings): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = `sp-${key}`;
  input.checked = Number(getSetting(key)) !== 0;
  input.addEventListener('change', () => saveSetting(key));
  return input;
}

function createColorInput(key: keyof Settings): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'color';
  input.id = `sp-${key}`;
  // `shadowColor` is a legacy field that shares a CSS variable with
  // `highlightColor`; render the picker with the value that's actually
  // on screen so the user sees what the panel is editing.
  const sourceKey: keyof Settings = key === 'shadowColor' ? 'highlightColor' : key;
  // Normalize through resolveCssColor: if a user upgraded from a pre-0.2.36
  // build, their storage may still hold a `var()`/`color-mix()` string
  // written by the old saveThemeChange. <input type="color"> rejects
  // those, so resolve them at the read site.
  input.value = resolveCssColor(String(getSetting(sourceKey) ?? ''));
  input.addEventListener('change', () => saveSetting(key));
  return input;
}

function createSelectInput(key: keyof Settings, options: { value: string; label: string }[]): HTMLSelectElement {
  const select = document.createElement('select');
  select.id = `sp-${key}`;
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (String(getSetting(key)) === opt.value) {
      option.selected = true;
    }
    select.appendChild(option);
  }
  select.addEventListener('change', () => saveSetting(key));
  return select;
}

/** The three dark-mode options shown in both the appearance tab and
 *  the custom-themes tab. Same options everywhere so the user's
 *  mental model of "where to change this" is one place. */
const DARK_MODE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '亮' },
  { value: 'dark', label: '暗' },
];

/** Build a fresh <select> bound to the `darkMode` setting. Used in
 *  both tabs; no revert button because 'system' is the default
 *  (no "reset to default" semantic distinct from the current value). */
function createDarkModeSelectInput(): HTMLSelectElement {
  return createSelectInput('darkMode', [...DARK_MODE_OPTIONS]);
}

// --- Tab content renderers ---

function renderLayoutTab(): HTMLElement {
  const container = el('div', 'sp-tab-content');

  container.appendChild(createRow('行间距', createNumberInput('spacing'), 'spacing', '书签链接之间的垂直间距（行与行之间的距离）。'));
  container.appendChild(createRow('列宽', createTextInput('columnWidth'), 'columnWidth', '每列的宽度。可以填 auto（按列数等分）或具体值（如 200px、20%）。'));
  container.appendChild(createRow('对齐方式', createSelectInput('align', [
    { value: 'left', label: '左对齐' },
    { value: 'center', label: '居中' },
    { value: 'right', label: '右对齐' },
  ]), 'align', '整组列在新标签页中的水平对齐方式（需配合「列宽」使用，auto 模式下整组列填满整宽，无效果）。'));
  container.appendChild(createRow('锁定列', createCheckboxInput('lockColumns'), 'lockColumns', '开启后禁止通过拖拽改变列的位置和数量。'));
  container.appendChild(createRow('显示顶层文件夹', createCheckboxInput('showRoot'), 'showRoot', '是否在列中渲染根级文件夹节点（关闭时直接显示其子项）。'));
  container.appendChild(createRow('自动缩放', createCheckboxInput('autoScale'), 'autoScale', '开启后列宽与边距随窗口大小自动按比例缩放；关闭则使用固定像素值。'));
  container.appendChild(createRow('锁定拖拽', createCheckboxInput('lock'), 'lock', '开启后禁止通过拖拽移动或排序书签项。'));

  return container;
}

async function renderAppearanceTab(): Promise<HTMLElement> {
  const container = el('div', 'sp-tab-content');

  const allThemes = await listAllThemesWithLabels(THEME_LABELS);
  const themeOptions = allThemes.map((t) => ({ value: t.value, label: t.label }));
  // 自定义主题的导入 / 删除迁到了独立的「自定义主题」tab。这里只把
  // 跳转入口塞在主题行自己的 description 里，避免在「外观」tab 底部
  // 再堆一个独立的 section。
  container.appendChild(createRow('主题', createSelectInput('theme', themeOptions), 'theme', buildThemeRowDescription()));
  // v0.2.75: dark mode is a separate setting, independent of theme.
  // The dropdown shows each base theme once; the variant (light/dark)
  // is decided by this setting. 'system' follows the OS preference.
  container.appendChild(
    createRow(
      '暗色模式',
      createDarkModeSelectInput(),
      'darkMode',
      '决定主题使用浅色还是深色变体。选「跟随系统」会随 macOS / Windows 的外观设置自动切换。',
    ),
  );
  container.appendChild(createRow('字体', createTextInput('font'), 'font', '书签链接使用的字体名称，例如 "PingFang SC"、Inter、Arial。'));
  container.appendChild(createRow('字号', createNumberInput('fontSize'), 'fontSize', '书签链接的字号（单位：px）。'));
  container.appendChild(createRow('字重', createNumberInput('fontWeight'), 'fontWeight', '书签链接的字重，常用值：400 正常、500 中等、600 半粗、700 粗体。'));
  container.appendChild(createRow('文字颜色', createColorInput('fontColor'), 'fontColor', '书签链接在默认状态下的文字颜色。'));
  container.appendChild(createRow('背景颜色', createColorInput('backgroundColor'), 'backgroundColor', '新标签页的背景颜色（不设置背景图时生效）。'));
  container.appendChild(createRow('高亮颜色', createColorInput('highlightColor'), 'highlightColor', '鼠标悬停或当前选中书签时的背景高亮颜色。'));
  container.appendChild(createRow('高亮文字颜色', createColorInput('highlightFontColor'), 'highlightFontColor', '鼠标悬停或选中时书签文字的颜色。'));
  container.appendChild(createRow('阴影颜色', createColorInput('shadowColor'), 'shadowColor', '书签高亮时四周光晕颜色；与"高亮颜色"共享同一 CSS 变量，修改会自动同步到高亮颜色。'));
  container.appendChild(createRow('阴影模糊', createNumberInput('shadowBlur'), 'shadowBlur', '高亮光晕的模糊半径，数值越大光晕越大越柔和。'));
  container.appendChild(createRow('高亮圆角', createNumberInput('highlightRound'), 'highlightRound', '书签高亮背景的圆角大小，0 为直角，数值越大越圆。'));
  container.appendChild(createRow('宽度', createNumberInput('width'), 'width', '新标签页主体区域的整体宽度（自动缩放时为百分比，否则为像素）。'));
  container.appendChild(createRow('水平位置', createNumberInput('hPos'), 'hPos', '主体区域在窗口内的水平位置比例，0 偏左、1 居中、2 偏右。'));

  return container;
}

/** Placeholder rendered immediately when the user opens the custom-themes
 *  tab, replaced by the real content once readCustomThemes resolves.
 *  Mirrors renderAppearanceTabSyncPlaceholder — keeps the panel from
 *  flashing empty during the chrome.storage.local round-trip. */
function renderCustomThemesTabSyncPlaceholder(): HTMLElement {
  return el('div', 'sp-tab-content sp-tab-content--loading');
}

/** Render the dedicated "自定义主题" tab: import + theme/darkMode
 *  quick switch + installed list. Async because listAllThemesWithLabels
 *  and readCustomThemes both hit chrome.storage.
 *
 *  v0.2.76: import is now the FIRST section (was last). Rationale:
 *  installing a new theme is the tab's primary action — the
 *  theme/darkMode switcher is secondary (a quick way to USE the
 *  themes that have already been installed), and the installed list
 *  is for cleanup. Showing import first matches the workflow
 *  "install → use → manage" top-to-bottom. */
async function renderCustomThemesTab(): Promise<HTMLElement> {
  const container = el('div', 'sp-tab-content');

  container.appendChild(buildCustomThemeImportSection());
  container.appendChild(await buildThemeSelectorSection());
  container.appendChild(await buildCustomThemeListSection());

  return container;
}

/** Build the "选择主题" section: a theme select + a darkMode select
 *  inline above the import section, so the user can switch themes
 *  from this tab without going back to 外观. Both selects are bound
 *  to saveSetting() so they share the change flow (and the
 *  chrome.storage.onChanged cross-tab sync) with their appearance
 *  tab counterparts. The same `id="sp-theme"` / `id="sp-darkMode"`
 *  is used as in 外观 — only one tab is in the DOM at a time, so
 *  the duplicate IDs don't collide. */
async function buildThemeSelectorSection(): Promise<HTMLElement> {
  const section = el('section', 'sp-theme-selector');
  const heading = el('h3', 'sp-custom-heading');
  heading.textContent = '选择主题';
  section.appendChild(heading);

  const allThemes = await listAllThemesWithLabels(THEME_LABELS);
  const themeOptions = allThemes.map((t) => ({ value: t.value, label: t.label }));
  section.appendChild(
    createRow(
      '主题',
      createSelectInput('theme', themeOptions),
      'theme',
      '在此切换当前主题。包含内置主题和已安装的自定义主题。',
    ),
  );
  section.appendChild(
    createRow(
      '暗色模式',
      createDarkModeSelectInput(),
      'darkMode',
      '决定主题使用浅色还是深色变体。',
    ),
  );

  return section;
}

/** Rich description for the theme row: explanatory text + an inline
 *  link that jumps to the dedicated "自定义主题" tab. Returned as a
 *  <span> (inline element) so it nests correctly inside the <p
 *  class="sp-desc"> that createRow builds for sp-row--with-desc.
 *  The link uses preventDefault on the click — it's a JS-driven tab
 *  switch, not a real navigation, so the URL bar would otherwise
 *  briefly try to scroll to "#". */
function buildThemeRowDescription(): HTMLElement {
  const desc = el('span');
  desc.appendChild(
    document.createTextNode(
      '切换新标签页的整体配色主题。已安装的自定义主题会出现在内置主题之后。如需安装新主题或管理已安装的主题，',
    ),
  );
  const link = document.createElement('a');
  link.href = '#';
  link.className = 'sp-link';
  link.textContent = '管理自定义主题 →';
  link.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveTab('custom-themes');
  });
  desc.appendChild(link);
  return desc;
}

/** Dispatch by detected input format and return a ValidationResult
 *  ready for installCustomTheme. The two paths (CSS, URL) share
 *  validation downstream (8 required shadcn vars + dark variant
 *  check + duplicate-name detection), so all format-specific code
 *  lives here and the rest of the Apply handler is format-agnostic.
 *
 *  v0.2.77: dropped the `'json'` branch — direct raw JSON paste is
 *  gone in favour of URL paste (which produces a JSON object the
 *  same way). The URL path's `JSON.parse` is now reading the
 *  service worker's fetch response, not user input. */
async function runThemeValidation(
  raw: string,
  nameFromInput: string,
  existing: Awaited<ReturnType<typeof readCustomThemes>>,
): Promise<Awaited<ReturnType<typeof validateThemeJson>>> {
  if (detectInputFormat(raw) === 'url') {
    // Step 1: shape check (no network yet)
    const kind = detectTweakcnUrl(raw);
    if (!kind) {
      return {
        ok: false,
        error:
          'URL 格式不正确：tweakcn 主题 URL 应该是 https://tweakcn.com/themes/<id>',
      };
    }
    // Step 2: normalize → JSON URL, fetch via service worker
    const jsonUrl = toTweakcnJsonUrl(raw);
    const fetched = await sendMessage<{ ok: true; text: string } | { ok: false; error: string }>({
      type: 'fetchThemeJson',
      url: jsonUrl,
    });
    if (!fetched || !fetched.ok) {
      return {
        ok: false,
        error: `加载失败: ${fetched?.error ?? 'unknown'}`,
      };
    }
    // Step 3: parse the response as JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(fetched.text);
    } catch (e) {
      return {
        ok: false,
        error: `JSON 解析失败: ${(e as Error).message}`,
      };
    }
    // Step 4: user-supplied name overrides the JSON's name field,
    // matching the v0.2.74 CSS-path semantics (where the name input
    // is required) — but on the URL path the name input is optional
    // (a missing name means "use whatever the JSON says").
    if (nameFromInput && typeof parsed === 'object' && parsed !== null) {
      (parsed as { name?: string }).name = nameFromInput;
    }
    return validateThemeJson(parsed, existing);
  }
  // CSS path (unchanged from v0.2.74 / v0.2.77)
  if (!nameFromInput) {
    return { ok: false, error: '请先输入主题名称' };
  }
  const parsed = parseCssTheme(raw, nameFromInput);
  if (!parsed.ok) {
    return { ok: false, error: `CSS 解析失败: ${parsed.error}` };
  }
  return validateThemeJson(parsed.json, existing);
}

/** Build the "Import custom theme" section: textarea + name input +
 *  Apply button + progress bar + status message. Accepts two input
 *  formats (auto-detected):
 *  - URL: `https://tweakcn.com/themes/<id>` or `https://tweakcn.com/r/themes/<id>`
 *    — fetched via the service worker, normalized to the JSON URL form.
 *  - CSS: `:root` + `.dark` blocks (the format tweakcn's "Copy" button emits).
 *
 *  v0.2.77: direct raw JSON paste removed (URL paste covers the same
 *  use case end-to-end). The Apply handler adds an indeterminate
 *  progress bar + disabled-button loading UX for the URL fetch path
 *  (CSS parse is sync and doesn't need it). */
function buildCustomThemeImportSection(): HTMLElement {
  const section = el('section', 'sp-custom-import');
  const heading = el('h3', 'sp-custom-heading');
  heading.textContent = '导入自定义主题';
  section.appendChild(heading);

  const hint = el('p', 'sp-hint');
  hint.textContent =
    '把 tweakcn 主题粘贴到下方文本框（支持 URL 或 CSS），点击「应用」即可立即安装（持久保存到本地）。';
  section.appendChild(hint);

  const textarea = document.createElement('textarea');
  textarea.id = 'sp-custom-theme-json';
  textarea.rows = 8;
  textarea.spellcheck = false;
  textarea.placeholder =
    '粘贴 tweakcn 主题 URL（https://tweakcn.com/themes/...）\n' +
    '或 tweakcn 主题 CSS（:root { ... } .dark { ... } 块）';
  section.appendChild(textarea);

  // Theme name. Behavior depends on the input format:
  // - CSS path: required (CSS has no name field); the Apply handler
  //   refuses the paste if empty.
  // - URL path: optional. If the user fills it, it overrides the
  //   JSON's `name` field. If empty, the JSON's name is used.
  // Rendered unconditionally so the UI is uniform — only the Apply
  // handler decides whether to read the value.
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'sp-custom-theme-name';
  nameInput.className = 'sp-name-input';
  nameInput.placeholder = '主题名称（CSS 必填；URL 可选，未填用主题里的名字）';
  nameInput.autocomplete = 'off';
  nameInput.spellcheck = false;
  section.appendChild(nameInput);

  const actions = el('div', 'sp-actions');
  const apply = document.createElement('button');
  apply.type = 'button';
  apply.id = 'sp-custom-theme-apply';
  apply.className = 'sp-btn-primary';
  apply.textContent = '应用';
  actions.appendChild(apply);
  section.appendChild(actions);

  // Indeterminate progress bar — visible only while the URL fetch is
  // in flight (toggled by adding/removing `.sp-progress--active`).
  // The CSS path is sync and never shows this — only the URL path
  // touches it.
  const progress = el('div', 'sp-progress');
  progress.id = 'sp-custom-theme-progress';
  progress.setAttribute('aria-hidden', 'true');
  section.appendChild(progress);

  const status = el('div', 'sp-status');
  status.id = 'sp-custom-theme-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  section.appendChild(status);

  // Wire up the Apply button. We re-render the custom-themes tab after
  // every successful install so the dropdown + list stay in sync.
  apply.addEventListener('click', async () => {
    const raw = textarea.value.trim();
    if (!raw) {
      setCustomThemeStatus(status, 'error', '请先粘贴 URL 或 CSS');
      return;
    }

    // Show the indeterminate progress bar + disable the button for
    // the duration of the apply flow. CSS parse is sync, so the bar
    // flashes briefly; URL fetch is async, so it stays until the
    // response lands. Either way the user sees a clear "in flight"
    // signal and can't double-click.
    apply.disabled = true;
    progress.classList.add('sp-progress--active');
    try {
      const existing = await readCustomThemes();
      const result = await runThemeValidation(raw, nameInput.value.trim(), existing);
      if (!result.ok) {
        setCustomThemeStatus(status, 'error', result.error);
        return;
      }
      try {
        await installCustomTheme(result.entry);
      } catch (e) {
        setCustomThemeStatus(
          status,
          'error',
          `保存失败: ${(e as Error).message}（可能 local 存储已满）`,
        );
        return;
      }
      // Re-inject the <style id="custom-themes"> so the new theme is
      // available immediately without reloading the tab.
      const map = await readCustomThemes();
      injectCustomThemesStyle(buildCustomThemesStyle(map));

      // Auto-switch to the newly installed theme. The user's current
      // darkMode is preserved — saveThemeChange() reads it from storage
      // and resolveTheme() picks the variant: dark if the user is in
      // dark mode AND the new theme has a dark variant, light otherwise
      // (fallback). Re-installing the same theme is a no-op visually but
      // re-stamps the 5 color overrides to the current variant, which
      // is what we want after a darkMode toggle.
      const baseId = `user-${result.entry.light.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
      await saveThemeChange(baseId);

      // Clear inputs and refresh the tab.
      textarea.value = '';
      nameInput.value = '';
      const successMsg = result.isUpdate
        ? `✓ 已更新 "${result.entry.light.name}"`
        : `✓ 已安装 "${result.entry.light.name}"${result.entry.dark ? '（含深色变体）' : '（仅浅色）'}`;
      if (result.warning) {
        setCustomThemeStatus(status, 'warning', `${successMsg}\n⚠ ${result.warning}`);
      } else {
        setCustomThemeStatus(status, 'success', successMsg);
      }
      rerenderCurrentTab();
    } finally {
      // Re-enable the button + hide the progress bar regardless of
      // success/failure. The `return` statements above are early
      // exits, but `finally` runs before they return to the caller.
      apply.disabled = false;
      progress.classList.remove('sp-progress--active');
    }
  });

  return section;
}

/** Build the "Installed custom themes" list. One <li> per installed
 *  name with a delete button. Empty state shown when no custom
 *  themes are installed. */
async function buildCustomThemeListSection(): Promise<HTMLElement> {
  const section = el('section', 'sp-custom-list');
  const heading = el('h3', 'sp-custom-heading');
  heading.textContent = '已安装的自定义主题';
  section.appendChild(heading);

  const map = await readCustomThemes();
  const names = Object.keys(map);

  if (names.length === 0) {
    const empty = el('div', 'sp-empty');
    empty.textContent = '尚未安装自定义主题。';
    section.appendChild(empty);
    return section;
  }

  const ul = document.createElement('ul');
  ul.id = 'sp-custom-theme-list';
  for (const name of names) {
    const entry = map[name];
    if (!entry) continue;
    const li = document.createElement('li');

    const nameSpan = el('span', 'sp-custom-name');
    nameSpan.textContent = name;
    li.appendChild(nameSpan);

    const meta = el('span', 'sp-custom-meta');
    const date = new Date(entry.installedAt);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    meta.textContent = `安装于 ${dateStr} · ${entry.dark ? 'light + dark' : 'light only'}`;
    li.appendChild(meta);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'sp-custom-delete';
    del.setAttribute('aria-label', `Delete ${name}`);
    del.textContent = '删除';
    del.addEventListener('click', async () => {
      // Confirm before destructive delete. Matches the project's
      // existing `window.confirm()` pattern (CLAUDE.md mentions
      // `folderActionConfirmThreshold` gates folder bulk actions
      // through the same native dialog). Zero DOM cost, no extra
      // state — the user must explicitly OK the removal.
      if (!window.confirm(`确定要删除自定义主题 "${name}" 吗？`)) return;
      const wasCurrent =
        String(getSetting('theme')).startsWith('user-') &&
        (String(getSetting('theme')) === deriveLightId(name) ||
          String(getSetting('theme')) === deriveLightId(name) + '-dark');
      await removeCustomTheme(name);
      const fresh = await readCustomThemes();
      injectCustomThemesStyle(buildCustomThemesStyle(fresh));
      if (wasCurrent) {
        applyTheme('default');
        updateSetting('theme', 'default').catch((e) => debug.warn('settings', e));
      }
      rerenderCurrentTab();
    });
    li.appendChild(del);

    ul.appendChild(li);
  }
  section.appendChild(ul);
  return section;
}

/** Mirrors the kebab logic in custom-themes.ts. Duplicated here to
 *  avoid an async round-trip when computing the current-theme check
 *  on a click handler — the logic is a one-liner and the source is
 *  documented in the canonical kebabThemeId() above. */
function deriveLightId(name: string): string {
  return `user-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

/** Re-render the currently-active tab in place after a custom-theme
 *  install or delete, so the dropdown + list reflect the new state.
 *  Works for both appearance (theme dropdown re-sync) and
 *  custom-themes (installed list re-sync) — the user is always on
 *  the custom-themes tab when install/delete fires, but the
 *  function is named for the action, not the call site. */
function rerenderCurrentTab(): void {
  const content = document.getElementById('sp-content');
  if (!content) return;
  renderContent(content);
}

function setCustomThemeStatus(
  el: HTMLElement,
  kind: 'success' | 'warning' | 'error',
  message: string,
): void {
  el.textContent = message;
  el.classList.remove('sp-status--success', 'sp-status--warning', 'sp-status--error');
  el.classList.add(`sp-status--${kind}`);
}

function renderFeaturesTab(): HTMLElement {
  const container = el('div', 'sp-tab-content');

  container.appendChild(createRow('显示常用网站', createCheckboxInput('showTop'), 'showTop', '是否在列中渲染"常用网站"特殊文件夹（来自 Chrome topSites）。'));
  container.appendChild(createRow('常用网站数量', createNumberInput('numberTop'), 'numberTop', '限制"常用网站"中显示的条目数量。'));
  container.appendChild(createRow('显示最近访问', createCheckboxInput('showRecent'), 'showRecent', '是否在列中渲染"最近访问"特殊文件夹。'));
  container.appendChild(createRow('最近访问数量', createNumberInput('numberRecent'), 'numberRecent', '限制"最近访问"中显示的条目数量。'));
  container.appendChild(createRow('显示最近关闭', createCheckboxInput('showClosed'), 'showClosed', '是否在列中渲染"最近关闭"特殊文件夹（来自 Chrome sessions）。'));
  container.appendChild(createRow('最近关闭数量', createNumberInput('numberClosed'), 'numberClosed', '限制"最近关闭"中显示的条目数量。'));
  container.appendChild(createRow('显示其他设备', createCheckboxInput('showDevices'), 'showDevices', '是否显示来自其他已同步设备的标签页列表。'));
  container.appendChild(createRow('显示应用', createCheckboxInput('showApps'), 'showApps', '是否显示已安装的 Chrome 应用/扩展快捷入口。'));
  container.appendChild(createRow('显示根节点', createCheckboxInput('showRoot'), 'showRoot', '单文件夹列中是否保留根节点；关闭时会直接展开该文件夹的内容。'));
  container.appendChild(createRow('记住展开的文件夹', createCheckboxInput('rememberOpen'), 'rememberOpen', '下次打开新标签页时，是否自动恢复上次展开过的文件夹状态。'));
  container.appendChild(createRow('自动折叠文件夹', createCheckboxInput('autoClose'), 'autoClose', '展开某个文件夹时，是否自动折叠同级别的其他文件夹（手风琴效果）。'));
  container.appendChild(createRow('批量打开确认阈值', createNumberInput('folderActionConfirmThreshold'), 'folderActionConfirmThreshold', '「打开全部链接」「以分组方式打开链接」时，目录链接数超过该值会弹出确认框。设为 0 关闭确认（每次都直接执行）。'));
  container.appendChild(createRow('打开链接方式', createSelectInput('newtab', [
    { value: '0', label: '当前标签页' },
    { value: '1', label: '新建前台标签页' },
    { value: '2', label: '新建后台标签页' },
  ]), 'newtab', '点击书签链接时的默认打开方式。'));

  return container;
}

function renderAdvancedTab(): HTMLElement {
  const container = el('div', 'sp-tab-content');

  const cssTextarea = document.createElement('textarea');
  cssTextarea.id = 'sp-css';
  cssTextarea.className = 'sp-textarea';
  cssTextarea.value = getSetting('css');
  cssTextarea.placeholder = '/* 在此输入自定义 CSS */';
  cssTextarea.addEventListener('change', () => saveSetting('css'));
  container.appendChild(createRow('自定义 CSS', cssTextarea, 'css', '追加到新标签页末尾的自定义样式代码，可覆盖主题样式与布局细节。'));

  // Import / Export
  const actionsRow = el('div', 'sp-actions');

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.className = 'sp-btn';
  importBtn.textContent = '导入设置';
  importBtn.addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result as string) as Partial<Settings>;
          const settings = { ...getDefaults(), ...imported };
          const entries = Object.entries(settings) as [keyof Settings, unknown][];
          for (const [k, v] of entries) {
            void updateSetting(k, v as Settings[keyof Settings]);
          }
          const content = document.getElementById('sp-content');
          if (content) renderContent(content);
        } catch {
          alert('设置文件无效');
        }
      };
      reader.readAsText(file);
    });
    fileInput.click();
  });

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'sp-btn';
  exportBtn.textContent = '导出设置';
  exportBtn.addEventListener('click', () => {
    const settings = getSettings();
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'newtab01-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  actionsRow.appendChild(importBtn);
  actionsRow.appendChild(exportBtn);
  container.appendChild(actionsRow);

  // Debug section — visible in dev/test builds (MODE !== 'production'); production strips
  // the UI but keeps the runtime no-op for the storage field. Use ?debug=1 in prod for
  // one-off logs.
  if (import.meta.env.MODE !== 'production') {
    const debugRow = el('div', 'sp-actions');
    debugRow.style.flexDirection = 'column';
    debugRow.style.alignItems = 'stretch';
    debugRow.style.gap = '8px';

    const debugHint = el('p', 'sp-hint');
    debugHint.textContent =
      '启用后，详细日志会输出到浏览器开发者工具控制台。可使用下方按钮将当前设置与布局状态导出到控制台，便于复制粘贴。';
    debugHint.style.fontSize = '12px';
    debugHint.style.color = 'var(--muted-foreground, #888)';
    debugHint.style.lineHeight = '1.4';
    debugHint.style.margin = '0';
    debugRow.appendChild(debugHint);

    const debugControls = el('div', 'sp-actions');
    const dumpBtn = document.createElement('button');
    dumpBtn.type = 'button';
    dumpBtn.className = 'sp-btn';
    dumpBtn.textContent = '导出状态到控制台';
    dumpBtn.addEventListener('click', () => {
      void debug.dump();
    });

    const copyLogsBtn = document.createElement('button');
    copyLogsBtn.type = 'button';
    copyLogsBtn.className = 'sp-btn';
    copyLogsBtn.textContent = '复制状态为 JSON';
    copyLogsBtn.addEventListener('click', async () => {
      const payload = {
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        settings: getSettings(),
      };
      try {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        copyLogsBtn.textContent = '已复制！';
        setTimeout(() => {
          copyLogsBtn.textContent = '复制状态为 JSON';
        }, 1500);
      } catch {
        window.prompt('复制状态：', JSON.stringify(payload, null, 2));
      }
    });

    debugControls.appendChild(dumpBtn);
    debugControls.appendChild(copyLogsBtn);
    debugRow.appendChild(debugControls);

    container.appendChild(createRow('调试模式', createCheckboxInput('debug'), 'debug', '开启后将在控制台输出渲染、拖拽、布局等详细日志，便于排查问题。'));
    container.appendChild(debugRow);
  }

  return container;
}
