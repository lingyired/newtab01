# Chrome Web Store Permissions Justification

> Submission-time document for the Chrome Web Store review team.
> Describes each permission declared in `manifest.json`, the user-facing
> feature that depends on it, and why no narrower permission would work.
> Last updated: 2026-06-24.

---

## 1. Permissions declared in `manifest.json`

```json
"permissions": [
  "bookmarks", "favicon", "topSites", "tabs", "tabGroups",
  "storage", "fontSettings", "sessions", "alarms",
  "declarativeNetRequest", "search", "contextMenus"
],
"host_permissions": ["<all_urls>"],
"optional_permissions": []
```

The extension is a New Tab Page (`chrome_url_overrides.newtab`) plus a
toolbar popup (`action.default_popup`). It does not run on third-party
websites and does not inject content scripts.

---

## 2. Per-permission justification

### 2.1 `bookmarks`

**Feature**: New Tab Page bookmark tree, drag-to-reorder, special folders
(Bookmarks Bar / Other Bookmarks / Top Sites / Recently Closed / Apps),
bookmark search index.

**Why required**: The NTP renders the user's full bookmark tree (folder
hierarchy + every link). `chrome.bookmarks.getTree()` is the only API that
returns the complete tree structure. `chrome.bookmarks.onChanged / onMoved
/ onCreated / onRemoved` listeners are required to keep the displayed tree
and the Fuse.js search index in sync without polling. The extension is
read-only with respect to bookmarks — it does not create, edit, or delete
any bookmark via this API; it only reads and re-orders folders in the
user's own NTP layout.

### 2.2 `favicon`

**Feature**: 16×16 / 32×32 site icons next to every bookmark link and
search result.

**Why required**: Chrome's `/_favicon/?pageUrl=...&size=16` endpoint is the
only reliable, same-origin-free way to fetch favicons for arbitrary
bookmark URLs without bundling icon assets or depending on third-party
services. The endpoint requires this permission to authenticate the
caller as a Chrome extension.

### 2.3 `topSites`

**Feature**: The "Top Sites" special folder on the NTP, showing the user's
most frequently visited URLs.

**Why required**: `chrome.topSites.get()` is the only API that exposes the
browser's most-visited URL list. No narrower alternative exists.

### 2.4 `tabs`

**Feature**: Popup "Open Tabs" picker; folder actions that open a group
of URLs in a split view; closing the previous NTP iframe in split view;
validating that candidate URLs are usable before invoking the split engine.

**Why required**: `chrome.tabs.create()` is used to open the split view in
a new tab. `chrome.tabs.query({ url: [...] })` is used by the popup's
"Open Tabs" tab to list the user's currently open tabs as split-view
candidates. `chrome.tabs.onRemoved` is used to clean up state when the
split-view tab is closed by the user. The extension does not modify
existing tabs' URLs, close unrelated tabs, or read tab content — it only
opens new tabs and lists titles/URLs of tabs the user can already see.

### 2.5 `tabGroups`

**Feature**: The "Group" action on a folder header — opens every URL in
the folder and groups them under a single Chrome native tab group.

**Why required**: `chrome.tabs.group()` and `chrome.tabGroups.update()`
are the only APIs that create and label native tab groups. No narrower
alternative exists.

### 2.6 `storage`

**Feature**: Persists user settings (theme, dark mode, font, font size,
column width, alignment, custom CSS, per-theme overrides, layout
snapshot, undo history) across browser restarts; persists runtime-
imported custom themes and layout state locally.

**Why required**: Settings must survive browser restarts and sync across
the user's devices. `chrome.storage.sync` is used for settings (100 KB
quota, cross-device sync). `chrome.storage.local` is used for the larger
layout snapshot, custom theme palette JSON, and undo history (10 MB
quota). `chrome.storage.onChanged` powers live in-place UI refresh when
settings change.

### 2.7 `fontSettings`

**Feature**: The "Font" dropdown in the Appearance tab enumerates the
fonts installed on the user's system so the user can pick one for the
NTP body text.

**Why required**: `chrome.fontSettings.getFontList()` is the only API
that lists the fonts installed at the OS / browser level. Without it,
the font dropdown would be a static list and would not reflect what the
user actually has available.

### 2.8 `sessions`

**Feature**: The "Recently Closed" special folder on the NTP, showing
the user's most recently closed tabs and tab groups so they can be
re-opened in one click.

