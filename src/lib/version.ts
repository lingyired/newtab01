// Single source of truth for the extension's user-facing version
// string. Kept in sync with `version` in `manifest.json` and
// `package.json` by hand on every release (no build step reads this
// file — `vite.config.ts` only patches `name` + `description` from
// the source manifest into the dist manifest). If the three ever
// drift, the worst that happens is the About tab shows a different
// number than chrome://extensions; the extension still works.
//
// v1.0.0: first Chrome Web Store release.
// v1.0.3: added "More from this author" section to the About tab
//          (1 new author extension + section title).

export const VERSION = '1.0.3';
