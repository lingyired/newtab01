# Chrome Web Store Listing Copy

> Drop-in copy for the Chrome Web Store Developer Dashboard.
> Last updated: 2026-06-24.

Chrome Web Store listing has 4 fields: **Summary** (≤ 132 chars), **Description** (≤ 16,384 chars), **Category**, and **Language**. Plus images (icon, marquee, small promo tile, screenshots).

---

## 1. Summary (≤ 132 chars)

This is the line that appears in search results and the top of the store page. It MUST be under 132 characters.

```
Multi-column bookmark board with drag-to-reorder, fuzzy search (Ctrl/⌘+K), popup split view, and 12 tweakcn themes.
```

Char count: ~121 ✓

**Alternative (more action-oriented):**

```
Replaces Chrome's new tab with a fast, calm, multi-column bookmark board. Drag, search, split-view, 12 themes.
```

Char count: ~117 ✓

---

## 2. Description (≤ 16,384 chars)

Plain text / lightly-formatted (no Markdown rendering in the store). The store does honor single line breaks and basic lists, so we can use bullets.

```
newtab01 is a fast, minimal Chrome New Tab Page built around the three things that actually matter when you open a new tab: your bookmarks, your work, and a calm screen to think on.

It replaces Chrome's default new tab with a multi-column bookmark board. Folders are draggable, dockable, and a single folder's worth of links can be opened as a Chrome tab group, dropped into a real iframe split view, or just blasted into a row of new tabs. Fuzzy search by ⌘/Ctrl + K jumps straight to any bookmark. 12 themes ship out of the box and you can install unlimited more from tweakcn in one paste.

═══ HIGHLIGHTS ═══

★ Multi-column bookmark board
  • Folders laid out as a board of equal-width columns
  • Drag folders within or across columns
  • Drop at a column edge to create a new one
  • A folder only appears in one column — no duplicates
  • Empty columns auto-disappear (one is always kept)
  • Special folders (Bookmarks Bar / Top Sites / Recently Closed / Apps) can sit anywhere

★ Folder batch actions
  • Open all — every link in a new tab
  • Open as group — wrapped in a Chrome native tab group
  • Open in split view — the whole folder in a 2x / 3 / 4-grid iframe view
  • Right-click menu offers the same three actions

★ Fuzzy bookmark search (⌘ / Ctrl + K)
  • Press a shortcut, type, hit enter
  • Matches against bookmark title and URL
  • ↑/↓ to navigate results, Enter to open
  • No selection + Enter forwards the query to your default search engine

★ Popup split view
  • Click the toolbar icon to open a small dialog
  • Bookmarks tab or Open Tabs tab
  • Pick 2–4 URLs, pick a layout (2h / 2v / 3H / 4grid)
  • A new tab opens with the URLs in real iframes side by side
  • Same engine is used by the folder "open in split" action

★ Themes & personalization
  • 12 built-in themes sourced from tweakcn: AstroVista, MX-Brutalist, Remedy's Control, Magic 2, Astra, Mimi, Manga Vibe, win86, Random Theme 02, Rose, Kawi Green, Optimus
  • Unlimited runtime imports — paste a tweakcn URL or a :root { ... } CSS block into the Custom Themes tab; the extension validates and installs in one click
  • Independent dark mode setting (system / light / dark) — every theme only appears once in the picker; the dark variant is selected automatically
  • Per-theme appearance overrides — font, font size, font weight, five colors, shadow blur, and link corner radius can be overridden per (theme, light/dark) pair
  • Per-theme, per-mode user CSS — drop a snippet to override one (theme, mode) combination
  • 10 languages: English, 中文, Español, العربية, हिन्दी, Français, Português, Deutsch, 日本語, Русский — with live in-place UI refresh

★ Privacy
  • No analytics, no telemetry, no third-party SDKs
  • No content scripts, no remote code
  • All settings stored locally or in chrome.storage.sync — never uploaded anywhere
  • Full permissions justification: see docs/permissions.md on the GitHub repo

═══ TECHNICAL ═══

• Manifest V3
• Built with vanilla JS + Vite — no framework runtime
• Native HTML5 drag & drop, no DnD library
• fuse.js for the search engine (7 KB, zero deps)
• Under 30 KB gzipped new-tab bundle

═══ OPEN SOURCE ═══

MIT licensed. The whole source tree is on GitHub:
https://github.com/lingyired/newtab01

Inspired by Humble New Tab Page by ibillingsley (MIT).
```

Char count: ~2,600 ✓ (well under 16,384)

---

## 3. Category

Chrome Web Store categories (pick the **most specific single** primary category):