**Why required**: `chrome.sessions.getRecentlyClosed()` is the only API
that exposes the closed-tab history. No narrower alternative exists.

### 2.9 `alarms`

**Feature**: Service Worker scheduled tasks — debounced re-aggregation
of storage writes, context menu rebuilds on language change, periodic
housekeeping.

**Why required**: Chrome may suspend the Service Worker at any time,
which would lose any pending `setTimeout` / `setInterval`. The
`chrome.alarms` API persists timers across SW suspensions and is the
Web Store–recommended replacement for these in Manifest V3. No narrower
alternative exists.

### 2.10 `declarativeNetRequest`

**Feature**: The split-view engine embeds 2–4 user-selected URLs in
`<iframe>` elements on a single new tab. Many websites send
`X-Frame-Options: DENY` or `Content-Security-Policy: frame-ancestors ...`
headers that would otherwise block embedding.

**Why required**: The extension uses **dynamic** DNR rules
(`updateDynamicRules`) scoped to the current split-view session only —
the rules are added when the user opens a split view and removed when
they close it. Static DNR rules in `rules.json` are NOT used. The
permission is needed to call `chrome.declarativeNetRequest.updateDynamicRules`.

### 2.11 `search`

**Feature**: When the NTP search box has input and the user hits Enter
without selecting a bookmark result, the extension forwards the query
to the user's default search engine (as configured in `chrome://settings/searchEngines`).

**Why required**: `chrome.search.query()` is the only API that respects
the user's default search engine preference without bundling our own
search provider configuration. Using `<form action="https://www.google.com/search">`
would hard-code a specific engine and ignore the user's choice.

### 2.12 `contextMenus`

**Feature**: Right-clicking the extension's toolbar icon shows a
"Options" menu item that opens the settings page.

**Why required**: `chrome.contextMenus.create()` is the only way to add
a custom entry to the extension's toolbar icon right-click menu. The
`action.default_popup` only fires on left-click.

---

## 3. `host_permissions: ["<all_urls>"]`

**Required by three features** (any one of which would justify the
declaration on its own):

1. **Split-view iframe embedding.** The user picks 2–4 URLs from their
   bookmarks or open tabs and the extension embeds them in iframes. The
   URLs are arbitrary user input — any site the user has bookmarked.
2. **Favicon fetching.** `/_favicon/?pageUrl=...&size=16` makes cross-
   origin requests for every bookmark URL.
3. **Tweakcn theme import.** The "Custom Themes" tab lets the user
   paste a `https://tweakcn.com/themes/<id>` URL or `https://tweakcn.com/r/themes/<id>`
   JSON URL; the extension fetches the JSON via `fetch()` in the Service
   Worker. The theme JSON itself can reference arbitrary `url(https://...)`
   assets.

The extension does not read page content, does not inject scripts, and
does not modify network requests for any website outside the split-view
iframe session.

---

## 4. Privacy practices summary

- **No data leaves the device.** All settings live in `chrome.storage.sync` /
  `chrome.storage.local`; theme JSON fetched from tweakcn is stored locally
  and never re-sent.
- **No analytics, no telemetry, no third-party SDKs.** The runtime
  dependencies are `fuse.js` (search), `@crxjs/vite-plugin` (build only),
  and Vite (build only).
- **No content scripts.** The extension does not run JavaScript on any
  third-party website.
- **No remote code.** The extension ships a fixed bundle; the only network
  requests are the favicon endpoint (Chrome internal), the user's split-
  view URLs (in iframes), and the optional tweakcn theme JSON fetch.
- **No `management` permission.** Earlier prototypes used
  `chrome.management.getAll()` to surface installed PWAs, but Edge does
  not expose user-installed PWAs through that API, and the feature was
  re-implemented as a UA-detected link to `chrome://apps` / `edge://apps`.
  The permission and all related code are removed.

---

## 5. Permission changes vs. earlier versions

| Permission | Status | Notes |
|------------|--------|-------|
| `management` | **Removed** | Replaced with UA-detected `chrome://apps` / `edge://apps` link. No `chrome.management.*` call sites remain in the bundle. |
| `declarativeNetRequest` | **Kept (dynamic only)** | No `rules.json` static file. Dynamic rules scoped to the active split-view session and torn down on close. |

All other permissions have been continuously required since the first
Manifest V3 release of newtab01.
