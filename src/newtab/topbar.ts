// Topbar — centered search box + undo button + settings button.
// Also creates the static results container (positioned absolute below the
// input) and the overlay backdrop (covers the page below the topbar).

import { setInputElement } from '../features/search/search-main';
import { openSettingsPanel } from './settings-panel';
import { renderUndoButton } from './undo-button';
import { createAppearanceToggle } from './appearance-toggle';
import { t } from '../lib/i18n';
import { isMacPlatform } from '../lib/platform';

// v0.2.118: cached references to the topbar's static elements so
//  applyLocaleToDom (in newtab/main.ts) can refresh their text on
//  locale change without rebuilding the DOM.
let searchInputEl: HTMLInputElement | null = null;
let searchResultsEl: HTMLDivElement | null = null;
let settingsBtnEl: HTMLButtonElement | null = null;

// v0.2.126: keyboard shortcut hint for the search box. Mac uses
//  ⌘K, Windows / Linux / others use Ctrl+K. The key token lives
//  outside the i18n catalog because it's not language-specific
//  (translators shouldn't have to decide which OS the user is on).
//  Cached at module load so the placeholder rebuild on locale
//  change doesn't pay the platform-detect cost on every refresh.
const SEARCH_SHORTCUT_HINT = isMacPlatform() ? '⌘K' : 'Ctrl+K';

/** Build the search input placeholder: `t('topbar.search.placeholder')`
 *  plus a single trailing space + parenthesized shortcut hint. The
 *  hint is a platform-specific key (⌘K or Ctrl+K) appended in code
 *  so the i18n catalog stays OS-agnostic. */
function buildSearchPlaceholder(): string {
  return `${t('topbar.search.placeholder')} (${SEARCH_SHORTCUT_HINT})`;
}

/** Re-paint all topbar static strings (search placeholder + aria,
 *  settings button title + aria, search results aria) for the
 *  active locale. Called from `applyLocaleToDom` (newtab/main.ts)
 *  when the i18n module's `setLocale()` fires. */
export function updateTopbarStrings(): void {
  if (searchInputEl) {
    searchInputEl.placeholder = buildSearchPlaceholder();
    searchInputEl.setAttribute('aria-label', t('topbar.search.ariaLabel'));
  }
  if (searchResultsEl) {
    searchResultsEl.setAttribute('aria-label', t('topbar.searchResults.ariaLabel'));
  }
  if (settingsBtnEl) {
    settingsBtnEl.title = t('topbar.settings.ariaLabel');
    settingsBtnEl.setAttribute('aria-label', t('topbar.settings.ariaLabel'));
  }
}

/** Create and render the topbar (and its associated search DOM).
 *  v0.2.93: the search bar is always rendered (previously gated by
 *  `showSearch` setting, now removed per user request). */
export function createTopbar(container: HTMLElement): void {
  const topbar = document.createElement('div');
  topbar.id = 'topbar';

  // Search box (centered)
  const searchWrap = document.createElement('div');
  searchWrap.classList.add('search-wrap');

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'search-input';
  searchInput.placeholder = t('topbar.search.placeholder');
  searchInput.classList.add('search-input');
  searchInput.setAttribute('aria-label', t('topbar.search.ariaLabel'));
  searchInput.setAttribute('autocomplete', 'off');
  searchInput.setAttribute('spellcheck', 'false');
  searchInputEl = searchInput;

  // Static results panel — positioned absolute below the input
  const resultsEl = document.createElement('div');
  resultsEl.id = 'search-results';
  resultsEl.setAttribute('role', 'listbox');
  resultsEl.setAttribute('aria-label', t('topbar.searchResults.ariaLabel'));
  searchResultsEl = resultsEl;

  searchWrap.appendChild(searchInput);
  searchWrap.appendChild(resultsEl);
  topbar.appendChild(searchWrap);

  // Static overlay — full viewport, below the topbar in z-order
  const overlayEl = document.createElement('div');
  overlayEl.id = 'search-overlay';
  overlayEl.setAttribute('aria-hidden', 'true');

  setInputElement(searchInput, resultsEl, overlayEl);

  // Append overlay first so it's behind the topbar in stacking
  container.appendChild(overlayEl);

  // Undo button — sits to the right of the search box, hidden until a
  // drop happens. v0.2.93: always created (was previously gated by
  // `showSearch` so an empty topbar would not have an orphan button).
  renderUndoButton(topbar);

  // v0.2.87: appearance toggle (亮 / 跟随系统 / 暗). Sits to the LEFT
  // of the settings button, same 32px height. Independent
  // chrome.storage.onChanged listener for sync with the settings
  // panel's 暗色模式 select.
  topbar.appendChild(createAppearanceToggle());

  // Settings button (top-right)
  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'options_button';
  settingsBtn.title = t('topbar.settings.ariaLabel');
  settingsBtn.setAttribute('aria-label', t('topbar.settings.ariaLabel'));
  // v0.2.85: replaced the Feather "settings" path (a complex
  // multi-curve shape whose lower-right segment rendered with
  // visible mis-alignment at small sizes — the bug the user
  // reported as "右下角怪怪的") with the Lucide "settings" icon:
  // a single 8-tooth gear outline + a separate centered circle.
  // 24×24 viewBox matches the 32px button's content area
  // (32 − 4×2 padding = 24). Lucide is ISC-licensed.
  settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
  settingsBtn.addEventListener('click', () => {
    openSettingsPanel();
  });
  settingsBtnEl = settingsBtn;

  topbar.appendChild(settingsBtn);
  container.appendChild(topbar);
}
