// URL import — accept a tweakcn theme URL (or JSON URL) into the
// settings panel's import section. The URL is auto-normalized to
// the JSON form (theme URL → JSON URL by inserting /r/), then
// fetched via the service worker (background.ts) and routed
// through validateThemeJson() just like a raw JSON paste would be.
//
// Why route through JSON: the downstream pipeline (validate +
// install + inject + auto-switch) was built around the
// TweakcnJson shape and is the single source of truth for
// "what counts as a valid tweakcn theme". Re-deriving that
// pipeline for CSS → JSON would be duplicate work — easier to
// keep the URL path a thin wrapper that produces the same JSON
// the CSS / direct-JSON paths produce.
//
// Scope: tweakcn.com only. See spec for why we don't generalize
// to any URL — it's an anti-feature (accidental fetch of random
// URLs, no other tweakcn-compatible source in scope).

/** Distinguish a tweakcn theme URL (no `/r/`) from a JSON URL
 *  (already has `/r/`). Returns null if the input doesn't
 *  match the tweakcn URL shape at all. */
export type TweakcnUrlKind = 'theme' | 'json';

const TWEAKCN_URL_RE = /^https?:\/\/tweakcn\.com\/(r\/)?themes\/[\w-]+/i;

export function detectTweakcnUrl(raw: string): TweakcnUrlKind | null {
  const match = TWEAKCN_URL_RE.exec(raw);
  if (!match) return null;
  return match[1] === 'r/' ? 'json' : 'theme';
}

/** Normalize any tweakcn URL to the JSON URL form. JSON URLs
 *  pass through unchanged; theme URLs get `/r/` inserted into
 *  the path. Preserves query string / hash / trailing path that
 *  may follow the theme id. */
export function toTweakcnJsonUrl(url: string): string {
  if (/\/r\/themes\//.test(url)) return url;
  return url.replace('/themes/', '/r/themes/');
}
