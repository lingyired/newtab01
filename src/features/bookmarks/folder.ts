// Folder node rendering — folder with header, action icons, expand/collapse

import type { BookmarkNode } from './types';
import { createFavicon } from './favicon';
import { createFolderActions } from './folder-actions';
import { openAllLinks } from './folder-actions-handler';
import { getChildren } from './special-folders';
import { renderLink } from './link';
import { renderMenu, getFolderMenuItems } from './context-menu';
import { enableDragFolder } from '../drag-drop/drag-folder';
import { getSetting } from '../../lib/storage/settings';
import { getLocal, setLocal, removeLocal } from '../../lib/storage';
import { getMovedOut, filterChildren } from './moved-out';
import * as debug from '../../lib/debug';

/** Track open folder state in storage */
const OPEN_PREFIX = 'open.';

/** Render a folder node as li with header and collapsible children */
export function renderFolder(
  node: BookmarkNode,
  target: HTMLElement,
  depth: number,
  inBookmarkBarContext: boolean,
): HTMLLIElement {
  const li = document.createElement('li');
  li.dataset.nodeId = node.id;
  li.dataset.depth = String(depth);

  const header = document.createElement('a');
  header.classList.add('folder');
  header.tabIndex = 0;

  // Set text
  const textWrap = document.createElement('span');
  textWrap.className = 'link-text';
  textWrap.textContent = node.title || '';
  header.appendChild(textWrap);

  // Folder icon
  const icon = createFavicon(undefined, undefined, undefined);
  icon.classList.add('folder-icon');
  header.insertBefore(icon, header.firstChild);

  // Action icons — regular folders use children synchronously; special folders
  // (top/recent/closed/devices) need an async getChildren() to know the real count.
  const isSpecial = node.type === 'top' || node.type === 'recent' || node.type === 'closed' || node.type === 'devices';
  if (isSpecial) {
    void getChildren(node).then((children) => {
      if (children.length > 0) {
        const actions = createFolderActions(node, children.length);
        header.appendChild(actions);
      }
    });
  } else {
    const bookmarkCount = node.children?.length ?? 0;
    const actions = createFolderActions(node, bookmarkCount);
    header.appendChild(actions);
  }

  li.appendChild(header);

  // Check if folder should be open
  checkOpenState(node).then((isOpen) => {
    if (isOpen) {
      header.classList.add('open');
      getChildren(node).then(async (children) => {
        if (header.classList.contains('open')) {
          const movedOut = await getMovedOut();
          const filtered = filterChildren(node.id, children, movedOut, inBookmarkBarContext);
          renderChildrenInto(filtered, li, depth + 1, inBookmarkBarContext);
        }
      });
    }
  });

  // Click handler for expand/collapse
  header.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.folder-action-btn')) return;
    toggleFolder(node, header, li, depth, inBookmarkBarContext);
  });

  // Keyboard support
  header.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (!target.closest('.folder-action-btn')) {
        toggleFolder(node, header, li, depth, inBookmarkBarContext);
      }
    }
  });

  // Middle-click on the folder header opens all DIRECT link children
  // (subfolders are skipped, same as the action button). The click
  // handler above only fires for the primary mouse button so they
  // don't conflict; `auxclick` is the spec'd event for non-primary
  // buttons (button === 1 is middle, 2 is right — contextmenu handles
  // the right-click path separately).
  header.addEventListener('auxclick', (e: MouseEvent) => {
    if (e.button !== 1) return;
    const target = e.target as HTMLElement;
    if (target.closest('.folder-action-btn')) return;
    e.preventDefault();
    e.stopPropagation();
    debug.log('folder', 'auxclick:middle', { folder: node.title, id: node.id });
    void openAllLinks(node);
  });

  // Enable drag on folder header (li wraps the whole subtree, header
  // is the draggable target)
  enableDragFolder(node, header, li);

  // Context menu on right-click
  header.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const items = getFolderMenuItems(node);
    if (items.length > 0) {
      renderMenu(items, e.pageX, e.pageY, header);
    }
  });

  target.appendChild(li);
  return li;
}

