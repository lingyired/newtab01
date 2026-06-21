// Column drag — enables dragging entire columns to reorder

import { getColumns } from './layout-ops';
import { getSetting } from '../../lib/storage/settings';
import { setDragIds } from './drag-state';
import * as debug from '../../lib/debug';

/** Enable drag on a column element. v0.2.93: also check `lockColumns`
 *  (in addition to `lock`) — `lockColumns=1` disables only column-level
 *  drag (folder drag within a column is still allowed). */
export function enableDragColumn(index: number, column: HTMLElement): void {
  if (getSetting('lock') || getSetting('lockColumns')) return;

  column.draggable = true;

  column.addEventListener('dragstart', (event) => {
    // v0.2.93: re-check the lock state at dragstart time, not just
    // at enable time. Without this, toggling the lock on after a
    // column has been rendered would leave the existing dragstart
    // listener active until the next renderColumns() (the user's
    // reported "one drag slips through before it locks" symptom).
    if (getSetting('lock') || getSetting('lockColumns')) {
      event.preventDefault();
      return;
    }
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
