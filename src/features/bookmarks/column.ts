// Column rendering — creates a column div and renders its folder list

import type { BookmarkNode } from './types';
import { getSubTreeStub, getChildren, isSpecialVisible } from './special-folders';
import { renderFolder } from './folder';
import { renderLink } from './link';
import { getColumnMenuItems, renderMenu } from './context-menu';
import { getSetting } from '../../lib/storage/settings';
import { getBookmarkSubTree, chromeBookmarkToNode } from '../../lib/chrome/bookmarks';
import * as debug from '../../lib/debug';

/** Render a single column at the given index into the target element */
export async function renderColumn(index: number, target: HTMLElement, columns: string[][]): Promise<void> {
  // v0.2.94: filter out special folder IDs whose `show*` toggle is off.
  // Previously `verifyColumns` only ADDED specials to the layout, so
  // toggling `showTop=0` (etc.) had no visible effect — the special
  // remained in the column and was rendered on every re-render. The
  // layout in storage is left untouched (toggling back on restores the
  // special at the same position).
  const rawIds = columns[index] ?? [];
  const ids = rawIds.filter((id) => isSpecialVisible(id));
  if (ids.length === 0) return;
  debug.log('render', 'renderColumn', { index, ids, showRoot: !!getSetting('showRoot') });

  const inBookmarkBarContext = ids.includes('1');

  // Single folder with showRoot=false: render children directly
  if (ids.length === 1 && !getSetting('showRoot')) {
    const node = await resolveNode(ids[0]!);
    if (node) {
      const children = await getChildren(node);
      const ul = renderAllNodes(children, inBookmarkBarContext);
      target.appendChild(ul);
      addColumnContextMenu(target, index);
    }
    return;
  }

  // Multiple folders or showRoot=true: render each folder
  const nodes: BookmarkNode[] = [];
  for (const id of ids) {
    const node = await resolveNode(id);
    if (node) nodes.push(node);
  }

  if (nodes.length > 0) {
    const ul = renderAllNodes(nodes, inBookmarkBarContext);
    target.appendChild(ul);
    addColumnContextMenu(target, index);
  }
}

/** Render an array of bookmark nodes into a ul */
export function renderAllNodes(
  nodes: BookmarkNode[],
  inBookmarkBarContext: boolean,
): HTMLUListElement {
  const ul = document.createElement('ul');

  if (nodes.length === 0) {
    const emptyNode: BookmarkNode = { id: 'empty', title: '< Empty >', type: 'empty' };
    renderNode(emptyNode, ul, 0, inBookmarkBarContext);
  } else {
    for (const node of nodes) {
      renderNode(node, ul, 0, inBookmarkBarContext);
    }
  }

  return ul;
}

/** Render a single bookmark node (folder or link)
 *
 *  v0.2.116: Apps is a regular link, NOT a folder.
 *
 *  Background: Apps points to the browser's native apps overview
 *  page (`chrome://apps` in Chrome, `edge://apps` in Edge) — it
 *  is not a bookmark container, so it has no children. The Apps
 *  stub in `getSubTreeStub('apps')` omits the `children` field,
 *  which sends it through `renderLink` (a regular `<a href>`
 *  link with the link visual, not the folder visual). Apps
 *  drag is wired up by `renderLink` itself, which calls
 *  `enableDragFolder(node, a, li)` when `node.id === 'apps'` —
 *  this reuses the folder drag implementation on the link
 *  element so Apps is individually draggable to other columns
 *  (matching the four other special folders' drag behaviour)
 *  without us writing a separate `enableDragLink`.
 *
 *  v0.2.111-v0.2.115 tried several folder-visual variants
 *  (folder visual + chrome.management.getAll() app list, etc.)
 *  but those don't work in practice:
 *  - chrome.management.getAll() does not return PWA in Edge
 *    (Edge PWA are registered at the OS level and not exposed
 *    to the extension API), so the Apps folder was always empty
 *    for Edge users.
 *  - chrome.management.getAll() returns Chrome extensions
 *    (type=extension) for regular installed extensions, and
 *    these should not appear in the Apps folder by Chrome's
 *    own chrome://apps design.
 *  - Click-then-jump-to-chrome://apps was confusing because
 *    clicking the Apps header looked like it would expand.
 *  Going back to the v0.2.95 visual: a single link that the
 *  user can drag to other columns and click to jump to the
 *  browser's native apps page. The 4 other special folders
 *  (top/recent/closed/devices) are still folders with
 *  `children: []` (their content is dynamic from chrome APIs).
 */
function renderNode(
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

/** Resolve a node ID to a BookmarkNode (handles special + regular) */
async function resolveNode(id: string): Promise<BookmarkNode | null> {
  // Special folders
  if (['top', 'apps', 'recent', 'closed', 'devices'].includes(id)) {
    return getSubTreeStub(id);
  }

  // Regular bookmark folder
  const result = await getBookmarkSubTree(id);
  if (result && result[0]) {
    return chromeBookmarkToNode(result[0]);
  }

  return null;
}

/** Add context menu handler for a column */
function addColumnContextMenu(target: HTMLElement, index: number): void {
  target.addEventListener('contextmenu', (e) => {
    const eventTarget = e.target as HTMLElement;
    if (eventTarget.tagName === 'A' || eventTarget.parentElement?.tagName === 'A') {
      return;
    }
    const items = getColumnMenuItems(index);
    if (items.length > 0) {
      e.preventDefault();
      renderMenu(items, e.pageX, e.pageY, target);
    }
  });
}
