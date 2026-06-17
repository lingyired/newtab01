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
import { applyTheme } from '../features/themes/switcher';
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

    // 1a. Apply theme to documentElement so theme CSS variables take effect
    applyTheme(String(getSetting('theme')));

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
      log('init', 'entering split view mode', { urlCount: parsed.urls.length, layout: parsed.layout.mode });
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
    if (window.location.search === '?options') {
      log('init', 'opening settings panel (?options)');
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

/** Apply settings as CSS custom properties and dynamic styles */
function applySettingsToDOM(): void {
  const settings = getSetting;

  // Apply dynamic styles via a <style> element
  const style = document.createElement('style');
  style.id = 'dynamic-styles';

  const rules: string[] = [];

  // Font
  rules.push(`#main a { font-family: "${settings('font')}"; }`);
  rules.push(`#main a { font-size: ${settings('fontSize') / 10}em; }`);
  rules.push(`#main a { font-weight: ${settings('fontWeight')}; }`);

  // Colors
  rules.push(`#main a { color: var(--newtab-text); }`);
  rules.push(`#main a:hover { color: var(--newtab-highlight-text); background-color: var(--newtab-highlight); }`);

  // Shadow
  const shadowBlur = scale(settings('shadowBlur'), 7, 100);
  rules.push(`#main a:hover { box-shadow: 0 0 ${shadowBlur}px var(--newtab-highlight); }`);

  // Border radius
  const highlightRound = scale(settings('highlightRound'), 0.2, 1.5);
  rules.push(`#main a { border-radius: ${highlightRound}em; }`);

  // Fade transition
  const fadeMs = scale(settings('fade'), 200, 1000);
  rules.push(`#main a { transition-duration: ${fadeMs}ms; }`);

  // Slide transition
  const slideMs = scale(settings('slide'), 200, 1000);
  rules.push(`.wrap { transition-duration: ${slideMs}ms; }`);

  // Spacing
  const lineHeight = scale(settings('spacing'), 2, 5.6, 0.8);
  const paddingH = scale(settings('spacing'), 0.8, 2, 0.4);
  rules.push(`#main a { line-height: ${lineHeight}; padding-left: ${paddingH + 0.4}em; padding-right: ${paddingH}em; }`);

  // Width
  if (settings('autoScale')) {
    const widthPct = scale(settings('width'), 96, 100, 60);
    rules.push(`#main { width: ${widthPct}%; }`);
  } else {
    const widthPx = scale(settings('width'), 1200, 3000, 800);
    rules.push(`#main { width: ${widthPx}px; }`);
  }

  // Vertical margin (0 by default — topbar already provides spacing)
  if (settings('autoScale')) {
    const vMarginPct = scale(settings('vMargin'), 0, 5);
    rules.push(`#main { margin-top: ${vMarginPct}%; }`);
  } else {
    const vMarginPx = scale(settings('vMargin'), 0, 200);
    rules.push(`#main { margin-top: ${vMarginPx}px; }`);
  }

  style.textContent = rules.join('\n');
  document.head.appendChild(style);

  const existingUserCss = document.getElementById('user-css');
  if (existingUserCss) {
    existingUserCss.textContent = settings('css');
  } else {
    const userCssEl = document.createElement('style');
    userCssEl.id = 'user-css';
    userCssEl.textContent = settings('css');
    document.head.appendChild(userCssEl);
  }
}

/** Scale a value from [0,1,2] to [min,mid,max] */
function scale(value: number, mid: number, max: number, min: number = 0): number {
  if (value > 1) {
    return mid + (value - 1) * (max - mid);
  }
  return min + value * (mid - min);
}

