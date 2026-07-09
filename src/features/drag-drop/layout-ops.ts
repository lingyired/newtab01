// Layout operations — column/row manipulation for the bookmark layout
// Manages the columns array, coords map, and persistence

import type { Columns, CoordMap } from '../bookmarks/types';
import { getLocal, setLocal } from '../../lib/storage';
import { isSpecialVisible } from '../bookmarks/special-folders';
import { renderColumns } from '../bookmarks/board';
import { markFoldersExpandedOnce } from '../bookmarks/folder';
import { recordMovedOutForIds, unmarkMovedOut, SPECIAL_IDS as MOVED_OUT_SPECIAL_IDS, DEFAULT_ROOT_IDS } from '../bookmarks/moved-out';
import { getBookmark } from '../../lib/chrome/bookmarks';
import * as debug from '../../lib/debug';

const LAYOUT_KEY = 'layout';

/** Special folder IDs */
const SPECIAL_IDS = ['apps', 'top', 'recent', 'closed', 'devices'];

// SHOW_KEY_MAP and isSpecialVisible were moved to
// `../bookmarks/special-folders.ts` in v0.2.94 so board.ts can use
// them without creating a layout-ops → board import cycle.

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

  // v1.2.8: call the empty-preserving variant of verifyColumns.
  // The full `verifyColumns` sweeps non-col-0 empty columns — which
  // is correct for drag-drop mutations (an empty col is a stale
  // artefact) but wrong for the load path. The v1.2.6 context-menu
  // `swapColumns` deliberately bypasses `verifyColumns` and writes
  // a layout like `[['1'], [], ['2', ...]]` straight to storage;
  // a naive load would call the full `verifyColumns` and delete
  // that vacated col 1 on every page refresh, regressing the
  // v1.2.2/v1.2.3 empty-column compatibility. The lightweight
  // variant below does the missing-root check + coords rebuild
  // (the two pieces a swap can never invalidate) and leaves the
  // user-driven empty columns alone.
  verifyLayoutPreservingEmpties();

  // v1.2.2: on first sight of a layout that contains the bookmark
  //  bar (col 1+), default-expand it so the user can see its
  //  contents immediately. The trigger is the **absence** of
  //  `open.bar.1`, not the absence of a stored layout — that way
  //  BOTH fresh installs (no stored layout) AND users upgrading
  //  from 1.2.1 (stored layout exists but `open.bar.1` was never
  //  written, because 1.2.1 used the wrong key `open.col.1` for
  //  the bar) get the same onboarding behaviour. Once the user
  //  manually toggles the bar (open or closed), `open.bar.1` is
  //  written by the folder toggle handler and the gating key
  //  check skips the auto-expand on every subsequent page load.
  //  Mirrors the import flow in settings-panel.ts:2633-2638.
  //
  //  Storage key MUST be `open.bar.1` (not `open.col.1`): when
  //  the bookmark bar lives in its own column, `column.ts:47`
  //  sets `inBookmarkBarContext = ids.includes('1')` and the
  //  open-state key resolves through `openKey()` to
  //  `open.bar.${id}`. Writing `open.col.1` would be a no-op
  //  for the bookmark bar — the user's `rememberOpen`-gated
  //  read would see the missing key and return false. The
  //  one-shot override above still covers the very first
  //  render (since the override is consulted before the
  //  storage read in `checkOpenState`), but the persistent
  //  write needs the right key for the next refresh.
  if (columns.some((col) => col.includes('1'))) {
    const existing = await getLocal<boolean>('open.bar.1');
    if (existing === undefined) {
      markFoldersExpandedOnce(['1']);
      void setLocal('open.bar.1', true);
    }
  }

  debug.log('layout', 'loadLayout', { fromStorage: stored ? stored.length : 0, columns: columns.map(c => c.length) });
}

/** Save current layout to storage and re-render */
export async function saveLayout(): Promise<void> {
  verifyColumns();
  await setLocal(LAYOUT_KEY, columns);
  debug.log('layout', 'saveLayout', { columns: columns.map(c => c.length), total: columns.reduce((s, c) => s + c.length, 0) });
  await renderColumns();
}