/** Toggle folder open/close state */
async function toggleFolder(
  node: BookmarkNode,
  header: HTMLAnchorElement,
  li: HTMLLIElement,
  depth: number,
  inBookmarkBarContext: boolean,
): Promise<void> {
  const isOpen = header.classList.contains('open');

  if (isOpen) {
    // Close folder
    header.classList.remove('open');
    await removeLocal(OPEN_PREFIX + node.id);

    // Auto-close child folders
    if (getSetting('autoClose')) {
      const childFolders = li.querySelectorAll(':scope > [data-wrap] > ul > li > a.open');
      for (const child of childFolders) {
        (child as HTMLElement).click();
      }
    }

    // Remove children container
    const wrap = li.querySelector(':scope > [data-wrap]') as HTMLElement | null;
    if (wrap) {
      wrap.remove();
    }
  } else {
    // Open folder
    header.classList.add('open');
    await setLocal(OPEN_PREFIX + node.id, true);

    // Auto-close sibling folders (accordion behavior)
    if (getSetting('autoClose')) {
      autoCloseSiblings(li, depth);
    }

    // Render children if not already rendered
    const existingWrap = li.querySelector(':scope > [data-wrap]');
    if (!existingWrap) {
      const rawChildren = await getChildren(node);
      if (header.classList.contains('open')) {
        const movedOut = await getMovedOut();
        const children = filterChildren(node.id, rawChildren, movedOut, inBookmarkBarContext);
        renderChildrenInto(children, li, depth + 1, inBookmarkBarContext);
      }
    }
  }
}

/** Auto-close sibling folders based on depth */
function autoCloseSiblings(li: HTMLLIElement, depth: number): void {
  const parent = li.parentElement;
  if (!parent) return;

  const siblings = parent.children;
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i] as HTMLElement;
    if (sibling === li) continue;

    const siblingDepth = sibling.dataset.depth;
    if (depth === 0 && siblingDepth === '0') {
      const siblingHeader = sibling.querySelector(':scope > a.open') as HTMLElement | null;
      if (siblingHeader) siblingHeader.click();
    } else if (depth > 0 && siblingDepth === String(depth)) {
      const siblingHeader = sibling.querySelector(':scope > a.open') as HTMLElement | null;
      if (siblingHeader) siblingHeader.click();
    }
  }
}

/** Render children into a wrapper div */
function renderChildrenInto(
  children: BookmarkNode[],
  li: HTMLLIElement,
  depth: number,
  inBookmarkBarContext: boolean,
): void {
  const ul = document.createElement('ul');

  if (children.length === 0) {
    // Show empty state
    const emptyNode: BookmarkNode = { id: 'empty', title: '< Empty >', type: 'empty' };
    renderNodeInto(emptyNode, ul, depth, inBookmarkBarContext);
  } else {
    for (const child of children) {
      renderNodeInto(child, ul, depth, inBookmarkBarContext);
    }
  }

  const wrap = document.createElement('div');
  wrap.dataset.wrap = '';
  wrap.appendChild(ul);
  li.appendChild(wrap);
}

/** Render a single node into a target (delegates to link or folder) */
function renderNodeInto(
  node: BookmarkNode,
  target: HTMLElement,
  depth: number,
  inBookmarkBarContext: boolean,
): void {
  if (node.children) {
    renderFolder(node, target, depth, inBookmarkBarContext);
  } else {
    renderLink(node, target);
  }
}

/** Check if a folder should be open (from storage) */
async function checkOpenState(node: BookmarkNode): Promise<boolean> {
  if (!getSetting('rememberOpen')) return false;
  const stored = await getLocal<boolean>(OPEN_PREFIX + node.id);
  return stored === true;
}
