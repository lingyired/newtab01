# Chrome Web Store Permissions Justification

> Submission-time document for the Chrome Web Store review team. Explains what each permission does, the user-facing feature it enables, and why the extension needs it. Last updated: 2026-06-24.

newtab01 replaces the new tab page with a multi-column bookmark board and adds a toolbar popup for opening 2–4 URLs in a split view. The extension does not run on third-party websites and does not inject scripts into any page.

---

## Permissions

**bookmarks** — Displays the user's full bookmark tree on the new tab page, including the bookmarks bar, other bookmarks, and any folders the user has created. The extension reads the bookmark tree and reacts to bookmark changes so the display stays in sync. It does not add, edit, or delete any bookmark.

**favicon** — Shows the 16×16 site icon next to every bookmark link and search result. Without this permission, bookmarks would appear as a generic placeholder icon.

**topSites** — Powers the "Top Sites" folder on the new tab page, showing the user's most-visited URLs. This is the only way to surface the browser's most-visited list.

**tabs** — Opens the split view in a new tab, lists the user's currently open tabs as split-view candidates in the popup, and cleans up state when the split-view tab is closed. The extension opens new tabs only; it does not modify the URL of existing tabs or close tabs the user did not ask to close.

**tabGroups** — Powers the "Group" action on a folder header, which opens every link in the folder and wraps them in a single Chrome native tab group.

**storage** — Saves the user's settings (theme, dark mode, font, font size, column width, layout, custom themes, undo history) so they survive a browser restart and stay in sync across the user's devices.

**fontSettings** — Lists the fonts installed on the user's system so the Appearance tab's font dropdown can offer a real choice. Without it the dropdown would have to be a static list that does not reflect what the user has installed.

**sessions** — Powers the "Recently Closed" folder on the new tab page, which lets the user re-open a recently closed tab or tab group in one click.

**alarms** — Schedules background housekeeping tasks (debounced settings saves, periodic cleanup) that survive the browser suspending the extension's service worker. This is the standard replacement for setTimeout / setInterval in Manifest V3.

**declarativeNetRequest** — Allows the split view to embed 2–4 user-selected URLs in iframes on a single new tab. Many websites block iframe embedding via response headers; this permission lets the extension remove those headers for the duration of the active split-view session only.

**search** — When the user types into the new tab page's search box and presses Enter without selecting a bookmark result, the extension forwards the query to the user's default search engine (as configured in Chrome settings). This respects the user's choice rather than hard-coding a specific engine.

**contextMenus** — Adds an "Options" item to the extension's toolbar icon right-click menu, giving the user a way to open the settings page from the toolbar.

---

## host_permissions: <all_urls>

Three independent features need access to all URLs; any one of them would justify the declaration on its own:

1. **Split-view iframe embedding.** The user picks 2–4 URLs from their bookmarks or open tabs, and the extension embeds them in iframes. The URLs are arbitrary user input — any site the user has bookmarked.
2. **Favicon fetching.** The extension fetches a 16×16 icon for every bookmark URL so bookmarks display with their real site icon.
3. **Custom theme import.** The "Custom Themes" tab lets the user paste a tweakcn theme URL, and the extension fetches the theme JSON.

The extension does not read page content, does not inject scripts, and does not modify network requests for any website outside the active split-view session.

---

## Privacy

- No analytics, no telemetry, no third-party SDKs.
- No content scripts. The extension does not run JavaScript on any third-party website.
- No remote code. The extension ships a fixed bundle.
- All settings are stored locally or synced via Chrome's built-in storage. Nothing is uploaded to a server.
- Network requests are limited to: the favicon endpoint (Chrome internal), the user's split-view URLs (in iframes the user explicitly opened), and an optional tweakcn theme JSON fetch when the user clicks "Import".