/** Verify and fix column layout — ensure root folders are included.
 *  v1.2.8: also sweeps non-col-0 empty columns (preserves col 0 as
 *  the v1.2.2 fresh-install placeholder). This sweep is correct
 *  for drag-drop mutations: the `addColumn` / `addRow` /
 *  `removeRow` cleanup loops already use the same `x !== 0`
 *  exemption, so all four sites agree on "an empty col is stale
 *  except for col 0". The load path (`loadLayout`) does NOT use
 *  this function — it calls `verifyLayoutPreservingEmpties` —
 *  because user-driven empties (e.g. v1.2.6's `swapColumns`
 *  leaving a vacated col 1) must survive a page refresh. */
export function verifyColumns(): void {
  // v1.2.2: 3-column fresh-install layout.
  //   col 0: empty placeholder (teaches the user "drop folders here")
  //   col 1: bookmark bar (id='1') — auto-expanded on first render + persisted
  //   col 2: other bookmarks (id='2') + 5 special folders
  // Only triggers when `columns.length === 0`, i.e. no stored layout
  // (= new install or layout was reset by the user). Existing users
  // with a stored layout skip this branch entirely. `isSpecialVisible`
  // filters by the user's `show*` settings, so a user with
  // `showBar=0` ends up with a second empty column (the bookmark bar
  // is hidden), and `showXxx=0` removes the matching special from
  // col 2. The post-loop "missing root" sweep has nothing to do
  // because '1' and '2' are now explicitly placed in col 1 and col 2.
  if (columns.length === 0) {
    columns.push([]);                                                // col 0: empty (drop target)
    columns.push(['1'].filter((id) => isSpecialVisible(id)));        // col 1: bookmark bar
    const thirdCol = ['2', ...SPECIAL_IDS].filter((id) => isSpecialVisible(id));
    columns.push(thirdCol);                                          // col 2: other + specials
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
    // Remove empty columns (keep at least 1) — BUT v1.2.2: exempt
    // col 0. The first column is the intentional "drop a folder
    // here" placeholder slot created by the fresh-install default
    // branch. Removing it would (a) drop the v1.2.2 onboarding
    // hint on first launch, AND (b) shift all subsequent
    // columns down by one — which breaks `loadLayout`'s
    // `columns[1]?.includes('1')` check that auto-expands the
    // bookmark bar. Other empty columns (x > 0) are still
    // auto-removed, preserving the v0.x cleanup behaviour.
    if (col.length === 0 && columns.length > 1 && x !== 0) {
      columns.splice(x, 1);
      x--;
    }
  }
}

/** Verify and fix column layout on load — same as verifyColumns
 *  but preserves user-driven empty columns. v1.2.8 split:
 *  drag-drop mutations (`saveLayout`) still use the full
 *  `verifyColumns` because a drop that empties a column always
 *  produces a stale col that should be swept; the load path
 *  (`loadLayout`) uses this variant because the persisted
 *  layout may legitimately contain a user-driven empty col
 *  (e.g. the v1.2.6 `swapColumns` "Move left" on the bookmark
 *  bar leaves col 1 empty by design — the bookmark bar
 *  swaps into col 0's slot and col 1 becomes the new
 *  "drop a folder here" placeholder). A full verifyColumns
 *  on every load would delete that col on every refresh.
 *  The two pieces of `verifyColumns` we still need here are
 *  the fresh-install branch (no stored layout → build the
 *  v1.2.2 3-col default) and the missing-root check
 *  (a load may run before the user has finished dragging
 *  all root ids into the board, though `rootIds` is normally
 *  set in `main.ts` BEFORE `loadLayout` runs — still
 *  defensive). The empty-column cleanup loop is the part
 *  that was hurting us and is intentionally omitted. */
