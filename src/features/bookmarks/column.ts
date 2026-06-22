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
 *  v0.2.110: reverted v0.2.108 special routing for Apps.
 *
 *  Background: v0.2.108 added `|| node.type === 'apps'` to send
 *  Apps through `renderFolder` (in order to call `enableDragFolder`
 *  so dragging the Apps header wouldn't fall through to the
 *  column's drag handler). v0.2.109 then overrode Apps' click
 *  behaviour in `renderFolder` to navigate to `chrome://apps`,
 *  preserving the folder visual. The result was a visual
 *  regression: Apps header looked like a folder and rendered an
 *  empty `< Empty >` placeholder when expanded, even though
 *  clicking it correctly navigated to `chrome://apps`.
 *
 *  The pre-v0.2.95 Apps UI was a regular bookmark link (an
 *  `<a href="chrome://apps">`), rendered by `renderLink`. That
 *  link element is natively `draggable = true` (HTML5 default for
 *  `<a href>`), and dragging a link does NOT bubble up to the
 *  parent column's dragstart — the link itself becomes the drag
 *  subject. So Apps-as-link works correctly: drag the header →
 *  it drags as a single link (which is what the user expects
 *  for a "navigate to chrome://apps" entry); click the header →
 *  navigates to chrome://apps in the configured tab mode.
 *
 *  v0.2.110 reverts the `|| node.type === 'apps'` clause. The
 *  v0.2.109 Apps short-circuit in `folder.ts` is kept as dead
 *  code for defence-in-depth — it only fires if some future
 *  change in this file routes Apps through `renderFolder`
 *  again, in which case clicking the header still navigates
 *  to chrome://apps instead of expanding into an empty
 *  folder. The `openLink` export in `link.ts` is kept for
 *  the same reason.
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
