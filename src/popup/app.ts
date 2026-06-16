// Popup page application entry
import { BookmarkPicker } from './bookmark-picker';
import { OpenTabsPicker } from './open-tabs-picker';
import { LayoutPicker } from './layout-picker';
import { splitManager } from '../features/split/manager';

type TabId = 'bookmarks' | 'open-tabs';

let currentTab: TabId = 'bookmarks';
let selectedCount = 0;

const bookmarkPicker = new BookmarkPicker((count) => {
  selectedCount = count;
  updateSplitButton();
});

const openTabsPicker = new OpenTabsPicker((count) => {
  selectedCount = count;
  updateSplitButton();
});

const layoutPicker = new LayoutPicker();

function updateSplitButton(): void {
  const btn = document.getElementById('split-btn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = selectedCount < 2;
    const countEl = document.getElementById('selected-count');
    if (countEl) {
      countEl.textContent = selectedCount > 0 ? `${selectedCount}/4` : '';
    }
  }
}

function render(root: HTMLElement): void {
  root.textContent = '';

  // Tab bar
  const tabBar = document.createElement('div');
  tabBar.className = 'popup-tab-bar';

  const bookmarkTab = document.createElement('button');
  bookmarkTab.type = 'button';
  bookmarkTab.className = 'popup-tab';
  if (currentTab === 'bookmarks') bookmarkTab.classList.add('popup-tab--active');
  bookmarkTab.textContent = 'Bookmarks';
  bookmarkTab.addEventListener('click', () => {
    currentTab = 'bookmarks';
    selectedCount = 0;
    render(root);
  });

  const openTabsTab = document.createElement('button');
  openTabsTab.type = 'button';
  openTabsTab.className = 'popup-tab';
  if (currentTab === 'open-tabs') openTabsTab.classList.add('popup-tab--active');
  openTabsTab.textContent = 'Open Tabs';
  openTabsTab.addEventListener('click', () => {
    currentTab = 'open-tabs';
    selectedCount = 0;
    render(root);
  });

  tabBar.appendChild(bookmarkTab);
  tabBar.appendChild(openTabsTab);

  // Content area
  const content = document.createElement('div');
  content.className = 'popup-content';
  if (currentTab === 'bookmarks') {
    content.appendChild(bookmarkPicker.render());
  } else {
    content.appendChild(openTabsPicker.render());
  }

  // Layout picker
  const layoutSection = document.createElement('div');
  layoutSection.className = 'popup-layout-section';
  const layoutTitle = document.createElement('div');
  layoutTitle.className = 'popup-section-title';
  layoutTitle.textContent = 'Layout';
  layoutSection.appendChild(layoutTitle);
  layoutSection.appendChild(layoutPicker.render());

  // Footer
  const footer = document.createElement('div');
  footer.className = 'popup-footer';

  const countSpan = document.createElement('span');
  countSpan.id = 'selected-count';
  countSpan.className = 'popup-count';

  const splitBtn = document.createElement('button');
  splitBtn.id = 'split-btn';
  splitBtn.type = 'button';
  splitBtn.className = 'popup-split-btn';
  splitBtn.disabled = true;
  splitBtn.textContent = 'Open Split';

  splitBtn.addEventListener('click', async () => {
    const urls =
      currentTab === 'bookmarks'
        ? bookmarkPicker.getSelectedUrls()
        : openTabsPicker.getSelectedUrls();
    if (urls.length < 2) return;
    const layout = { mode: layoutPicker.getSelected() };
    await splitManager.open(urls, layout);
  });

  footer.appendChild(countSpan);
  footer.appendChild(splitBtn);

  root.appendChild(tabBar);
  root.appendChild(content);
  root.appendChild(layoutSection);
  root.appendChild(footer);

  updateSplitButton();
}

const root = document.getElementById('root');
if (root) {
  render(root);
}
