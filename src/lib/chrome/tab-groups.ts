// Typed wrappers for chrome.tabGroups API

export type TabGroupColor = 'blue' | 'cyan' | 'green' | 'grey' | 'orange' | 'pink' | 'purple' | 'red' | 'yellow';

export async function groupTabs(tabIds: [number, ...number[]], options?: { title?: string; color?: TabGroupColor }): Promise<number> {
  return chrome.tabs.group({ tabIds, ...options });
}

export async function updateGroup(groupId: number, options: { title?: string; color?: TabGroupColor }): Promise<chrome.tabGroups.TabGroup | undefined> {
  return chrome.tabGroups.update(groupId, options);
}
