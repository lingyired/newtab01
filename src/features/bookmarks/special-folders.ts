// Special folders — topSites, recent, closed, devices, apps
// Each returns BookmarkNode[] for rendering

import type { BookmarkNode, Settings } from './types';
import { getSetting } from '../../lib/storage/settings';
import {
  getTopSites,
  getRecentBookmarks,
  getRecentlyClosed,
  getDevices,
  restoreSession,
} from '../../lib/chrome/bookmarks';

/** Map from special folder ID to its `show*` setting key.
 *  Hoisted from `layout-ops.ts` in v0.2.94 so board.ts can use
 *  `isSpecialVisible` without creating a layout-ops → board import
 *  cycle. board.ts and column.ts both import from this module. */
export const SHOW_KEY_MAP: Record<string, keyof Settings> = {
  apps: 'showApps',
  top: 'showTop',
  recent: 'showRecent',
  closed: 'showClosed',
  devices: 'showDevices',
};

/** True when a special folder ID is currently visible per the user's
 *  `show*` setting. Returns true for any non-special ID (regular
 *  bookmark folders) so the predicate is safe to use as a filter
 *  on the whole `ids` list. */
export function isSpecialVisible(id: string): boolean {
  const key = SHOW_KEY_MAP[id];
  if (!key) return true;
  try {
    return getSetting(key) !== 0;
  } catch {
    return true;
  }
}

/** Get children for a special or regular bookmark node */
export async function getChildren(node: BookmarkNode): Promise<BookmarkNode[]> {
  switch (node.type ?? node.id) {
    case 'top':
      return getTopSitesNodes();
    case 'recent':
      return getRecentNodes();
    case 'closed':
      return getClosedNodes();
    case 'devices':
      return getDevicesNodes();
    default:
      if (node.children) return node.children;
      return [];
  }
}

/** Get sub-tree stub for a special folder (for column rendering) */
export function getSubTreeStub(id: string): BookmarkNode {
  switch (id) {
    case 'top':
      return { id: 'top', title: 'Most visited', type: 'top', children: [] };
    case 'apps':
      // v0.2.116: Apps is a single-link entry pointing to the
      //  browser's native apps overview page — NOT a bookmark
      //  container. The stub has no `children` field so
      //  `column.ts:renderNode` routes it through `renderLink`
      //  (a regular `<a href>` link with the link visual, not
      //  the folder visual). The drag handler is wired up by
      //  `link.ts:renderLink` (when `node.id === 'apps'` it
      //  reuses `enableDragFolder` so Apps is individually
      //  draggable to other columns, matching the four other
      //  special folders' drag behaviour).
      //
      //  URL: pick the right browser scheme. Chrome uses
      //  `chrome://apps`; Edge uses `edge://apps`. Detect via
      //  userAgent — the unique Edge token is `Edg/`
      //  (Chrome UA contains `Chrome/...` but NOT `Edg/`).
      return {
        id: 'apps',
        title: 'Apps',
        type: 'apps',
        url: typeof navigator !== 'undefined' &&
             navigator.userAgent?.includes('Edg/')
          ? 'edge://apps'
          : 'chrome://apps',
      };
    case 'recent':
      return { id: 'recent', title: 'Recent bookmarks', type: 'recent', children: [] };
    case 'closed':
      return { id: 'closed', title: 'Recently closed', type: 'closed', children: [] };
    case 'devices':
      return { id: 'devices', title: 'Other devices', type: 'devices', children: [] };
    default:
      return { id, title: '', children: [] };
  }
}

/** Helper: build a BookmarkNode with optional url, respecting exactOptionalPropertyTypes */
function makeNode(id: string, title: string, url: string | undefined, extra?: Partial<BookmarkNode>): BookmarkNode {
  const node: BookmarkNode = { id, title, ...extra };
  if (url) node.url = url;
  return node;
}

/** Top Sites */
async function getTopSitesNodes(): Promise<BookmarkNode[]> {
  const count = getSetting('numberTop');
  const sites = await getTopSites();
  return sites.slice(0, count).map((site): BookmarkNode => makeNode(`top.${site.url}`, site.title || '', site.url));
}

/** Recent Bookmarks */
async function getRecentNodes(): Promise<BookmarkNode[]> {
  const count = getSetting('numberRecent');
  const bookmarks = await getRecentBookmarks(count);
  return bookmarks.map((bm): BookmarkNode => makeNode(bm.id, bm.title || '', bm.url));
}

/** Recently Closed */
async function getClosedNodes(): Promise<BookmarkNode[]> {
  const maxResults = getSetting('numberClosed');
  const sessions = await getRecentlyClosed(maxResults);
  const nodes: BookmarkNode[] = [];

  for (const session of sessions) {
    if (session.window && session.window.tabs && session.window.tabs.length === 1) {
      const tab = session.window.tabs[0]!;
      nodes.push(makeNode(
        `closed.${tab.sessionId ?? tab.url}`, tab.title ?? '', tab.url,
        { className: 'window', action: () => { if (tab.sessionId) restoreSession(tab.sessionId); return false; } },
      ));
    } else if (session.tab) {
      const sTab = session.tab;
      nodes.push(makeNode(
        `closed.${sTab.sessionId ?? sTab.url}`, sTab.title ?? '', sTab.url,
        { action: () => { if (sTab.sessionId) restoreSession(sTab.sessionId); return false; } },
      ));
    } else if (session.window && session.window.tabs && session.window.tabs.length > 1) {
      const win = session.window;
      const tabCount = win.tabs?.length ?? 0;
      nodes.push(makeNode(
        `closed.${win.sessionId}`, `${tabCount} Tabs`, undefined,
        { className: 'window', action: () => { if (win.sessionId) restoreSession(win.sessionId); return false; } },
      ));
    }
  }

  return nodes.slice(0, maxResults);
}

/** Other Devices */
async function getDevicesNodes(): Promise<BookmarkNode[]> {
  // v0.2.94: the v0.2.x code read `getSetting('numberClosed')` here,
  // which is the "最近关闭数量" setting — a copy/paste leftover that
  // silently controlled how many devices this folder showed. There
  // is no `numberDevices` setting in the UI, so hardcode 10 to match
  // the other count defaults (`numberTop` / `numberRecent` /
  // `numberClosed` all default to 10). If a future feature wants to
  // expose a `numberDevices` slider, wire it here.
  const maxResults = 10;
  const devices = await getDevices(maxResults);
  const nodes: BookmarkNode[] = [];

  for (const device of devices) {
    const children: BookmarkNode[] = [];
    for (const session of device.sessions) {
      const tabs = session.window?.tabs ?? (session.tab ? [session.tab] : []);
      for (const tab of tabs) {
        children.push(makeNode(`device.${tab.url}`, tab.title ?? '', tab.url));
      }
    }
    nodes.push({
      id: `device.${device.deviceName}`,
      title: device.deviceName,
      children,
    });
  }

  return nodes;
}
