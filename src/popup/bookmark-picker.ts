// Bookmark picker tab for Popup
import { getBookmarkTree, chromeBookmarkToNode } from '../lib/chrome/bookmarks';
import type { BookmarkNode } from '../features/bookmarks/types';

export class BookmarkPicker {
  private selected = new Map<string, string>(); // id -> url
  private onChange: (count: number) => void;
  private container: HTMLElement;

  constructor(onChange: (count: number) => void) {
    this.onChange = onChange;
    this.container = document.createElement('div');
    this.container.className = 'picker-list';
  }

  render(): HTMLElement {
    this.container.textContent = '';
    this.loadBookmarks();
    return this.container;
  }

  getSelectedUrls(): string[] {
    return Array.from(this.selected.values());
  }

  private async loadBookmarks(): Promise<void> {
    try {
      const tree = await getBookmarkTree();
      const root = tree[0];
      if (root?.children) {
        for (const child of root.children) {
          const node = chromeBookmarkToNode(child);
          this.renderNode(node, 0);
        }
      }
    } catch {
      const err = document.createElement('div');
      err.className = 'picker-empty';
      err.textContent = 'Failed to load bookmarks';
      this.container.appendChild(err);
    }
  }

  private renderNode(node: BookmarkNode, depth: number): void {
    if (node.url) {
      // Bookmark item
      const item = document.createElement('label');
      item.className = 'picker-item';
      item.style.paddingLeft = `${depth * 16 + 8}px`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = this.selected.has(node.id);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (this.selected.size < 4) {
            this.selected.set(node.id, node.url!);
          } else {
            checkbox.checked = false;
          }
        } else {
          this.selected.delete(node.id);
        }
        this.onChange(this.selected.size);
      });

      const favicon = document.createElement('img');
      favicon.className = 'picker-favicon';
      favicon.src = `/_favicon/?pageUrl=${encodeURIComponent(node.url)}&size=16`;
      favicon.alt = '';
      favicon.width = 16;
      favicon.height = 16;

      const title = document.createElement('span');
      title.className = 'picker-title';
      title.textContent = node.title || node.url;

      item.appendChild(checkbox);
      item.appendChild(favicon);
      item.appendChild(title);
      this.container.appendChild(item);
    } else if (node.children) {
      // Folder
      const folder = document.createElement('div');
      folder.className = 'picker-folder';

      const header = document.createElement('button');
      header.className = 'picker-folder-header';
      header.type = 'button';
      header.style.paddingLeft = `${depth * 16 + 8}px`;

      const arrow = document.createElement('span');
      arrow.className = 'picker-arrow';
      arrow.textContent = '▶';

      const folderTitle = document.createElement('span');
      folderTitle.className = 'picker-folder-title';
      folderTitle.textContent = node.title || 'Bookmarks';

      header.appendChild(arrow);
      header.appendChild(folderTitle);

      const children = document.createElement('div');
      children.className = 'picker-folder-children';
      children.hidden = true;

      header.addEventListener('click', () => {
        children.hidden = !children.hidden;
        arrow.textContent = children.hidden ? '▶' : '▼';
      });

      folder.appendChild(header);
      folder.appendChild(children);
      this.container.appendChild(folder);

      for (const child of node.children) {
        const savedContainer = this.container;
        this.container = children;
        this.renderNode(child, depth + 1);
        this.container = savedContainer;
      }
    }
  }
}
