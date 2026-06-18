// Folder action handlers — batch open, group open, split open
// Called by folder-actions.ts button clicks AND middle-click on the
// folder header (auxclick, see folder.ts:renderFolder).

import type { BookmarkNode } from './types';
import { getChildren } from './special-folders';
import { getCurrentTab, createTab } from '../../lib/chrome/bookmarks';
import { sendMessage } from '../../lib/chrome/messages';
import { splitManager } from '../split/manager';
import type { SplitLayout } from '../split/types';
import { getSetting } from '../../lib/storage/settings';
import { showSplitPickerFromNodes, SPLIT_VIEW_MAX } from './split-picker';
import * as debug from '../../lib/debug';

/**
 * Open all links in a folder as individual tabs (background).
 * Gated by `folderActionConfirmThreshold` — when the URL-children
 * count exceeds the threshold, the user is prompted via
 * `window.confirm` before any tabs are created. A 0 threshold
 * disables the confirm entirely.
 */
export async function openAllLinks(node: BookmarkNode): Promise<void> {
  const children = await getChildren(node);
  const urlChildren = children.filter((c) => c.url);
  debug.log('folder-action', 'openAllLinks:start', {
    folder: node.title,
    urlCount: urlChildren.length,
  });
  if (urlChildren.length === 0) return;
  if (!confirmIfExceedsThreshold(node, urlChildren.length, '打开全部链接')) return;

  const tab = await getCurrentTab();
  for (const child of urlChildren) {
    await createTab(child.url!, false, tab?.id);
  }
  debug.log('folder-action', 'openAllLinks:done', {
    folder: node.title,
    opened: urlChildren.length,
  });
}

/**
 * Open all links in a folder as a Chrome tab group. Same threshold
 * confirm as `openAllLinks` (the user-visible cost is similar).
 */
export async function openAsGroup(node: BookmarkNode): Promise<void> {
  const children = await getChildren(node);
  const urlChildren = children.filter((c) => c.url);
  debug.log('folder-action', 'openAsGroup:start', {
    folder: node.title,
    urlCount: urlChildren.length,
  });
  if (urlChildren.length === 0) return;
  if (!confirmIfExceedsThreshold(node, urlChildren.length, '以分组方式打开链接')) return;

  const tab = await getCurrentTab();
  const tabIds: number[] = [];
  for (const child of urlChildren) {
    const newTab = await createTab(child.url!, false, tab?.id);
    if (newTab?.id !== undefined) {
      tabIds.push(newTab.id);
    }
  }

  if (tabIds.length === 0) {
    debug.log('folder-action', 'openAsGroup:done', { folder: node.title, groupSize: 0 });
    return;
  }

  const result = await sendMessage<{ ok: true; groupId: number } | { ok: false; error: string }>({
    type: 'createTabGroup',
    tabIds,
    title: node.title,
  });
  if (!result.ok) {
    debug.warn('folder-action', 'openAsGroup: createTabGroup failed', {
      folder: node.title,
      error: result.error,
    });
    return;
  }
  debug.log('folder-action', 'openAsGroup:done', {
    folder: node.title,
    groupSize: tabIds.length,
    groupId: result.groupId,
  });
}

/**
 * Open links in split view (via split engine).
 *
 * - ≤ SPLIT_VIEW_MAX links: open directly (no prompt, layout picked
 *   by count).
 * - > SPLIT_VIEW_MAX links: show the floating picker so the user
 *   can hand-pick ≤ 4. A null result (cancel) returns without
 *   opening anything.
 */
export async function openSplit(node: BookmarkNode): Promise<void> {
  const children = await getChildren(node);
  const urlChildren = children.filter((c) => c.url);
  if (urlChildren.length === 0) {
    debug.warn('folder-action', 'openSplit: no urls in folder', { folder: node.title });
    return;
  }

  let pickedUrls: string[];
  if (urlChildren.length > SPLIT_VIEW_MAX) {
    const result = await showSplitPickerFromNodes(urlChildren);
    if (result === null || result.length === 0) {
      debug.log('folder-action', 'openSplit:cancelled', { folder: node.title });
      return;
    }
    pickedUrls = result;
  } else {
    pickedUrls = urlChildren.map((c) => c.url!);
  }

  // Pick layout by URL count (cap at SPLIT_VIEW_MAX)
  const mode: SplitLayout['mode'] =
    pickedUrls.length <= 2 ? '2h' : pickedUrls.length <= 3 ? '3H' : '4grid';
  const layout: SplitLayout = { mode };

  debug.log('folder-action', 'openSplit', {
    folder: node.title,
    urlCount: pickedUrls.length,
    layout: mode,
  });

  // The folder name becomes the browser tab title of the split view.
  await splitManager.open(pickedUrls, layout, undefined, node.title);
}

/**
 * Show a `window.confirm` when the action would open more than
 * `folderActionConfirmThreshold` tabs. Returns true when the caller
 * should proceed (either count ≤ threshold, threshold is 0, or the
 * user accepted the prompt).
 */
function confirmIfExceedsThreshold(
  node: BookmarkNode,
  count: number,
  verb: string,
): boolean {
  const threshold = Number(getSetting('folderActionConfirmThreshold') ?? 10);
  if (threshold <= 0 || count <= threshold) return true;
  const title = node.title || '当前目录';
  return window.confirm(`「${title}」包含 ${count} 个链接，确认${verb}？`);
}