export function verifyLayoutPreservingEmpties(): void {
  // v1.2.2: 3-column fresh-install layout. Same shape as the
  // branch inside `verifyColumns` — only fires when storage
  // returned no layout (new install or user reset).
  if (columns.length === 0) {
    columns.push([]);                                                // col 0: empty (drop target)
    columns.push(['1'].filter((id) => isSpecialVisible(id)));        // col 1: bookmark bar
    const thirdCol = ['2', ...SPECIAL_IDS].filter((id) => isSpecialVisible(id));
    columns.push(thirdCol);                                          // col 2: other + specials
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

  // Rebuild coordinate map — same as verifyColumns.
  // Intentionally NOT sweeping empty columns here (see
  // function doc comment for the v1.2.8 rationale).
  coords = {};
  for (let x = 0; x < columns.length; x++) {
    const col = columns[x];
    if (!col) continue;
    for (let y = 0; y < col.length; y++) {
      const id = col[y];
      if (id === undefined) continue;
      coords[id] = { x, y };
    }
  }
}

/** Add a new column at the given index with the given IDs.
 *  v1.2.6: empty `ids` is a no-op. The only legitimate empty-id
 *  caller is the context-menu "Move column left/right" on an
 *  empty column (v1.2.2 onboarding placeholder) — moving an
 *  empty column would just insert a new empty column somewhere,
 *  which is invisible to the user but still produced a
 *  `withUndo` history step. Returning here means no
 *  `setLocal` / `saveLayout` / `recordMovedOutForIds` side
 *  effects, so the empty-column move becomes a true no-op.
 *  The matching `withUndo` change in context-menu.ts adds an
 *  `isLayoutUnchanged` check so a no-op mutation also skips
 *  the undo snapshot. */
export async function addColumn(ids: string[], index?: number): Promise<void> {
  if (ids.length === 0) {
    debug.log('layout', 'addColumn: skipped, empty ids (no-op)');
    return;
  }
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
    // Remove empty columns. v1.2.4: keep col 0 — the intentional
    // fresh-install "drop a folder here" placeholder. The v1.2.2
    // `verifyColumns` fix and the v1.2.3 `removeRow` fix both
    // carried this exemption, but the same cleanup loop in
    // `addColumn` (and `addRow` until v1.2.4) was missed. Without
    // this guard, a column-structure drop that lands between two
    // non-col-0 columns swept col 0 away — the user saw 3 cols
    // with the empty placeholder gone AND the new col pushed to
    // the end of the row. Repro: drag a bookmark-bar folder
    // between col 1 (bookmark bar) and col 2 (specials) under the
    // v1.2.2 default 3-col layout; observed `[['1'], ['2', ...],
    // [folderX]]` instead of the expected `[[], ['1'], [folderX],
    // ['2', ...]]`.
    if (columns[x]!.length === 0 && columns.length > 1 && x !== 0) {
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

/** Remove a column at the given index.
 *  v1.2.6: refuse `index === 0` so the v1.2.2 fresh-install
 *  col 0 placeholder cannot be removed via the column context
 *  menu. The empty col 0 is the intentional onboarding hint
 *  "drop a folder here" — removing it would silently break
 *  the v1.2.2 default layout promise AND shift all other
 *  columns down by one (which then breaks the bookmark bar
 *  auto-expand gate `columns[1]?.includes('1')` in
 *  `loadLayout`). Previously `removeColumn(0)` would just
 *  `splice(0, 1)` and the empty placeholder vanished, leaving
 *  the user without an obvious way to bring it back short of
 *  a "reset layout" action. */
export async function removeColumn(index: number): Promise<void> {
  if (index === 0) {
    debug.warn('layout', 'removeColumn: refused, col 0 is the intentional placeholder', { index });
    return;
  }
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
    // Remove empty columns. v1.2.3: keep col 0 — the intentional
    // fresh-install "drop a folder here" placeholder. v1.2.2's
    // verifyColumns fix added this exemption but missed the same
    // loop here in addRow — dragging a folder into the empty col 0
    // tripped the cleanup, deleted col 0, decremented xPos to -1,
    // and crashed on `columns[xPos].splice(...)`. Without this
    // guard, every drag whose target is the empty col 0 fails.
    if (columns[x]!.length === 0 && columns.length > 1 && x !== 0) {
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

  if (columns[xPos]!.length === 0 && columns.length > 1 && xPos !== 0) {
    columns.splice(xPos, 1);
  }

  await restoreMovedOutForRemovedId(removedId);
  await saveLayout();
}

/** Swap two columns in place. v1.2.6: helper for the context-menu
 *  "Move column left" item. `addColumn` can't do a true swap
 *  because it removes ids from the source first, leaving the
 *  source empty, and then `verifyColumns` deletes that empty
 *  source — net effect on the v1.2.2 default 3-col layout: a
 *  single-id col 1 moving left collapses 3 → 2 cols and the
 *  empty col 0 placeholder vanishes. A direct swap keeps all
 *  three columns, with col 0 still empty and the moved column
 *  taking the previous slot. Drag-drop column-structure drops
 *  still use `addColumn` — those are "create a new column at
 *  X", not "swap with X", and are unaffected.
 *
 *  v1.2.6.1: bypass `saveLayout` / `verifyColumns`. The first
 *  iteration just did `await saveLayout()` after the swap, but
 *  `verifyColumns`'s empty-column cleanup unconditionally
 *  removes any non-col-0 empty column — including the one we
 *  just vacated — collapsing 3 → 2 cols and bringing back the
 *  original "空列消失" bug. The vacated col is now the
 *  v1.2.2 onboarding placeholder equivalent (it sits where
 *  col 0 used to be and prompts the user to drop a folder
 *  there). Rebuild the `coords` map in-place (the only piece
 *  of `verifyColumns` we need) and persist + re-render
 *  directly. The `missing root` check inside `verifyColumns`
 *  is intentionally skipped — a swap never changes the set of
 *  root ids present, so there's nothing to repair.
 *
 *  v1.2.10: the in-place persist+rebuild pattern is now
 *  factored out into `persistAndRenderColumns()` so the undo
 *  path (which restores a snapshot that may itself be a
 *  swap result, i.e. may contain a non-col-0 empty column)
 *  can use the same bypass-verifyColumns flow. The undo path
 *  previously went through `saveLayout()` → `verifyColumns()`
 *  → empty-column sweep, which deleted a non-col-0 empty col
 *  that the swap had just produced — undo erased the swap. */
export async function swapColumns(a: number, b: number): Promise<void> {
  if (a < 0 || b < 0 || a >= columns.length || b >= columns.length) {
    debug.warn('layout', 'swapColumns: out of bounds', { a, b, len: columns.length });
    return;
  }
  if (a === b) return;
  const temp = columns[a]!;
  columns[a] = columns[b]!;
  columns[b] = temp;
  debug.log('layout', 'swapColumns', { a, b, after: columns.map(c => [...c]) });
  await persistAndRenderColumns();
}

/** Persist the current `columns` + re-render — bypassing
 *  `verifyColumns`. Used by code paths that produce
 *  user-driven non-col-0 empty columns (v1.2.6 `swapColumns`,
 *  v1.2.10 undo) and need those empties to survive both the
 *  in-memory write AND the next `loadLayout()` (which uses
 *  `verifyLayoutPreservingEmpties` for the same reason).
 *
 *  Performs three things — exactly the three pieces of
 *  `saveLayout` / `verifyColumns` that DON'T touch empty-column
 *  cleanup:
 *    1. Rebuild the `coords` map from the current `columns`.
 *       This is the only piece of `verifyColumns` the swap /
 *       undo paths need: a swap can't add/remove root ids, and
 *       an undo restores a snapshot that was itself valid at
 *       capture time (the empty-col cleanup was just the bug).
 *    2. `setLocal(LAYOUT_KEY, columns)` — persist the new
 *       layout. `loadLayout` (next page load) will then read
 *       it and run `verifyLayoutPreservingEmpties`, which
 *       leaves the empty col alone.
 *    3. `renderColumns()` — repaint the board.
 *
 *  Intentionally does NOT call the missing-root check: a
 *  swap / undo can't change which root ids are present (they
 *  only rearrange), so the sweep would be a no-op anyway. The
 *  cost of skipping it is one fewer loop over `rootIds`. */
export async function persistAndRenderColumns(): Promise<void> {
  coords = {};
  for (let x = 0; x < columns.length; x++) {
    const col = columns[x]!;
    for (let y = 0; y < col.length; y++) {
      const id = col[y]!;
      coords[id] = { x, y };
    }
  }
  await setLocal(LAYOUT_KEY, columns);
  await renderColumns();
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
