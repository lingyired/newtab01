// Context menu — dynamic popup menu for folders and columns

import type { MenuItem } from './types';
// addRow is currently only used by the hidden "Move folder" menu items
// (see the /* ... */ block in getFolderMenuItems below). Imported as a
// commented-out slot so re-enabling those items only requires removing
// the /* */ blocks — no extra import edits needed.
// import { getCoords, addRow, addColumn, removeRow, removeColumn, getColumns } from '../drag-drop/layout-ops';
import { getCoords, addColumn, removeRow, removeColumn, getColumns, swapColumns } from '../drag-drop/layout-ops';
import { captureSnapshot, pushSnapshot, isSnapshotEqual } from '../drag-drop/history';
import { openAllLinks } from './folder-actions-handler';
import { createTab } from '../../lib/chrome/bookmarks';
import { getSetting, updateSetting } from '../../lib/storage/settings';
import { t } from '../../lib/i18n';
import { SHOW_KEY_MAP } from './special-folders';
import { renderColumns } from './board';
import { getMovedOut } from './moved-out';

/** Currently active menu element, if any */
let activeMenu: HTMLUListElement | null = null;

/** Right-clicked element to highlight while the menu is open */
let selectedTarget: HTMLElement | null = null;

const isEdge = /Edg\//.test(navigator.userAgent);
const internalScheme = isEdge ? 'edge' : 'chrome';

function openInternalPage(path: string): void {
  void createTab(`${internalScheme}://${path}`, true);
}

/**
 * Wrap a context-menu layout action so the topbar undo button can revert it.
 * Captures a pre-mutation snapshot, awaits the mutation, then pushes the
 * snapshot onto the history stack so a single undo click restores the prior
 * column layout and moved-out visibility.
 *
 * v1.2.6: skip the push when the layout is structurally identical
 * to the snapshot. The v1.2.2 col 0 placeholder opened up a
 * class of "noop" actions: "Move column left/right" on an empty
 * column now short-circuits inside `addColumn` (returns without
 * calling `setLocal` / `saveLayout` / `recordMovedOutForIds`),
 * but `withUndo` was still pushing a snapshot for it. Pushing
 * an empty-mutation snapshot makes the undo badge tick up while
 * pressing undo does nothing — misleading. Compare against the
 * snapshot and bail on equality. The `getMovedOut` round-trip
 * is the same as the drag-drop handler's
 * `isLayoutUnchanged` (history.ts:296) — it lives here instead
 * of in history.ts to keep the local coupling tight, and
 * because this is the only other caller of the pattern.
 */
async function withUndo(action: () => Promise<void> | void): Promise<void> {
  const snapshot = await captureSnapshot();
  await action();
  if (isSnapshotEqual(snapshot, getColumns(), await getMovedOut())) {
    return;
  }
  pushSnapshot(snapshot);
}

/** Render a popup context menu at given coordinates.
 * `target` is the right-clicked element to highlight with `.selected`
 * while the menu is open; class is cleared automatically on close. */
export function renderMenu(
  items: (MenuItem | null)[],
  x: number,
  y: number,
  target?: HTMLElement,
): HTMLUListElement {
  closeMenu();

  if (target) {
    target.classList.add('selected');
    selectedTarget = target;
  }

  const ul = document.createElement('ul');
  ul.classList.add('menu');

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      // Null = separator, skip leading/trailing separators
      if (i > 0 && i < items.length - 1) {
        const li = document.createElement('li');
        li.appendChild(document.createElement('hr'));
        ul.appendChild(li);
      }
      continue;
    }

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = item.label;
    a.tabIndex = 0;
    a.href = '#';
    a.addEventListener('click', (e) => {
      e.preventDefault();
      item.action();
      closeMenu();
    });
    li.appendChild(a);
    ul.appendChild(li);
  }

  document.body.appendChild(ul);

  // Position menu within viewport
  ul.style.left = Math.max(Math.min(x, window.innerWidth + window.scrollX - ul.clientWidth), 0) + 'px';
  ul.style.top = Math.max(Math.min(y, window.innerHeight + window.scrollY - ul.clientHeight), 0) + 'px';

  ul.addEventListener('mousedown', (e) => {
    e.stopPropagation();
  });

  // Close on outside click, mousedown, contextmenu, or ESC
  setTimeout(() => {
    document.addEventListener('click', onDocClick);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('contextmenu', onDocClick);
    document.addEventListener('keydown', onDocKeydown);
  }, 20);

  activeMenu = ul;
  return ul;
}

