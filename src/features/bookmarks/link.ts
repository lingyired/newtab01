// Link node rendering — bookmark link (li > a with favicon + title)

import type { BookmarkNode } from './types';
import { createFavicon } from './favicon';
import { getCurrentTab, createTab, updateTab } from '../../lib/chrome/bookmarks';
import { getSetting } from '../../lib/storage/settings';

/** Render a single bookmark link as li > a */
export function renderLink(node: BookmarkNode, target: HTMLElement): HTMLLIElement {
  const li = document.createElement('li');
  const a = document.createElement('a');

  // v0.2.59: full shadcn Button class composition. v0.2.58 covered 9
  // classes; this is the complete 33-class set the user pulled from
  // shadcn, plus `w-full` for the bookmark column fill. The class
  // names + the theme's shadcn vars (--background, --accent,
  // --shadow-xs, --ring, etc.) are the entire contract — no
  // per-theme CSS overrides needed in newtab.css. The composition
  // below matches shadcn's `button-outline` class verbatim except
  // for the bookmark-specific `w-full` addition.
  //
  // Classes covered:
  //   layout     inline-flex shrink-0 items-center justify-center
  //              gap-2 w-full h-9 px-4 py-2
  //   typography text-sm font-medium whitespace-nowrap no-underline
  //              cursor-pointer
  //   surface    border border-input bg-background text-foreground
  //              shadow-xs rounded-md
  //   hover      hover:bg-accent hover:text-accent-foreground
  //   focus      focus-visible:border-ring focus-visible:ring-[3px]
  //              focus-visible:ring-ring/50
  //   disabled   disabled:pointer-events-none disabled:opacity-50
  //   aria       aria-invalid:border-destructive
  //              aria-invalid:ring-destructive/20
  //              dark:aria-invalid:ring-destructive/40
  //   dark       dark:border-input dark:bg-input/30
  //              dark:hover:bg-input/50
  //   misc       transition-all outline-none
  //   svg-children
  //              [&_svg]:pointer-events-none [&_svg]:shrink-0
  //              [&_svg:not([class*='size-'])]:size-4
  //
  // The v0.2.58 `focus-visible:ring-stacked` custom class is gone —
  // replaced by the standard shadcn `focus-visible:border-ring` +
  // `focus-visible:ring-[3px]` + `focus-visible:ring-ring/50` triple,
  // which REPLACES the element's box-shadow with a 3px ring at 50%
  // opacity during keyboard focus. Brutalist's hard offset shadow
  // is replaced by the ring on focus (the standard shadcn behavior);
  // it returns when focus leaves.
  a.classList.add(
    // Layout — display, flex, alignment, gap
    'inline-flex',
    'shrink-0',
    'items-center',
    'justify-center',
    'gap-2',
    // Sizing — bookmark-specific width + shadcn button height
    'w-full',
    'h-9',
    // Padding
    'px-4',
    'py-2',
    // Typography
    'text-sm',
    'font-medium',
    // Whitespace / text / cursor
    'whitespace-nowrap',
    'no-underline',
    'cursor-pointer',
    // Border / background / text color
    'border',
    'border-input',
    'bg-background',
    'text-foreground',
    // Shadow / radius
    'shadow-xs',
    'rounded-md',
    // Hover
    'hover:bg-accent',
    'hover:text-accent-foreground',
    // Focus-visible (shadcn standard: border-ring + 3px ring at 50%)
    'focus-visible:border-ring',
    'focus-visible:ring-[3px]',
    'focus-visible:ring-ring/50',
    // Disabled / aria-invalid
    'disabled:pointer-events-none',
    'disabled:opacity-50',
    'aria-invalid:border-destructive',
    'aria-invalid:ring-destructive/20',
    'dark:aria-invalid:ring-destructive/40',
    // Dark mode
    'dark:border-input',
    'dark:bg-input/30',
    'dark:hover:bg-input/50',
    // Transition / outline
    'transition-all',
    'outline-none',
    // SVG children (no-op for <img> favicons, but matches shadcn verbatim)
    '[&_svg]:pointer-events-none',
    '[&_svg]:shrink-0',
    "[&_svg:not([class*='size-'])]:size-4",
  );

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

    // Fix chrome:// and file:/// URLs
    const urlStart = url.substring(0, 6);
    if (urlStart === 'chrome' || urlStart === 'file:/') {
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
