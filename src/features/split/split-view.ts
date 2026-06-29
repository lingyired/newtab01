import type { SplitMode, SplitLayout } from './types';
import { createLayoutContainer, createFrameSlot } from './split-layout';

interface FrameState {
  url: string;
  iframe: HTMLIFrameElement;
  slot: HTMLElement;
  loaded: boolean;
  error: boolean;
}

const toolbarBtnStyles = `
  padding: 4px 8px;
  font-size: 11px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--background);
  color: var(--foreground);
  cursor: pointer;
  transition: background 80ms ease;
`;

const iframeStyles = `
  width: 100%;
  height: calc(100% - 32px);
  border: none;
  background: var(--background);
`;

const errorOverlayStyles = `
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--background);
  color: var(--muted-foreground);
  font-size: 13px;
  z-index: 5;
`;

function validateUrls(urls: string[]): string[] {
  return urls.filter(url => {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  });
}

function validateLayout(urls: string[], mode: SplitMode): boolean {
  const requiredCounts: Record<SplitMode, number> = {
    '2h': 2,
    '2v': 2,
    '3H': 3,
    '4grid': 4,
  };
  const required = requiredCounts[mode];
  return urls.length >= 2 && urls.length <= (required ?? 4);
}

function createIframe(url: string, slot: HTMLElement): FrameState {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
  iframe.loading = 'lazy';
  iframe.style.cssText = iframeStyles;
  iframe.src = url;
  slot.appendChild(iframe);

  const state: FrameState = {
    url,
    iframe,
    slot,
    loaded: false,
    error: false,
  };

  iframe.addEventListener('load', () => {
    state.loaded = true;
    state.error = false;
  });

  iframe.addEventListener('error', () => {
    state.loaded = false;
    state.error = true;
    showErrorOverlay(slot, url);
  });

  return state;
}

function showErrorOverlay(slot: HTMLElement, url: string): void {
  const existing = slot.querySelector('.split-error-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'split-error-overlay';
  overlay.style.cssText = errorOverlayStyles;

  const msg = document.createElement('span');
  msg.textContent = 'This site cannot be embedded';
  overlay.appendChild(msg);

  const openBtn = document.createElement('button');
  openBtn.textContent = 'Open in new tab';
  openBtn.style.cssText = toolbarBtnStyles;
  openBtn.addEventListener('click', () => {
    window.open(url, '_blank');
  });
  overlay.appendChild(openBtn);

  slot.appendChild(overlay);
}

function createFrameToolbar(url: string, iframe: HTMLIFrameElement, slot: HTMLElement): HTMLElement {
  const bar = document.createElement('div');
  bar.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 6px;
    background: var(--muted);
    border-bottom: 1px solid var(--border);
    font-size: 10px;
    color: var(--muted-foreground);
    height: 24px;
    box-sizing: border-box;
  `;

  const urlLabel = document.createElement('span');
  try {
    urlLabel.textContent = new URL(url).hostname;
  } catch {
    urlLabel.textContent = url;
  }
  urlLabel.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
  bar.appendChild(urlLabel);

  // Refresh button
  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = '↻';
  refreshBtn.title = 'Refresh';
  refreshBtn.style.cssText = `${toolbarBtnStyles} padding: 1px 4px; font-size: 12px;`;
  refreshBtn.addEventListener('click', () => {
    iframe.src = url;
  });
  bar.appendChild(refreshBtn);

  // Open in new tab button
  const openBtn = document.createElement('button');
  openBtn.textContent = '↗';
  openBtn.title = 'Open in new tab';
  openBtn.style.cssText = `${toolbarBtnStyles} padding: 1px 4px; font-size: 12px;`;
  openBtn.addEventListener('click', () => {
    window.open(url, '_blank');
  });
  bar.appendChild(openBtn);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.title = 'Close';
  closeBtn.style.cssText = `${toolbarBtnStyles} padding: 1px 4px; font-size: 12px;`;
  closeBtn.addEventListener('click', () => {
    slot.style.display = 'none';
  });
  bar.appendChild(closeBtn);

  // Fullscreen toggle
  const fsBtn = document.createElement('button');
  fsBtn.textContent = '⤢';
  fsBtn.title = 'Toggle fullscreen';
  fsBtn.style.cssText = `${toolbarBtnStyles} padding: 1px 4px; font-size: 12px;`;
  fsBtn.addEventListener('click', () => {
    if (slot.style.position === 'fixed') {
      slot.style.cssText = `
        background: var(--background);
        position: relative;
        overflow: hidden;
      `;
    } else {
      slot.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 100;
        background: var(--background);
        overflow: hidden;
      `;
    }
  });
  bar.appendChild(fsBtn);

  return bar;
}

export function renderSplitView(urls: string[], layout: SplitLayout): HTMLElement {
  const validUrls = validateUrls(urls);

  // v0.2.18X: 1 valid URL — split view with one iframe is meaningless.
  // Navigate the current tab to the URL directly so the user gets a
  // normal page instead of a half-empty grid. `replace` so the user
  // can't "back" into the broken split view. Defence in depth — the
  // folder-action handler already short-circuits 1-URL cases, but
  // the split view may be opened via the popup or an external URL
  // hash and should still degrade gracefully.
  if (validUrls.length === 1) {
    const singleUrl = validUrls[0]!;
    window.location.replace(singleUrl);
    const placeholder = document.createElement('div');
    return placeholder;
  }

  if (!validateLayout(validUrls, layout.mode)) {
    const error = document.createElement('div');
    error.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      color: var(--muted-foreground);
      font-size: 14px;
    `;
    error.textContent = 'Invalid split view configuration: need 2-4 valid URLs';
    return error;
  }

  // Container fills the entire viewport (no top toolbar — the browser
  // tab title is the only "header" users see; see app.ts:initApp for
  // how document.title is set from parseSplitParams).
  const container = createLayoutContainer(layout.mode);
  container.style.position = 'fixed';
  container.style.inset = '0';

  for (let i = 0; i < validUrls.length; i++) {
    const url = validUrls[i]!;
    const slot = createFrameSlot(i);

    const frame = createIframe(url, slot);
    const frameToolbar = createFrameToolbar(url, frame.iframe, slot);
    slot.insertBefore(frameToolbar, frame.iframe);

    frame.iframe.style.cssText = `
      width: 100%;
      height: calc(100% - 24px);
      border: none;
      background: var(--background);
    `;

    container.appendChild(slot);
  }

  return container;
}

export function parseSplitParams(): { urls: string[]; layout: SplitLayout; title?: string } | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get('split') !== '1') return null;

  const hash = window.location.hash.slice(1);
  const hashParams = new URLSearchParams(hash);

  const urlsParam = hashParams.get('urls');
  const layoutParam = hashParams.get('layout');

  if (!urlsParam || !layoutParam) return null;

  let title: string | undefined;
  const titleParam = hashParams.get('title');
  if (titleParam) {
    try {
      const decoded = decodeURIComponent(titleParam).trim();
      if (decoded) title = decoded;
    } catch {
      // Malformed percent-encoding — ignore and fall through with no title.
    }
  }

  try {
    const urls: string[] = JSON.parse(decodeURIComponent(urlsParam));
    const mode = layoutParam as SplitMode;
    if (!['2h', '2v', '3H', '4grid'].includes(mode)) return null;
    const result: { urls: string[]; layout: SplitLayout; title?: string } = { urls, layout: { mode } };
    if (title !== undefined) result.title = title;
    return result;
  } catch {
    return null;
  }
}
