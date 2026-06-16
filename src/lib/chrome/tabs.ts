// Chrome API wrappers for tabs

export interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
}

export async function getAllTabs(): Promise<TabInfo[]> {
  const tabs = await chrome.tabs.query({});
  return tabs
    .filter((tab): tab is chrome.tabs.Tab & { url: string } => typeof tab.url === 'string')
    .map((tab) => ({
      id: tab.id!,
      title: tab.title ?? '',
      url: tab.url,
      ...(tab.favIconUrl ? { favIconUrl: tab.favIconUrl } : {}),
    }));
}

/** Remove a tab by ID */
export async function removeTab(tabId: number): Promise<void> {
  return chrome.tabs.remove(tabId);
}
