// Favicon rendering using Chrome extension /_favicon/ API
// Per CLAUDE.md 9.5: use /_favicon/?pageUrl=...&size=16 with srcSet for 2x

/** Cache for same-origin favicon URLs to avoid duplicate generation */
const faviconCache = new Map<string, string>();

/** Generate favicon URL using Chrome extension internal API */
function getFaviconUrl(pageUrl: string, size: number): string {
  return `/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}

/** Create an icon element (img or placeholder div) */
export function createFavicon(url?: string, icons?: Array<{ url: string; size: number }>, icon?: string): HTMLElement {
  let src: string | undefined;
  let src2x: string | undefined;

  if (icons && icons.length > 0) {
    // Pick best icon from app icons list
    let bestSize: number | undefined;
    for (const iconInfo of icons) {
      if (iconInfo.url && (!bestSize || (iconInfo.size < bestSize && iconInfo.size > 15))) {
        src = iconInfo.url;
        if (iconInfo.size > 31) src2x = iconInfo.url;
        bestSize = iconInfo.size;
      }
    }
  } else if (icon) {
    src = icon;
  } else if (url) {
    // Check cache first
    const cached = faviconCache.get(url);
    if (cached) {
      src = cached;
    } else {
      src = getFaviconUrl(url, 16);
      src2x = getFaviconUrl(url, 32);
      faviconCache.set(url, src);
    }
  }

  const element = src ? document.createElement('img') : document.createElement('div');
  element.classList.add('icon');

  if (element instanceof HTMLImageElement && src) {
    element.src = src;
    if (src2x) element.srcset = `${src2x} 2x`;
    element.alt = ' ';
  }

  return element;
}

/** Clear favicon cache (useful when settings change) */
export function clearFaviconCache(): void {
  faviconCache.clear();
}
