// Undo button — sits to the right of the search box in the topbar.
// Visible only when there's at least one snapshot on the history stack.
// Click pops the newest snapshot and restores the column layout + moved-out
// map, then re-renders the board.

import { popSnapshot, getHistoryLength, subscribe } from '../features/drag-drop/history';
import { setColumns, saveLayout } from '../features/drag-drop/layout-ops';
import { setMovedOutCache } from '../features/bookmarks/moved-out';
import { setLocal } from '../lib/storage';
import * as debug from '../lib/debug';
import { t } from '../lib/i18n';

const MOVED_OUT_KEY = 'movedOut';

/** Undo button element, lazily created by renderUndoButton. */
let undoBtn: HTMLButtonElement | null = null;
let undoWrap: HTMLDivElement | null = null;
let undoLabel: HTMLSpanElement | null = null;
let undoHint: HTMLSpanElement | null = null;

/**
 * Create the undo button and append it to the given topbar container.
 * v0.2.93: the `showSearch` parameter was removed (the search bar is
 * always shown now), so the no-op branch is gone and the button is
 * always created. The caller in `topbar.ts` no longer passes the flag.
 *
 * v0.2.143 (feat/undo-button-polish) rev 4: the button is restored
 * to its ORIGINAL size (padding 7px 14px + font-size 1.2rem +
 * line-height 1.4, ~33px tall) — earlier revs grew the button to
 * match the search input's ~46px height, but the user found the
 * larger button visually heavy. The hint ("Only undoable in this
 * session; clears on refresh" / 「仅本次会话可回退，刷新后清空」)
 * lives OUTSIDE the button as a sibling, positioned absolutely
 * below it (`position: absolute; top: calc(100% + 4px)`) so it
 * "floats" beneath the button without affecting the topbar's
 * vertical layout. Layout:
 *
 *      ┌──────────────┐
 *      │  回退  1     │   ← #undo_button (original size)
 *      └──────────────┘
 *             │
 *             ↓
 *   仅本次会话可回退，刷新后清空   ← .undo-hint (absolutely positioned)
 *
 * The .undo-wrap div is `position: relative` so it acts as the
 * positioning anchor for the absolutely-positioned hint.
 */
export function renderUndoButton(topbar: HTMLElement): void {
  if (undoBtn) return;

  undoBtn = document.createElement('button');
  undoBtn.id = 'undo_button';
  undoBtn.type = 'button';
  undoBtn.setAttribute('aria-label', t('undo.title'));
  undoBtn.title = t('undo.title');

  // Layout: text label + inline count badge. The badge ALWAYS renders
  // a number (1, 2, …) when the history stack is non-empty — no empty
  // state. An earlier version hid the badge at count=1, which read as
  // "blue pill with nothing in it, then suddenly a number" and felt
  // inconsistent (see CHANGELOG v0.2.61).
  const label = document.createElement('span');
  label.id = 'undo_button_label';
  label.classList.add('undo-label');
  label.textContent = t('undo.label');
  undoLabel = label;
  undoBtn.appendChild(label);

  const badge = document.createElement('span');
  badge.id = 'undo_button_count';
  badge.classList.add('undo-count');
  undoBtn.appendChild(badge);

  undoBtn.addEventListener('click', onUndoClick);

  // v0.2.143 rev 4: wrap hosts the button + the absolutely-positioned
  //  hint. The hint is positioned relative to this wrap (which is
  //  sized by the button alone, since the hint is out-of-flow). The
  //  wrap is hidden alongside the button when history stack is empty
  //  so the orphan hint doesn't appear below an invisible button.
  undoWrap = document.createElement('div');
  undoWrap.id = 'undo_wrap';
  undoWrap.classList.add('undo-wrap');
  undoWrap.appendChild(undoBtn);

  const hint = document.createElement('span');
  hint.id = 'undo_button_hint';
  hint.classList.add('undo-hint');
  hint.textContent = t('undo.sessionHint');
  undoHint = hint;
  undoWrap.appendChild(hint);

  topbar.appendChild(undoWrap);

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

/** Toggle visibility + update badge text based on current stack length.
 *  v0.2.143 rev 4: hide the WRAP (not just the button) when count is 0,
 *  so the absolutely-positioned hint doesn't appear as an orphan below
 *  an invisible button. */
function updateVisibility(): void {
  if (!undoBtn) return;
  const count = getHistoryLength();
  const badge = undoBtn.querySelector<HTMLSpanElement>('#undo_button_count');
  if (count === 0) {
    undoBtn.style.display = 'none';
    if (undoWrap) undoWrap.style.display = 'none';
  } else {
    undoBtn.style.display = '';
    if (undoWrap) undoWrap.style.display = '';
    undoBtn.title = count === 1
      ? t('undo.title')
      : t('undo.titleWithCount', { count });
    if (badge) {
      badge.textContent = String(count);
    }
  }
}

/** v0.2.118: refresh the undo button's static strings (text label
 *  + title + aria-label) for the active locale. Called from
 *  `applyLocaleToDom` (newtab/main.ts) on `setLocale()`. Re-uses
 *  `updateVisibility()` so the title (which includes the live
 *  history count) re-computes against the new locale.
 *
 *  feat/undo-button-polish: also refresh the small explanatory hint
 *  span below the button so the "session-only" caveat re-translates
 *  on locale change. */
export function updateUndoStrings(): void {
  if (undoBtn) {
    undoBtn.setAttribute('aria-label', t('undo.title'));
  }
  if (undoLabel) {
    undoLabel.textContent = t('undo.label');
  }
  if (undoHint) {
    undoHint.textContent = t('undo.sessionHint');
  }
  updateVisibility();
}