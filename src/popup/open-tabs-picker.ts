// Open tabs picker tab for Popup
import { getAllTabs } from '../lib/chrome/tabs';
import type { TabInfo } from '../lib/chrome/tabs';

export class OpenTabsPicker {
  private selected = new Map<number, string>(); // tabId -> url
  private onChange: (count: number) => void;
  private container: HTMLElement;

  constructor(onChange: (count: number) => void) {
    this.onChange = onChange;
    this.container = document.createElement('div');
    this.container.className = 'picker-list';
  }

  render(): HTMLElement {
    this.container.textContent = '';
    this.loadTabs();
    return this.container;
  }

  getSelectedUrls(): string[] {
    return Array.from(this.selected.values());
  }

  private async loadTabs(): Promise<void> {
    try {
      const tabs = await getAllTabs();
      if (tabs.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'picker-empty';
        empty.textContent = 'No open tabs';
        this.container.appendChild(empty);
        return;
      }
      for (const tab of tabs) {
        this.renderTab(tab);
      }
    } catch {
      const err = document.createElement('div');
      err.className = 'picker-empty';
      err.textContent = 'Failed to load tabs';
      this.container.appendChild(err);
    }
  }

  private renderTab(tab: TabInfo): void {
    const item = document.createElement('label');
    item.className = 'picker-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = this.selected.has(tab.id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        if (this.selected.size < 4) {
          this.selected.set(tab.id, tab.url);
        } else {
          checkbox.checked = false;
        }
      } else {
        this.selected.delete(tab.id);
      }
      this.onChange(this.selected.size);
    });

    const favicon = document.createElement('img');
    favicon.className = 'picker-favicon';
    if (tab.favIconUrl) {
      favicon.src = tab.favIconUrl;
    } else {
      favicon.src = `/_favicon/?pageUrl=${encodeURIComponent(tab.url)}&size=16`;
    }
    favicon.alt = '';
    favicon.width = 16;
    favicon.height = 16;

    const info = document.createElement('div');
    info.className = 'picker-tab-info';

    const title = document.createElement('span');
    title.className = 'picker-title';
    title.textContent = tab.title || tab.url;

    const url = document.createElement('span');
    url.className = 'picker-url';
    try {
      url.textContent = new URL(tab.url).hostname;
    } catch {
      url.textContent = tab.url;
    }

    info.appendChild(title);
    info.appendChild(url);

    item.appendChild(checkbox);
    item.appendChild(favicon);
    item.appendChild(info);
    this.container.appendChild(item);
  }
}
