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
 *  v0.2.108: Apps special folder routed through `renderFolder`
 *  even though its stub has no `children` field.
 *
 *  Background: `getSubTreeStub('apps')` returns
 *  `{ id: 'apps', title: 'Apps', type: 'apps', url: 'chrome://apps' }`
 *  — no `children` because Apps is a URL page
 *  (chrome://apps), not a bookmark container. The four other
 *  special folders (top/recent/closed/devices) all have
 *  `children: []`, so the naive `if (node.children)` check
 *  sends them to `renderFolder` (which calls
 *  `enableDragFolder` and makes them individually
 *  draggable). Apps falls through to `renderLink`, which
 *  doesn't call `enableDragFolder` — so dragging the Apps
 *  header bubbled up to the column's draggable region and
 *  triggered whole-column drag instead.
 *
 *  Fix: special-folder type `apps` is routed to
 *  `renderFolder` explicitly. `renderFolder` already calls
 *  `enableDragFolder(node, header, li)` unconditionally, so
 *  Apps becomes individually draggable. The "0 children"
 *  action-icon branch inside `renderFolder` is a no-op
 *  visually for Apps (no bookmark children), which matches
 *  the semantic that Apps isn't a folder of bookmarks.
 */
function renderNode(
  node: BookmarkNode,
  target: HTMLElement,
  depth: number,
  inBookmarkBarContext: boolean,
): void {
  if (node.children || node.type === 'apps') {
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
