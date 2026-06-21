// Board — main panel that holds all columns
// Manages the #main element and renders columns

import { renderColumn } from './column';
import { enableDragColumn } from '../drag-drop/drag-column';
import { enableDragDrop } from '../drag-drop/drop-handler';
import { getColumns } from '../drag-drop/layout-ops';
import { isSpecialVisible } from './special-folders';
import { getSetting } from '../../lib/storage/settings';
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
  const visibleColumns = columns.filter((col) => {
    if (col.length === 0) return false;
    return col.some((id) => isSpecialVisible(id));
  });
  const renderedColumns = visibleColumns.length > 0 ? visibleColumns : [[]];

  for (let i = 0; i < renderedColumns.length; i++) {
    const columnDiv = document.createElement('div');
    columnDiv.classList.add('column');
    columnDiv.dataset.columnIndex = String(i);

    // Set column width
    const columnWidth = getSetting('columnWidth');
    if (columnWidth === 'auto' || !columnWidth) {
      columnDiv.style.width = `${(1 / renderedColumns.length) * 100}%`;
    } else {
      columnDiv.style.width = columnWidth;
    }

    // Enable drag on column
    enableDragColumn(i, columnDiv);

    main.appendChild(columnDiv);
    await renderColumn(i, columnDiv, renderedColumns);
  }

  // Enable drag-drop on main
  enableDragDrop();
  debug.log('render', 'renderColumns:done', { columnCount: renderedColumns.length });
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
