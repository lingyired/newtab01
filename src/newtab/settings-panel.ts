// Floating settings panel — rendered as a right-side drawer on the newtab page

import { getSettings, getSetting, updateSetting, updateSettings } from '../lib/storage/settings';
import type { Settings } from '../features/bookmarks/types';
import { applyTheme, listThemes } from '../features/themes/switcher';
import { applySettingChange, applyUserColorOverride } from '../features/settings/apply';
import * as debug from '../lib/debug';
import { renderColumns } from '../features/bookmarks/board';

/** Chinese labels for the theme dropdown in this panel. Theme ids without an
 *  entry fall back to the English id — see renderAppearanceTab. */
const THEME_LABELS: Readonly<Record<string, string>> = {
  default: '默认',
  slate: '石板灰',
  rose: '玫瑰红',
  dark: '暗色',
  midnight: '午夜',
  mocha: '摩卡',
  'mx-brutalist': 'MX 暴力',
  blue: '海蓝',
  green: '森林',
  purple: '紫罗兰',
  orange: '暖橙',
};

type SettingsTab = 'layout' | 'appearance' | 'features' | 'advanced';

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
  'align',
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
    const next = String(getSetting(sourceKey) ?? '');
    if (input.value !== next) input.value = next;
  }
  // Theme select lives on the same tab as the color inputs; keep it in sync.
  const themeSelect = document.getElementById('sp-theme') as HTMLSelectElement | null;
  if (themeSelect) {
    const next = String(getSetting('theme') ?? '');
    if (themeSelect.value !== next) themeSelect.value = next;
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
    { id: 'features', label: '功能' },
    { id: 'advanced', label: '高级' },
  ];

  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sp-nav-item';
    if (tab.id === currentTab) btn.classList.add('sp-nav-item--active');
    btn.textContent = tab.label;
    btn.addEventListener('click', () => {
      currentTab = tab.id;
      renderNav(nav);
      const content = document.getElementById('sp-content');
      if (content) renderContent(content);
    });
    nav.appendChild(btn);
  }
}

function renderContent(container: HTMLElement): void {
  container.textContent = '';

  switch (currentTab) {
    case 'layout':
      container.appendChild(renderLayoutTab());
      break;
    case 'appearance':
      container.appendChild(renderAppearanceTab());
      break;
    case 'features':
      container.appendChild(renderFeaturesTab());
      break;
    case 'advanced':
      container.appendChild(renderAdvancedTab());
      break;
  }
}

// --- Setting row helpers ---

function createRow(label: string, input: HTMLElement, key: keyof Settings, description?: string): HTMLElement {
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
    desc.textContent = description;
    row.appendChild(desc);
  }

  return row;
}

function getDefaults(): Settings {
  // Re-import defaults from settings module
  return {
    font: 'Sans-serif',
    fontSize: 16,
    fontWeight: 400,
    theme: 'default',
    fontColor: '#555555',
    backgroundColor: '#ffffff',
    backgroundImage: '',
    highlightColor: '#e4f4ff',
    highlightFontColor: '#000000',
    shadowColor: '#57b0ff',
    shadowBlur: 1,
    highlightRound: 1,
    fade: 1,
    spacing: 1,
    width: 1,
    hPos: 1,
    vMargin: 1,
    slide: 1,
    hideOptions: 0,
    lock: 0,
    showTop: 1,
    showApps: 1,
    showRecent: 1,
    showClosed: 1,
    showDevices: 1,
    showRoot: 1,
    showSearch: 1,
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
  const readVar = (name: string): string => root.style.getPropertyValue(name).trim();
  const bundle: Partial<Settings> = {
    theme,
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
  input.value = String(getSetting(key));
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

// --- Tab content renderers ---

function renderLayoutTab(): HTMLElement {
  const container = el('div', 'sp-tab-content');

  container.appendChild(createRow('行间距', createNumberInput('spacing'), 'spacing', '控制书签链接之间的垂直行高，数值越大行距越宽。'));
  container.appendChild(createRow('垂直边距', createNumberInput('vMargin'), 'vMargin', '新标签页主体距离顶部的空白边距。'));
  container.appendChild(createRow('列宽', createTextInput('columnWidth'), 'columnWidth', '每列的宽度。可以填 auto（按列数等分）或具体值（如 200px、20%）。'));
  container.appendChild(createRow('对齐方式', createSelectInput('align', [
    { value: 'left', label: '左对齐' },
    { value: 'center', label: '居中' },
    { value: 'right', label: '右对齐' },
  ]), 'align', '整组列在新标签页中的水平对齐方式。'));
  container.appendChild(createRow('锁定列', createCheckboxInput('lockColumns'), 'lockColumns', '开启后禁止通过拖拽改变列的位置和数量。'));
  container.appendChild(createRow('显示顶层文件夹', createCheckboxInput('showTop'), 'showTop', '是否在列中渲染根级文件夹节点（关闭时直接显示其子项）。'));
  container.appendChild(createRow('自动缩放', createCheckboxInput('autoScale'), 'autoScale', '开启后列宽与边距随窗口大小自动按比例缩放；关闭则使用固定像素值。'));
  container.appendChild(createRow('锁定拖拽', createCheckboxInput('lock'), 'lock', '开启后禁止通过拖拽移动或排序书签项。'));

  return container;
}

function renderAppearanceTab(): HTMLElement {
  const container = el('div', 'sp-tab-content');

  const themeOptions = listThemes().map((t) => ({ value: t, label: THEME_LABELS[t] ?? t }));
  container.appendChild(createRow('主题', createSelectInput('theme', themeOptions), 'theme', '切换新标签页的整体配色主题。'));
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
  container.appendChild(createRow('淡入淡出时长', createNumberInput('fade'), 'fade', '鼠标悬停时颜色变化的过渡时长（毫秒）。'));
  container.appendChild(createRow('滑动时长', createNumberInput('slide'), 'slide', '展开或折叠文件夹时的动画时长（毫秒）。'));
  container.appendChild(createRow('宽度', createNumberInput('width'), 'width', '新标签页主体区域的整体宽度（自动缩放时为百分比，否则为像素）。'));
  container.appendChild(createRow('水平位置', createNumberInput('hPos'), 'hPos', '主体区域在窗口内的水平位置比例，0 偏左、1 居中、2 偏右。'));

  return container;
}

function renderFeaturesTab(): HTMLElement {
  const container = el('div', 'sp-tab-content');

  container.appendChild(createRow('隐藏设置按钮', createCheckboxInput('hideOptions'), 'hideOptions', '隐藏新标签页右上角的齿轮按钮；仍可通过 ⌘K 唤起搜索并打开设置。'));
  container.appendChild(createRow('显示搜索栏', createCheckboxInput('showSearch'), 'showSearch', '关闭后顶栏的搜索框会隐藏，但 ⌘K 快捷键仍然可用。'));
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
