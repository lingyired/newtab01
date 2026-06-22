// Split-view link picker — floating overlay that lets the user select up
// to 4 bookmarks from a folder before opening them in split view.
// Triggered by `openSplit` in folder-actions-handler.ts when a folder's
// direct URL children exceed SPLIT_MAX (4). Style mirrors the settings
// panel's overlay/panel (same z-index plan, same CSS variables) but
// renders as a centered card since the content is short.
//
// Public API: `showSplitPicker(urls: BookmarkNode[]): Promise<string[] | null>`
//   - resolves to the selected URLs on confirm (1-4 items)
//   - resolves to null when the user cancels (overlay click, ESC, "Cancel" button)
// Three action buttons at the bottom:
//   Cancel              → resolve(null)
//   Open first N        → resolve(first 4 unconditionally)
//   Open selected       → resolve(current selection, defaulting to first 4)

import type { BookmarkNode } from './types';
import { t } from '../../lib/i18n';

const SPLIT_MAX = 4;

let overlayEl: HTMLElement | null = null;
let panelEl: HTMLElement | null = null;
let escHandler: ((e: KeyboardEvent) => void) | null = null;

export interface PickerEntry {
  url: string;
  title: string;
}

/**
 * Show the picker. Resolves to the selected URL list (1-4 items) on
 * confirm, or null on cancel. The picker is single-instance — a second
 * call while one is open is a no-op (returns null). Caller is expected
 * to call `closeSplitPicker()` or rely on auto-close on resolve.
 */
export function showSplitPicker(entries: PickerEntry[]): Promise<string[] | null> {
  if (panelEl) {
    // Already open — return null so the caller doesn't double-open.
    return Promise.resolve(null);
  }

  // Default selection: the first SPLIT_MAX items pre-checked.
  const selected = new Set<string>(entries.slice(0, SPLIT_MAX).map((e) => e.url));

  return new Promise<string[] | null>((resolve) => {
    overlayEl = document.createElement('div');
    overlayEl.classList.add('sp-overlay', 'split-picker-overlay');
    overlayEl.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    panelEl = document.createElement('div');
    panelEl.classList.add('split-picker-panel');
    panelEl.setAttribute('role', 'dialog');
    panelEl.setAttribute('aria-modal', 'true');
    panelEl.addEventListener('click', (e) => e.stopPropagation());

    // Header
    const header = document.createElement('div');
    header.classList.add('split-picker-header');

    const title = document.createElement('span');
    title.classList.add('sp-title');
    title.textContent = t('splitPicker.title', { max: SPLIT_MAX });
    header.appendChild(title);

    const counter = document.createElement('span');
    counter.classList.add('split-picker-counter');
    counter.textContent = t('splitPicker.counter', { count: selected.size, max: SPLIT_MAX });
    header.appendChild(counter);

    // List
    const list = document.createElement('ul');
    list.classList.add('split-picker-list');
    entries.forEach((entry, index) => {
      list.appendChild(buildRow(entry, index, selected, counter));
    });

    // Footer buttons
    const footer = document.createElement('div');
    footer.classList.add('split-picker-footer');

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.classList.add('sp-btn');
    cancelBtn.textContent = t('splitPicker.cancel');
    cancelBtn.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });

    const openFirstBtn = document.createElement('button');
    openFirstBtn.type = 'button';
    openFirstBtn.classList.add('sp-btn');
    openFirstBtn.textContent = t('splitPicker.openFirstN', { n: SPLIT_MAX });
    openFirstBtn.addEventListener('click', () => {
      const first4 = entries.slice(0, SPLIT_MAX).map((e) => e.url);
      cleanup();
      resolve(first4);
    });

    const openSelectedBtn = document.createElement('button');
    openSelectedBtn.type = 'button';
    openSelectedBtn.classList.add('sp-btn-primary');
    openSelectedBtn.textContent = t('splitPicker.openSelected');
    openSelectedBtn.addEventListener('click', () => {
      const picked = entries
        .map((e) => e.url)
        .filter((url) => selected.has(url));
      if (picked.length === 0) return; // require at least 1 selection
      cleanup();
      resolve(picked);
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(openFirstBtn);
    footer.appendChild(openSelectedBtn);

    panelEl.appendChild(header);
    panelEl.appendChild(list);
    panelEl.appendChild(footer);

    document.body.appendChild(overlayEl);
    document.body.appendChild(panelEl);

    // ESC to cancel
    escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    };
    document.addEventListener('keydown', escHandler);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      overlayEl?.classList.add('sp-overlay--visible');
      panelEl?.classList.add('split-picker-panel--open');
    });
  });
}

/** Build a single row in the picker list. */
function buildRow(entry: PickerEntry, index: number, selected: Set<string>, counter: HTMLElement): HTMLLIElement {
  const li = document.createElement('li');
  li.classList.add('split-picker-item');

  // Use the row index rather than the URL for the checkbox id: URLs
  // may contain characters that aren't valid in an HTML id (e.g. a
  // query string with `?` or `#`), and two entries could in theory
  // share a URL. The label association only needs uniqueness within
  // this dialog.
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = selected.has(entry.url);
  checkbox.id = `split-picker-row-${index}`;

  const label = document.createElement('label');
  label.htmlFor = checkbox.id;
  label.classList.add('split-picker-label');

  const titleSpan = document.createElement('span');
  titleSpan.classList.add('split-picker-title');
  titleSpan.textContent = entry.title || entry.url;
  label.appendChild(titleSpan);

  const urlSpan = document.createElement('span');
  urlSpan.classList.add('split-picker-url');
  urlSpan.textContent = entry.url;
  label.appendChild(urlSpan);

  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      // Cap at SPLIT_MAX — refuse the check rather than auto-evicting
      // an older selection, which would be surprising.
      if (selected.size >= SPLIT_MAX) {
        checkbox.checked = false;
        return;
      }
      selected.add(entry.url);
    } else {
      selected.delete(entry.url);
    }
    // Re-evaluate disabled state for the other checkboxes
    const rows = li.parentElement?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? [];
    for (const cb of rows) {
      cb.disabled = !cb.checked && selected.size >= SPLIT_MAX;
    }
    counter.textContent = t('splitPicker.counter', { count: selected.size, max: SPLIT_MAX });
  });

  li.appendChild(checkbox);
  li.appendChild(label);
  return li;
}

/** Remove the picker DOM nodes + listeners. Idempotent. */
function cleanup(): void {
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  if (overlayEl) {
    overlayEl.classList.remove('sp-overlay--visible');
    overlayEl.remove();
    overlayEl = null;
  }
  if (panelEl) {
    panelEl.classList.remove('split-picker-panel--open');
    panelEl.remove();
    panelEl = null;
  }
}

/** Export the cap so other modules (e.g. the handler) can share the constant. */
export const SPLIT_VIEW_MAX = SPLIT_MAX;

/** Re-export the entry shape for the caller. */
export type { PickerEntry as SplitPickerEntry };

// Re-export for callers that prefer passing BookmarkNode[] directly.
export function showSplitPickerFromNodes(nodes: BookmarkNode[]): Promise<string[] | null> {
  return showSplitPicker(
    nodes
      .filter((n) => typeof n.url === 'string' && n.url.length > 0)
      .map((n) => ({ url: n.url as string, title: n.title })),
  );
}
