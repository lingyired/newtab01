// Link node rendering — bookmark link (li > a with favicon + title)

import type { BookmarkNode } from './types';
import { createFavicon } from './favicon';
import { getCurrentTab, createTab, updateTab } from '../../lib/chrome/bookmarks';
import { getSetting } from '../../lib/storage/settings';

/** Render a single bookmark link as li > a */
export function renderLink(node: BookmarkNode, target: HTMLElement): HTMLLIElement {
  const li = document.createElement('li');
  const a = document.createElement('a');

  const url = node.url;
  if (url) {
    a.href = url;
  } else {
    a.tabIndex = 0;
  }

  // Set text
  let text = node.title || '';
  if (!text && node.title === '') text = node.url || '';
  const textWrap = document.createElement('span');
  textWrap.className = 'link-text';
  textWrap.textContent = text;
  a.appendChild(textWrap);

  // Tooltip
  if (node.tooltip) a.title = node.tooltip;

  // CSS classes
  if (node.className) a.classList.add(node.className);

  // Favicon icon
  const icon = createFavicon(url, node.icons, node.icon);
  a.insertBefore(icon, a.firstChild);

  // Click behavior
  if (node.action) {
    a.addEventListener('click', (event) => {
      const result = node.action!(event);
      if (result === false) event.preventDefault();
    });
  } else if (url) {
    const newtab = getSetting('newtab');
    // chrome:// and file:/// URLs must be opened via the chrome.tabs API
    // (the `<a target="_blank">` shortcut in the newtab override is
    // unreliable for these schemes), so we route them through a single
    // dedicated click handler below. Skip the generic newtab branch
    // here — running both would attach two click listeners and open
    // the URL twice (e.g. newtab=2 + apps' default `chrome://apps` URL
    // would open two background tabs on every click).
    const urlStart = url.substring(0, 6);
    const isChromeOrFile = urlStart === 'chrome' || urlStart === 'file:/';
    if (!isChromeOrFile) {
      if (newtab === 1) {
        // New foreground tab
        a.target = '_blank';
      } else if (newtab === 2) {
        // New background tab
        a.addEventListener('click', (e) => {
          e.preventDefault();
          openLink(url, newtab);
        });
      }
    }

    // Fix chrome:// and file:/// URLs
    if (isChromeOrFile) {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        openLink(url, newtab || (e.ctrlKey ? 2 : 0));
      });
      a.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          openLink(url, 2);
        }
      });
    }
  } else if (!node.children) {
    a.style.pointerEvents = 'none';
  }

  li.appendChild(a);
  target.appendChild(li);
  return li;
}

/** Open a link in the appropriate tab mode */
async function openLink(url: string, newtab: number): Promise<void> {
  const tab = await getCurrentTab();
  if (!tab?.id) return;

  if (newtab) {
    await createTab(url, newtab === 1, tab.id);
  } else {
    await updateTab(tab.id, url);
  }
}
