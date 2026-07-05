// Board — main panel that holds all columns
// Manages the #main element and renders columns

import { renderColumn } from './column';
import { enableDragColumn } from '../drag-drop/drag-column';
import { enableDragDrop } from '../drag-drop/drop-handler';
import { getColumns } from '../drag-drop/layout-ops';
import { isSpecialVisible } from './special-folders';
import { getSetting, updateSetting } from '../../lib/storage/settings';
import { t } from '../../lib/i18n';
import * as debug from '../../lib/debug';

/** Render all columns to the #main element */
export async function renderColumns(): Promise<void> {
  const main = document.getElementById('main');
  if (!main) return;

  // Clear existing content
  while (main.firstChild) {
    main.removeChild(main.firstChild);
  }

  const columns = getColumns();
  debug.log('render', 'renderColumns:start', { columnCount: columns.length, total: columns.reduce((s, c) => s + c.length, 0) });

  // v0.2.94: filter the column set by visibility so a column whose
  // every folder is a hidden special doesn't render as a blank
  // 1/N-wide div. Each remaining column gets equal width, and at
  // least 1 column is always kept (HNTP invariant: never an empty
  // board). `isSpecialVisible` is true for non-special IDs, so the
  // `some` returns true whenever a column has at least one
  // bookmark folder OR at least one visible special.
  //
  // v1.1.4: keep empty columns visible. v0.2.94's filter
  //  `col.length === 0 → false` hid every column whose only
  //  folder was later deleted in Chrome, leaving the user no way
  //  to (a) right-click → remove the column, or (b) drag another
  //  folder into the now-invisible slot. Both interactions
  //  require the column div to be in the DOM (right-click reads
  //  the column index off the target; drop handler resolves
  //  `getDropX` by walking `.column` siblings). Now an empty
  //  column renders as a slim placeholder (see column.ts →
  //  renderColumn) so the user can right-click and drop into it.
  //  Columns whose every id is a hidden special still hide —
  //  those have no actionable content (the show* toggle is the
  //  canonical way to deal with them, and the user did set
  //  show*=0 intentionally).
  //
  // v1.1.4: iterate the ORIGINAL columns array (so the index
  //  passed to enableDragColumn / renderColumn matches the
  //  layout index used by drag-column.ts and the drop handler),
  //  but skip columns whose every id is a hidden special. The
  //  width divisor is the count of actually-rendered columns
  //  (so the visible columns keep their equal-width 1/N
  //  distribution regardless of how many were filtered).
  const renderedIndices: number[] = [];
  for (let idx = 0; idx < columns.length; idx++) {
    const col = columns[idx] ?? [];
    if (col.some((id) => isSpecialVisible(id))) {
      renderedIndices.push(idx);
    }
  }
  const renderedCount = renderedIndices.length > 0 ? renderedIndices.length : 1;

  for (const i of renderedIndices) {
    const columnDiv = document.createElement('div');
    columnDiv.classList.add('column');
    columnDiv.dataset.columnIndex = String(i);

    // Set column width
    const columnWidth = getSetting('columnWidth');
    if (columnWidth === 'auto' || !columnWidth) {
      columnDiv.style.width = `${(1 / renderedCount) * 100}%`;
    } else {
      columnDiv.style.width = columnWidth;
    }

    // Enable drag on column
    enableDragColumn(i, columnDiv);

    main.appendChild(columnDiv);
    await renderColumn(i, columnDiv, columns);
  }
  // Edge case: the layout is empty (no columns at all) — render a
  // single empty placeholder so the user can right-click to remove
  // (no-op, only 1 column) and the board isn't a 0-height box.
  if (renderedIndices.length === 0) {
    const columnDiv = document.createElement('div');
    columnDiv.classList.add('column', 'column--empty');
    columnDiv.dataset.columnIndex = '0';
    columnDiv.style.width = '100%';
    main.appendChild(columnDiv);
    await renderColumn(0, columnDiv, [[]]);
  }

  // Enable drag-drop on main
  enableDragDrop();
  debug.log('render', 'renderColumns:done', { columnCount: renderedCount });

  // v1.0.28 + v1.0.29: empty-state. v1.0.28 used the cheap filter
  //  path (`renderedColumns === [[]]`), which only triggers when the
  //  layout itself is empty. That misses the common case where the
  //  layout still has columns but every visible folder is itself
  //  empty (e.g. a fresh Chrome profile with no bookmarks, or a
  //  user who deleted all bookmarks and then hid all specials).
  //  v1.0.29 widens the check: scan rendered `li` nodes in #main
  //  and treat the board as empty if NONE are real content (every
  //  li is a placeholder from the `< Empty >` node in folder.ts:243,
  //  which sets `data-type="empty"` via BookmarkNode.type). This
  //  catches both "no columns" and "only empty folders" with a
  //  single post-render DOM scan — no model layer changes, no
  //  re-walk of the bookmark tree, runs once per renderColumns.
  //
  // v1.1.4: also bail when at least one .column--empty placeholder
  //  is in the DOM. The placeholders are <div>, not <li>, so the
  //  v1.0.29 li scan alone would still treat a layout of all
  //  deleted-folder columns (e.g. user deleted every folder) as
  //  empty and show the "Show bookmark bar" onboarding message —
  //  which is wrong, because the user has an explicit layout and
  //  the placeholders are themselves the actionable UI (right-
  //  click to remove, drag a folder in). The two "has content"
  //  signals are OR'd: real <li> OR .column--empty placeholder.
  //  The v1.0.29 "all folders exist but are empty" path still
  //  triggers correctly (no placeholders, all <li data-type=empty>).
  const hasPlaceholderColumn =
    main.querySelector('.column--empty') !== null;
  if (!hasPlaceholderColumn) {
    const lis = main.querySelectorAll('li');
    let hasRealContent = false;
    for (const li of lis) {
      if (li.dataset['type'] !== 'empty') {
        hasRealContent = true;
        break;
      }
    }
    if (!hasRealContent) {
      const empty = document.createElement('div');
      empty.className = 'board-empty';
      const msg = document.createElement('p');
      msg.textContent = t('board.empty');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'board-empty-action';
      btn.textContent = t('board.emptyAction');
      btn.addEventListener('click', () => {
        void updateSetting('showBar', 1).then(() => {
          location.reload();
        });
      });
      empty.appendChild(msg);
      empty.appendChild(btn);
      main.appendChild(empty);
    }
  }
}

/** Initialize the board with resize handler */
export function initBoard(): void {
  renderColumns();

  // Handle window resize
  window.addEventListener('resize', () => {
    updateTooltips();
  });
}

/** Update tooltips for truncated text */
function updateTooltips(): void {
  const elements = document.querySelectorAll('#main li a');
  for (const element of elements) {
    const el = element as HTMLElement;
    if (el.clientWidth + 1 < el.scrollWidth) {
      if (!el.title) {
        el.title = el.textContent || '';
      }
    } else if (el.title === el.textContent) {
      el.title = '';
    }
  }
}
