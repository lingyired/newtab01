// Board — main panel that holds all columns
// Manages the #main element and renders columns

import { renderColumn } from './column';
import { enableDragColumn } from '../drag-drop/drag-column';
import { enableDragDrop } from '../drag-drop/drop-handler';
import { getColumns } from '../drag-drop/layout-ops';
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

  for (let i = 0; i < columns.length; i++) {
    const columnDiv = document.createElement('div');
    columnDiv.classList.add('column');
    columnDiv.dataset.columnIndex = String(i);

    // Set column width
    const columnWidth = getSetting('columnWidth');
    if (columnWidth === 'auto' || !columnWidth) {
      columnDiv.style.width = `${(1 / columns.length) * 100}%`;
    } else {
      columnDiv.style.width = columnWidth;
    }

    // Enable drag on column
    enableDragColumn(i, columnDiv);

    main.appendChild(columnDiv);
    await renderColumn(i, columnDiv, columns);
  }

  // Enable drag-drop on main
  enableDragDrop();
  debug.log('render', 'renderColumns:done', { columnCount: columns.length });
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
