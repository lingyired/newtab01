# newtab01

> Bookmark-driven new tab for Chrome. Open folders as tab groups or in split view. 12 themes + custom ones from tweakcn.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE_MIT.txt)
[![Manifest V3](https://img.shields.io/badge/manifest-MV3-4285F4.svg)](manifest.json)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-v1.0.18-0f9d58.svg)](https://chromewebstore.google.com/detail/newtab01/nlecfkdndodablijmfcjbnannkgmpegj)
[![Built with Vanilla JS](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20Vite-f7df1e.svg)](#tech-stack)
[![Co-authored by TRAE.AI](https://img.shields.io/badge/co--author-TRAE.AI-7c3aed.svg)](#credits)

[English](README.md) · [中文](docs/README.zh.md)

---

## Install

[<img src="https://img.shields.io/badge/Chrome%20Web%20Store-Install-green?style=for-the-badge&logo=google-chrome&logoColor=white" height="40" alt="Install newtab01 for Chrome">](https://chromewebstore.google.com/detail/newtab01/nlecfkdndodablijmfcjbnannkgmpegj)

The extension is published on the Chrome Web Store. Click the badge
above (or use [this direct link](https://chromewebstore.google.com/detail/newtab01/nlecfkdndodablijmfcjbnannkgmpegj))
to install the latest published version. An Edge Add-ons listing is
in progress.

If you want to load an unpacked build for development instead, see
[Development](#development) below.

---

## Overview

**newtab01** is a Chrome New Tab Page extension that replaces the
default new tab with a multi-column bookmark board.

- **Multi-column bookmark board** with drag-to-reorder and special folders (Bookmarks Bar / Top Sites / Recently Closed / Apps)
- **Folder batch actions** — open all, open as a Chrome tab group, or open the whole folder in a split view
- **Fuzzy bookmark search** via `⌘` / `Ctrl + K` (fuse.js, title + URL, weights 0.7 / 0.3)
- **Popup split view** — pick 2–4 URLs from bookmarks or open tabs and pin them into a real iframe split view (`2h` / `2v` / `3H` / `4grid`)
- **12 built-in themes** sourced from [tweakcn](https://tweakcn.com), plus **unlimited runtime imports** (paste a tweakcn URL or CSS block)
- **10 languages** with live in-place UI refresh
- **Per-theme, per-mode appearance overrides** and user CSS

![Multi-column bookmark board — the new tab overview](extension-previews/newtab.png)

The whole new-tab bundle ships under 30 KB gzipped.

---

## Features

### 1. Folder batch actions

A folder with 30 links shouldn't take 30 clicks. Every folder header
exposes three actions:

- **Open all** — spread every link into new tabs
- **Open as group** — wrap them in a Chrome native tab group
- **Open in split view** — drop the whole folder into a 2x / 3 / 4-grid split view

![Open folder as Chrome tab group](extension-previews/open%20as%20tab%20group.png)

![Open folder in split view](extension-previews/open%20in%20split%20view.png)

![Right-click menu on a folder](extension-previews/right%20click.png)

### 2. Drag-and-drop layout

Your new tab, your layout.

- Drag folders within a column or across columns
- Drop at a column edge to create a new one
- A folder lives in exactly one column — no duplicates
- Empty columns auto-disappear (one is always kept)
- Special folders (Bookmarks Bar, Top Sites, Recently Closed, Apps) can sit anywhere, not just at the end

![Drag a folder to another column](extension-previews/drag%20to%20move.png)

![Drag to a column edge to create a new column](extension-previews/drag%20to%20create%20new%20column.png)

### 3. Bookmark search (`⌘` / `Ctrl + K`)

Press a shortcut, type, hit enter. Fuzzy-matched against bookmark
titles and URLs (weights 0.7 / 0.3, threshold 0.4) with up/down arrow
navigation. No selection? Enter forwards the query to your default
search engine.

![Bookmark fuzzy search via ⌘/Ctrl + K](extension-previews/search.png)

### 4. Popup split view

Click the toolbar icon to open a small dialog with two tabs:
**Bookmarks** and **Open Tabs**. Pick 2–4 URLs, pick a layout
(`2h` / `2v` / `3H` / `4grid`), hit **Open Split** — a new tab
opens with the URLs side-by-side in real iframes. Same engine is used
by the folder "open in split" action.

![Popup: open a split view from the toolbar icon](extension-previews/open%20split%20by%20click%20icon.png)

![Split view in action — 4 URLs in a 2×2 grid](extension-previews/split%20view.png)

### 5. Themes & personalization

- **12 built-in themes** sourced from [tweakcn](https://tweakcn.com)
  (AstroVista, MX-Brutalist, Remedy's Control, Magic 2, Astra, Mimi,
  Manga Vibe, win86, Random Theme 02, Rose, Kawi Green, Optimus)
- **Unlimited runtime imports** — paste a tweakcn URL or `:root { ... }`
  CSS block into the "Custom Themes" tab; the extension validates
  it and installs it in one click
- **Independent dark mode setting** (`system` / `light` / `dark`) —
  every theme only appears once in the picker; the dark variant is
  selected automatically
- **Per-theme appearance overrides** — font, font size, font weight,
  five colors, shadow blur, and link corner radius can be overridden
  per `(theme, light/dark)` pair
- **10 languages** — `en` / `zh` / `es` / `ar` / `hi` / `fr` / `pt` /
  `de` / `ja` / `ru`, with live in-place UI refresh on language switch
- **Per-theme, per-mode user CSS** — drop in a snippet to override
  the theme for a specific (theme, light/dark) combination

![Change theme in the Appearance settings](extension-previews/change%20theme.png)

![Dark mode preview](extension-previews/dark%20mode.png)

![Install a custom theme from a tweakcn URL](extension-previews/install%20theme.png)

![Custom theme picker with the new theme active](extension-previews/install%20theme%202.png)

### 6. Privacy

- No analytics, no telemetry, no third-party SDKs
- No content scripts, no remote code
- All settings stored locally / in `chrome.storage.sync` — never
  uploaded to any server
- See [docs/permissions.md](docs/permissions.md) for the full
  Chrome Web Store permissions justification

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Build | Vite + `@crxjs/vite-plugin` | Modular bundling, extension-aware HMR |
| UI | Hand-written HTML / CSS | Lightweight, no framework runtime |
| State | Plain JS modules + `chrome.storage` | No framework overhead |
| Search | `fuse.js` | 7 KB, zero deps |
| Drag & drop | Native HTML5 Drag & Drop | No dependency, full control over the event lifecycle |
| Animation | CSS transitions / animations | No dependency |
| Persistence | `chrome.storage.sync` (settings) + `chrome.storage.local` (layout) | Cross-device sync, room for larger local objects |

---

## Architecture

| Context | Entry | Responsibility |
|---------|-------|----------------|
| Service Worker | `src/background.ts` | Message routing, `tabGroups`, `alarms`, context menu, theme JSON fetch |
| New Tab | `newtab.html` | Bookmark tree, search, drag, split view (`?split=1`) |
| Options | `options.html` | Settings UI (native form + `chrome.storage`) |
| Popup | `popup.html` | URL picker that triggers split view |

```
src/
├── background.ts             # Service Worker
├── lib/
│   ├── chrome/               # chrome.* API typed wrappers
│   ├── storage/              # chrome.storage unified access
│   ├── i18n/                 # 10-locale catalog + t()
│   └── platform.ts
├── newtab/                   # NTP entry
├── popup/                    # Toolbar popup entry
└── features/
    ├── bookmarks/            # Tree, columns, folders, drag targets
    ├── drag-drop/            # Native HTML5 DnD
    ├── search/               # fuse.js search + overlay
    ├── split/                # Split engine abstraction + iframe engine
    ├── settings/             # Apply pipeline
    └── themes/               # Switcher, custom themes, tweakcn import
```

### Performance budget

| Metric | Budget | Strategy |
|--------|--------|----------|
| New Tab first-load JS | ≤ 80 KB gzipped | Vite chunk split by route |
| New Tab FCP | < 200 ms | Bookmark data from `chrome.storage.local` cache, skeleton on first paint |
| Service Worker | < 10 KB | Routing + alarms only, no heavy deps |
| Drag & drop | 60 fps | Native DnD, no per-frame re-render |

---

## Development

```bash
# Install dependencies
pnpm install

# Dev mode (with HMR)
pnpm dev

# Production build (output in dist/)
pnpm build
```

After `pnpm build`, load `dist/` as an "unpacked extension" in
`chrome://extensions/` (Developer mode on).

See [CLAUDE.md](CLAUDE.md) for the full engineering conventions and
[docs/i18n.md](docs/i18n.md) for the internationalization workflow.

---

## License

MIT — see [LICENSE_MIT.txt](LICENSE_MIT.txt).

---

## Credits

Maintained by [@lingyired](https://github.com/lingyired).
AI co-author: **TRAE.AI**.

> "Built with humans and AI, in the open."

---

## Inspiration

Inspired by [Humble New Tab Page](https://github.com/ibillingsley/HumbleNewTabPage)
by [ibillingsley](https://github.com/ibillingsley) and contributors (MIT).

---

## Roadmap

- Bookmark editing (currently read-only + drag-to-reorder)
- History search (currently bookmarks only)
- `NativeSplitEngine` based on the Chrome Window Placing API
- Virtualized list rendering for thousands of bookmarks
- Firefox support
