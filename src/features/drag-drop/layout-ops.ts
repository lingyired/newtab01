// Layout operations — column/row manipulation for the bookmark layout
// Manages the columns array, coords map, and persistence

import type { Columns, CoordMap } from '../bookmarks/types';
import type { Settings } from '../bookmarks/types';
import { getLocal, setLocal } from '../../lib/storage';
import { getSetting } from '../../lib/storage/settings';
import { renderColumns } from '../bookmarks/board';
import { recordMovedOutForIds, unmarkMovedOut, SPECIAL_IDS as MOVED_OUT_SPECIAL_IDS, DEFAULT_ROOT_IDS } from '../bookmarks/moved-out';
import { getBookmark } from '../../lib/chrome/bookmarks';
import * as debug from '../../lib/debug';

const LAYOUT_KEY = 'layout';

/** Special folder IDs */
const SPECIAL_IDS = ['apps', 'top', 'recent', 'closed', 'devices'];

/** Map from special folder ID to settings key */
const SHOW_KEY_MAP: Record<string, keyof Settings> = {
  apps: 'showApps',
  top: 'showTop',
  recent: 'showRecent',
  closed: 'showClosed',
  devices: 'showDevices',
};

/** Current column layout */
let columns: Columns = [];

/** Coordinate map for quick lookup */
let coords: CoordMap = {};

/** Root folder IDs (bookmark bar + other + special) */
let rootIds: string[] = [];

/** Get current columns */
export function getColumns(): Columns {
  return columns;
}

/** Get coordinate for a given node ID */
export function getCoords(id: string): { x: number; y: number } | undefined {
  return coords[id];
}

/** Set root IDs (called after bookmark tree is loaded) */
export function setRootIds(ids: string[]): void {
  rootIds = ids;
}

/**
 * Replace the entire column layout with the given snapshot. Used by the
 * undo flow to restore a pre-drop state. Caller is responsible for
 * invoking saveLayout afterwards (which re-runs verifyColumns, rebuilds
 * the coords map, persists to storage, and re-renders the board).
 *
 * The input is taken by reference; the snapshot module already deep-
 * clones before pushing, so we don't clone here.
 */
export function setColumns(next: Columns): void {
  columns = next;
}

/** Load column layout from storage */
export async function loadLayout(): Promise<void> {
  const stored = await getLocal<Columns>(LAYOUT_KEY);
  if (stored && stored.length > 0) {
    columns = stored;
  } else {
    columns = [];
  }

  verifyColumns();
  debug.log('layout', 'loadLayout', { fromStorage: stored ? stored.length : 0, columns: columns.map(c => c.length) });
}

/** Save current layout to storage and re-render */
export async function saveLayout(): Promise<void> {
  verifyColumns();
  await setLocal(LAYOUT_KEY, columns);
  debug.log('layout', 'saveLayout', { columns: columns.map(c => c.length), total: columns.reduce((s, c) => s + c.length, 0) });
  await renderColumns();
}

/** Check if a special folder is visible */
function isSpecialVisible(id: string): boolean {
  const key = SHOW_KEY_MAP[id];
  if (!key) return true;
  try {
    return getSetting(key) !== 0;
  } catch {
    return true;
  }
}

/** Verify and fix column layout — ensure root folders are included */
export function verifyColumns(): void {
  // Default layout if empty
  if (columns.length === 0) {
    columns.push([]);
    const specialVisible = SPECIAL_IDS.filter((id) => isSpecialVisible(id));
    columns.push(specialVisible);
  }

  // Find missing root items
  const missing = rootIds.slice();
  for (let x = 0; x < columns.length; x++) {
    const col = columns[x];
    if (!col) continue;
    for (let y = 0; y < col.length; y++) {
      const id = col[y];
      if (id === undefined) continue;
      const idx = missing.indexOf(id);
      if (idx > -1) {
        missing.splice(idx, 1);
      }
    }
  }

  // Add missing root items to first column
  const firstCol = columns[0]!;
  for (const id of missing) {
    if (isSpecialVisible(id)) {
      firstCol.push(id);
    }
  }

  // Rebuild coordinate map
  coords = {};
  for (let x = 0; x < columns.length; x++) {
    const col = columns[x];
    if (!col) continue;
    for (let y = 0; y < col.length; y++) {
      const id = col[y];
      if (id === undefined) continue;
      coords[id] = { x, y };
    }
    // Remove empty columns (keep at least 1)
    if (col.length === 0 && columns.length > 1) {
      columns.splice(x, 1);
      x--;
    }
  }
}

