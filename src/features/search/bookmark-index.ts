import { getBookmarkTree, onBookmarkChanged, onBookmarkCreated, onBookmarkRemoved } from '../../lib/chrome/bookmarks';
import type { SearchItem } from './search-engine';
import * as debug from '../../lib/debug';

let cachedItems: SearchItem[] | null = null;
let rebuildTimer: ReturnType<typeof setTimeout> | null = null;

function flattenBookmarkTree(nodes: chrome.bookmarks.BookmarkTreeNode[]): SearchItem[] {
  const items: SearchItem[] = [];

  function walk(node: chrome.bookmarks.BookmarkTreeNode): void {
    if (node.url) {
      items.push({
        id: node.id,
        title: node.title || '',
        url: node.url,
        type: 'bookmark',
      });
    }
    if (node.children) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const node of nodes) {
    walk(node);
  }
  return items;
}

export async function buildIndex(): Promise<SearchItem[]> {
  const tree = await getBookmarkTree();
  cachedItems = flattenBookmarkTree(tree);
  debug.log('index', 'buildIndex', { count: cachedItems.length });
  return cachedItems;
}

export function getCachedItems(): SearchItem[] | null {
  return cachedItems;
}

export async function rebuildIndex(): Promise<void> {
  debug.log('index', 'rebuildIndex');
  cachedItems = null;
  await buildIndex();
}

function scheduleRebuild(): void {
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    debug.log('index', 'scheduleRebuild: fired');
    void rebuildIndex();
  }, 300);
}

export function watchBookmarkChanges(): void {
  onBookmarkChanged((id, changeInfo) => {
    debug.log('index', 'bookmark changed', { id, changeInfo });
    scheduleRebuild();
  });
  onBookmarkCreated((id, node) => {
    debug.log('index', 'bookmark created', { id, title: node.title });
    scheduleRebuild();
  });
  onBookmarkRemoved((id, removeInfo) => {
    debug.log('index', 'bookmark removed', { id, removeInfo });
    scheduleRebuild();
  });
}
