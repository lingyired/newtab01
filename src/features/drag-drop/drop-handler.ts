// Drop handler — manages dragover, dragleave, and drop events on #main
// Calculates drop target position and delegates to layout-ops

import { getDragIds, getDropTarget, setDropTarget } from './drag-state';
import { getColumns, addRow, addColumn } from './layout-ops';
import { captureSnapshot, pushSnapshot } from './history';
import { getSetting } from '../../lib/storage/settings';
import * as debug from '../../lib/debug';

/** Initialize drag-drop handlers on #main */
export function enableDragDrop(): void {
  const main = document.getElementById('main');
  if (!main) return;

  if (getSetting('lock')) {
    main.ondragover = null;
    main.ondragleave = null;
    main.ondrop = null;
    return;
  }

  main.addEventListener('dragover', onDragOver);
  main.addEventListener('dragleave', onDragLeave);
  main.addEventListener('drop', onDrop);
}

/** Remove drag-drop handlers */
export function disableDragDrop(): void {
  const main = document.getElementById('main');
  if (!main) return;

  main.removeEventListener('dragover', onDragOver);
  main.removeEventListener('dragleave', onDragLeave);
  main.removeEventListener('drop', onDrop);
}

function onDragOver(event: DragEvent): void {
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }

  const target = getDropTargetElement(event);
  if (target) {
    clearDropTarget();
    setDropTarget(target);

    const highlightColor = getComputedStyle(document.documentElement).getPropertyValue('--newtab-drop-indicator').trim() || '#2563eb';
    const borderCss = `solid 4px ${highlightColor}`;

    if (target.tagName === 'LI' || target.tagName === 'UL') {
      if (isAbove(event, target)) {
        target.style.borderBottom = borderCss;
        target.style.margin = '0 0 -4px 0';
      } else {
        target.style.borderTop = borderCss;
        target.style.margin = '-4px 0 0 0';
      }
    } else if (target.classList.contains('column')) {
      const rect = target.getBoundingClientRect();
      const relativeX = event.clientX - rect.left;
      if (relativeX > rect.width / 2) {
        target.style.borderRight = borderCss;
        target.style.margin = '0';
      } else {
        target.style.borderLeft = borderCss;
        target.style.margin = '0 4px 0 -4px';
      }
    }
  }
}

function onDragLeave(_event: DragEvent): void {
  clearDropTarget();
}

function onDrop(event: DragEvent): void {
  event.stopPropagation();
  event.preventDefault();

  const dragIds = getDragIds();
  if (!dragIds) return;

  const target = getDropTargetElement(event);
  if (!target) {
    debug.warn('drop', 'onDrop: no target found', { dragIds, clientX: event.clientX, clientY: event.clientY });
    return;
  }

  // Calculate drop coordinates
  const x = getDropX(target, event);
  const y = getDropY(target, event);

  debug.log('drop', 'onDrop', { dragIds, targetTag: target.tagName, targetClass: target.className, x, y, clientX: event.clientX, clientY: event.clientY });

  // Capture a pre-drop snapshot for the undo stack. Snapshotted BEFORE
  // the mutation runs so undo restores to exactly the state the user
  // had before this drop. Pushed to the stack AFTER the mutation
  // completes (asynchronously — addRow/addColumn call recordMovedOutForIds
  // which is awaited) so the snapshot is only added to history if the
  // drop actually applied.
  void captureAndDrop(dragIds, x, y, target, event);

  clearDropTarget();
}

