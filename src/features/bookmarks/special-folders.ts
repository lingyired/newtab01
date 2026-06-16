// Special folders — topSites, recent, closed, devices, apps
// Each returns BookmarkNode[] for rendering

import type { BookmarkNode } from './types';
import { getSetting } from '../../lib/storage/settings';
import {
  getTopSites,
  getRecentBookmarks,
  getRecentlyClosed,
  getDevices,
  getInstalledApps,
  restoreSession,
} from '../../lib/chrome/bookmarks';

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
      return { id: 'apps', title: 'Apps', type: 'apps', url: 'chrome://apps' };
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
  const maxResults = getSetting('numberClosed');
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

/** Apps */
export async function getAppsNodes(): Promise<BookmarkNode[]> {
  const apps = await getInstalledApps();
  return apps.map((app): BookmarkNode => {
    const icons = app.icons?.map((i) => ({ url: i.url, size: i.size }));
    return makeNode(
      `app.${app.id}`, app.name, app.appLaunchUrl ?? `chrome://apps`,
      icons && icons.length > 0 ? { icons } : {},
    );
  });
}
