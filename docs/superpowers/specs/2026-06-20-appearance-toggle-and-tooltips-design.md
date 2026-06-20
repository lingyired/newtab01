# Topbar Appearance Toggle + Tooltips — 设计 spec

> 日期: 2026-06-20
> 目标分支: `feat/appearance-toggle-and-tooltips`（从 `main` 拉出）
> 状态: 待 review
> 关联: v0.2.75 的 `Settings.darkMode` 独立设置（toggle 的 single source of truth）

## 1. 目标

两件事：

1. **Topbar 外观 toggle**：在 `设置按钮` 左边加一个 3 段 pill 形 segmented control（sun / lightning / moon），跟设置面板里的「暗色模式」设置双向同步。
2. **5 个 tooltip**：topbar 设置按钮、3 个 toggle 段、folder header 的 3 个动作图标（批量打开 / Group 打开 / 分屏打开）—— hover 时显示原生 `title` tooltip。

## 2. 现状

| 元素 | 当前 tooltip / 状态 |
|---|---|
| 设置按钮（`#options_button`）| `title="Settings"`（英文）|
| Folder action 按钮（3 个）| `title="Open all in tabs"` / `"Open as tab group"` / `"Open in split view"`（英文）—— **已存在**，v0.2.73 之前就有 |
| 外观 darkMode 设置 | 只在「外观」tab 的「暗色模式」select 上；topbar 没有快捷入口 |
| 暗色模式 3 段 | 视觉上参考图是 iOS-style pill（亮 / 跟随系统 / 暗）|

## 3. 设计

### 3.1 Topbar 3 段 pill

**结构**（HTML）：
```html
<div class="sp-appearance-toggle" role="radiogroup" aria-label="切换外观">
  <button type="button" role="radio" aria-checked="false"
          data-value="light" title="亮" aria-label="亮"
          class="sp-appearance-toggle-btn">
    <!-- sun SVG -->
  </button>
  <button ... data-value="system" ...> <!-- zap SVG --> </button>
  <button ... data-value="dark" ...>   <!-- moon SVG --> </button>
</div>
```

**视觉**（CSS）：
- 容器：`position: absolute; right: 80px; top: 50%; transform: translateY(-50%); height: 32px;`（**高度 32px 跟设置按钮一致**——用户原话"大小一致"理解为高度；宽度 auto）
- 容器背景：`var(--muted)` 浅灰底，`border-radius: 16px`（半高 = full pill）
- 容器内 3 个 button 平分宽度（`flex: 1`，gap 0）
- button 默认 `opacity: 0.5`（unselected 视觉）
- button `[aria-checked="true"]`：`opacity: 1`
- button hover：`opacity: 0.75`（从 0.5 上提一档，不影响 selected 段）
- button 内部：16×16 SVG icon（Lucide `sun` / `zap` / `moon`），`stroke="currentColor"` 跟主题色

**跟设置按钮的距离**：`right: 80px` 给 `~16px` 视觉间距（设置按钮 32px 宽 + 16px gap = 48px from right；toggle 容器 ~56px 宽 + 16px gap = 72px；安全值取 80px）。

### 3.2 状态同步

**单源 single source of truth**：`Settings.darkMode`（v0.2.75 已有）。toggle 不新增字段，只读 + 写同一个 setting。

**Toggle → Storage → 主题**（用户点 toggle）：
1. `handleClick(value)` → `updateSetting('darkMode', value)`
2. `applyTheme(getSetting('theme'))` → `resolveTheme()` 重算 `data-theme` → inline style 切换

**Storage → Toggle UI**（用户在设置面板改 darkMode）：
1. `chrome.storage.onChanged` 事件 → 过滤 `areaName === 'sync'` 和 `changes['newtab01.settings']`
2. 检查 `newValue.darkMode !== oldValue.darkMode`
3. `updateSelection()`：遍历 3 个 button，按 `getSetting('darkMode')` 设 `aria-checked`

**为什么不监听 settings-panel 的 listener**：
- settings-panel 的 `installStorageListener()` 配对 `uninstallStorageListener()`（面板打开/关闭）。Toggle 是 topbar 永久元素，需要**独立**的 listener（开/关面板不影响 toggle）
- 两个模块解耦：toggle 不知道 settings-panel 存在，反之亦然

**为什么不用 `applyTheme` 监听 `matchMedia`**：
- `matchMedia('(prefers-color-scheme: dark)')` 已经在 v0.2.75 装上（`app.ts:installMatchMediaListener`）→ OS 主题切换时 `applyTheme(currentTheme)` 重新解析。toggle 的 selected 段**不需要**在 OS 切换时改变（因为用户的 `darkMode='system'` 没变），所以 matchMedia 路径**不影响** toggle 状态

### 3.3 Tooltip

**全部用 HTML native `title` 属性**（用户原话"html 自带也行"）。理由：
- 5 个静态 label 不需要 rich 格式 / 快捷键 / 触发逻辑
- Native tooltip 自带 200ms 延迟（不打扰正常浏览）+ 屏幕边缘自适应
- 无障碍免费（屏幕阅读器读 `title`）
- YAGNI：自定义 tooltip 组件是 80+ 行代码 + N 个 edge case，5 个 label 不值

