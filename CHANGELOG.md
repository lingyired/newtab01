# Changelog

All notable changes to newtab01 are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.27] - 2026-06-17

### Fixed
- **主题下文字 / 背景 / 高亮等 5 个颜色 setting 改完不生效**：`src/features/settings/apply.ts:rebuildDynamicStyles` 之前把这些颜色硬编码成 `var(--newtab-*)` 主题 CSS 变量后，settings-panel 改 `fontColor` / `backgroundColor` / `highlightColor` / `highlightFontColor` / `shadowColor` 时只写 storage、dynamic-styles 仍然引用主题变量 → 永远显示主题色、用户覆盖被主题吃掉。改为把 5 个颜色通过 `applyUserColorOverride(key)` 写到 `<html>` 上的 inline custom properties (specificity 1,0,0,0)，既能在 cascade 中胜出 `[data-theme="..."]` (0,1,0) 又能被切主题时的 `applyTheme` 用 `removeProperty` 清空再写新主题值；dynamic-styles 同时移除 5 个颜色 rule 避免 dynamic-styles 重新赢 cascade。新增 `src/features/settings/apply.ts:saveThemeChange` 把 `theme + 5 个颜色` 作为一个 `updateSettings` bundle 原子写入 storage，切主题瞬间 5 个 color 同步进 storage（下次开 tab / 跨 tab 也能立刻看到新主题色而不是上一次覆盖的值）。
- **删除孤儿 `mergeSettingsLocal`**：v0.2.26 临时为 applyTheme 加的"只改内存不写 storage"工具函数已无外部调用方，按 Precise Edits 规则清理；`updateSettings` 内联 `Object.assign(currentSettings, partial)`。`applyTheme` 不再触碰 `currentSettings`，用户的 5 个 color 覆盖完全由 settings-panel 显式 `updateSettings` 持久化。

### Changed
- `src/features/settings/apply.ts:applySettingsToDOM` 不再调 `applyTheme`（避免每次 storage 变更把用户 color 覆盖冲掉），拆为 `applySettingsToDOM`（5 个 applyUserColorOverride + rebuildDynamicStyles + rebuildUserCss）和 storage onChanged 路径只在 `newValue.theme !== oldValue.theme` 时调 `applyTheme`。`src/newtab/app.ts:initApp` 启动顺序：initSettings → installSettingsChangeListener → applyTheme → applySettingsToDOM。
- `src/features/settings/apply.ts:applySettingChange(key)` 拆出 color key 路径：color key 走 `applyUserColorOverride`（不再 `rebuildDynamicStyles`，因为 dynamic-styles 不再含颜色 rule）；`theme` 走 `applyTheme`；其他 STYLE_KEYS 走 `rebuildDynamicStyles`；`css` 走 `rebuildUserCss`。
- `src/features/settings/apply.ts:installSettingsChangeListener` 在 `chrome.storage.onChanged` 回调里比较 `newValue.theme !== oldValue.theme`，只有主题变化才调 `applyTheme`，避免 cross-tab 改字号时把别人改的主题色冲掉。

## [0.2.26] - 2026-06-17

### Fixed
- **设置浮层的 z-index 层级错**：`styles/newtab.css` 里 `.sp-overlay` z-index 40、`.sp-panel` z-index 50，而 `#topbar` z-index 100（齿轮在 topbar 内），导致 (1) 齿轮图标在打开的设置浮层之上方显示，(2) 设置遮罩不覆盖搜索框。提升 `.sp-overlay` → 110、`.sp-panel` → 120，保留 `#search-overlay` 50 在 `#topbar` 100 之下以维持「搜索遮罩不遮搜索框」的设计意图，保留 `#search-results` 200 在最上方。文件内附完整 z-index 计划注释供后续参考。

## [0.2.25] - 2026-06-17

### Changed
- 把 0.2.24 临时加的直接 `console.log`（绕开 `lib/debug` 的 `enabled` gate）换回 `debug.log`，现在受 `?debug=1` URL override 与 dev-mode 默认 ON 控制，生产 build 默认静默。日志格式不变：`[newtab01:theme] applyTheme` / `[newtab01:apply] applySettingsToDOM` / `[newtab01:apply] applySettingChange` / `[newtab01:apply] storage.onChanged fired` / `[newtab01:settings-panel] saveSetting`。


## [0.2.24] - 2026-06-17

### Fixed
- **主题切换 + 每个主题看起来一样**：`styles/globals.css` 把 `:root` 写在 8 个 `@import` 之前，Vite 在打包时按 `@import` 展开顺序把 8 个 `[data-theme="…"]` 块放在 `:root` 之前；同一 specificity (0,0,1) 下后写的胜出，`:root` 在 cascade 末端覆盖了所有主题变量——切到 dark 主题时实际计算值还是 `:root` 里的 `--newtab-bg: #f1f5f9`，8 个主题看起来都一样。改用 `:where(:root)` (specificity 0) 包住 `:root` 的全部变量声明，让 `[data-theme="…"]` 块（0,1,0）始终胜出。
- **`chrome.storage.onChanged` 跨 tab 同步永远不触发**：`src/features/settings/apply.ts:installSettingsChangeListener` 之前监听的是裸 key `'settings'`，但 `lib/storage/index.ts` 写入用 `STORAGE_PREFIX + key` = `'newtab01.settings'`。`onChanged` 的 key 跟写入的 key 一致，裸 key 永远不匹配 → 跨 tab 改主题/字体永远不传到其他 newtab。改为监听 `'newtab01.settings'`。

### Added
- 直接 `console.log`（不经过 `lib/debug` 的 `enabled` gate）输出到主题/设置流程的关键路径，方便用户在 production build 调试。日志格式：`[newtab01:theme] applyTheme`、`[newtab01:apply] applySettingsToDOM`、`[newtab01:apply] applySettingChange`、`[newtab01:apply] storage.onChanged fired`、`[newtab01:settings-panel] saveSetting`。修复稳定后可以替换回 `debug.log`。

