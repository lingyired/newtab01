// Popup page application entry
import { BookmarkPicker } from './bookmark-picker';
import { OpenTabsPicker } from './open-tabs-picker';
import { LayoutPicker } from './layout-picker';
import { splitManager } from '../features/split/manager';

type TabId = 'bookmarks' | 'open-tabs';

let currentTab: TabId = 'open-tabs';
let selectedCount = 0;

/**
 * Extract a "root domain" string suitable for the split view tab title.
 *
 * Takes the last two dot-separated segments of the hostname (e.g.
 * "www.weibo.com" -> "weibo.com"). This is a heuristic that matches the
 * common eTLD+1 case (com / net / org / io etc.) but will not handle
 * multi-segment public suffixes like "bbc.co.uk" correctly — we don't
 * ship a Public Suffix List, so this is a known limitation. If a URL is
 * malformed the original string is returned so the title is never empty.
 */
function rootDomainFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (!hostname) return url;
    const parts = hostname.split('.');
    if (parts.length <= 2) return hostname;
    return parts.slice(-2).join('.');
  } catch {
    return url;
  }
}

/** Build the split view tab title from a set of URLs. */
function buildPopupTitle(urls: string[]): string {
  return urls.map(rootDomainFromUrl).join(' | ');
}

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

  tabBar.appendChild(openTabsTab);
  tabBar.appendChild(bookmarkTab);

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
    // Build a tab title like "weibo.com | v2ex.com" from the selected URLs.
    // The split view's browser tab title becomes this string (see
    // app.ts:initApp -> parseSplitParams -> document.title).
    const title = buildPopupTitle(urls);
    await splitManager.open(urls, layout, undefined, title, true);
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
