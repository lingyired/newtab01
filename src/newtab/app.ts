// New tab page application entry
// Initializes settings, layout, and renders the bookmark board

import { initSettings, getSetting } from '../lib/storage/settings';
import { loadLayout, setRootIds } from '../features/drag-drop/layout-ops';
import { renderColumns } from '../features/bookmarks/board';
import { initSearch } from '../features/search/search-main';
import { createTopbar } from './topbar';
import { openSettingsPanel } from './settings-panel';
import { getBookmarkTree } from '../lib/chrome/bookmarks';
import { initDebug, log, group, groupEnd } from '../lib/debug';
import { applySettingsToDOM, installSettingsChangeListener } from '../features/settings/apply';
import { applyTheme } from '../features/themes/switcher';
import { applyCustomThemes } from '../features/themes/custom-themes';
import { parseSplitParams, renderSplitView } from '../features/split/split-view';

/** Initialize the new tab page */
export async function initApp(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) return;

  // Show loading state
  root.textContent = '';
  const loading = document.createElement('div');
  loading.classList.add('loading');
  loading.textContent = 'Loading...';
  root.appendChild(loading);

  try {
    group('init', 'newtab app startup');
    // 0. Initialize debug (reads settings + URL ?debug=)
    await initDebug();
    log('init', 'debug initialized', { enabled: true /* isEnabled() checked via getSync */ });

    // 1. Initialize settings first
    await initSettings();
    log('init', 'settings initialized');

    // 1a. Inject any custom themes the user has previously imported via
    // the settings panel (tweakcn JSON paste). Must happen BEFORE
    // applyTheme() so the [data-theme="user-xxx"] selectors exist in
    // <head> when the data-theme attribute is set.
    await applyCustomThemes();
    log('init', 'custom themes applied');

    // 1b. Listen for chrome.storage.onChanged so other tabs (or the popup)
    // can update settings live here. applySettingsToDOM() is re-run on each
    // change, and settings-panel edits are also picked up because they
    // write through the same setSync path that fires the listener.
    installSettingsChangeListener();

    // 1b. Apply the active theme. `applyTheme` writes the theme's
    // palette to inline custom properties on <html>; `applySettingsToDOM`
    // (below) then re-asserts the user's per-color overrides on top of
    // that baseline.
    applyTheme(String(getSetting('theme')));
    log('init', 'theme applied', { theme: getSetting('theme') });

    // 1c. Rebuild the dynamic-styles block and the user-CSS block from
    // the current settings.
    applySettingsToDOM();
    log('init', 'settings applied to DOM');

    // 2. Load bookmark tree to get root IDs
    const tree = await getBookmarkTree();
    const rootNodes = tree[0]?.children ?? [];
    const rootIds: string[] = ['apps', 'top', 'recent', 'closed', 'devices'];
    for (const node of rootNodes) {
      rootIds.push(node.id);
    }
    setRootIds(rootIds);
    log('init', 'bookmark tree loaded', { rootCount: rootNodes.length, rootIds });

    // 3. Load layout from storage
    await loadLayout();
    log('init', 'layout loaded');

    // 4. Clear loading and render
    root.textContent = '';

    // Check if split mode (?split=1 with hash+JSON params - see CLAUDE.md section 4.1)
    const parsed = parseSplitParams();
    if (parsed) {
      log('init', 'entering split view mode', { urlCount: parsed.urls.length, layout: parsed.layout.mode, title: parsed.title });
      if (parsed.title) {
        document.title = parsed.title;
      }
      const view = renderSplitView(parsed.urls, parsed.layout);
      root.replaceWith(view);
      groupEnd();
      return;
    }

    // If ?split=1 was present but params were invalid, show an error placeholder
    // (mirrors the pattern in split-view.ts renderSplitView's invalid-config branch)
    const splitFlag = new URLSearchParams(window.location.search).get('split');
    if (splitFlag === '1') {
      log('init', 'split view: invalid or missing hash params');
      const error = document.createElement('div');
      error.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        color: var(--muted-foreground);
        font-size: 14px;
      `;
      error.textContent = 'Invalid split view URL: missing or malformed #urls / #layout parameters';
      root.appendChild(error);
      groupEnd();
      return;
    }

    // Render topbar
    createTopbar(root);
    log('init', 'topbar rendered');

    // Render main board
    const main = document.createElement('div');
    main.id = 'main';
    root.appendChild(main);

    // Render columns
    await renderColumns();
    log('init', 'columns rendered');

    // Initialize search (topbar input already registered via setInputElement)
    try {
      await initSearch();
      log('init', 'search initialized');
    } catch (searchErr) {
      log('init', 'initSearch failed; continuing without search', searchErr);
      console.error('[newtab01] initSearch failed:', searchErr);
    }

    // Apply settings to DOM
    applySettingsToDOM();
    log('init', 'settings applied to DOM');

    // Hide options button if configured
    if (getSetting('hideOptions')) {
      const optionsBtn = document.getElementById('options_button');
      if (optionsBtn) optionsBtn.style.opacity = '0';
    }

    // Open options if requested
    if (window.location.search === '?options' || window.location.hash === '#settings=1') {
      log('init', 'opening settings panel (?options / #settings=1)');
      openSettingsPanel();
    }

    groupEnd();
  } catch (err) {
    groupEnd();
    root.textContent = '';
    const errorEl = document.createElement('div');
    errorEl.classList.add('error');
    errorEl.textContent = 'Failed to load bookmarks. Please refresh the page.';
    root.appendChild(errorEl);
    console.error('[newtab01] init error:', err);
  }
}

