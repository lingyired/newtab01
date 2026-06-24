// Search results — renders Fuse results into a static container element
// positioned below the search input. The container is created externally.

import type { SearchItem } from './search-engine';
import { createTab } from '../../lib/chrome/bookmarks';
import { t } from '../../lib/i18n';

let container: HTMLElement | null = null;
let listEl: HTMLElement | null = null;
let selectedIndex = -1;
let currentItems: SearchItem[] = [];
let onSelectCallback: ((item: SearchItem) => void) | null = null;
const faviconUrlCache = new Map<string, string>();

/** Attach to an externally created results container. Idempotent. */
export function attachResultsContainer(el: HTMLElement): void {
  if (container === el) return;
  container = el;
  container.style.display = 'none';

  // Keep the search input focused when the user clicks anywhere inside the
  // results panel (items, empty area, footer). Without this guard the
  // mousedown transfers focus away from the input, the input's blur
  // listener fires, and the panel auto-hides after 150ms. Left button only
  // — right-click / middle-click should keep their default focus behavior
  // and not interfere with context menus etc.
  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
  });

  // Internal structure: list + footer with keyboard hints.
  // Re-render on each attach so the footer is always present.
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  listEl = document.createElement('div');
  listEl.className = 'search-results-list';
  container.appendChild(listEl);

  // The footer is created once at attach-time and rebuilt in place
  // by `updateSearchStrings()`. v1.0.7 used to keep a module-level
  // `footerEl` reference here as a side effect of `buildFooter()`;
  // v1.0.8 makes `buildFooter` pure (it no longer touches any
  // module state) and locates the existing footer via
  // `container.querySelector` at call time, so the reference no
  // longer needs to be cached.
  container.appendChild(buildFooter());

  selectedIndex = -1;
  currentItems = [];
}

/** Build the static footer with keyboard hints. v0.2.118: hint
 *  labels are read from t() at render time so that locale changes
 *  can repaint the footer without rebuilding the rest of the
 *  results panel.
 *
 *  v1.0.8: this function is now pure — it does NOT touch any
 *  module-level state. The previous implementation did
 *  `footerEl = footer` as a side effect, which made the rebuild
 *  path in `updateSearchStrings()` a no-op: by the time
 *  `updateSearchStrings` did `footerEl.replaceWith(newFooter)`,
 *  `buildFooter` had already overwritten `footerEl` with
 *  `newFooter` (a detached node), so `replaceWith` was effectively
 *  `newFooter.replaceWith(newFooter)` — a self-no-op — and the
 *  old footer remained in the DOM with its stale translations.
 *  `updateSearchStrings` now locates the existing footer through
 *  the container at call time, so no cached reference is needed. */
function buildFooter(): HTMLElement {
  const footer = document.createElement('div');
  footer.className = 'search-results-footer';

  function appendHint(kbds: string[], label: string): void {
    const span = document.createElement('span');
    for (const k of kbds) {
      const kbd = document.createElement('kbd');
      kbd.textContent = k;
      span.appendChild(kbd);
    }
    span.appendChild(document.createTextNode(` ${label}`));
    footer.appendChild(span);
  }

  appendHint(['↑', '↓'], t('searchResults.footer.navigate'));
  appendHint(['↵'], t('searchResults.footer.open'));
  appendHint(['esc'], t('searchResults.footer.close'));

  // Right-aligned fallback hint: pressing Enter without selecting a result
  // routes the input through the browser's default search engine.
  const fallback = document.createElement('span');
  fallback.className = 'search-results-footer-fallback';
  const fallbackKbd = document.createElement('kbd');
  fallbackKbd.textContent = '↵';
  fallback.appendChild(fallbackKbd);
  fallback.appendChild(
    document.createTextNode(` ${t('searchResults.footer.websearch')}`),
  );
  footer.appendChild(fallback);

  return footer;
}

/** v0.2.118: rebuild the search results footer in-place so that the
 *  keyboard hint labels track the active locale. Called from
 *  `applyLocaleToDom` (newtab/main.ts) on `setLocale()`. The list
 *  above the footer is untouched — it already shows whatever results
 *  the user previously searched for, and a stale list is preferable
 *  to clearing the user's results on a language switch.
 *
 *  v1.0.7: also repaint the empty-state text inside `listEl` so that
 *  switching language while the panel is open in its empty state
 *  (input focused, no query yet) updates immediately. Pre-v1.0.7 the
 *  empty `<div class="search-results-empty">` was only populated by
 *  `showResults([])` (called on input focus), so a locale change
 *  between focus and the next focus would leave the user staring at
 *  the old-language "Type to search…" until they blurred and
 *  re-focused.
 *
 *  v1.0.8: the footer rebuild now uses `container.querySelector`
 *  instead of the (now-removed) module-level `footerEl` reference.
 *  v1.0.7 looked up the footer via `footerEl && footerEl.parentElement`,
 *  but `buildFooter()` had a side effect of overwriting that
 *  reference with the freshly-built (detached) node, so the
 *  subsequent `footerEl.replaceWith(newFooter)` operated on the
 *  new node itself and never replaced the visible footer. v1.0.8
 *  makes `buildFooter` pure and locates the existing footer
 *  through the container at call time, which is robust against
 *  any future re-attach or container replacement. */
