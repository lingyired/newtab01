// Search module — coordinates the topbar search input, overlay backdrop,
// and results panel. Inspired by the working old-project design: static
// DOM elements + focus/blur-driven show/hide (no separate "isOpen" state).

import { createSearchEngine, search } from './search-engine';
import { buildIndex, watchBookmarkChanges, getCachedItems } from './bookmark-index';
import { showOverlay, hideOverlay, attachOverlay } from './search-overlay';
import {
  showResults,
  hideResults,
  attachResultsContainer,
  setOnSelect,
  handleKeyNavigation,
  hasSelection,
} from './search-results';
import { getSetting } from '../../lib/storage/settings';
import { searchInCurrentTab } from '../../lib/chrome/bookmarks';
import * as debug from '../../lib/debug';

const DEBOUNCE_MS = 150;

let engine: ReturnType<typeof createSearchEngine> | null = null;
let inputEl: HTMLInputElement | null = null;
let overlayEl: HTMLElement | null = null;
let blurTimeout: ReturnType<typeof setTimeout> | null = null;
let globalKeydownWired = false;
let inputWired = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function ensureEngine(): Promise<void> {
  const items = getCachedItems();
  if (items) {
    engine = createSearchEngine(items);
    debug.log('search', 'ensureEngine: cache hit', { items: items.length });
    return;
  }
  debug.time('search:buildIndex');
  const index = await buildIndex();
  debug.timeEnd('search:buildIndex');
  engine = createSearchEngine(index);
  debug.log('search', 'ensureEngine: built', { items: index.length });
}

function performSearch(query: string): void {
  if (!engine) return;
  const results = search(engine, query);
  debug.log('search', 'performSearch', { query, resultCount: results.length });
  showResults(results);
}

function closeAll(): void {
  hideResults();
  hideOverlay();
  if (inputEl) {
    inputEl.value = '';
    inputEl.blur();
  }
}

function focusSearch(): void {
  if (!inputEl) return;
  if (blurTimeout) {
    clearTimeout(blurTimeout);
    blurTimeout = null;
  }
  inputEl.focus();
  inputEl.select();
  if (inputEl.value.trim()) {
    performSearch(inputEl.value);
  }
}

function wireInputEvents(): void {
  if (inputWired || !inputEl) return;
  inputWired = true;

  setOnSelect(() => {
    closeAll();
  });

  inputEl.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => performSearch(inputEl!.value), DEBOUNCE_MS);
  });

  inputEl.addEventListener('focus', () => {
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      blurTimeout = null;
    }
    showOverlay(closeAll);
    if (inputEl!.value.trim()) {
      performSearch(inputEl!.value);
    } else {
      // Show the panel with the empty state so the user knows the search UI is active
      showResults([]);
    }
  });

  inputEl.addEventListener('blur', () => {
    if (blurTimeout) clearTimeout(blurTimeout);
    blurTimeout = setTimeout(() => {
      hideResults();
      hideOverlay();
    }, 150);
  });

  inputEl.addEventListener('keydown', (e) => {
    const handled = handleKeyNavigation(e);
    if (handled) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      const query = inputEl!.value.trim();
      if (query && !hasSelection()) {
        debug.log('search', 'fallback to search engine', { query });
        void searchInCurrentTab(query);
        closeAll();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeAll();
    }
  });
}

function handleGlobalKeydown(event: KeyboardEvent): void {
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault();
    debug.log('search', 'hotkey: cmd/ctrl+k');
    focusSearch();
  }
}

export function setInputElement(
  input: HTMLInputElement | null,
  results: HTMLElement | null,
  overlay: HTMLElement | null,
): void {
  // If the input element changed (e.g. due to a re-render or duplicate
  // createTopbar call), reset the wiring flag so the new element gets
  // its listeners attached. Without this, the second call would silently
  // skip wireInputEvents because inputWired is already true.
  if (input && input !== inputEl) {
    inputWired = false;
  }

  inputEl = input;
  overlayEl = overlay;

  if (results) attachResultsContainer(results);
  if (overlay) attachOverlay(overlay);

  if (input) wireInputEvents();
}

export function getInputElement(): HTMLInputElement | null {
  return inputEl;
}

export function isOpen(): boolean {
  return overlayEl?.style.display === 'block';
}

export async function initSearch(): Promise<void> {
  if (getSetting('showSearch') === 0) {
    debug.log('search', 'initSearch: showSearch=0, skipped');
    return;
  }

  try {
    await ensureEngine();
    watchBookmarkChanges();

    if (!globalKeydownWired) {
      globalKeydownWired = true;
      document.addEventListener('keydown', handleGlobalKeydown);
    }

    debug.log('search', 'initSearch complete');
  } catch (err) {
    debug.error('search', 'initSearch error', err);
    throw err;
  }
}

export { focusSearch as toggleSearch, focusSearch as openSearch, closeAll as closeSearch };
