import Fuse from 'fuse.js';

export interface SearchItem {
  id: string;
  title: string;
  url: string;
  type: 'bookmark';
}

export function createSearchEngine(items: SearchItem[]): Fuse<SearchItem> {
  return new Fuse(items, {
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'url', weight: 0.3 },
    ],
    threshold: 0.4,
    includeScore: true,
  });
}

export function search(engine: Fuse<SearchItem>, query: string): SearchItem[] {
  if (!query.trim()) return [];
  return engine.search(query).map(result => result.item);
}
