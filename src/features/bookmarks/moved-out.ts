// Moved-out tracking — remembers which child folders have been dragged out of
// which parent folders, so the parent's expanded view can hide them.

import type { BookmarkNode } from './types';
import { getLocal, setLocal } from '../../lib/storage';
import { getBookmark } from '../../lib/chrome/bookmarks';

/** Chrome bookmark IDs for the two root folders — never filtered. */
export const DEFAULT_ROOT_IDS: ReadonlySet<string> = new Set(['1', '2']);

/** Special folder IDs — never recorded as moved-out. */
export const SPECIAL_IDS: ReadonlySet<string> = new Set([
  'apps', 'top', 'recent', 'closed', 'devices',
]);

const STORAGE_KEY = 'movedOut';

export type MovedOutMap = Record<string, string[]>;

/** In-memory cache, kept in sync with chrome.storage.local. */
let cache: MovedOutMap | null = null;

/** Load the moved-out map from chrome.storage.local (cached after first load). */
export async function getMovedOut(): Promise<MovedOutMap> {
  if (cache !== null) return cache;
  const stored = await getLocal<MovedOutMap>(STORAGE_KEY);
  cache = stored ?? {};
  return cache;
}

/**
 * Replace the in-memory moved-out cache with the given snapshot. Used
 * by the drag-undo flow to restore the pre-drop visibility map. The
 * input is taken by reference — callers must pass a snapshot that won't
 * be mutated (history.ts already deep-clones on push).
 *
 * Callers are responsible for persisting via setLocal afterwards (the
 * undo handler in undo-button.ts does this).
 */
export function setMovedOutCache(next: MovedOutMap): void {
  cache = next;
}

/** Record that childId was dragged out of parentId. Idempotent. */
export async function markMovedOut(parentId: string, childId: string): Promise<void> {
  if (DEFAULT_ROOT_IDS.has(parentId) || SPECIAL_IDS.has(childId)) return;
  const map = await getMovedOut();
  const list = map[parentId] ?? [];
  if (!list.includes(childId)) {
    list.push(childId);
    map[parentId] = list;
    await setLocal(STORAGE_KEY, map);
  }
}

/** Remove a record. Exposed for future undo / reset flows. */
export async function unmarkMovedOut(parentId: string, childId: string): Promise<void> {
  const map = await getMovedOut();
  const list = map[parentId];
  if (!list) return;
  const idx = list.indexOf(childId);
  if (idx > -1) {
    list.splice(idx, 1);
    if (list.length === 0) {
      delete map[parentId];
    } else {
      map[parentId] = list;
    }
    await setLocal(STORAGE_KEY, map);
  }
}

/**
 * Filter children list for display under parentId.
 * - If parentId is in DEFAULT_ROOT_IDS → return children unchanged.
 * - Otherwise → drop children whose id appears in movedOut[parentId].
 */
export function filterChildren(
  parentId: string,
  children: BookmarkNode[],
  movedOut: MovedOutMap,
  inBookmarkBarContext = false,
): BookmarkNode[] {
  if (inBookmarkBarContext) return children;
  if (DEFAULT_ROOT_IDS.has(parentId)) return children;
  const hidden = movedOut[parentId];
  if (!hidden || hidden.length === 0) return children;
  const hiddenSet = new Set(hidden);
  return children.filter((child) => !hiddenSet.has(child.id));
}

/**
 * Record moved-out entries for a list of dragged folder IDs.
 * Looks up each id's bookmark-tree parent via getBookmark and calls
 * markMovedOut. Skips special folders and root-level folders.
 * Never throws — failures are logged via console.error so layout updates
 * can still proceed even if the lookup fails.
 */
export async function recordMovedOutForIds(ids: string[]): Promise<void> {
  for (const id of ids) {
    if (SPECIAL_IDS.has(id)) continue;
    try {
      const node = await getBookmark(id);
      const parentId = node?.parentId;
      if (!parentId || parentId === '0') continue;
      await markMovedOut(parentId, id);
    } catch (err) {
      console.error('[newtab01] recordMovedOutForIds failed for', id, err);
    }
  }
}
