// Shared drag state — used by drag-column, drag-folder, and drop-handler
// Avoids circular dependencies between drag modules

/** Current drag IDs (folder IDs being dragged) */
let dragIds: string[] | null = null;

/** Current drop target element */
let dropTarget: HTMLElement | null = null;

/** Get current drag IDs */
export function getDragIds(): string[] | null {
  return dragIds;
}

/** Set current drag IDs */
export function setDragIds(ids: string[] | null): void {
  dragIds = ids;
}

/** Get current drop target */
export function getDropTarget(): HTMLElement | null {
  return dropTarget;
}

/** Set current drop target */
export function setDropTarget(target: HTMLElement | null): void {
  dropTarget = target;
}