/** Close the active menu */
export function closeMenu(): void {
  if (activeMenu && activeMenu.parentNode) {
    activeMenu.parentNode.removeChild(activeMenu);
  }
  activeMenu = null;
  if (selectedTarget) {
    selectedTarget.classList.remove('selected');
    selectedTarget = null;
  }
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('mousedown', onDocClick);
  document.removeEventListener('contextmenu', onDocClick);
  document.removeEventListener('keydown', onDocKeydown);
}

function onDocClick(): void {
  closeMenu();
}

function onDocKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    closeMenu();
  }
}

/** Get context menu items for a folder node */
export function getFolderMenuItems(node: { id: string; title?: string }): (MenuItem | null)[] {
  const items: (MenuItem | null)[] = [];

  items.push({
    label: t('contextMenu.openAllInFolder'),
    // Synthesize a left-click MouseEvent (button = 0) so the handler
    // honours the user's `newtab` link setting rather than treating
    // the context-menu click as a middle-click. The event is only
    // inspected for `button` and read-only, so a partial stub is
    // sufficient.
    action: () => openAllLinks(node as any, new MouseEvent('click', { button: 0 })),
  });

  // Special items
  if (node.id === 'closed') {
    items.push({
      label: t('contextMenu.clearBrowsingData'),
      action: () => {
        openInternalPage('settings/clearBrowserData');
      },
    });
  }

  if (node.id === 'devices') {
    items.push({
      label: t('contextMenu.history'),
      action: () => {
        openInternalPage('history');
      },
    });
  }

  // Numeric ID = real bookmark folder
  if (/^\d+$/.test(node.id)) {
    items.push({
      label: t('contextMenu.editBookmarks'),
      action: () => {
        openInternalPage('bookmarks/?id=' + node.id);
      },
    });
  }

  // Layout items — v0.2.93: read `lockColumns` from storage at
  // right-click time. Was hardcoded `false` (a "TODO when integrated"
  // comment), so the menu kept showing "Create new column" / "Remove
  // folder" / "Move column" / "Remove column" even when the user had
  // the "锁定列" toggle on in the settings panel. Reading here (vs at
  // module load) means toggling the setting takes effect on the next
  // right-click without needing a page reload.
  //
  // v1.1.1: the lockColumns gate now only applies to "Create new
  //  column" (which actually adds a new column to the layout).
  //  "Remove from column" (regular folder) is shown regardless of
  //  lockColumns — removing a folder from a column is the inverse of
  //  the "add to column" drag, and locking the lockColumns setting
  //  expresses a desire to prevent column *rearrangement* (add / move
  //  / split), not extraction. The special-folder "Remove" (see
  //  SHOW_KEY_MAP block below) was already unlocked in v1.0.30.
  const lock = Number(getSetting('lockColumns')) !== 0;
  const coords = getCoords(node.id);

  if (!lock) {
    items.push(null); // separator

    items.push({
      label: t('contextMenu.createNewColumn'),
      action: () => withUndo(() => {
        void addColumn([node.id]);
      }),
    });
  }

  if (coords) {
    // Move-folder UX was deemed insufficient — the 4 menu items below
    // (Move folder up / down / left / right) are temporarily hidden
    // while the interaction is redesigned. The layout-ops (addRow /
    // getCoords) code paths remain untouched so they can be re-enabled
    // by removing this comment block.
    /*
    if (coords.y > 0) {
      items.push({
        label: 'Move folder up',
        action: () => {
          addRow(node.id, coords.x, coords.y - 1);
        },
      });
    }
    if (coords.y < columns[coords.x]!.length - 1) {
      items.push({
        label: 'Move folder down',
        action: () => {
          addRow(node.id, coords.x, coords.y + 2);
        },
      });
    }
    if (coords.x > 0) {
      items.push({
        label: 'Move folder left',
        action: () => {
          addRow(node.id, coords.x - 1);
        },
      });
    }
    if (coords.x < columns.length - 1) {
      items.push({
        label: 'Move folder right',
        action: () => {
          addRow(node.id, coords.x + 1);
        },
      });
    }
    */
    // v1.1.2: skip removeRow for folders that are also in
    //  SHOW_KEY_MAP (bookmark bar / other bookmarks). Those folders
    //  also get a "Remove" item from the special-folder branch below
    //  (which toggles a show* setting). Without this guard, the
    //  user would see two items with the same label but different
    //  effects (removeRow = take folder out of column, show*=0 =
    //  hide the entire column). The show* action is the canonical
    //  one for these folders.
    if (!SHOW_KEY_MAP[node.id]) {
      items.push({
        label: t('contextMenu.removeFolder'),
        action: () => withUndo(() => {
          void removeRow(coords.x, coords.y);
        }),
      });
    }
  }

  // v1.0.29: special-folder "Remove" is shown regardless of
  //  lockColumns. The action only flips a `show*` setting — it does
  //  NOT mutate layout, so it does not conflict with the lock
  //  semantic. Before this change, locking the columns hid the
  //  item entirely, forcing users to unlock → right-click → relock
  //  just to hide a special folder.
  if (SHOW_KEY_MAP[node.id]) {
    items.push(null); // separator
    const showKey = SHOW_KEY_MAP[node.id]!;
    items.push({
      label: t('contextMenu.removeFolder'),
      action: () => {
        void updateSetting(showKey, 0).then(() => {
          void renderColumns();
        });
      },
    });
  }

  return items;
}

