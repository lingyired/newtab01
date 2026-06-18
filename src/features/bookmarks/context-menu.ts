// Context menu — dynamic popup menu for folders and columns

import type { MenuItem } from './types';
// addRow is currently only used by the hidden "Move folder" menu items
// (see the /* ... */ block in getFolderMenuItems below). Imported as a
// commented-out slot so re-enabling those items only requires removing
// the /* */ blocks — no extra import edits needed.
// import { getCoords, addRow, addColumn, removeRow, removeColumn, getColumns } from '../drag-drop/layout-ops';
import { getCoords, addColumn, removeRow, removeColumn, getColumns } from '../drag-drop/layout-ops';
import { captureSnapshot, pushSnapshot } from '../drag-drop/history';
import { openAllLinks } from './folder-actions-handler';
import { createTab } from '../../lib/chrome/bookmarks';

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
 */
async function withUndo(action: () => Promise<void> | void): Promise<void> {
  const snapshot = await captureSnapshot();
  await action();
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
    label: 'Open all links in folder',
    action: () => openAllLinks(node as any),
  });

  // Special items
  if (node.id === 'closed') {
    items.push({
      label: 'Clear browsing data',
      action: () => {
        openInternalPage('settings/clearBrowserData');
      },
    });
  }

  if (node.id === 'devices') {
    items.push({
      label: 'History',
      action: () => {
        openInternalPage('history');
      },
    });
  }

  // Numeric ID = real bookmark folder
  if (/^\d+$/.test(node.id)) {
    items.push({
      label: 'Edit bookmarks',
      action: () => {
        openInternalPage('bookmarks/?id=' + node.id);
      },
    });
  }

  // Layout items (if not locked)
  const lock = false; // Will be read from settings when integrated
  if (!lock) {
    const coords = getCoords(node.id);

    items.push(null); // separator

    items.push({
      label: 'Create new column',
      action: () => withUndo(() => {
        void addColumn([node.id]);
      }),
    });

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
      items.push({
        label: 'Remove folder',
        action: () => withUndo(() => {
          void removeRow(coords.x, coords.y);
        }),
      });
    }
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

  // Column layout items
  if (columns.length > 1) {
    items.push(null); // separator

    if (index > 0) {
      items.push({
        label: 'Move column left',
        action: () => withUndo(() => {
          void addColumn(ids, index - 1);
        }),
      });
    }
    if (index < columns.length - 1) {
      items.push({
        label: 'Move column right',
        action: () => withUndo(() => {
          // addColumn removes the ids from their current column first,
          // so the target splice index is in the post-removal array.
          // "One step right" = (original index) + 1 in that new array.
          // (Previously used index + 2, which overshoots — the column
          // always jumped to the rightmost position.)
          void addColumn(ids, index + 1);
        }),
      });
    }
    items.push({
      label: 'Remove column',
      action: () => withUndo(() => {
        void removeColumn(index);
      }),
    });
  }

  return items;
}
