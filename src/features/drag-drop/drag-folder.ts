// Folder drag — enables dragging folder headers to reorder/move

import type { BookmarkNode } from '../bookmarks/types';
import { getSetting } from '../../lib/storage/settings';
import { setDragIds } from './drag-state';
import * as debug from '../../lib/debug';

/** Enable drag on a folder header element */
export function enableDragFolder(node: BookmarkNode, header: HTMLElement): void {
  if (getSetting('lock')) return;

  header.draggable = true;

  header.addEventListener('dragstart', (event) => {
    setDragIds([node.id]);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copyMove';
    }
    // Stop propagation so column dragstart doesn't fire
    event.stopPropagation();
    header.classList.add('dragstart');
    debug.log('drag', 'folder dragstart', { id: node.id, title: node.title });
  });

  header.addEventListener('dragend', (event) => {
    debug.log('drag', 'folder dragend', { id: node.id, dropEffect: event.dataTransfer?.dropEffect });
    setDragIds(null);
    header.classList.remove('dragstart');
  });
}
