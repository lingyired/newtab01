// Folder action handlers — batch open, group open, split open
// Called by folder-actions.ts button clicks (left or middle).

import type { BookmarkNode } from './types';
import { getChildren } from './special-folders';
import { getCurrentTab, createTab, updateTab } from '../../lib/chrome/bookmarks';
import { sendMessage } from '../../lib/chrome/messages';
import { splitManager } from '../split/manager';
import type { SplitLayout } from '../split/types';
import { getSetting } from '../../lib/storage/settings';
import { showSplitPickerFromNodes, SPLIT_VIEW_MAX } from './split-picker';
import * as debug from '../../lib/debug';

/** `Settings.newtab` value type. 0 = current tab, 1 = new foreground, 2 = new background. */
type NewtabMode = 0 | 1 | 2;

/** Resolve the newtab mode for a folder action, honouring middle-click (always background). */
function resolveNewtabMode(event: MouseEvent): NewtabMode {
  if (event.button === 1) {
    // Middle-click always opens in the background, regardless of the
    // user's link newtab setting. Matches ordinary bookmark links.
    return 2;
  }
  const raw = Number(getSetting('newtab') ?? 2);
  if (raw === 0 || raw === 1) return raw;
  return 2;
}

/**
 * Open a list of URLs in tabs according to the resolved newtab mode.
 * - mode 0 (current tab): the first URL replaces the current tab,
 *   the rest open in the background.
 * - mode 1 (foreground): all tabs are created as active.
 * - mode 2 (background): all tabs are created inactive.
 */
async function openUrlsInNewtabMode(urls: string[], mode: NewtabMode): Promise<void> {
  const tab = await getCurrentTab();
  if (urls.length === 0) return;

  if (mode === 0) {
    if (tab?.id !== undefined) {
      await updateTab(tab.id, urls[0]!);
    }
    for (let i = 1; i < urls.length; i++) {
      await createTab(urls[i]!, false, tab?.id);
    }
    return;
  }

  const active = mode === 1;
  for (const url of urls) {
    await createTab(url, active, tab?.id);
  }
}

/**
 * Open all links in a folder as individual tabs.
 * Tab mode follows the user's `newtab` link setting (or background
 * for middle-click). Gated by `folderActionConfirmThreshold` — when
 * the URL-children count exceeds the threshold, the user is prompted
 * via `window.confirm` before any tabs are created.
 */
export async function openAllLinks(node: BookmarkNode, event: MouseEvent): Promise<void> {
  const children = await getChildren(node);
  const urlChildren = children.filter((c) => c.url);
  const mode = resolveNewtabMode(event);
  debug.log('folder-action', 'openAllLinks:start', {
    folder: node.title,
    urlCount: urlChildren.length,
    mode,
    middleClick: event.button === 1,
  });
  if (urlChildren.length === 0) return;
  if (!confirmIfExceedsThreshold(node, urlChildren.length, '打开全部链接')) return;

  const urls = urlChildren.map((c) => c.url!);
  await openUrlsInNewtabMode(urls, mode);
  debug.log('folder-action', 'openAllLinks:done', {
    folder: node.title,
    opened: urls.length,
    mode,
  });
}

/**
 * Open all links in a folder as a Chrome tab group. Tab mode follows
 * the user's `newtab` link setting (or background for middle-click).
 *
 * - mode 0 (current tab): the first URL replaces the current tab,
 *   the rest open in the background; all opened tabs (including the
 *   reused current tab) are grouped together.
 * - mode 1 (foreground): all tabs are created as active.
 * - mode 2 (background): all tabs are created inactive.
 */
export async function openAsGroup(node: BookmarkNode, event: MouseEvent): Promise<void> {
  const children = await getChildren(node);
  const urlChildren = children.filter((c) => c.url);
  const mode = resolveNewtabMode(event);
  debug.log('folder-action', 'openAsGroup:start', {
    folder: node.title,
    urlCount: urlChildren.length,
    mode,
    middleClick: event.button === 1,
  });
  if (urlChildren.length === 0) return;
  if (!confirmIfExceedsThreshold(node, urlChildren.length, '以分组方式打开链接')) return;

  const tab = await getCurrentTab();
  const tabIds: number[] = [];
  const urls = urlChildren.map((c) => c.url!);
  if (urls.length === 0) return;

  if (mode === 0) {
    if (tab?.id !== undefined) {
      await updateTab(tab.id, urls[0]!);
      // The current tab keeps its id; include it in the group.
      tabIds.push(tab.id);
    }
    for (let i = 1; i < urls.length; i++) {
      const newTab = await createTab(urls[i]!, false, tab?.id);
      if (newTab?.id !== undefined) {
        tabIds.push(newTab.id);
      }
    }
  } else {
    const active = mode === 1;
    for (const url of urls) {
      const newTab = await createTab(url, active, tab?.id);
      if (newTab?.id !== undefined) {
        tabIds.push(newTab.id);
      }
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
    mode,
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
 *
 * The split view's own tab is opened according to the user's
 * `newtab` link setting (or background for middle-click):
 * - mode 0 (current tab): the split view replaces the current tab.
 * - mode 1 (foreground): the split view opens as a new active tab.
 * - mode 2 (background): the split view opens in the background.
 */
export async function openSplit(node: BookmarkNode, event: MouseEvent): Promise<void> {
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

  const newtabMode = resolveNewtabMode(event);
  debug.log('folder-action', 'openSplit', {
    folder: node.title,
    urlCount: pickedUrls.length,
    layout: mode,
    newtabMode,
    middleClick: event.button === 1,
  });

  if (newtabMode === 0) {
    // Replace the current tab with the split view. We can't use
    // splitManager.open + active=false here because that opens a
    // *new* background tab — we need the existing tab to navigate.
    const tab = await getCurrentTab();
    if (tab?.id === undefined) return;
    const encodedUrls = encodeURIComponent(JSON.stringify(pickedUrls));
    const hashParams = new URLSearchParams();
    hashParams.set('urls', encodedUrls);
    hashParams.set('layout', mode);
    if (node.title) hashParams.set('title', node.title);
    const splitUrl = `chrome-extension://${chrome.runtime.id}/newtab.html?split=1#${hashParams.toString()}`;
    await updateTab(tab.id, splitUrl);
    return;
  }

  // The folder name becomes the browser tab title of the split view.
  await splitManager.open(pickedUrls, layout, undefined, node.title, newtabMode === 1);
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
