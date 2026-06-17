import { getBookmarkTree, onBookmarkChanged, onBookmarkCreated, onBookmarkRemoved } from '../../lib/chrome/bookmarks';
import type { SearchItem } from './search-engine';
import * as debug from '../../lib/debug';

const ALARM_NAME = 'bookmark-index-rebuild';

// chrome.alarms minimum granularity is 30 seconds in stable Chrome
// (1 minute in earlier versions). The original setTimeout used 300ms,
// but alarms can't fire that fast. We use 0.5 minutes (30s) as the
// closest semantic match — same fire-once-after-debounce behavior,
// just with a coarser floor. The "alarms" permission is already in
// manifest.json.
const REBUILD_DELAY_MINUTES = 0.5;

let cachedItems: SearchItem[] | null = null;
let alarmListenerWired = false;

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
  // Calling create() with an existing name replaces the previous alarm,
  // so this naturally debounces consecutive bookmark events.
  void chrome.alarms.create(ALARM_NAME, { delayInMinutes: REBUILD_DELAY_MINUTES });
  debug.log('index', 'scheduleRebuild: alarm created', { delayInMinutes: REBUILD_DELAY_MINUTES });
}

function wireAlarmListener(): void {
  if (alarmListenerWired) return;
  alarmListenerWired = true;
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      debug.log('index', 'scheduleRebuild: alarm fired');
      void rebuildIndex();
    }
  });
}

export function watchBookmarkChanges(): void {
  wireAlarmListener();
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