/** Add a new column at the given index with the given IDs */
export async function addColumn(ids: string[], index?: number): Promise<void> {
  const column = ids.slice();
  debug.log('layout', 'addColumn:start', { ids, index, before: columns.map(c => [...c]) });

  // Remove previous locations of these IDs
  for (let x = 0; x < columns.length; x++) {
    for (let y = 0; y < columns[x]!.length; y++) {
      if (ids.includes(columns[x]![y]!)) {
        columns[x]!.splice(y, 1);
        y--;
      }
    }
    // Remove empty columns
    if (columns[x]!.length === 0 && columns.length > 1) {
      columns.splice(x, 1);
      x--;
    }
  }

  // Insert new column
  const insertIndex = index ?? columns.length;
  columns.splice(Math.min(insertIndex, columns.length), 0, column);

  debug.log('layout', 'addColumn:done', { insertIndex, after: columns.map(c => [...c]) });
  await recordMovedOutForIds(ids);
  await saveLayout();
}

/** Remove a column at the given index */
export async function removeColumn(index: number): Promise<void> {
  if (columns.length <= 1) {
    debug.warn('layout', 'removeColumn: refused, only 1 column left', { index });
    return;
  }
  const removed = columns.splice(index, 1);
  debug.log('layout', 'removeColumn', { index, removed: removed[0] });
  await saveLayout();
}

/** Add a row (move a folder ID to position x, y) */
export async function addRow(id: string, xPos: number, yPos?: number): Promise<void> {
  if (yPos === undefined || yPos === null) {
    yPos = columns[xPos]?.length ?? 0;
  }
  debug.log('layout', 'addRow:start', { id, xPos, yPos, before: columns.map(c => [...c]) });

  // Remove previous location
  for (let x = 0; x < columns.length; x++) {
    const i = columns[x]!.indexOf(id);
    if (i > -1) {
      columns[x]!.splice(i, 1);
      if (x === xPos && yPos > i) {
        yPos--;
      }
    }
    // Remove empty columns (keep at least 1)
    if (columns[x]!.length === 0 && columns.length > 1) {
      columns.splice(x, 1);
      x--;
      if (xPos > x) {
        xPos--;
      }
    }
  }

  // Ensure target column exists
  while (columns.length <= xPos) {
    columns.push([]);
  }

  // Insert at position
  columns[xPos]!.splice(Math.min(yPos, columns[xPos]!.length), 0, id);

  debug.log('layout', 'addRow:done', { xPos, yPos, after: columns.map(c => [...c]) });
  await recordMovedOutForIds([id]);
  await saveLayout();
}

/** Remove a row at the given position */
export async function removeRow(xPos: number, yPos: number): Promise<void> {
  if (!columns[xPos]) {
    debug.warn('layout', 'removeRow: no such column', { xPos, yPos });
    return;
  }
  const removed = columns[xPos]!.splice(yPos, 1);
  const removedId = removed[0];
  debug.log('layout', 'removeRow', { xPos, yPos, removed: removedId });

  if (columns[xPos]!.length === 0 && columns.length > 1) {
    columns.splice(xPos, 1);
  }

  await restoreMovedOutForRemovedId(removedId);
  await saveLayout();
}

async function restoreMovedOutForRemovedId(id: string | undefined): Promise<void> {
  if (!id) return;
  if (MOVED_OUT_SPECIAL_IDS.has(id)) return;
  if (DEFAULT_ROOT_IDS.has(id)) return;
  if (!/^\d+$/.test(id)) return;
  try {
    const node = await getBookmark(id);
    const parentId = node?.parentId;
    if (parentId && parentId !== '0') {
      await unmarkMovedOut(parentId, id);
    }
  } catch (err) {
    console.error('[newtab01] restoreMovedOutForRemovedId failed for', id, err);
  }
}
