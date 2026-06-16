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

    // Check if split mode
    const params = new URLSearchParams(window.location.search);
    if (params.get('split') === '1') {
      log('init', 'entering split view mode', Object.fromEntries(params));
      renderSplitView(root, params);
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

  // Custom CSS
  const customCss = settings('css');
  if (customCss) {
    rules.push(customCss);
  }

  style.textContent = rules.join('\n');
  document.head.appendChild(style);
}

/** Scale a value from [0,1,2] to [min,mid,max] */
function scale(value: number, mid: number, max: number, min: number = 0): number {
  if (value > 1) {
    return mid + (value - 1) * (max - mid);
  }
  return min + value * (mid - min);
}

/** Render split view (placeholder — full implementation in split feature) */
function renderSplitView(root: HTMLElement, params: URLSearchParams): void {
  const urls = params.get('urls')?.split(',') ?? [];
  const layout = params.get('layout') ?? '2h';

  const container = document.createElement('div');
  container.classList.add('split-container', `split-${layout}`);

  for (const url of urls) {
    const frame = document.createElement('iframe');
    frame.src = url;
    frame.sandbox.add('allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-forms');
    frame.loading = 'lazy';
    container.appendChild(frame);
  }

  root.appendChild(container);
}
