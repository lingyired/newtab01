// Persistent storage for per-folder tab group state.
//
// When the user opens a bookmark folder as a Chrome tab group and then
// edits the group's color or title in the browser, we want to remember
// that customization. The next time the same folder is opened as a
// group, the saved color + title is re-applied.
//
// Two storage buckets in chrome.storage.local (no cross-device sync —
// tab group appearance is per-installation):
//   - tabGroupState: Record<folderId, { color?, title? }>
//       Last user-set (or default-applied) state for each folder.
//   - tabGroupFolderMap: Record<groupId, folderId>
//       Active tab groups we created. Lives only while the group is
//       alive in the browser; cleaned up on chrome.tabGroups.onRemoved.
//       Persists across SW restarts (SW can be killed mid-session).

import type { TabGroupColor } from '../../lib/chrome/tab-groups';
import { getLocal, setLocal } from '../../lib/storage';

const STATE_KEY = 'tabGroupState';
const MAP_KEY = 'tabGroupFolderMap';

export interface TabGroupSavedState {
  color?: TabGroupColor;
  title?: string;
}

export async function getSavedTabGroupState(folderId: string): Promise<TabGroupSavedState | undefined> {
  const map = (await getLocal<Record<string, TabGroupSavedState>>(STATE_KEY)) ?? {};
  return map[folderId];
}

export async function setSavedTabGroupState(folderId: string, state: TabGroupSavedState): Promise<void> {
  const map = (await getLocal<Record<string, TabGroupSavedState>>(STATE_KEY)) ?? {};
  map[folderId] = state;
  await setLocal(STATE_KEY, map);
}

export async function getGroupFolderMap(): Promise<Record<number, string>> {
  return (await getLocal<Record<number, string>>(MAP_KEY)) ?? {};
}

export async function setGroupFolderMapEntry(groupId: number, folderId: string): Promise<void> {
  const map = await getGroupFolderMap();
  map[groupId] = folderId;
  await setLocal(MAP_KEY, map);
}

export async function removeGroupFolderMapEntry(groupId: number): Promise<void> {
  const map = await getGroupFolderMap();
  delete map[groupId];
  await setLocal(MAP_KEY, map);
}
