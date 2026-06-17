// Options page application entry
// Uses the unified settings store (src/lib/storage/settings.ts) — getSettings +
// updateSetting. All chrome.storage.sync writes go through the canonical
// `settings` object; per-key writes are no longer used.

import { getSettings, getSetting, updateSetting } from '../lib/storage/settings';
import type { Settings } from '../features/bookmarks/types';
import { applyTheme, listThemes } from '../features/themes/switcher';
import { buildAIPrompt } from './ai-prompt';

type OptionsTab = 'layout' | 'appearance' | 'features' | 'advanced';

let currentTab: OptionsTab = 'layout';

function el(tag: string, className?: string): HTMLElement {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

// --- Setting row helpers ---

function createSettingRow(label: string, input: HTMLElement, key: keyof Settings): HTMLElement {
  const row = el('div', 'opt-row');

  const labelEl = el('label', 'opt-label');
  labelEl.textContent = label;
  labelEl.setAttribute('for', `opt-${String(key)}`);

  const inputWrap = el('div', 'opt-input');

  const revertBtn = el('button', 'opt-revert') as HTMLButtonElement;
  revertBtn.type = 'button';
  revertBtn.title = 'Revert to default';
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

  return row;
}

function saveSetting(key: keyof Settings): void {
  const input = document.getElementById(`opt-${String(key)}`);
  if (!input) return;

  let value: Settings[keyof Settings];
  if (input instanceof HTMLInputElement) {
    if (input.type === 'checkbox') {
      value = (input.checked ? 1 : 0) as Settings[keyof Settings];
    } else if (input.type === 'number') {
      value = Number(input.value) as Settings[keyof Settings];
    } else if (input.type === 'color') {
      value = input.value as Settings[keyof Settings];
    } else {
      value = input.value as Settings[keyof Settings];
    }
  } else if (input instanceof HTMLSelectElement) {
    value = input.value as Settings[keyof Settings];
  } else if (input instanceof HTMLTextAreaElement) {
    value = input.value as Settings[keyof Settings];
  } else {
    return;
  }

  void updateSetting(key, value);

  if (key === 'theme' && typeof value === 'string') {
    applyTheme(value);
  }
}

function createNumberInput(key: keyof Settings): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.id = `opt-${String(key)}`;
  input.value = String(getSetting(key));
  input.addEventListener('change', () => saveSetting(key));
  return input;
}

function createTextInput(key: keyof Settings): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.id = `opt-${String(key)}`;
  input.value = String(getSetting(key));
  input.addEventListener('change', () => saveSetting(key));
  return input;
}

function createCheckboxInput(key: keyof Settings): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = `opt-${String(key)}`;
  input.checked = Number(getSetting(key)) !== 0;
  input.addEventListener('change', () => saveSetting(key));
  return input;
}

function createColorInput(key: keyof Settings): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'color';
  input.id = `opt-${String(key)}`;
  input.value = String(getSetting(key));
  input.addEventListener('change', () => saveSetting(key));
  return input;
}

function createSelectInput(key: keyof Settings, options: { value: string; label: string }[]): HTMLSelectElement {
  const select = document.createElement('select');
  select.id = `opt-${String(key)}`;
  const current = String(getSetting(key));
  for (const opt of options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    if (current === opt.value) {
      option.selected = true;
    }
    select.appendChild(option);
  }
  select.addEventListener('change', () => saveSetting(key));
  return select;
}

// --- Defaults (mirror of canonical Settings defaults) ---

function getDefaults(): Settings {
  return {
    font: 'Sans-serif',
    fontSize: 18,
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
  container.appendChild(createSettingRow('Show Top Level', createCheckboxInput('showTop'), 'showTop'));
  container.appendChild(createSettingRow('Auto Scale', createCheckboxInput('autoScale'), 'autoScale'));

  return container;
}

function renderAppearanceTab(): HTMLElement {
  const container = el('div', 'opt-tab-content');

  const themeOptions = listThemes().map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));
  container.appendChild(createSettingRow('Theme', createSelectInput('theme', themeOptions), 'theme'));
  container.appendChild(createSettingRow('Font', createTextInput('font'), 'font'));
  container.appendChild(createSettingRow('Text Color', createColorInput('fontColor'), 'fontColor'));
  container.appendChild(createSettingRow('Background Color', createColorInput('backgroundColor'), 'backgroundColor'));

  // Background image - file input
  const bgInput = document.createElement('input');
  bgInput.type = 'file';
  bgInput.id = 'opt-backgroundImage';
  bgInput.accept = 'image/*';
  bgInput.addEventListener('change', () => {
    const file = bgInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      if (dataUrl) {
        void updateSetting('backgroundImage', dataUrl);
      }
    };
    reader.readAsDataURL(file);
  });
  container.appendChild(createSettingRow('Background Image', bgInput, 'backgroundImage'));

  container.appendChild(createSettingRow('Highlight Color', createColorInput('highlightColor'), 'highlightColor'));
  container.appendChild(createSettingRow('Highlight Text Color', createColorInput('highlightFontColor'), 'highlightFontColor'));
  container.appendChild(createSettingRow('Shadow Blur', createNumberInput('shadowBlur'), 'shadowBlur'));
  container.appendChild(createSettingRow('Highlight Round', createNumberInput('highlightRound'), 'highlightRound'));
  container.appendChild(createSettingRow('Fade (scale 0–2)', createNumberInput('fade'), 'fade'));
  container.appendChild(createSettingRow('Slide (scale 0–2)', createNumberInput('slide'), 'slide'));

  return container;
}

