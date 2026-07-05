// Drag-drop history — in-memory undo stack for layout mutations.
//
// Captures a snapshot of the column layout AND the moved-out map BEFORE
// each successful mutation, so a single click on the topbar undo button can
// revert it. Used by both the drag-drop handler and the context-menu layout
// actions (remove folder / column, move column, create column).
//
// Design notes:
// - **Memory-only**: state lives in this module's array. Refreshing the
//   newtab page discards history. No chrome.storage writes.
// - **Bounded**: MAX_HISTORY = 10. Oldest entry dropped on overflow.
// - **Single-mutation granularity**: each successful operation pushes one
//   snapshot, regardless of how many folders it touches (single-folder
//   drag = single snapshot, multi-folder column drag = single snapshot,
//   context-menu remove column = single snapshot).
// - **Reactive UI**: `subscribe(listener)` lets the topbar undo button
//   re-render its visibility / count badge whenever the stack changes.

import type { Columns } from '../bookmarks/types';
import type { MovedOutMap } from '../bookmarks/moved-out';
import { getColumns } from './layout-ops';
import { getMovedOut } from '../bookmarks/moved-out';

/** Maximum number of undo snapshots retained. Older entries are dropped. */
export const MAX_HISTORY = 10;

/** A pre-drop snapshot — enough to fully revert one drag operation. */
export interface HistorySnapshot {
  /** Deep clone of `columns` at the moment BEFORE the drop was applied. */
  columns: Columns;
  /**
   * Shallow clone of `movedOut` at the moment BEFORE the drop was applied.
   * Each parent's id array is also cloned so later mutations don't bleed
   * back into the snapshot.
   */
  movedOut: MovedOutMap;
}

/** Snapshot stack — push on drop, pop on undo. Newest at the end. */
const stack: HistorySnapshot[] = [];

/** Listeners notified after every push / pop / clear. */
const listeners = new Set<() => void>();

/** Clone a snapshot (deep clone columns, shallow-with-array-clone movedOut). */
function cloneSnapshot(snapshot: HistorySnapshot): HistorySnapshot {
  return {
    columns: snapshot.columns.map((col) => col.slice()),
    movedOut: cloneMovedOut(snapshot.movedOut),
  };
}

/** Shallow clone a moved-out map, cloning each parent's id array too. */
export function cloneMovedOut(map: MovedOutMap): MovedOutMap {
  const out: MovedOutMap = {};
  for (const [parentId, ids] of Object.entries(map)) {
    out[parentId] = ids.slice();
  }
  return out;
}

/** Push a snapshot onto the stack. Drops the oldest if over MAX_HISTORY. */
export function pushSnapshot(snapshot: HistorySnapshot): void {
  stack.push(cloneSnapshot(snapshot));
  if (stack.length > MAX_HISTORY) {
    stack.shift();
  }
  for (const fn of listeners) {
    fn();
  }
}

/**
 * Check if a snapshot is structurally identical to a given layout
 * state. Used by the drop handler to skip pushing a no-op snapshot
 * — e.g. the user drags a folder back to its original position so
 * the mutation re-renders to the same state. Recording that as an
 * undo step is misleading: pressing undo would be a no-op too, and
 * the undo button's count badge would tick up for nothing.
 *
 * Compares both `columns` (outer length, per-column length, ids
 * in order) and `movedOut` (keys, per-key id arrays in order).
 * Order matters for both — addRow / removeRow rely on the user-
 * perceived order being preserved through the snapshot.
 */
export function isSnapshotEqual(
  snapshot: HistorySnapshot,
  currentColumns: Columns,
  currentMovedOut: MovedOutMap,
): boolean {
  // columns: same outer length, same per-column length, same ids
  //  in the same positions.
  if (snapshot.columns.length !== currentColumns.length) return false;
  for (let i = 0; i < snapshot.columns.length; i++) {
    const a = snapshot.columns[i]!;
    const b = currentColumns[i]!;
    if (a.length !== b.length) return false;
    for (let j = 0; j < a.length; j++) {
      if (a[j] !== b[j]) return false;
    }
  }
  // movedOut: same keys, same id arrays in the same order.
  const snapKeys = Object.keys(snapshot.movedOut);
  const curKeys = Object.keys(currentMovedOut);
  if (snapKeys.length !== curKeys.length) return false;
  for (const key of snapKeys) {
    const a = snapshot.movedOut[key]!;
    const b = currentMovedOut[key];
    if (!b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
  }
  return true;
}

/**
 * Capture a fresh snapshot of the current column layout and moved-out map.
 * Caller is expected to:
 *   1. `const snapshot = await captureSnapshot();`
 *   2. run the layout mutation (addRow / addColumn / removeRow / removeColumn)
 *   3. `pushSnapshot(snapshot)` after the mutation resolves successfully
 *
 * Both fields are cloned (deep clone columns, shallow-with-array-clone
 * movedOut) so later mutations don't bleed back into the captured state.
 * Used by both drag-drop and the context-menu layout operations so a
 * single undo button covers every layout mutation.
 */
export async function captureSnapshot(): Promise<HistorySnapshot> {
  return {
    columns: getColumns().map((col) => col.slice()),
    movedOut: cloneMovedOut(await getMovedOut()),
  };
}

/** Pop the newest snapshot. Returns null if the stack is empty. */
export function popSnapshot(): HistorySnapshot | null {
  const snapshot = stack.pop() ?? null;
  if (snapshot) {
    for (const fn of listeners) {
      fn();
    }
  }
  return snapshot;
}

/** Current number of snapshots on the stack (0..MAX_HISTORY). */
export function getHistoryLength(): number {
  return stack.length;
}

/** Empty the stack. Called on init to guarantee a clean slate per page load. */
export function clearHistory(): void {
  if (stack.length === 0) return;
  stack.length = 0;
  for (const fn of listeners) {
    fn();
  }
}

/** Subscribe to stack mutations. Returns an unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}