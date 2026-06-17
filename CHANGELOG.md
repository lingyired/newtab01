# Changelog

All notable changes to newtab01 are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.20] - 2026-06-17

### Added
- **Generate with AI 按钮（Issue #8）**：选项页 Advanced Tab 顶部新增「Generate with AI」按钮，点击后弹出 modal 展示结构化 prompt（newtab01 DOM 概览 + 语义 CSS 变量清单 + 指令 + 2 个示例 snippet），用户可一键复制到剪贴板再贴到任意 AI 助手。生成结果由用户手动粘贴回 Custom CSS 文本域，扩展不调用任何外部 AI API，也不自动应用。新增 `src/options/ai-prompt.ts`（`buildAIPrompt()` 导出），`src/options/app.ts` 增 `openAIPromptModal()` + `copyToClipboard()` 助手，`styles/options.css` 增 modal 样式（`.ai-modal-overlay` / `.ai-modal` / `.ai-modal-btn--primary` 等，全部走语义 CSS 变量）。


## [0.2.19] - 2026-06-17

### Changed
- Split user-supplied custom CSS out of `<style id="dynamic-styles">` into a separate `<style id="user-css">` element in `src/newtab/app.ts:applySettingsToDOM()` (Issue #7). Per CLAUDE.md §6, user-css now lives in its own node so it sits after both the theme variables (loaded via linked stylesheets in `newtab.html`) and the dynamic-styles element, giving user CSS the highest cascade priority. The dynamic-styles rules array no longer mixes in the user CSS string. Idempotent: if `<style id="user-css">` already exists, `applySettingsToDOM` replaces its `textContent` in place rather than appending a duplicate node.

### Added
- **主题扩展 4 → 8 套（Issue #6）**：新增 4 套内置主题 `zinc`（冷调中性灰）、`stone`（暖调米灰）、`midnight`（深海军蓝）、`mocha`（暖调深棕），与现有 default / slate / rose / dark 一起由 `src/features/themes/switcher.ts` 集中管理。
- `src/features/themes/switcher.ts` 新模块：导出 `listThemes()` / `applyTheme()` / `getCurrentTheme()` / `onThemeChange()`，作为主题 id 列表与 `data-theme` 切换的唯一来源。新增主题只需在该数组追加 id 并在 `styles/themes/` 添加对应 `[data-theme="…"]` 块 + `globals.css` 一行 `@import`。
- `styles/themes/{zinc,stone,midnight,mocha}.css`：4 个新 `[data-theme]` 变量覆盖集，复用现有 8 个语义变量与 5 个 newtab 专用变量。

### Changed
- `styles/globals.css` 增加 4 行 `@import`，将 4 个新主题加入全局 CSS 链。
- `src/options/app.ts`：删除本地 `THEME_LIST` 常量与本地 `applyTheme()`；改为从 `features/themes/switcher` 导入 `applyTheme` + `listThemes`，主题下拉通过 `listThemes().map(...)` 生成。
- `src/newtab/settings-panel.ts`：主题下拉改为 `listThemes()` 驱动；新增本地 `THEME_LABELS` 中文标签映射（8 个主题），未命中时回退到英文 id。
- 主题下拉顺序：由声明顺序（default/slate/rose/dark）改为 `listThemes()` 返回的字母序（dark / default / midnight / mocha / rose / slate / stone / zinc）。


## [0.2.17] - 2026-06-17

### Changed
- **分屏引擎集成（Issue #3）**：`src/newtab/app.ts` 删除本地 `renderSplitView` stub，改为 `parseSplitParams()` + `renderSplitView(urls, layout)`；`folder-actions-handler.ts:openSplit` 改走 `splitManager.open(urls, layout)` 而非直接拼 URL，与 `src/popup/app.ts` 共用同一引擎。
- 统一 hash+JSON 协议：`?split=1#urls=<JSON>&layout=<mode>`，由 `IframeSplitEngine` 单点负责编码/创建标签页/解析回读。

### Fixed
- 文件夹「分屏打开」按钮之前打开后立即被新标签页内的 `validateLayout` 拒绝（query-param 与 hash+JSON 协议不一致），现在链路打通：folder/popup 写 hash+JSON → `app.ts:initApp` 读回 → `renderSplitView` 渲染 toolbar + iframes + 错误占位。

## [0.2.16] - 2026-06-17

### Added
- Service Worker 消息路由：新增 `src/lib/chrome/messages.ts` 统一管理 `Message` discriminated union (`createTabGroup` / `refreshDeclarativeNetRequest`) + 手写 `isValidMessage` 类型守卫 + Promise 化 `sendMessage<T>` 包装。`src/background.ts` 加 `chrome.runtime.onMessage` 监听，先校验 `sender.id === chrome.runtime.id` 再校验 schema，handler 始终 `return true` 保持异步通道。
- `refreshDeclarativeNetRequest` handler 复用现有 `registerFrameHeaderRules()`，失败时响应 `{ ok: false, error }` 而非静默吞错。

### Changed
- `src/background.ts` 从「只跑 onInstalled」改为「纯消息路由 + onInstalled」。满足 CLAUDE.md § 5.2 关于「SW 仅作为消息路由 + 定时任务」的要求。
- `src/features/search/bookmark-index.ts` 把 `setTimeout(..., 300ms)` 防抖改为 `chrome.alarms.create('bookmark-index-rebuild', { delayInMinutes: 0.5 })`，由 `chrome.alarms.onAlarm` 触发重建。注意：Chrome alarms 最小粒度 30s，因此原 300ms 防抖改为 30s — 见代码注释。Alarm listener 在 `watchBookmarkChanges()` 内 wiring（带 `alarmListenerWired` 守卫防重复注册）。
- `src/features/bookmarks/folder-actions-handler.ts:openAsGroup` 不再直接调 `createTabGroup`，改为 `sendMessage({ type: 'createTabGroup', tabIds, title })` 走 SW；失败时 `debug.warn` 并 early return。

### Removed
- `src/lib/chrome/bookmarks.ts` 的 `createTabGroup()` helper 已无人调用（`openAsGroup` 改走 SW 消息路由），按 § 2.3「自己改动产生的孤儿必须删」清理掉。`tabGroups` 能力现在统一由 `src/lib/chrome/tab-groups.ts` 的 `groupTabs` + `updateGroup` 暴露，且仅 SW 调用，UI 不再直接接触 Chrome API。

## [0.2.15] - 2026-06-17

### Changed
- **Settings 系统合一**：保留 canonical 存储 `src/lib/storage/settings.ts`，删除重复定义 `src/lib/settings.ts`（AppSettings/defaultSettings/themeList）。所有 chrome.storage.sync 设置现在都走统一的 `settings` 对象 + `getSettings/updateSetting` API。
- **字段重命名对齐**（老 `AppSettings` → canonical `Settings`）：
  `textColor` → `fontColor` · `showTopLevel` → `showTop` · `showSearchBar` → `showSearch` · `openInNewTab` (string union) → `newtab` (0/1/2) · `customCSS` → `css` · `highlightTextColor` → `highlightFontColor` · `fadeMs` → `fade` · `slideMs` → `slide` · `showOtherDevices` → `showDevices`。
- 选项页 `src/options/app.ts` 重写：所有写入通过 `updateSetting(key, value)`，checkbox 在 0/1 ↔ boolean 间转换与 `newtab/settings-panel.ts` 保持一致；Import/Export 仍然工作（导出当前 `getSettings()` 快照，导入按字段 `updateSetting`）。
- 删除 `src/lib/storage/index.ts` 中的死代码 helper：`getSyncSettings` / `setSyncSettings`（在 canonical settings store 接管后无人调用）。

### Added
- `Settings` interface 与默认值新增 `backgroundImage: string`（选项页 Background Image 输入项需要持久化 dataURL）。
- `migrateLegacySettings()`：在 `initSettings()` 检测到无统一 `settings` 对象时，从老格式的逐 key chrome.storage.sync 项（`newtab01.theme` / `newtab01.textColor` / `newtab01.openInNewTab` / `newtab01.customCSS` / ...）合并到统一对象，写回后再 `removeSync` 删除 legacy keys。已存在统一对象时跳过，无 legacy keys 时也跳过。

### Removed
- `src/lib/settings.ts` 文件整体删除。

## [0.2.14] - 2026-06-17

### Fixed
- 文件夹 header 在无书签时仍显示 3 个操作图标（批量打开 / tab group / 分屏）。原因：原 `hasBookmarks` 检查只判断 `node.children !== undefined`（空数组 `[]` 也会通过），且特殊目录（top/recent/closed/devices）始终判定为有图标。修复：
  - `createFolderActions(node, bookmarkCount)` 新增 `bookmarkCount: number` 参数，`bookmarkCount === 0` 时直接返回空 `<span>`（不渲染按钮）。
  - `folder.ts` 区分常规与特殊目录：常规用 `node.children?.length ?? 0` 同步决定；特殊目录 `getChildren(node)` 异步解析后，若 `children.length > 0` 才追加 actions。
  - 常规空目录的 header 不再有任何 hover 效果；特殊目录（top 等）若用户实际数据为空同样不显示图标。


## [0.2.12]