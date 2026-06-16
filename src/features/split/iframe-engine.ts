import type { SplitEngine, SplitLayout, SplitHandle } from './types';
import { createTab } from '../../lib/chrome/bookmarks';
import { removeTab } from '../../lib/chrome/tabs';
import * as debug from '../../lib/debug';

export class IframeSplitEngine implements SplitEngine {
  readonly id = 'iframe' as const;
  readonly displayName = 'Iframe Split';

  async open(urls: string[], layout: SplitLayout): Promise<SplitHandle> {
    const encodedUrls = encodeURIComponent(JSON.stringify(urls));
    const hash = `#urls=${encodedUrls}&layout=${layout.mode}`;
    const splitUrl = `chrome-extension://${chrome.runtime.id}/newtab.html?split=1${hash}`;

    debug.log('split', 'iframe open', { urlCount: urls.length, layout: layout.mode, splitUrl });
    const tab = await createTab(splitUrl, true);

    return {
      id: String(tab?.id ?? Date.now()),
      kind: 'iframe-page',
      urls,
      layout,
    };
  }

  async close(handle: SplitHandle): Promise<void> {
    const tabId = Number(handle.id);
    debug.log('split', 'iframe close', { tabId });
    if (!isNaN(tabId)) {
      await removeTab(tabId);
    }
  }
}
