// Topbar — centered search box + settings button.
// Also creates the static results container (positioned absolute below the
// input) and the overlay backdrop (covers the page below the topbar).

import { getSetting } from '../lib/storage/settings';
import { setInputElement } from '../features/search/search-main';
import { openSettingsPanel } from './settings-panel';

/** Create and render the topbar (and its associated search DOM). */
export function createTopbar(container: HTMLElement): void {
  const topbar = document.createElement('div');
  topbar.id = 'topbar';

  // Search box (centered)
  const showSearch = getSetting('showSearch') !== 0;
  if (showSearch) {
    const searchWrap = document.createElement('div');
    searchWrap.classList.add('search-wrap');

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'search-input';
    searchInput.placeholder = 'Search bookmarks... (⌘K)';
    searchInput.classList.add('search-input');
    // v0.2.59: shadcn utility classes (see styles/shadcn-utilities.css).
    // Same contract as the link: class name + theme's shadcn vars =
    // entire visual treatment. v0.2.58 used the custom
    // `focus-visible:ring-stacked` class (which stacked a 3px ring
    // over the theme's --shadow-xs). That custom class is removed in
    // v0.2.59 — replaced by the standard shadcn focus-visible triple
    // (`focus-visible:border-ring` + `focus-visible:ring-[3px]` +
    // `focus-visible:ring-ring/50`) to match the link's focus
    // behavior and shadcn standard. Box-shadow is REPLACED by the
    // ring on focus; the theme's --shadow-xs returns when focus
    // leaves.
    searchInput.classList.add(
      'border',
      'border-input',
      'bg-transparent',
      'text-foreground',
      'shadow-xs',
      'rounded-md',
      'transition-colors',
      'placeholder:text-muted-foreground',
      'selection:bg-primary',
      'selection:text-primary-foreground',
      'focus-visible:border-ring',
      'focus-visible:ring-[3px]',
      'focus-visible:ring-ring/50',
    );
    searchInput.setAttribute('aria-label', 'Search bookmarks');
    searchInput.setAttribute('autocomplete', 'off');
    searchInput.setAttribute('spellcheck', 'false');

    // Static results panel — positioned absolute below the input
    const resultsEl = document.createElement('div');
    resultsEl.id = 'search-results';
    resultsEl.setAttribute('role', 'listbox');
    resultsEl.setAttribute('aria-label', 'Search results');

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
  }

  // Settings button (top-right)
  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'options_button';
  settingsBtn.title = 'Settings';
  settingsBtn.setAttribute('aria-label', 'Open settings');
  settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
  settingsBtn.addEventListener('click', () => {
    openSettingsPanel();
  });

  topbar.appendChild(settingsBtn);
  container.appendChild(topbar);
}
