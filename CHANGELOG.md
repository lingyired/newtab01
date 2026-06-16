# Changelog

All notable changes to newtab01 are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.7] - 2026-06-16

### Changed
- **搜索结果栏：focus 即显示**。之前 focus 时如果 query 为空，结果栏会被隐藏；现在直接显示一个空面板（`min-height: 200px` + 「Type to search…」提示），让用户清楚搜索 UI 处于激活态。
- **搜索结果栏底部加 keyboard hints**：用 `↑↓ navigate · ↵ open · esc close` 三个 kbd 标签提示用户快捷键，位置固定在结果列表下方。
- **搜索输入框变大**：`.search-wrap` 宽度 400px → 520px，`.search-input` 字号 1.6em → 1.8em，padding 9px 16px → 11px 18px。
- **回车无选中时跳到默认搜索引擎（当前页）**：之前是 `createTab(query, true)` 开一个新空白标签页；现在调用 `chrome.search.query({ text, disposition: 'CURRENT_TAB' })` 直接在当前标签页用浏览器默认搜索引擎打开搜索结果。需要新增 `"search"` 权限（已在 manifest 中加入）；如果权限被拒，回退到 `chrome.tabs.update` + Google URL。
- 每次重新渲染结果栏时 `container.scrollTop = 0`，避免长列表时滚动位置错乱。

### Added
- `src/lib/chrome/bookmarks.ts` 新增 `searchInCurrentTab(query)` 和 `navigateCurrentTab(url)` 两个 helper。
- `chrome.search` 权限。

## [0.2.6] - 2026-06-16

### Changed
- 搜索模块加诊断日志：所有关键路径（`createTopbar / setInputElement / wireInputEvents / focus / blur / input / keydown / performSearch / showResults / showOverlay / hideOverlay / initSearch`）都加了 `console.log('[search]', ...)`，方便排查「点击搜索框没反应」之类的问题。日志会直接打到 DevTools Console，**不依赖 debug 模块开关**。

## [0.2.4] - 2026-06-16

### Changed
- **搜索模块整体重写**：放弃「动态创建 DOM + 状态机（isOpenFlag）」的方案，改为「静态 DOM 元素 + focus/blur 驱动」的更简单模型，参考了 `newtab01.old` 老项目里能正常工作的设计。
  - `search-overlay.ts`：从动态 `appendChild` 改为接收外部静态元素 + `style.display` toggle，移除 `document.body` 副作用。
  - `search-results.ts`：从 `position: fixed; top: 72px` 绝对定位改为渲染到 topbar 传入的容器，定位交由 CSS `position: absolute; top: 100%` 负责（结果面板自然贴在 input 正下方）。
  - `search-main.ts`：移除 `isOpenFlag` 状态机；改为直接在 input 上挂 `focus / blur / input / keydown`，focus 时显示 overlay + 按需检索，blur 后 150ms 自动隐藏。
  - `Cmd/Ctrl + K` 现在只是「focus the input」，由 focus 事件统一驱动显示。
  - `topbar.ts` 现在一并创建 `#search-results`（结果容器）和 `#search-overlay`（背景遮罩）静态元素，并通过 `setInputElement(input, results, overlay)` 一次性挂入。
- 重新设计 CSS z-index 层级：#topbar (100) / #search-results (200) / #search-overlay (50)，主内容 0。
- 移除 `.search-input--active` 类（不再需要，新设计中 focus 视觉反馈由 `:focus` 配合 overlay 共同提供）。

### Fixed
- 「点击搜索框没反应」「Cmd+K 显示 overlay 但无结果」两个症状：根因是动态 append 的结果面板（`top: 72px`）与 topbar 高度不匹配，且 `isOpenFlag` 状态机与 Cmd+K 路径有竞态。重构后 focus/blur 单一驱动，无竞态。

## [0.2.3] - 2026-06-16

### Fixed
- 搜索功能不可用：`initSearch()` 之前未被 newtab 启动流程调用，已在 `initApp()` 中装配。
- Topbar 与搜索面板共享 input 行为冲突：移除 `search-bar.ts` 浮层渲染，topbar 的 `#search-input` 现在是搜索功能的唯一入口（满足 R8「共享单一 input」）。
- `Cmd/Ctrl + K` 唤起逻辑统一收敛到 `search-main` 的全局 keydown 处理；topbar 不再独立抢占焦点。
- 聚焦 topbar 搜索框时不会自动唤起面板（先前未挂 `focus` 监听，只有 `Cmd/Ctrl + K` 才能打开）：在 `wireInputElement` 内追加 `focus` 监听，调用 `openSearch()`，与 R1「激活时显示搜索面板」一致。

### Changed
- 搜索模块公共 API 重构：`search-main.ts` 导出 `initSearch / openSearch / closeSearch / toggleSearch / performSearch / setInputElement / getInputElement / isOpen`。
- 搜索激活态视觉反馈：在 `styles/newtab.css` 增加 `.search-input--active` 类（更明显的 ring + 提升阴影）。
- 搜索结果 favicon URL 加入 `Map<string, string>` 缓存（按 origin 缓存），满足 R12 与 § 3.4 性能规则。

### Removed
- `src/features/search/search-bar.ts` 文件删除（其功能已被 `search-main.ts` 取代）。

## [0.2.1] - 2026-06-16

### Added
- 拖拽子目录到新列后，原父目录的展开视图会自动隐藏该子目录，避免重复显示。
- 新增 `moved-out` 持久化（chrome.storage.local key `movedOut`），记录 `parentId -> childId[]`，仅影响渲染层，Chrome 书签树不变。
- 豁免规则：
  - 父目录为书签栏（`id === "1"`）或其他书签栏（`id === "2"`）时不过滤，永远显示完整。
  - 被拖的是 5 个特殊目录（apps / top / recent / closed / devices）时永不记录、永不消失。
- 新增 `lib/chrome/bookmarks.ts` 的 `getBookmark(id)` 包装。
- 新增 `src/features/bookmarks/moved-out.ts` 模块。

[Unreleased]: https://github.com/lingyired/newtab01/compare/v0.2.7...HEAD
[0.2.7]: https://github.com/lingyired/newtab01/compare/v0.2.6...v0.2.7
[0.2.6]: https://github.com/lingyired/newtab01/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/lingyired/newtab01/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/lingyired/newtab01/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/lingyired/newtab01/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/lingyired/newtab01/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/lingyired/newtab01/releases/tag/v0.2.1