- **Primary:** Productivity
- (No secondary; pick Productivity as the dominant category — bookmark management is the core feature)

The store also has a "Privacy practices" single-select. Pick:

- **Does the extension handle personal data?** Yes — bookmarks and tab URLs are user data accessed via permissions
- **Does the extension use or transfer data to third parties?** No
- **Does the extension collect or use data that is not directly related to the extension's core functionality?** No

---

## 4. Language

- **Primary language:** English
- (We have 10 catalog locales for the in-app UI, but the store listing is the listing — English is the standard for Chrome Web Store discoverability)

---

## 5. Images

Chrome Web Store image requirements (as of 2026-06):

| Asset | Size | Notes |
|-------|------|-------|
| Icon | 128×128 PNG | Required. Use `icons/icon_128.png` |
| Marquee promo tile | 1400×560 PNG or JPG | Optional. Strongly recommended. |
| Small promo tile | 440×280 PNG or JPG | Optional |
| Screenshots | 1280×800 or 640×400 PNG or JPG | Up to 5. **Required to publish** |

The 14 images under `extension-previews/` are mostly NTP / popup / settings UI captures. Recommended screenshot selection for the store:

| Order | File | What it shows |
|-------|------|---------------|
| 1 | `extension-previews/newtab.png` | Main new-tab board — most important |
| 2 | `extension-previews/drag to create new column.png` | Drag-to-create-column signature feature |
| 3 | `extension-previews/split view.png` | Split view in action |
| 4 | `extension-previews/search.png` | ⌘/Ctrl + K search panel |
| 5 | `extension-previews/install theme 2.png` | Theme picker (12 themes + runtime import) |

The store accepts at most 5 screenshots, so pick the 5 that best sell the extension. All 14 remain in the repo for the README.

Image size note: 1280×800 is preferred. If `extension-previews/*.png` are at a different aspect ratio, open them in a 1280×800 editor and either:
- Letterbox / pillarbox to fit (add theme-colored padding to keep the look on-brand)
- Or crop the bottom-most non-essential UI

`extension-previews/open split by click icon.png` and the various other popup / settings shots are great as GitHub README art but may need cropping / resizing for the store's stricter aspect ratio.

---

## 6. Privacy tab answers

In the Chrome Web Store Developer Dashboard → Privacy practices:

| Question | Answer | Notes |
|----------|--------|-------|
| Does this extension handle personal data? | **Yes** | Accesses user bookmarks + tab URLs |
| Is the data transferred to a third party? | **No** | Everything stays local or in chrome.storage.sync |
| Is the data used for purposes unrelated to the core feature? | **No** | Bookmarks are only used to render the NTP |
| Does the extension collect data from children under 13? | **No** | |

**Justification single-paragraph answer (paste into the Privacy practices "Single purpose" + "Data usage" text fields):**

```
newtab01 reads the user's Chrome bookmark tree to render a multi-column
bookmark board on every new tab. It also reads the list of currently
open tabs and recently closed tabs so the user can pick them as
candidates for the split-view picker. No data leaves the device.
All settings (theme, dark mode, language, layout, custom themes, undo
history) are stored in chrome.storage.sync and chrome.storage.local.
The extension does not inject content scripts, does not run remote
code, and does not contact any third-party analytics service.
```

---

## 7. "What's new" / Release notes (for the Dashboard's "Release notes" field per release)

**v1.0.9 — 2026-06-24**

```
• 14 new extension preview screenshots added under extension-previews/ and embedded in the README at the matching feature sections.
• No functional changes. Version 1.0.9 reflects the documentation/asset update.
```

**v1.0.5 — 2026-06-24**

```
• First Chrome Web Store submission.
• New: 12 tweakcn themes (AstroVista, MX-Brutalist, Remedy's Control, Magic 2, Astra, Mimi, Manga Vibe, win86, Random Theme 02, Rose, Kawi Green, Optimus). Dark mode is a single global setting; each theme only appears once in the picker.
• New: Unlimited tweakcn theme import — paste a theme URL or :root { ... } CSS block into the Custom Themes tab and the extension validates + installs it.
• New: Per-theme, per-mode appearance overrides — font, font size, font weight, 5 colors, shadow blur, and link corner radius.
• New: Per-theme, per-mode user CSS in the Appearance tab.
• New: 10 in-app languages (en / zh / es / ar / hi / fr / pt / de / ja / ru) with live in-place UI refresh on language switch (Arabic supports RTL).
• New: Full permissions justification document at docs/permissions.md.
```

---

## 8. Pricing

- **Free**, no in-app purchases, no trial
- Select "Free" + uncheck "In-app purchases" in the Pricing section