### Notes
- **未实现**：`fontColor` / `backgroundColor` / `highlightColor` / `highlightFontColor` / `shadowColor` 这几个 Settings 字段仍然存在但不影响外观（dynamic-styles 用 `var(--newtab-bg)` 等主题变量）。CLAUDE.md § 9.7 列的必实现 setting 中不包含它们。如果后续要实现用户改背景色，需要用 inline style 在 `<html>` 上设 CSS 变量（specificity 1,0,0,0）+ 切主题时清空 inline style，否则 dynamic-styles 会永远赢 cascade 让主题切换失效。


## [0.2.23] - 2026-06-17

### Fixed
- **hPos=1 (默认) 实际不居中**：v0.2.22 在 `src/features/settings/apply.ts:rebuildDynamicStyles()` 新增的 hPos 处理用了 `scale(hPos, 50, 100, 0) / 2` 公式，默认 hPos=1 → 50 → 25% margin-left，对 width: 96% 的 `#main` 来说意味着从视口 25% 起、向右溢出 21%，而且覆盖了 `newtab.css` 的 `margin: 0 auto` 居中。改为 `(hPos / 2) * (100 - width)` 映射：hPos=0 → 0%（左贴边）、hPos=1 → (100-width)/2%（居中）、hPos=2 → 100-width%（右贴边）。固定像素模式下用 `calc((hPos / 2) * (100vw - widthPx))` 保留窗口 resize 居中。同时把 hPos 合并到 `#main { width: ...; margin-left: ...; }` 同一行，删除原来独立的二次写入块（会覆盖前一次宽度计算）。


## [0.2.22] - 2026-06-17

### Changed
- **Settings 实时生效**：新增 `src/features/settings/apply.ts`，把 `applySettingsToDOM()` 从 `newtab/app.ts` 抽成可重复调用的导出函数（重建 `<style id="dynamic-styles">` 与 `<style id="user-css">` 节点，幂等替换不重复追加），并新增 `applySettingChange(key)` 单 key 局部更新与 `installSettingsChangeListener()` chrome.storage.onChanged 监听器。`newtab/app.ts:initApp` 启动时调一次 `applySettingsToDOM()`（含 `applyTheme` + dynamic-styles + user-css），`settings-panel.ts:saveSetting` 在 `updateSetting` 后调 `applySettingChange(key)`，主题、字体、字号、字重、文字/背景/高亮/阴影颜色、淡入淡出/滑动时长、间距、边距、宽度、水平位置等修改立即可见。`chrome.storage.onChanged` 监听让跨 tab / popup 改的设置也能实时同步到当前 newtab（背景回填 `currentSettings` 缓存，保证 `getSetting()` 拿到新值后再重生成样式）。
- **移除 options 页面**：删 `options.html` 与 `src/options/` 整个目录（app.ts、main.ts、ai-prompt.ts）。`manifest.json` 移除 `options_ui` 字段（Chrome 不再自动注入 Options 菜单），`vite.config.ts` 的 `rollupOptions.input` 移除 `options: 'options.html'`。新增 `contextMenus` 权限，`src/background.ts` 在 `chrome.runtime.onInstalled` 时注册 `chrome.contextMenus.create({ id: 'newtab01-open-settings', title: '打开设置', contexts: ['action'] })`；`chrome.contextMenus.onClicked` 调 `chrome.tabs.create({ url: 'chrome://newtab#settings=1' })` 打开新标签页并自动展开浮动设置面板。`newtab/app.ts:initApp` 在 `window.location.hash === '#settings=1'` 时调 `openSettingsPanel()`（保留原有 `?options` query 兼容入口）。

### Added
- `src/lib/storage/settings.ts` 导出 `replaceSettings(next)`：用新对象整体替换内存中的 `currentSettings` 缓存，供 `chrome.storage.onChanged` 监听器回填跨 tab 设置变更。`updateSetting` 仍只更新单一 key + 写 sync，行为不变。

### Fixed
- 修改 `font` / `fontSize` / `fontColor` / 主题等设置后无需刷新页面即可看到效果（原来需要刷新才生效）。
- 主题切换后跨 tab 实时同步（原来仅同 tab 立即切换，其他 tab 需刷新）。


## [0.2.21] - 2026-06-17

### Fixed
- **主题切换不生效**：`styles/globals.css`（含 `:root` 基础色 + 8 个 `[data-theme]` 主题块）此前未被打包进 `dist/` — Vite + `@crxjs/vite-plugin` 不处理 HTML 中以绝对路径引用的 CSS 文件。在 `src/{newtab,options,popup}/main.ts` 顶部加 `import '../../styles/globals.css';`，Vite 把它合并进 shared CSS chunk 后由 3 个 HTML 共同加载。同时 `src/newtab/app.ts:initApp()` 在 `await initSettings()` 之后调一次 `applyTheme(getSetting('theme'))`，让 newtab 启动时把 `data-theme` 写到 `documentElement`，主题立刻生效而不是停在 `:root` 默认值。
- **分屏视图报 `NotFoundError: insertBefore`**：`src/features/split/split-view.ts:createIframe()` 创建了 iframe 元素但没有 append 到 `slot`，导致后续 `slot.insertBefore(frameToolbar, frame.iframe)` 抛 `NotFoundError` 并 fall through 到 `initApp` 的 catch 块，页面被替换为 "Failed to load bookmarks. Please refresh the page."。在 `createIframe` 内加 `slot.appendChild(iframe)`，并删除已经变成死代码的 IntersectionObserver（`iframe.src` 已在创建时立即设置）。


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