/** Get context menu items for a column */
export function getColumnMenuItems(index: number): (MenuItem | null)[] {
  const items: (MenuItem | null)[] = [];
  const columns = getColumns();
  const ids = columns[index];
  if (!ids) return items;

  // Single folder items
  if (ids.length === 1) {
    const folderItems = getFolderMenuItems({ id: ids[0]! });
    items.push(...folderItems);
  }

  // Column layout items — gated by `lockColumns` (v0.2.93). Reading
  // the setting at right-click time means the toggle takes effect
  // immediately on the next menu, no page reload needed.
  const columnsLocked = Number(getSetting('lockColumns')) !== 0;
  if (!columnsLocked && columns.length > 1) {
    items.push(null); // separator

    if (index > 0) {
      items.push({
        label: t('contextMenu.moveColumnLeft'),
        action: () => withUndo(() => {
          // v1.2.6: swap with the previous column instead of
          //  `addColumn(ids, index - 1)`. addColumn can't do a
          //  true swap — it removes ids from the source column
          //  first, which makes the source column empty, then
          //  `verifyColumns` deletes that empty source. Net
          //  effect on the v1.2.2 default 3-col layout
          //  (`[[], ['1'], ['2', ...]]`): moving col 1 left
          //  collapses 3 → 2 cols and the empty col 0
          //  onboarding placeholder vanishes (observed
          //  `[['1'], ['2', ...]]` instead of the expected
          //  `[[], ['1'], ['2', ...]]` swap). A direct swap
          //  keeps all 3 cols, with col 0 still empty and
          //  the moved column taking the previous slot. Drag-
          //  drop column-structure drops still use
          //  `addColumn` — those are "create a new column at
          //  X" not "swap with X" and are unaffected.
          void swapColumns(index - 1, index);
        }),
      });
    }
    if (index < columns.length - 1) {
      items.push({
        label: t('contextMenu.moveColumnRight'),
        action: () => withUndo(() => {
          // v1.2.8.1: swap with the next column instead of
          //  `addColumn(ids, index + 1)`. Symmetric with the
          //  v1.2.6 "Move column left" fix. For non-empty cols
          //  both approaches give the same end state (e.g.
          //  `[[], ['1'], [X], ['2', ...]]` moving col 2 right
          //  → `[[], ['1'], ['2', ...], [X]]`), but for the
          //  v1.2.2 col 0 empty placeholder the addColumn path
          //  short-circuits to a no-op (v1.2.6 empty-ids early
          //  return in addColumn) so "Move right" on the empty
          //  col silently did nothing. swapColumns gives a true
          //  swap in both cases, and bypasses verifyColumns
          //  (just like the v1.2.6/v1.2.7 left-move fix) so
          //  the vacated col is preserved instead of being
          //  swept on the next saveLayout.
          void swapColumns(index, index + 1);
        }),
      });
    }
    items.push({
      label: t('contextMenu.removeColumn'),
      action: () => withUndo(() => {
        void removeColumn(index);
      }),
    });
  }

  return items;
}
