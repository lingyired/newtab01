// Folder action icons — 3 SVG icon buttons for folder headers
// ExternalLink (batch open), FolderPlus (group open), Columns2 (split open)
// Only shown on hover when folder has ≥ 1 bookmark

import type { BookmarkNode } from './types';
import { openAllLinks, openAsGroup, openSplit } from './folder-actions-handler';

/** SVG icon definitions — inline SVGs, no icon library dependency */
const ICONS = {
  externalLink: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  folderPlus: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`,
  columns2: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/></svg>`,
} as const;

interface ActionButton {
  icon: string;
  title: string;
  action: (node: BookmarkNode, event: MouseEvent) => void;
}

const ACTIONS: ActionButton[] = [
  { icon: ICONS.externalLink, title: 'Open all in tabs', action: openAllLinks },
  { icon: ICONS.folderPlus, title: 'Open as tab group', action: openAsGroup },
  { icon: ICONS.columns2, title: 'Open in split view', action: openSplit },
];

/** Tooltip show delay (ms). Shorter than the browser-native ~500ms title
 * delay; the JS-driven bubble is the primary affordance. */
const TOOLTIP_DELAY_MS = 200;

/** Attach a hover-driven tooltip to `target`. The tooltip is created as
 * a `<span class="folder-action-tooltip">` appended to document.body so
 * it escapes any ancestor `overflow: hidden` (the folder header is a
 * `<a class="folder">` with `overflow: hidden` to ellipsis long titles,
 * which would clip a `::after` pseudo-tooltip). Mouseenter schedules a
 * show after `TOOLTIP_DELAY_MS`; mouseleave / click / scroll removes it
 * immediately. */
function attachTooltip(target: HTMLElement, text: string): void {
  let showTimer: number | null = null;
  let activeEl: HTMLSpanElement | null = null;

  const position = (el: HTMLSpanElement): void => {
    const rect = target.getBoundingClientRect();
    // 6px gap below the button (same as the v0.2.88 ::after bubble on
    // .sp-appearance-toggle-btn / #options_button). Tooltip sits below
    // the button; the topbar sits high in the viewport, but folder
    // headers sit mid-page so there's no top-edge clip.
    el.style.left = `${rect.left + rect.width / 2}px`;
    el.style.top = `${rect.bottom + 6}px`;
  };

  const show = (): void => {
    if (activeEl) return;
    const el = document.createElement('span');
    el.className = 'folder-action-tooltip';
    el.textContent = text;
    // fixed so it ignores document scroll offset; we re-read the rect
    // on every show in case the user scrolled between mousedown and
    // the 200ms timer firing.
    el.style.position = 'fixed';
    el.style.transform = 'translateX(-50%)';
    el.style.display = 'none';
    document.body.appendChild(el);
    position(el);
    el.style.display = 'block';
    activeEl = el;
  };

  const hide = (): void => {
    if (showTimer !== null) {
      window.clearTimeout(showTimer);
      showTimer = null;
    }
    if (activeEl) {
      activeEl.remove();
      activeEl = null;
    }
  };

  target.addEventListener('mouseenter', () => {
    if (showTimer !== null) {
      window.clearTimeout(showTimer);
    }
    showTimer = window.setTimeout(show, TOOLTIP_DELAY_MS);
  });
  target.addEventListener('mouseleave', hide);
  target.addEventListener('click', hide);
  // Wheel / scroll inside the page would leave the bubble stranded
  // over the wrong row, and the user has moved their focus anyway.
  target.addEventListener('wheel', hide, { passive: true });
  // Auxclick (middle-click) is the newtab=2 path — also hide.
  target.addEventListener('auxclick', hide);
}

/** Create the folder action buttons container. Returns an empty span when bookmarkCount is 0. */
export function createFolderActions(node: BookmarkNode, bookmarkCount: number): HTMLSpanElement {
  const container = document.createElement('span');
  container.classList.add('folder-actions');

  if (bookmarkCount === 0) {
    return container;
  }

  for (const actionDef of ACTIONS) {
    const btn = document.createElement('button');
    btn.classList.add('folder-action-btn');
    // `title` is kept for screen readers + keyboard tooltip fallback.
    // The visible bubble is the JS-driven `.folder-action-tooltip`
    // (see attachTooltip above) — a CSS `::after` pseudo-tooltip was
    // tried first but got clipped by the folder `<a class="folder">`'s
    // `overflow: hidden` (which ellipsises long titles).
    btn.title = actionDef.title;
    btn.setAttribute('aria-label', actionDef.title);
    btn.innerHTML = actionDef.icon;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      actionDef.action(node, e);
    });
    // Middle-click → always open in background (newtab=2), regardless
    // of the user's link newtab setting. Matches the behaviour of
    // ordinary bookmark links (see link.ts:renderLink).
    btn.addEventListener('auxclick', (e) => {
      if (e.button === 1) {
        e.stopPropagation();
        e.preventDefault();
        actionDef.action(node, e);
      }
    });
    // Prevent drag when clicking action buttons
    btn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    attachTooltip(btn, actionDef.title);
    container.appendChild(btn);
  }

  return container;
}