/** Apply a drop and record an undo snapshot on success. */
async function captureAndDrop(
  dragIds: string[],
  x: number,
  y: number | null,
  target: HTMLElement,
  event: DragEvent,
): Promise<void> {
  // Capture pre-drop snapshot (columns + movedOut, both cloned).
  const snapshot = await captureSnapshot();

  if (dragIds.length === 1 && y !== null) {
    await addRow(dragIds[0]!, x, y);
  } else {
    const rect = target.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    // targetX is in the ORIGINAL array coordinate system (left half =
    // before column N, right half = after column N). addColumn's index
    // parameter is in the POST-REMOVAL array — it removes the ids from
    // their source column(s) first, then splices.
    //
    // Compensation rule: a source column contributes to the shift iff
    // it becomes EMPTY after removing dragIds (i.e., every id in that
    // column is being dragged). addColumn's empty-column cleanup then
    // removes it, shortening the new array by 1 at that position.
    // If such an empty-out column sits at an index strictly less than
    // targetX, we decrement the splice target by 1 per removed source.
    //
    // IMPORTANT: a source column that still has non-dragged ids left
    // (e.g. dragging B out of [B, C] leaves [C]) does NOT become empty
    // and keeps its slot — targetX in old array maps 1:1 to the new
    // array. v0.2.69 over-counted compensation in this case: for
    // [A], [B, C], [D] dragging B onto D's left half it produced
    // [A, B, C, D] instead of [A, C, B, D].
    const targetX = relativeX > rect.width / 2 ? x + 1 : x;
    const beforeColumns = getColumns();
    let compensation = 0;
    for (let xi = 0; xi < beforeColumns.length; xi++) {
      if (xi >= targetX) break;
      const col = beforeColumns[xi]!;
      if (col.length > 0 && col.every((id) => dragIds.includes(id))) {
        compensation++;
      }
    }
    const finalX = targetX - compensation;
    debug.log('drop', 'captureAndDrop: addColumn path', {
      finalX, targetX, compensation, relativeX, rectWidth: rect.width,
    });
    await addColumn(dragIds, finalX);
  }

  pushSnapshot(snapshot);
}

/** Get the proper drop target element based on event coordinates */
function getDropTargetElement(event: DragEvent): HTMLElement | null {
  const dragIds = getDragIds();
  if (!dragIds) return null;

  let target = event.target as HTMLElement | null;

  if (target && (target.tagName === 'A' || target.parentElement?.tagName === 'A') && dragIds.length === 1) {
    // Walk up to find the top-level LI within a column
    while (target && target.parentElement?.parentElement && !target.parentElement.parentElement.classList.contains('column')) {
      target = target.parentElement;
    }
    // If single-folder column, get the UL
    if (target && target.tagName === 'LI') {
      const x = getDropX(target, event);
      const columns = getColumns();
      if (columns[x]?.length === 1) {
        target = target.parentElement; // UL
      }
    }
  } else {
    // Walk up to find the column
    while (target && !target.classList.contains('column')) {
      target = target.parentElement;
    }
  }

  return target;
}

/** Get the x (column) coordinate of a drop target */
function getDropX(target: HTMLElement, _event: DragEvent): number {
  let el: HTMLElement | null = target;
  while (el && !el.classList.contains('column')) {
    el = el.parentElement;
  }
  if (!el) return 0;

  let x = 0;
  while (el.previousSibling) {
    x++;
    el = el.previousSibling as HTMLElement;
  }
  return x;
}

/** Get the y (row) coordinate of a drop target */
function getDropY(target: HTMLElement, event: DragEvent): number | null {
  if (target.tagName === 'LI') {
    let y = 0;
    if (isAbove(event, target)) {
      y++;
    }
    let el: HTMLElement | null = target;
    while (el.previousSibling) {
      y++;
      el = el.previousSibling as HTMLElement;
    }
    return y;
  } else if (target.tagName === 'UL') {
    let y = 0;
    if (isAbove(event, target)) {
      y++;
    }
    return y;
  }
  return null;
}

/** Check if the drop position is above the target's midpoint */
function isAbove(event: DragEvent, target: HTMLElement): boolean {
  const rect = target.getBoundingClientRect();
  return event.clientY - rect.top > rect.height / 2;
}

/** Clear drop target styling */
export function clearDropTarget(): void {
  const target = getDropTarget();
  if (target) {
    target.style.border = '';
    target.style.margin = '';
  }
  setDropTarget(null);
}
