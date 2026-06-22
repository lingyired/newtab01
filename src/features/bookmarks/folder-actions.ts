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
    // Keep `title` for screen readers + the CSS-only ::after tooltip
    // (see styles/newtab.css .folder-action-btn:hover::after). The
    // browser's native tooltip delay (~500ms) is irrelevant — the
    // CSS bubble paints instantly on hover.
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
    container.appendChild(btn);
  }

  return container;
}