function renderFeaturesTab(): HTMLElement {
  const container = el('div', 'opt-tab-content');

  container.appendChild(createSettingRow('Hide Options Button', createCheckboxInput('hideOptions'), 'hideOptions'));
  container.appendChild(createSettingRow('Number of Top Sites', createNumberInput('numberTop'), 'numberTop'));
  container.appendChild(createSettingRow('Number of Recent', createNumberInput('numberRecent'), 'numberRecent'));
  container.appendChild(createSettingRow('Show Other Devices', createCheckboxInput('showDevices'), 'showDevices'));
  container.appendChild(createSettingRow('Show Search Bar', createCheckboxInput('showSearch'), 'showSearch'));
  container.appendChild(createSettingRow('Open in New Tab', createSelectInput('newtab', [
    { value: '0', label: 'Same Tab' },
    { value: '1', label: 'New Foreground Tab' },
    { value: '2', label: 'New Background Tab' },
  ]), 'newtab'));

  return container;
}

function renderAdvancedTab(): HTMLElement {
  const container = el('div', 'opt-tab-content');

  // Generate-with-AI section: button + prompt modal
  const aiRow = el('div', 'opt-actions');
  const aiBtn = document.createElement('button');
  aiBtn.type = 'button';
  aiBtn.className = 'opt-btn';
  aiBtn.textContent = 'Generate with AI';
  aiBtn.title = 'Copy a prompt to use with an AI assistant for generating custom CSS';
  aiBtn.addEventListener('click', () => {
    openAIPromptModal();
  });
  aiRow.appendChild(aiBtn);
  container.appendChild(aiRow);

  // Custom CSS textarea
  const cssTextarea = document.createElement('textarea');
  cssTextarea.id = 'opt-css';
  cssTextarea.className = 'opt-textarea';
  cssTextarea.value = String(getSetting('css'));
  cssTextarea.placeholder = '/* Your custom CSS here */';
  cssTextarea.addEventListener('change', () => saveSetting('css'));
  container.appendChild(createSettingRow('Custom CSS', cssTextarea, 'css'));

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
          const imported = JSON.parse(String(reader.result ?? '{}')) as Partial<Settings>;
          const defaults = getDefaults();
          const entries = Object.entries({ ...defaults, ...imported }) as [keyof Settings, Settings[keyof Settings]][];
          for (const [k, v] of entries) {
            void updateSetting(k, v);
          }
          applyTheme(String(getSetting('theme')));
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
    const blob = new Blob([JSON.stringify(getSettings(), null, 2)], { type: 'application/json' });
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


/** Open a modal showing the AI prompt with a copy-to-clipboard action. */
function openAIPromptModal(): void {
  const prompt = buildAIPrompt();

  const overlay = el('div', 'ai-modal-overlay');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'ai-modal-title');

  const modal = el('div', 'ai-modal');

  const title = el('h2', 'ai-modal-title');
  title.id = 'ai-modal-title';
  title.textContent = 'Generate Custom CSS with AI';
  modal.appendChild(title);

  const hint = el('p', 'ai-modal-hint');
  hint.textContent = 'Copy the prompt below, paste it into any AI assistant, then paste the generated CSS back into the Custom CSS field.';
  modal.appendChild(hint);

  const textarea = document.createElement('textarea');
  textarea.className = 'ai-modal-textarea';
  textarea.value = prompt;
  textarea.readOnly = true;
  textarea.setAttribute('spellcheck', 'false');
  modal.appendChild(textarea);

  const actions = el('div', 'ai-modal-actions');

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'ai-modal-btn ai-modal-btn--primary';
  copyBtn.textContent = 'Copy to Clipboard';
  copyBtn.addEventListener('click', async () => {
    const ok = await copyToClipboard(prompt);
    copyBtn.textContent = ok ? 'Copied!' : 'Copy failed — opening prompt';
    if (ok) {
      window.setTimeout(() => {
        copyBtn.textContent = 'Copy to Clipboard';
      }, 1500);
    }
  });
  actions.appendChild(copyBtn);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ai-modal-btn';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => {
    closeModal();
  });
  actions.appendChild(closeBtn);

  modal.appendChild(actions);
  overlay.appendChild(modal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeModal();
    }
  });

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      closeModal();
    }
  }
  document.addEventListener('keydown', onKey);

  function closeModal(): void {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  }

  document.body.appendChild(overlay);
  textarea.focus();
  textarea.select();
}

/** Copy text to clipboard, falling back to a window.prompt dialog on failure. */
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy fallback
    }
  }
  // Legacy fallback for environments without a working Clipboard API
  // (e.g. insecure contexts). The user can still copy manually.
  window.prompt('Copy the prompt below', text);
  return false;
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

async function init(): Promise<void> {
  applyTheme(String(getSetting('theme')));
  renderNav();
  renderContent();
}

void init();
