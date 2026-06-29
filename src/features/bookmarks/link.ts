// Link node rendering — bookmark link (li > a with favicon + title)

import type { BookmarkNode } from './types';
import { createFavicon } from './favicon';
import { getCurrentTab, createTab, updateTab } from '../../lib/chrome/bookmarks';
import { getSetting } from '../../lib/storage/settings';
import { enableDragFolder } from '../drag-drop/drag-folder';
import { renderMenu } from './context-menu';
import { renderColumns } from './board';
import { updateSetting } from '../../lib/storage/settings';
import { SHOW_KEY_MAP } from './special-folders';
import { t } from '../../lib/i18n';

/** Render a single bookmark link as li > a */
export function renderLink(node: BookmarkNode, target: HTMLElement): HTMLLIElement {
  const li = document.createElement('li');
  // v1.0.29: stamp the node type so the empty-state scanner in
  //  board.ts can tell real links from the `< Empty >` placeholder
  //  (BookmarkNode.type === 'empty', see folder.ts:243). No other
  //  code path in the codebase reads li.dataset.type, so this is
  //  the minimal surface to add.
  if (node.type) {
    li.dataset.type = node.type;
  }
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
    // chrome:// / chrome-extension:// / file:/// URLs must be
    // opened via the chrome.tabs API (the `<a target="_blank">`
    // shortcut in the newtab override is unreliable for these
    // schemes — chrome-extension://<id>/_generated_background_page.html
    // launches in a generated iframe background, not the user's
    // newtab, and chrome:// URLs are blocked from being targeted
    // in some Chrome versions), so we route them through a
    // single dedicated click handler below. Skip the generic
    // newtab branch here — running both would attach two click
    // listeners and open the URL twice (e.g. newtab=2 + apps'
    // default `chrome://apps` URL would open two background tabs
    // on every click).
    //
    // v0.2.111: `chrome-extension://` added — Apps special folder
    //  now lists installed apps and each app's `appLaunchUrl` is
    //  typically a `chrome-extension://<id>/_generated_background_page.html`
    //  URL that must be launched via the chrome.tabs API. We use
    //  `startsWith` on the full URL rather than the
    //  `urlStart` substring check below because the substring
    //  approach only compares the first 6 chars and would
    //  conflate `chrome://` (URL starts with `'chrome:'`, first
    //  6 chars `'chrome:'` ≠ `'chrome'`) — wait, `urlStart` is
    //  `url.substring(0, 6)` and `'chrome:'` is 7 chars, so
    //  `urlStart` for `chrome://foo` is `'chrome:'` which DOES
    //  equal `'chrome'`. For `chrome-extension://foo`,
    //  `urlStart` is `'chrome-'`, which is why the previous
    //  code missed it. Using `startsWith` here is the correct
    //  fix: any of these three prefixes triggers the
    //  chrome.tabs API path.
    const isChromeOrFile =
      url.startsWith('chrome:') ||
      url.startsWith('chrome-extension:') ||
      url.startsWith('file:') ||
      // v0.2.116: Edge's internal URL scheme (edge://apps, edge://flags,
      //  etc) must also go through the chrome.tabs API — Edge blocks
      //  `<a target="_blank">` for edge:// URLs the same way Chrome
      //  blocks it for chrome:// URLs (depending on context). This
      //  branch is a no-op in Chrome (no `edge://` scheme exists).
      url.startsWith('edge:');
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

  // v0.2.116: Apps is a regular link (`<a href="chrome://apps">` /
  //  `edge://apps`), not a folder — see `getSubTreeStub('apps')`.
  //  Apps still needs to be individually draggable to other
  //  columns (matching the four other special folders' drag
  //  behaviour), so we reuse `enableDragFolder` on the link
  //  element. `enableDragFolder` is already generic over the
  //  header element type (accepts any `HTMLElement`), so wiring
  //  it to an `<a>` works without a separate `enableDragLink`.
  //  Without this, dragging the Apps link would bubble to the
  //  parent column's dragstart and trigger whole-column drag.
  if (node.id === 'apps') {
    enableDragFolder(node, a, li);
  }

  // v1.0.27: Apps is rendered as a plain `<a>` (no folder
  //  header), so the column-level `contextmenu` handler in
  //  column.ts:138-149 — which short-circuits when the right-
  //  click target is an `<a>` — never fires for Apps. Attach a
  //  link-local contextmenu that offers "Remove" (toggles
  //  showApps off, mirroring the right-click path used for the
  //  other 6 special/root folders via SHOW_KEY_MAP). The
  //  chrome.storage.onChanged listener doesn't re-render the
  //  same tab, so we explicitly call renderColumns() after the
  //  write so the link disappears immediately. Scoped to
  //  `node.id === 'apps'` rather than all link nodes — regular
  //  bookmark links have no column membership to remove, so
  //  the menu would be empty.
  if (node.id === 'apps' && SHOW_KEY_MAP[node.id]) {
    a.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const showKey = SHOW_KEY_MAP[node.id]!;
      renderMenu(
        [{
          label: t('contextMenu.removeFolder'),
          action: () => {
            void updateSetting(showKey, 0).then(() => {
              void renderColumns();
            });
          },
        }],
        e.pageX,
        e.pageY,
        a,
      );
    });
  }

  target.appendChild(li);
  return li;
}

/** Open a link in the appropriate tab mode.
 *
 *  Exported (v0.2.109) so that the Apps special-folder header
 *  in `folder.ts` can use the same chrome:// URL navigation
 *  path as actual `chrome://` bookmark links. Apps' header
 *  looks like a folder (so it can be individually dragged)
 *  but clicking it should open `chrome://apps` in the tab
 *  the user has configured under "打开链接方式" — exactly
 *  the same dispatch the link chrome:// branch does.
 */
export async function openLink(url: string, newtab: number): Promise<void> {
  const tab = await getCurrentTab();
  if (!tab?.id) return;

  if (newtab) {
    await createTab(url, newtab === 1, tab.id);
  } else {
    await updateTab(tab.id, url);
  }
}
