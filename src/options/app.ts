// Options page application entry
import { getSync, setSync } from '../lib/storage';
import { defaultSettings, themeList, type AppSettings } from '../lib/settings';

type OptionsTab = 'layout' | 'appearance' | 'features' | 'advanced';

let currentTab: OptionsTab = 'layout';
let settings: AppSettings = { ...defaultSettings };

function el(tag: string, className?: string): HTMLElement {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

// --- Setting row helpers ---

function createSettingRow(label: string, input: HTMLElement, key: keyof AppSettings): HTMLElement {
  const row = el('div', 'opt-row');

  const labelEl = el('label', 'opt-label');
  labelEl.textContent = label;
  labelEl.setAttribute('for', `opt-${key}`);

  const inputWrap = el('div', 'opt-input');

  const revertBtn = el('button', 'opt-revert') as HTMLButtonElement;
  revertBtn.type = 'button';
  revertBtn.title = 'Revert to default';
  revertBtn.textContent = '↩';
  revertBtn.addEventListener('click', () => {
    const defaultVal = defaultSettings[key];
    if (input instanceof HTMLInputElement) {
      if (input.type === 'checkbox') {
        input.checked = defaultVal as boolean;
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

  return row;
}

function saveSetting(key: keyof AppSettings): void {
  const input = document.getElementById(`opt-${key}`);
  if (!input) return;

  let value: unknown;
  if (input instanceof HTMLInputElement) {
    if (input.type === 'checkbox') {
      value = input.checked;
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

  settings = { ...settings, [key]: value };
  void setSync(key, value);

  // Apply theme change immediately
  if (key === 'theme') {
    applyTheme(value as string);
  }
}

function applyTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
}

function createNumberInput(key: keyof AppSettings): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.id = `opt-${key}`;
  input.value = String(settings[key]);
  input.addEventListener('change', () => saveSetting(key));
  return input;
}

function createTextInput(key: keyof AppSettings): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.id = `opt-${key}`;
  input.value = String(settings[key]);
  input.addEventListener('change', () => saveSetting(key));
  return input;
}

function createCheckboxInput(key: keyof AppSettings): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = `opt-${key}`;
  input.checked = settings[key] as boolean;
  input.addEventListener('change', () => saveSetting(key));
  return input;
}

function createColorInput(key: keyof AppSettings): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'color';
  input.id = `opt-${key}`;
  input.value = String(settings[key]);
  input.addEventListener('change', () => saveSetting(key));
  return input;
}

function createSelectInput(key: keyof AppSettings, options: { value: string; label: string }[]): HTMLSelectElement {
  const select = document.createElement('select');
  select.id = `opt-${key}`;
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (String(settings[key]) === opt.value) {
      option.selected = true;
    }
    select.appendChild(option);
  }
  select.addEventListener('change', () => saveSetting(key));
  return select;
}

// --- Tab content renderers ---

function renderLayoutTab(): HTMLElement {
  const container = el('div', 'opt-tab-content');

  container.appendChild(createSettingRow('Spacing', createNumberInput('spacing'), 'spacing'));
  container.appendChild(createSettingRow('Vertical Margin', createNumberInput('vMargin'), 'vMargin'));
  container.appendChild(createSettingRow('Column Width', createTextInput('columnWidth'), 'columnWidth'));
  container.appendChild(createSettingRow('Alignment', createSelectInput('align', [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
  ]), 'align'));
  container.appendChild(createSettingRow('Lock Columns', createCheckboxInput('lockColumns'), 'lockColumns'));
  container.appendChild(createSettingRow('Show Top Level', createCheckboxInput('showTopLevel'), 'showTopLevel'));
  container.appendChild(createSettingRow('Auto Scale', createCheckboxInput('autoScale'), 'autoScale'));

  return container;
}

function renderAppearanceTab(): HTMLElement {
  const container = el('div', 'opt-tab-content');

  const themeOptions = themeList.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));
  container.appendChild(createSettingRow('Theme', createSelectInput('theme', themeOptions), 'theme'));
  container.appendChild(createSettingRow('Font', createTextInput('font'), 'font'));
  container.appendChild(createSettingRow('Text Color', createColorInput('textColor'), 'textColor'));
  container.appendChild(createSettingRow('Background Color', createColorInput('backgroundColor'), 'backgroundColor'));

  // Background image - file input
  const bgInput = document.createElement('input');
  bgInput.type = 'file';
  bgInput.id = 'opt-backgroundImage';
  bgInput.accept = 'image/*';
  bgInput.addEventListener('change', () => {
    const file = bgInput.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        settings = { ...settings, backgroundImage: dataUrl };
        void setSync('backgroundImage', dataUrl);
      };
      reader.readAsDataURL(file);
    }
  });
  container.appendChild(createSettingRow('Background Image', bgInput, 'backgroundImage'));

  container.appendChild(createSettingRow('Highlight Color', createColorInput('highlightColor'), 'highlightColor'));
  container.appendChild(createSettingRow('Highlight Text Color', createColorInput('highlightTextColor'), 'highlightTextColor'));
  container.appendChild(createSettingRow('Shadow Blur', createNumberInput('shadowBlur'), 'shadowBlur'));
  container.appendChild(createSettingRow('Highlight Round', createNumberInput('highlightRound'), 'highlightRound'));
  container.appendChild(createSettingRow('Fade Duration (ms)', createNumberInput('fadeMs'), 'fadeMs'));
  container.appendChild(createSettingRow('Slide Duration (ms)', createNumberInput('slideMs'), 'slideMs'));

  return container;
}

