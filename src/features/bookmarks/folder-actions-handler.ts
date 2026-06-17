// Folder action handlers — batch open, group open, split open
// Called by folder-actions.ts button clicks

import type { BookmarkNode } from './types';
import { getChildren } from './special-folders';
import { getCurrentTab, createTab } from '../../lib/chrome/bookmarks';
import { sendMessage } from '../../lib/chrome/messages';
import { splitManager } from '../split/manager';
import type { SplitLayout } from '../split/types';
import * as debug from '../../lib/debug';

/** Open all links in a folder as individual tabs (background) */
export async function openAllLinks(node: BookmarkNode): Promise<void> {
  const children = await getChildren(node);
  debug.log('folder-action', 'openAllLinks:start', { folder: node.title, count: children.length });
  const tab = await getCurrentTab();
  for (const child of children) {
    if (child.url) {
      await createTab(child.url, false, tab?.id);
    }
  }
  debug.log('folder-action', 'openAllLinks:done', { folder: node.title, opened: children.filter(c => c.url).length });
}

/** Open all links in a folder as a Chrome tab group */
export async function openAsGroup(node: BookmarkNode): Promise<void> {
  const children = await getChildren(node);
  debug.log('folder-action', 'openAsGroup:start', { folder: node.title, count: children.length });
  const tab = await getCurrentTab();
  const tabIds: number[] = [];

  for (const child of children) {
    if (child.url) {
      const newTab = await createTab(child.url, false, tab?.id);
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
    debug.warn('folder-action', 'openAsGroup: createTabGroup failed', { folder: node.title, error: result.error });
    return;
  }
  debug.log('folder-action', 'openAsGroup:done', { folder: node.title, groupSize: tabIds.length, groupId: result.groupId });
}

/** Open links in split view (via split engine) */
export async function openSplit(node: BookmarkNode): Promise<void> {
  const children = await getChildren(node);
  const urls = children
    .filter((child) => child.url)
    .map((child) => child.url!);

  if (urls.length === 0) {
    debug.warn('folder-action', 'openSplit: no urls in folder', { folder: node.title });
    return;
  }

  // Pick layout by URL count (cap at 4 to match SplitMode's max)
  const mode: SplitLayout['mode'] =
    urls.length <= 2 ? '2h' : urls.length <= 3 ? '3grid' : '4grid';
  const layout: SplitLayout = { mode };
  const slicedUrls = urls.slice(0, 4);

  debug.log('folder-action', 'openSplit', { folder: node.title, urlCount: urls.length, layout: mode });

  // Delegate URL+layout encoding to the split engine (CLAUDE.md § 4).
  // The engine knows the wire format (hash+JSON), builds the new-tab URL,
  // and the new tab's app.ts:initApp reads it back via parseSplitParams().
  await splitManager.open(slicedUrls, layout);
}