export function updateSearchStrings(): void {
  if (!container) return;
  // 1. Footer (keyboard hints). Look up the live footer in the
  //    container, then `replaceWith` a freshly-built one so the
  //    right-aligned fallback span keeps its `margin-left: auto`
  //    flexbox slot.
  const existingFooter = container.querySelector('.search-results-footer');
  const newFooter = buildFooter();
  if (existingFooter && existingFooter.parentElement) {
    existingFooter.replaceWith(newFooter);
  } else {
    // Defensive: no footer in the container (shouldn't happen —
    // attachResultsContainer always creates one — but if the
    // container was somehow replaced or the footer was removed,
    // append a fresh footer to restore the keyboard hints).
    container.appendChild(newFooter);
  }
  // 2. Empty-state hint inside the list. Re-write textContent in
  //    place — the surrounding element is preserved so layout
  //    doesn't shift if the empty state happens to be visible.
  if (listEl) {
    const empty = listEl.querySelector('.search-results-empty');
    if (empty) {
      empty.textContent = t('searchResults.empty');
    }
  }
}

function getFaviconUrl(url: string): string {
  try {
    const pageUrl = new URL(url);
    const origin = pageUrl.origin;
    const cached = faviconUrlCache.get(origin);
    if (cached !== undefined) return cached;
    const faviconUrl = `/_favicon/?pageUrl=${encodeURIComponent(origin)}&size=16`;
    faviconUrlCache.set(origin, faviconUrl);
    return faviconUrl;
  } catch {
    return '';
  }
}

function createItemElement(item: SearchItem, index: number): HTMLElement {
  const el = document.createElement('div');
  el.className = 'search-result-item';
  el.setAttribute('role', 'option');
  el.dataset.index = String(index);

  const favicon = document.createElement('img');
  favicon.src = getFaviconUrl(item.url);
  favicon.alt = '';
  favicon.className = 'search-result-favicon';
  favicon.loading = 'lazy';
  favicon.addEventListener('error', () => {
    favicon.style.display = 'none';
  });

  const title = document.createElement('span');
  title.className = 'search-result-title';
  title.textContent = item.title || item.url;

  const url = document.createElement('span');
  url.className = 'search-result-url';
  try {
    const u = new URL(item.url);
    url.textContent = u.hostname;
  } catch {
    url.textContent = item.url;
  }

  el.appendChild(favicon);
  el.appendChild(title);
  el.appendChild(url);

  el.addEventListener('mouseenter', () => {
    selectedIndex = index;
    updateActiveItem();
  });

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onSelectCallback?.(item);
  });

  return el;
}

function updateActiveItem(): void {
  if (!listEl) return;
  const items = listEl.querySelectorAll('.search-result-item');
  items.forEach((el, i) => {
    if (i === selectedIndex) {
      el.classList.add('search-result-active');
    } else {
      el.classList.remove('search-result-active');
    }
  });
  const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : undefined;
  if (selectedItem instanceof HTMLElement) {
    selectedItem.scrollIntoView({ block: 'nearest' });
  }
}

function openItem(item: SearchItem): void {
  void createTab(item.url, true);
}

/** Set the callback for when a result is clicked (or Enter is pressed). */
export function setOnSelect(cb: (item: SearchItem) => void): void {
  onSelectCallback = cb;
}

/** Render results into the attached container. */
export function showResults(items: SearchItem[]): void {
  if (!container || !listEl) return;
  currentItems = items;
  selectedIndex = -1;

  while (listEl.firstChild) {
    listEl.removeChild(listEl.firstChild);
  }

  if (items.length === 0) {
    // Empty state — keep the panel visible with a small hint
    const empty = document.createElement('div');
    empty.className = 'search-results-empty';
    empty.textContent = t('searchResults.empty');
    listEl.appendChild(empty);
  } else {
    for (let i = 0; i < items.length; i++) {
      listEl.appendChild(createItemElement(items[i]!, i));
    }
  }

  container.style.display = 'block';
  // Reset scroll on every render so the user always sees the top result.
  container.scrollTop = 0;
}

/** Hide the results panel. */
export function hideResults(): void {
  if (!container) return;
  container.style.display = 'none';
  currentItems = [];
  selectedIndex = -1;
}

/** Keyboard navigation handler. Returns true if event was handled. */
export function handleKeyNavigation(event: KeyboardEvent): boolean {
  if (!container || container.style.display === 'none' || currentItems.length === 0) {
    return false;
  }

  switch (event.key) {
    case 'ArrowDown': {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, currentItems.length - 1);
      updateActiveItem();
      return true;
    }
    case 'ArrowUp': {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, -1);
      updateActiveItem();
      return true;
    }
    case 'Enter': {
      event.preventDefault();
      if (selectedIndex >= 0 && currentItems[selectedIndex]) {
        openItem(currentItems[selectedIndex]!);
      } else {
        return false;
      }
      return true;
    }
    case 'Escape': {
      event.preventDefault();
      hideResults();
      return true;
    }
  }

  return false;
}

export function hasSelection(): boolean {
  return selectedIndex >= 0;
}