function renderFeaturesTab(): HTMLElement {
  const container = el('div', 'opt-tab-content');

  container.appendChild(createSettingRow('Hide Options Button', createCheckboxInput('hideOptions'), 'hideOptions'));
  container.appendChild(createSettingRow('Number of Top Sites', createNumberInput('numberTop'), 'numberTop'));
  container.appendChild(createSettingRow('Number of Recent', createNumberInput('numberRecent'), 'numberRecent'));
  container.appendChild(createSettingRow('Show Other Devices', createCheckboxInput('showOtherDevices'), 'showOtherDevices'));
  container.appendChild(createSettingRow('Show Search Bar', createCheckboxInput('showSearchBar'), 'showSearchBar'));
  container.appendChild(createSettingRow('Open in New Tab', createSelectInput('openInNewTab', [
    { value: 'same', label: 'Same Tab' },
    { value: 'foreground', label: 'New Foreground Tab' },
    { value: 'background', label: 'New Background Tab' },
  ]), 'openInNewTab'));

  return container;
}

function renderAdvancedTab(): HTMLElement {
  const container = el('div', 'opt-tab-content');

  // Custom CSS textarea
  const cssTextarea = document.createElement('textarea');
  cssTextarea.id = 'opt-customCSS';
  cssTextarea.className = 'opt-textarea';
  cssTextarea.value = settings.customCSS;
  cssTextarea.placeholder = '/* Your custom CSS here */';
  cssTextarea.addEventListener('change', () => saveSetting('customCSS'));
  container.appendChild(createSettingRow('Custom CSS', cssTextarea, 'customCSS'));

  // Import / Export
  const actionsRow = el('div', 'opt-actions');

  const importBtn = document.createElement('button');
  importBtn.type = 'button';
  importBtn.className = 'opt-btn';
  importBtn.textContent = 'Import Settings';
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
          const imported = JSON.parse(reader.result as string) as Partial<AppSettings>;
          settings = { ...defaultSettings, ...imported };
          // Save all settings
          const entries = Object.entries(settings) as [keyof AppSettings, unknown][];
          for (const [k, v] of entries) {
            void setSync(k, v);
          }
          applyTheme(settings.theme);
          renderContent();
        } catch {
          alert('Invalid settings file');
        }
      };
      reader.readAsText(file);
    });
    fileInput.click();
  });

  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'opt-btn';
  exportBtn.textContent = 'Export Settings';
  exportBtn.addEventListener('click', () => {
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

  return container;
}

// --- Main render ---

const contentContainer = document.getElementById('content');

function renderContent(): void {
  if (!contentContainer) return;
  contentContainer.textContent = '';

  switch (currentTab) {
    case 'layout':
      contentContainer.appendChild(renderLayoutTab());
      break;
    case 'appearance':
      contentContainer.appendChild(renderAppearanceTab());
      break;
    case 'features':
      contentContainer.appendChild(renderFeaturesTab());
      break;
    case 'advanced':
      contentContainer.appendChild(renderAdvancedTab());
      break;
  }
}

function renderNav(): void {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.textContent = '';

  const tabs: { id: OptionsTab; label: string }[] = [
    { id: 'layout', label: 'Layout' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'features', label: 'Features' },
    { id: 'advanced', label: 'Advanced' },
  ];

  for (const tab of tabs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'opt-nav-item';
    if (tab.id === currentTab) btn.classList.add('opt-nav-item--active');
    btn.textContent = tab.label;
    btn.addEventListener('click', () => {
      currentTab = tab.id;
      renderNav();
      renderContent();
    });
    nav.appendChild(btn);
  }
}

async function loadSettings(): Promise<AppSettings> {
  const result = { ...defaultSettings } as Record<string, unknown>;
  const keys = Object.keys(defaultSettings) as (keyof AppSettings)[];
  for (const key of keys) {
    const val = await getSync<unknown>(key);
    if (val !== undefined) {
      result[key] = val;
    }
  }
  return result as unknown as AppSettings;
}

async function init(): Promise<void> {
  settings = await loadSettings();
  applyTheme(settings.theme);
  renderNav();
  renderContent();
}

init();
