// Folder drag — enables dragging folder headers to reorder/move

import type { BookmarkNode } from '../bookmarks/types';
import { getSetting } from '../../lib/storage/settings';
import { setDragIds } from './drag-state';
import * as debug from '../../lib/debug';

/**
 * Enable drag on a folder header element.
 * Takes both `header` (the <a> the user grabs) and `li` (the parent that
 * wraps the entire folder tree — header + descendants). The `.dragstart`
 * class is toggled on `li` so the visual highlight wraps the WHOLE
 * subtree being moved, not just the header row. Drag listeners stay on
 * `header` since that's the actual draggable element.
 *
 * v0.2.93: re-check `lock` at dragstart time (not just at enable
 * time) so toggling the lock on after a folder has been rendered
 * takes effect on the NEXT drag attempt. Without this, an
 * "already-enabled" folder could be dragged once after the toggle
 * (the user's reported "lock 开启之后依然可以进行一次拖拽" symptom).
 */
export function enableDragFolder(
  node: BookmarkNode,
  header: HTMLElement,
  li: HTMLLIElement,
): void {
  if (getSetting('lock')) return;

  header.draggable = true;

  header.addEventListener('dragstart', (event) => {
    if (getSetting('lock')) {
      event.preventDefault();
      return;
    }
    setDragIds([node.id]);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copyMove';
    }
    // Stop propagation so column dragstart doesn't fire
    event.stopPropagation();
    li.classList.add('dragstart');
    debug.log('drag', 'folder dragstart', { id: node.id, title: node.title });
  });

  header.addEventListener('dragend', (event) => {
    debug.log('drag', 'folder dragend', { id: node.id, dropEffect: event.dataTransfer?.dropEffect });
    setDragIds(null);
    li.classList.remove('dragstart');
  });
}
