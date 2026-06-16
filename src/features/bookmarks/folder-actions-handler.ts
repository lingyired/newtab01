// Folder action handlers — batch open, group open, split open
// Called by folder-actions.ts button clicks

import type { BookmarkNode } from './types';
import { getChildren } from './special-folders';
import { getCurrentTab, createTab, createTabGroup } from '../../lib/chrome/bookmarks';
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

  if (tabIds.length > 0) {
    await createTabGroup(tabIds, node.title);
  }
  debug.log('folder-action', 'openAsGroup:done', { folder: node.title, groupSize: tabIds.length });
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

  // Build split URL with hash params
  const layout = urls.length <= 2 ? '2h' : urls.length <= 3 ? '3grid' : '4grid';
  const params = new URLSearchParams({
    split: '1',
    urls: urls.slice(0, 4).join(','),
    layout,
  });

  debug.log('folder-action', 'openSplit', { folder: node.title, urlCount: urls.length, layout });

  // Open in new tab
  const splitUrl = `chrome-extension://${chrome.runtime.id}/newtab.html?${params.toString()}`;
  await createTab(splitUrl, true);
}
