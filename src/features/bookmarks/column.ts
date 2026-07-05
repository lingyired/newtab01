// Column rendering — creates a column div and renders its folder list

import type { BookmarkNode } from './types';
import { getSubTreeStub, getChildren, isSpecialVisible } from './special-folders';
import { renderFolder } from './folder';
import { renderLink } from './link';
import { getColumnMenuItems, renderMenu } from './context-menu';
import { getSetting } from '../../lib/storage/settings';
import { getBookmarkSubTree, chromeBookmarkToNode } from '../../lib/chrome/bookmarks';
import * as debug from '../../lib/debug';
import { t } from '../../lib/i18n';

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

  // v1.1.4: empty column — two flavors.
  //  1. `rawIds` is empty (the column had no ids at all — only
  //     happens for the placeholder column the empty-layout
  //     branch in board.ts creates; in practice verifyColumns
  //     guarantees at least one id).
  //  2. Every id is a hidden special (the user toggled show*=0
  //     for every folder in the column). board.ts already
  //     filters such columns out, so this branch only triggers
  //     if the user disabled a special's show* AFTER the column
  //     was queued for render.
  //
  // We still need to (a) attach the column-level context menu so
  // the user can right-click → remove the column, and (b) show a
  // placeholder so the slot is visually discoverable as droppable.
  // The drag-drop handler resolves `.column` siblings to compute
  // the drop x, so a present-but-empty column div is sufficient
  // for the drop path.
  if (ids.length === 0) {
    renderEmptyColumnPlaceholder(target, index);
    return;
  }
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
    } else {
      // v1.1.4: the only id in this column points to a folder
      //  that was deleted in Chrome bookmarks. The id is still
      //  in the layout array (verifyColumns doesn't know it
      //  became invalid — see comments in board.ts about why we
      //  don't auto-clean). Fall through to the empty-column
      //  placeholder so the user can right-click to remove the
      //  column or drag a fresh folder in.
      renderEmptyColumnPlaceholder(target, index);
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
  } else {
    // v1.1.4: every id in this column resolved to null (i.e. the
    //  user deleted every folder in the column from Chrome
    //  bookmarks, or the column contained a mix of valid +
    //  deleted ids and all valid ids were hidden). Same UX as
    //  the ids.length === 0 case — show placeholder + column
    //  context menu so the slot is still actionable.
    renderEmptyColumnPlaceholder(target, index);
  }
}

/** v1.1.4: shared empty-column rendering. Builds the "Drop a
 *  folder here" placeholder inside the column div and attaches
 *  the column-level context menu so the user can right-click to
 *  remove the column. Extracted to avoid duplicating the class
 *  add + placeholder creation across the three empty branches in
 *  renderColumn (rawIds empty / showRoot-false single id is
 *  unresolved / multi-folder all unresolved).
 *
 *  v1.1.4: the placeholder is rendered as a `<a class="folder
 *  folder--empty">` element so it inherits the same flexbox +
 *  align-items: center + font-size: 1.8em / line-height: 1.4
 *  layout that real folder headers use. The text is then
 *  guaranteed to land at the exact same y position as the first
 *  folder in a regular column, without us having to hard-code
 *  a margin/padding offset that would drift the moment the
 *  user's font size or theme line-height changes. The `a` is
 *  used (not a `div`) so the same `#main a` rules apply, but
 *  `tabIndex = -1` + `href` absent means it is not focusable
 *  and not clickable (the click would otherwise bubble to the
 *  column's right-click handler, etc.). `folder--empty` adds
 *  the muted placeholder color + removes the icon / action
 *  buttons that renderFolder normally appends. */
function renderEmptyColumnPlaceholder(target: HTMLElement, index: number): void {
  target.classList.add('column--empty');

  // Wrap in a <ul> so the column's children match the same shape
  //  as a regular column (one <ul> per column, holds <li> nodes).
  //  Keeps the DOM structure consistent for downstream selectors
  //  (e.g. the search indexer, the moved-out panel, the undo
  //  snapshot). The <li> wraps the folder-like placeholder so
  //  the layout mirrors a real folder row exactly.
  const ul = document.createElement('ul');
  const li = document.createElement('li');
  li.dataset.depth = '0';
  li.dataset.type = 'empty';

  const header = document.createElement('a');
  header.classList.add('folder', 'folder--empty');
  header.tabIndex = -1;
  // No `href` — see comment above. Prevents middle-click / ctrl-
  //  click from accidentally opening a blank navigation.

  const textWrap = document.createElement('span');
  textWrap.className = 'link-text';
  textWrap.textContent = t('column.empty');
  header.appendChild(textWrap);

  li.appendChild(header);
  ul.appendChild(li);
  target.appendChild(ul);
  addColumnContextMenu(target, index);
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
