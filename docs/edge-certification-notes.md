# Edge Add-ons Notes for Certification

> Drop-in copy for the Edge Add-ons Partner Center "Notes for certification" field. Internal only — never shown to end users. Last updated: 2026-06-27.

Edge Add-ons Partner Center → Submission → **Notes for certification** (≤ 2,000 chars). Use this to tell the certification reviewer how to install, what to test, and any non-obvious behaviour.

---

## Field copy (≤ 2,000 chars)

```
Thank you for reviewing newtab01. This extension is a Microsoft Edge
new tab page plus a small toolbar popup. Please use the following
test plan.

INSTALL
1. Unzip newtab01-1.0.13.zip and load the unzipped folder via
   edge://extensions → enable Developer mode → "Load unpacked".
2. A new tab should now show a multi-column bookmark board
   instead of the Edge default new tab.

WHAT TO TEST
- New Tab Page: bookmark folders render as draggable columns. Drag
  a folder within or across a column; drop at a column edge to
  create a new one. A folder can only appear in one column.
- Folder actions (the three small icons in each folder header):
  "Open all" (one tab per link), "Open as group" (Chrome tab
  groups — `chrome.tabGroups` is exposed by Edge under the same
  name), "Open in split view" (2/3/4-grid iframe page).
- Right-click on a folder offers the same three actions.
- Fuzzy bookmark search: press Ctrl + K, type a query, use
  arrow keys to navigate, Enter to open. With no selection, Enter
  forwards the query to the default search engine.
- Toolbar popup: click the extension icon, switch to the "Open
  Tabs" tab, pick 2–4 tabs and a layout, click "Open Split".
- Themes: open edge://extensions → newtab01 → Options → Appearance
  tab. Switch between the 12 built-in tweakcn themes. Toggle dark
  mode (system / light / dark). Try "Custom themes" tab → paste
  any tweakcn theme URL to test the runtime import.

NOT NEEDED
- No account, no login, no first-run wizard.
- The first new tab after install may take ~500ms to render while
  the bookmark tree is fetched from the browser.
- An undo button (top-right) appears after layout edits.
- All data is stored locally; nothing leaves the device.
```

Char count: ~1,470 / 2,000 ✓ (well within budget).

---

## What the reviewer is told that the user is not

| Point | Why include it |
|-------|----------------|
| How to load the unpacked extension | Edge Partner Center accepts either unpacked folders or packaged CRX-style zips. Tell them explicitly. |
| Which features to actually click | Saves the reviewer from having to explore; turns certification into a 10-minute checklist. |
| "chrome.tabGroups" works in Edge | Edge re-exports the Chrome namespace — the reviewer might wonder. |
| No login / no first-run wizard | Avoids the reviewer flagging "but how do I sign in?" |
| Bookmark-fetch latency on first NTP | Pre-empts "page is blank" reports. |
| Undo button is at the top-right | Reviewer might miss it. |
| Privacy posture | Confirms "data leaves device" question from the Edge privacy questions. |

---

## Privacy-practice answers (for the same Partner Center form)

Edge Add-ons certification asks a separate privacy questionnaire. Answers match `docs/permissions.md` §Privacy:

| Question | Answer |
|----------|--------|
| Does the extension collect or transmit personal data? | Yes (bookmarks + open tab URLs read locally) |
| Is data sent to a third party? | No |
| Is data used outside the extension's core functionality? | No |
| Does the extension collect data from children under 13? | No |

Justification paragraph (paste into the free-text field if Edge asks for one):

```
newtab01 reads the user's Edge bookmark tree to render a multi-
column bookmark board on every new tab. It also reads the list of
currently open tabs and recently closed tabs so the user can pick
them as split-view candidates. No data leaves the device. All
settings (theme, dark mode, language, layout, custom themes,
undo history) are stored in chrome.storage.sync and
chrome.storage.local. The extension does not inject content
scripts, does not run remote code, and does not contact any
third-party analytics service.
```
