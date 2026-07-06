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
      // v1.1.7: check `chrome.runtime.lastError` so Chrome's "Unchecked
      //  runtime.lastError" console warning does not fire when the id
      //  has been deleted from Chrome bookmarks (or the bookmarks
      //  permission was revoked). The previous code just resolved with
      //  `undefined` and left lastError dangling — Chrome then surfaces
      //  the warning to the user in edge://newtab/ and chrome://newtab/
      //  devtools. Resolving to `undefined` here is the right semantic:
      //  the caller treats it as "id not found" (e.g. resolveNode in
      //  column.ts returns null, the column falls through to the
      //  v1.1.4 empty-column placeholder).
      if (chrome.runtime.lastError) {
        resolve(undefined);
        return;
      }
      resolve(results && results[0] ? results[0] : undefined);
    });
  });
}

/** Get multiple bookmark nodes by id. Order matches the input; missing
 *  ids return as undefined slots. Used by the import-layout filter
 *  (settings-panel.ts) to batch-validate every imported column id
 *  against the current Chrome bookmark tree in a single round-trip. */
export function getBookmarks(
  ids: string[],
): Promise<Array<chrome.bookmarks.BookmarkTreeNode | undefined>> {
  return new Promise((resolve) => {
    if (ids.length === 0) {
      resolve([]);
      return;
    }
    // `chrome.bookmarks.get`'s TS signature is
    //  `string | [string, ...string[]]` — Chrome itself accepts any
    //  string[] at runtime, but the type narrowing makes the cast
    //  necessary. We already handled the empty case above so the
    //  tuple shape is satisfied.
    chrome.bookmarks.get(ids as [string, ...string[]], (results) => {
      if (chrome.runtime.lastError) {
        // Treat the whole lookup as missing on a callback error
        // (e.g. the user revoked the bookmarks permission). The
        // import filter will then drop every non-special id, which
        // is the conservative correct behaviour — better to fail
        // closed than to accept ids we couldn't verify.
        resolve(ids.map(() => undefined));
        return;
      }
      const out: Array<chrome.bookmarks.BookmarkTreeNode | undefined> = [];
      for (let i = 0; i < ids.length; i++) {
        // Chrome returns results in the same order as the input
        // ids (per the API contract) when all ids resolve; missing
        // ids are simply absent from the array. We pad with
        // undefined to keep the caller's index arithmetic simple.
        out[i] = results?.[i];
      }
      resolve(out);
    });
  });
}

/** Get sub-tree for a specific bookmark ID */
export function getBookmarkSubTree(id: string): Promise<chrome.bookmarks.BookmarkTreeNode[] | undefined> {
  return new Promise((resolve) => {
    chrome.bookmarks.getSubTree(id, (result) => {
      // v1.1.7: same lastError guard as getBookmark above.
      //  getSubTree is called from resolveNode in column.ts:221
      //  for every column id on every re-render. When the user
      //  deletes a folder from Chrome bookmarks, the id stays
      //  in the layout (verifyColumns doesn't auto-clean — see
      //  board.ts comments), so the next re-render hits
      //  getSubTree with a now-missing id. Chrome returns
      //  undefined and sets lastError; the wrapper used to
      //  forward the undefined but leave lastError dangling,
      //  which Chrome surfaces as the "Unchecked
      //  runtime.lastError: Can't find bookmark for id."
      //  warning the user reported. resolveNode already
      //  handles the undefined result correctly (returns
      //  null → renderColumn falls through to the empty-
      //  column placeholder).
      if (chrome.runtime.lastError) {
        resolve(undefined);
        return;
      }
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
