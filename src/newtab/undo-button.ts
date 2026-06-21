// Undo button — sits to the right of the search box in the topbar.
// Visible only when there's at least one snapshot on the history stack.
// Click pops the newest snapshot and restores the column layout + moved-out
// map, then re-renders the board.

import { popSnapshot, getHistoryLength, subscribe } from '../features/drag-drop/history';
import { setColumns, saveLayout } from '../features/drag-drop/layout-ops';
import { setMovedOutCache } from '../features/bookmarks/moved-out';
import { setLocal } from '../lib/storage';
import * as debug from '../lib/debug';

const MOVED_OUT_KEY = 'movedOut';

/** Undo button element, lazily created by renderUndoButton. */
let undoBtn: HTMLButtonElement | null = null;

/**
 * Create the undo button and append it to the given topbar container.
 * v0.2.93: the `showSearch` parameter was removed (the search bar is
 * always shown now), so the no-op branch is gone and the button is
 * always created. The caller in `topbar.ts` no longer passes the flag.
 */
export function renderUndoButton(topbar: HTMLElement): void {
  if (undoBtn) return;

  undoBtn = document.createElement('button');
  undoBtn.id = 'undo_button';
  undoBtn.type = 'button';
  undoBtn.setAttribute('aria-label', '回退操作');
  undoBtn.title = '回退操作';

  // Layout: text label + inline count badge. The badge ALWAYS renders
  // a number (1, 2, …) when the history stack is non-empty — no empty
  // state. An earlier version hid the badge at count=1, which read as
  // "blue pill with nothing in it, then suddenly a number" and felt
  // inconsistent (see CHANGELOG v0.2.61).
  const label = document.createElement('span');
  label.id = 'undo_button_label';
  label.classList.add('undo-label');
  label.textContent = '回退操作';
  undoBtn.appendChild(label);

  const badge = document.createElement('span');
  badge.id = 'undo_button_count';
  badge.classList.add('undo-count');
  undoBtn.appendChild(badge);

  undoBtn.addEventListener('click', onUndoClick);

  topbar.appendChild(undoBtn);

  // Initial visibility + react to stack changes (push from drop, pop
  // from undo, clear from init). The unsubscribe return value is
  // intentionally discarded — the topbar lives for the page lifetime
  // so there's no teardown point.
  void subscribe(() => {
    updateVisibility();
  });
  updateVisibility();
}

/** Restore the most recent snapshot, if any. Re-renders the board. */
async function onUndoClick(): Promise<void> {
  const snapshot = popSnapshot();
  if (!snapshot) {
    debug.log('undo', 'onUndoClick: stack empty, ignoring');
    return;
  }

  debug.log('undo', 'onUndoClick: restoring snapshot', {
    columns: snapshot.columns.map((c) => c.length),
    movedOutEntries: Object.keys(snapshot.movedOut).length,
  });

  // Replace columns in-place (the layout-ops module-level ref) and
  // persist. saveLayout calls verifyColumns (rebuilds coords, drops
  // empty columns), then setLocal, then renderColumns to repaint.
  setColumns(snapshot.columns);
  setMovedOutCache(snapshot.movedOut);
  await setLocal(MOVED_OUT_KEY, snapshot.movedOut);
  await saveLayout();
}

/** Toggle visibility + update badge text based on current stack length. */
function updateVisibility(): void {
  if (!undoBtn) return;
  const count = getHistoryLength();
  const badge = undoBtn.querySelector<HTMLSpanElement>('#undo_button_count');
  if (count === 0) {
    undoBtn.style.display = 'none';
  } else {
    undoBtn.style.display = '';
    undoBtn.title = count === 1
      ? '回退操作'
      : `回退操作（${count} 步）`;
    if (badge) {
      badge.textContent = String(count);
    }
  }
}