// Column drag — enables dragging entire columns to reorder

import { getColumns } from './layout-ops';
import { getSetting } from '../../lib/storage/settings';
import { setDragIds } from './drag-state';
import * as debug from '../../lib/debug';

/** Enable drag on a column element */
export function enableDragColumn(index: number, column: HTMLElement): void {
  if (getSetting('lock')) return;

  column.draggable = true;

  column.addEventListener('dragstart', (event) => {
    const columns = getColumns();
    const ids = columns[index]?.slice() ?? [];
    setDragIds(ids);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
    }
    column.classList.add('dragstart');
    debug.log('drag', 'column dragstart', { index, ids });
  });

  column.addEventListener('dragend', (event) => {
    debug.log('drag', 'column dragend', { index, dropEffect: event.dataTransfer?.dropEffect });
    setDragIds(null);
    column.classList.remove('dragstart');
  });
}
