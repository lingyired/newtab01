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
 */
export function enableDragFolder(
  node: BookmarkNode,
  header: HTMLElement,
  li: HTMLLIElement,
): void {
  if (getSetting('lock')) return;

  header.draggable = true;

  header.addEventListener('dragstart', (event) => {
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
