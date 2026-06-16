// Chrome API wrappers for bookmarks, topSites, sessions, management
// All chrome.* calls go through this module

export type { BookmarkNode } from '../../features/bookmarks/types';
import type { BookmarkNode } from '../../features/bookmarks/types';

/** Get the full bookmark tree */
export function getBookmarkTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return chrome.bookmarks.getTree();
}

/** Get a single bookmark node by id. Returns undefined if not found. */
export function getBookmark(id: string): Promise<chrome.bookmarks.BookmarkTreeNode | undefined> {
  return new Promise((resolve) => {
    chrome.bookmarks.get(id, (results) => {
      resolve(results && results[0] ? results[0] : undefined);
    });
  });
}

/** Get sub-tree for a specific bookmark ID */
export function getBookmarkSubTree(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[] | undefined> {
  return new Promise((resolve) => {
    chrome.bookmarks.getSubTree(id, (result) => {
      resolve(result ?? undefined);
    });
  });
}

/** Get recent bookmarks */
export function getRecentBookmarks(count: number): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  return new Promise((resolve) => {
    chrome.bookmarks.getRecent(count, resolve);
  });
}

/** Get top sites */
export function getTopSites(): Promise<chrome.topSites.MostVisitedURL[]> {
  return new Promise((resolve) => {
    if (chrome.topSites) {
      chrome.topSites.get(resolve);
    } else {
      resolve([]);
    }
  });
}

/** Get recently closed sessions */
export function getRecentlyClosed(maxResults: number): Promise<chrome.sessions.Session[]> {
  return new Promise((resolve) => {
    if (chrome.sessions) {
      chrome.sessions.getRecentlyClosed({ maxResults }, resolve);
    } else {
      resolve([]);
    }
  });
}

/** Get devices with open tabs */
export function getDevices(maxResults: number): Promise<chrome.sessions.Device[]> {
  return new Promise((resolve) => {
    if (chrome.sessions) {
      chrome.sessions.getDevices({ maxResults }, resolve);
    } else {
      resolve([]);
    }
  });
}

/** Get all installed apps */
export function getInstalledApps(): Promise<chrome.management.ExtensionInfo[]> {
  return new Promise((resolve) => {
    if (chrome.management) {
      chrome.management.getAll((extensions) => {
        resolve(extensions.filter((ext) => ext.type === 'hosted_app' || ext.type === 'legacy_packaged_app'));
      });
    } else {
      resolve([]);
    }
  });
}

/** Get current tab info */
export function getCurrentTab(): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.getCurrent((tab) => {
      resolve(tab ?? undefined);
    });
  });
}

/** Open URL in new tab */
export function createTab(url: string, active: boolean, openerTabId?: number): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve) => {
    const options: chrome.tabs.CreateProperties = { url, active };
    if (openerTabId !== undefined) {
      options.openerTabId = openerTabId;
    }
    chrome.tabs.create(options, (tab) => {
      resolve(tab ?? undefined);
    });
  });
}

/**
 * Search the user's default search engine in the current tab.
 * Requires the "search" permission. Falls back to a Google search URL if
 * the API is unavailable (e.g. permission denied at runtime).
 */
export function searchInCurrentTab(query: string): Promise<void> {
  return new Promise((resolve) => {
    if (chrome.search?.query) {
      try {
        chrome.search.query(
          { text: query, disposition: 'CURRENT_TAB' },
          () => resolve(),
        );
        return;
      } catch {
        // fall through to fallback
      }
    }
    const fallback = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    void navigateCurrentTab(fallback).then(resolve);
  });
}

/** Navigate the current tab to the given URL. */
export function navigateCurrentTab(url: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.getCurrent((tab) => {
      if (tab?.id !== undefined) {
        chrome.tabs.update(tab.id, { url }, () => resolve());
      } else {
        resolve();
      }
    });
  });
}

/** Update current tab URL */
export function updateTab(tabId: number, url: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.tabs.update(tabId, { url }, () => {
      resolve();
    });
  });
}

/** Create a Chrome tab group */
export function createTabGroup(tabIds: number[], title?: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    if (chrome.tabGroups) {
      const nonEmptyTabIds: [number, ...number[]] = [tabIds[0]!, ...tabIds.slice(1)];
      chrome.tabs.group({ tabIds: nonEmptyTabIds }, (groupId) => {
        if (title) {
          chrome.tabGroups.update(groupId, { title }, () => {
            resolve(groupId);
          });
        } else {
          resolve(groupId);
        }
      });
    } else {
      resolve(undefined);
    }
  });
}

/** Restore a recently closed session */
export function restoreSession(sessionId: string): Promise<chrome.sessions.Session | undefined> {
  return new Promise((resolve) => {
    if (chrome.sessions) {
      chrome.sessions.restore(sessionId, (session) => {
        resolve(session ?? undefined);
      });
    } else {
      resolve(undefined);
    }
  });
}

/** Listen for bookmark changes */
export function onBookmarkChanged(
  callback: (id: string, changeInfo: { title: string; url?: string }) => void,
): void {
  chrome.bookmarks.onChanged.addListener(callback);
}

/** Listen for bookmark creation */
export function onBookmarkCreated(
  callback: (id: string, bookmark: chrome.bookmarks.BookmarkTreeNode) => void,
): void {
  chrome.bookmarks.onCreated.addListener(callback);
}

/** Listen for bookmark removal */
export function onBookmarkRemoved(
  callback: (
    id: string,
    removeInfo: { parentId: string; index: number; node: chrome.bookmarks.BookmarkTreeNode },
  ) => void,
): void {
  chrome.bookmarks.onRemoved.addListener(callback);
}

/** Convert chrome.bookmarks.BookmarkTreeNode to our BookmarkNode */
export function chromeBookmarkToNode(node: chrome.bookmarks.BookmarkTreeNode): BookmarkNode {
  const result: BookmarkNode = {
    id: node.id,
    title: node.title || '',
  };
  if (node.url) {
    result.url = node.url;
  }
  if (node.children) {
    result.children = node.children
      .filter((child) => child.title !== '' || child.url !== undefined || child.children !== undefined)
      .map(chromeBookmarkToNode);
  }
  return result;
}