| 元素 | 当前 `title` | 改为 |
|---|---|---|
| `#options_button` | `Settings` | `设置`（中文化）|
| Toggle `data-value="light"` | 无 | `亮` |
| Toggle `data-value="system"` | 无 | `跟随系统` |
| Toggle `data-value="dark"` | 无 | `暗` |
| Folder action ExternalLink | `Open all in tabs` | **保留**（已经是 tooltip，0 改动）|
| Folder action FolderPlus | `Open as tab group` | **保留**（同上）|
| Folder action Columns2 | `Open in split view` | **保留**（同上）|

**为什么 folder actions 不中文化**：CLAUDE.md §9.1-9.3 没有强制 UI 文案统一；项目既存 UI 中英混排（settings panel 中文 / 4 个 4 段控制用英文 variable names）。**只动用户这次明确要的中文化**，不动 folder 3 个，避免范围蔓延。

## 4. 改动文件

| 文件 | 改动 |
|---|---|
| 新文件 [src/newtab/appearance-toggle.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/appearance-toggle.ts) | `createAppearanceToggle()` 渲染 pill + 3 button + 内部 storage listener（~90 行）|
| [src/newtab/topbar.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/topbar.ts) | 在 `#options_button` 前面 append `createAppearanceToggle()`；设置按钮 `title="Settings"` → `title="设置"` |
| [styles/newtab.css](file:///Users/lingsmbp/Documents/aiwork/newtab01/styles/newtab.css) | 新增 `.sp-appearance-toggle` / `.sp-appearance-toggle-btn` / `[aria-checked="true"]` 样式块（~25 行）|
| [CHANGELOG.md](file:///Users/lingsmbp/Documents/aiwork/newtab01/CHANGELOG.md) | v0.2.87 Added 段 |
| [package.json](file:///Users/lingsmbp/Documents/aiwork/newtab01/package.json) / [manifest.json](file:///Users/lingsmbp/Documents/aiwork/newtab01/manifest.json) | 0.2.86 → 0.2.87 |
| [docs/superpowers/specs/2026-06-20-appearance-toggle-and-tooltips-design.md](file:///Users/lingsmbp/Documents/aiwork/newtab01/docs/superpowers/specs/2026-06-20-appearance-toggle-and-tooltips-design.md) | 本 spec |

**不动** [src/features/bookmarks/folder-actions.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder-actions.ts)（3 个 folder 已有 `title`）和 `applyTheme` 路径（v0.2.75 已就位）。

总改动 ~140 行（其中 90 行是新模块）。

## 5. 边界 case

| 场景 | 行为 |
|---|---|
| Toggle 段被点 | 立即应用（`updateSetting` + `applyTheme`），无延迟，无 loading state |
| 切到 dark 但主题没 dark 变体 | `resolveTheme()` fallback 到 light 变体（v0.2.75 已有逻辑）|
| 用户在设置面板改 darkMode | toggle 收到 `chrome.storage.onChanged` 事件 → 1-2 frame 内 updateSelection |
| search bar 隐藏（`showSearch = 0`）| topbar 还在，toggle 在 `right: 80px`（不变）|
| undo button 显示时 | undo 是 flex 子，**不影响** absolute 定位的 toggle |
| 暗色主题下 toggle 配色 | `var(--muted)` 走主题色（暗主题下是深灰），`currentColor` 跟着变 |
| Folder header 0 个 bookmark | 3 个图标都不显示（现有逻辑），无 tooltip 问题 |
| 多个 newtab 同时打开 | `chrome.storage.onChanged` 跨 tab 广播，每个 tab 的 toggle 独立 listener 同步 |
| 移动端 / 触屏 | `title` 在触屏上无效，但项目本身**不支持移动端**（CLAUDE.md §1.2），不引入额外处理 |
| Toggle 模块 init 多次 | 内部 `storageListenerInstalled` flag 防重复装 listener |

## 6. 不做（YAGNI）

- **不做自定义 tooltip 组件** —— 5 个 `title` 已够
- **不动 folder action 按钮的 `title` 文案** —— 已经在 tooltip 工作
- **不动设置面板的暗色模式 select** —— v0.2.75 已有，加 toggle 不影响它
- **不做 keyboard arrow 键切换 toggle 段** —— `<input type="radio">` 的标准行为；项目用 `<div role="radiogroup">` 时需要手写 ↑/↓ 键 listener。**用户没要求**，且触屏+鼠标用户够用。**如果将来用户提了，再加**
- **不做动画过渡**（selected 段切换无 slide 动效）—— iOS 风格有，项目保持 minimal chrome（CLAUDE.md §1 风格）原则下不引入
- **不做 popover / 二次确认** —— darkMode 切换无破坏性
- **不做 size 切换**（toggle 跟随设置按钮高度不可调）—— 用户没要求

## 7. 验证

- 手动：加载 dist → 调 `darkMode` 在 3 段间切换 → 主题立即跟随；回设置面板改 select → toggle 的 selected 段同步
- 手动：hover 设置按钮 → 出现 "设置" tooltip；hover 3 个 toggle 段 → 出现 "亮/跟随系统/暗" tooltip；hover 3 个 folder icon → 出现 "Open all in tabs" 等 tooltip
- 手动：CSS 主题切换（Codex / Cyberpunk / MX-Brutalist）→ toggle 的 `var(--muted)` 背景 + icon `currentColor` 自动适配
- build：`pnpm build` 通过，newtab JS 增 ~0.7KB（新模块 ~90 行 minified）

## 8. 版本号

0.2.86 → 0.2.87（项目约定每次 commit bump patch）。`Settings.darkMode` 字段没改、`Message` type 没改，settings-panel.ts 没改 → 0 个 storage migration、0 个向后兼容问题。
