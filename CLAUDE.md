# newtab01 — 项目设计与工程指南

> 本文档是项目的设计总览与工程约束，供 AI 编码助手与协作者遵循。
> AI 编码助手行为指令见 [`.trae/rules/project_rules.md`](.trae/rules/project_rules.md)。

## 0. 关于本项目

**newtab01** 是一个基于 [Humble New Tab Page](https://github.com/ibillingsley/HumbleNewTabPage) (MIT) 重构而来的 Chrome 扩展新标签页。新增 5 项核心能力。

**出处与致谢**：原始版权属 ibillingsley 与贡献者所有，本项目在 MIT 协议下使用、修改并发布。详见 `LICENSE_MIT.txt` 与 `README.md`。

**目录命名**：`newtab01`

### 0.1 分支清单与版本基线（重要）

> 本节是 AI 编码助手开始任何工作**前**必读的内容。分支策略与"哪个版本是基线"直接决定后续 commit 落在哪条线。

| 分支 | 状态 | 用途 | 起点 commit |
|------|------|------|------------|
| **`main`** | 当前默认分支 | 已发布 / 稳定基线 | `68fa259` (v0.2.57) |
| `feat/runtime-theme-import` | 🗄 冻结 | runtime theme import 后期增量（v0.2.57 → v0.2.59）| `68fa259` (v0.2.57) |
| `feat/vue-migration` | 🗄 冻结 / 已弃 | Vue 3 + Pinia + shadcn-vue 重构实验（v0.3.0 → v0.3.12）| main @ v0.2.59 |
| `feat/custom-themes-tab` | 🗄 冻结 | "自定义主题" tab 拆分 + entry link 重构（v0.2.73）| `1c67d0a` (v0.2.73) |
| `feat/css-paste-import` | 🗄 冻结 | tweakcn CSS 粘贴导入（v0.2.74）| `87af123` (v0.2.74) |
| `feat/dark-mode-setting` | 🗄 冻结 | darkMode 一等设置 + dark variant dropdown 修复（v0.2.75 + v0.2.76）| `f44a4cc` (v0.2.76) |
| `feat/url-import` | 🗄 冻结 | tweakcn URL 粘贴导入 + JSON 路径移除（v0.2.77 + v0.2.78）| `427173f` (v0.2.78) |
| `feat/settings-gear-reposition` | 🗄 冻结 | 设置齿轮重定位 + 缩放 + Lucide 图标（v0.2.84 + v0.2.85）| `813e51d` (v0.2.85) |
| `fix/settings-options-bugs` | 🗄 冻结 | 设置面板 16 个选项 bug 修复（v0.2.93 → v0.2.96）| `c0bf492` (v0.2.93) |
| `feat/appearance-theme-overrides` | 🗄 冻结 | 外观 tab 10 选项 per-theme per-mode 化 + 高亮圆角改 px + 字号改 px 直接存（v0.2.97）+ 字号默认值 18→16（v0.2.98）+ 颜色 picker 空值回退到主题色（v0.2.99）+ 阴影颜色与高亮颜色 CSS 变量解耦（v0.2.100）| 见 git log |
| `feat/folder-actions-tooltip-and-newtab-mode` | 🗄 冻结 | folder 三个小图标 tooltip 改 CSS-only + hover 背景 `--newtab-highlight` → `--muted` + 三个 handler 接收 `MouseEvent` 按 `Settings.newtab` 模式打开 + 中键强制 background（v0.2.101）| 见 git log |
| `feat/per-theme-custom-css` | 🗄 冻结 | 移除高级 tab 全局"自定义 CSS" + `Settings.css` 字段 + `<style id="user-css">` + 升级迁移；外观 tab `<details>` 末尾追加 per-theme per-mode `customCss` textarea + 注入 `<style id="user-theme-css">`（v0.2.102）+ 修切换主题/darkMode 时 textarea 不刷新的回归（v0.2.103）| 见 git log |
| `feat/import-export-cleanup-and-custom-themes` | 🗄 冻结 | 高级 tab 导出 JSON 移除已迁到 `themeOverrides` 的 10 个 per-theme 字段（font / fontSize / fontWeight / 5 颜色 / shadowBlur / highlightRound）+ import 同步静默丢弃；`CustomThemeEntry` 加 `sourceUrl?` 字段记录 URL 安装时的原始 URL；导出 `customThemes: [{ name, url }]` 数组（CSS paste 主题无 URL 跳过并 alert）；import 走 fetch + validate + install 路径重装 URL 主题（v0.2.104）+ 修 storage.onChanged 只在 theme 变化时调 applyTheme、忽略 darkMode 变化的 bug 导致 import 后 darkMode 必须刷新才生效（v0.2.105）| 见 git log |
| `feat/import-export-layout-and-custom-themes` | 🗄 冻结 | 高级 tab 导出 settings JSON 加可选 `layout: { columns, movedOut }` 字段（UI 默认勾选 checkbox「包含布局」）+ import 自动检测并恢复 layout（剥 special-folder IDs 避免异环境 force-enable）+ 走 history snapshot 撤销栈可手动 undo + 只动 newtab 显示（不调 `chrome.bookmarks.*` API）（v0.2.106）+ 保留特殊文件夹 ID 默认不勾 checkbox 垂直对齐（v0.2.107）+ Apps UX 反复 4 次回归最终改回 link 视觉 + UA 检测 `chrome://apps` / `edge://apps` + Apps link 复用 `enableDragFolder` 显式 `stopPropagation` 单独拖（v0.2.108 → v0.2.116）| 见 git log |
| `feat/i18n` | 🗄 冻结 | i18n 多语言支持完整周期：types/index/catalog 脚手架 + en/zh（v0.2.117）→ 全模块迁移（v0.2.118）→ 8 新 locale（es/ar/hi/fr/pt/de/ja/ru）+ Arabic RTL（v0.2.119）→ background SW 10 语言表（v0.2.120）→ import button 完整动作短语 + long-label 换行 + panel in-place 刷新（v0.2.121）→ 去掉 trailing 省略号（v0.2.122）。合并到 main 见 `bffc756`。| 见 git log |

**为什么 v0.2.57 是 `main` 的基线（而不是 v0.2.36 / v0.2.59）**

1. **v0.2.57 的 UI 是"完美"状态**——用户测试确认视觉无回归：链接高度 40px（`h-10`）、列宽 1/N 等分、长链接截断、Tailwind preflight 正确开启（`box-sizing: border-box`）、shadcn-vue 的 `text-foreground no-underline hover:no-underline` class 在 BookmarkLink 落地、Codex / MX-Brutalist / Cyberpunk / AstroVista 4 套 tweakcn 主题的 link hover 全部生效且不破坏其他主题。
2. **v0.2.36 缺主题化 hotfix**——v0.2.37 引入"theme style class"机制、v0.2.50 补全 27 design tokens、v0.2.53 / 54 / 55 / 56 / 57 一系列主题化修复均未在 main 上；v0.2.36 的 default 主题仍是手调 hex 基线，不是 tweakcn Codex 调色板。
3. **v0.2.58 / v0.2.59 仍未完全通过测试**——v0.2.58 切到 shadcn class-based approach 后 link 颜色与下划线回归、v0.2.59 补全 class 集后用户仍未做完整视觉验证；v0.2.57 是"用户确认视觉 OK"的最后稳定点。
4. **v0.3.x 已被弃用**——`feat/vue-migration` 在 v0.3.5 ~ v0.3.12 之间做了 8 次增量 hotfix（box-sizing / 链接颜色 / 列宽 / 主题 / 设置 UI / 布局 / 列高），最终用户决定 Vue 重构"不明智"。该分支不再维护，保留为历史参考。详细取舍见 CHANGELOG.md `## [0.2.57-baseline]` 条目。

**已弃分支策略**：`feat/runtime-theme-import` 与 `feat/vue-migration`、`feat/custom-themes-tab`、`feat/css-paste-import`、`feat/dark-mode-setting`、`feat/url-import`、`feat/settings-gear-reposition`、`feat/appearance-toggle-and-tooltips`、`feat/appearance-options-fix` 暂时不删除，保留为历史 commit 索引。新功能 / hotfix **只**在 `main` 上做，不要 merge 任何 v0.3.x commit 进 main。新功能流程：在 `feat/<feature>` 分支上做 → 完成后 `--no-ff` merge 到 main → push main → `git push -u origin feat/<feature>` 把分支冻结到 origin 作为历史索引（merge 前的 commit history 完整保留）。

**当前已知未决问题**（v0.2.57 遗留，**仅** main 上未解决）
- **主题化兼容性**：tweakcn 主题通过 runtime import（URL / CSS paste）时需要带完整的 8 个核心 + 11 个 surface vars（`secondary` / `accent` / `destructive` / `card` / `popover` / `input` + 各自 foreground）。v0.2.83 之后 link / search 默认 bg 走 `var(--newtab-link-bg, var(--card, var(--newtab-bg)))` chained fallback —— 缺 `--card` 时回退到 `--newtab-bg`，视觉降级但**不会**破样式。Chrome extension storage 不会自动升级旧值；用户在 v0.2.55 之前导入的老主题需要重新粘贴一次以写入完整 surface 集。
- **Codex light 主题下 link 默认态有极淡 drop shadow**（`var(--shadow-xs)` = `0px 2px 4px 0px hsl(0 0% 0% / 0.05)`）。按 shadcn Button 标准不主动 override 时会保留；用户已经接受此视觉，视为"主题本身效果"。

---

## 1. 目标与非目标

### 1.1 目标
- 提供高性能、低资源占用的新标签页体验
- 在保留原项目核心能力（apps、topSites、recent、closed、devices、背景图、字体、动画、自定义 CSS）的基础上叠加 5 项核心新能力
- 主题系统完全基于 [tweakcn](https://tweakcn.com) 调色板：4 套内置主题（Codex / MX-Brutalist / Cyberpunk / AstroVista）+ 无限运行时自定义（URL / CSS paste 到「自定义主题」tab，存 `chrome.storage.local.customThemes`）；dark mode 是独立 `darkMode` 设置（`system` / `light` / `dark`），与 theme id 解耦
- 通过**分屏引擎抽象层**为未来 Chrome Window Placing API 等原生能力预留接入点
- 提供清晰的模块边界与可维护代码

### 1.2 非目标
- v1 不支持 Firefox 或其他非 Chromium 浏览器
- 不做云端同步 / 账号系统（依赖 Chrome 自带 sync 能力）
- 不做书签编辑 / 新增 / 删除（只读 + 拖拽布局）
- 不做历史记录搜索（v1 搜索范围仅书签）
- 不做移动端适配（Chrome 扩展仅桌面端）

---

## 2. 五大新增能力

### 2.1 目录分组 & 分屏打开
- 在每个文件夹 header 渲染 **3 个图标**：
  1. **批量打开**（ExternalLink 图标）：以新标签页方式打开目录下所有 URL
  2. **Group 打开**（FolderPlus 图标）：调用 `chrome.tabGroups` 创建 Chrome 原生标签组
  3. **分屏打开**（Columns2 图标）：调用分屏引擎，URL 传入分屏页
- 仅当目录内 bookmark 数量 ≥ 1 时显示；右键菜单保留等价能力

### 2.2 拖拽排序与布局管理
- 书签文件夹可在列内拖拽排序，也可跨列拖拽
- 拖拽到列边缘可创建新列（左 / 右侧）
- 同一文件夹只能出现在一列中，不允许重复
- 空列（length === 0）自动移除，至少保留 1 列
- 顶层文件夹（depth === 0）自动折叠同列其他顶层文件夹；嵌套文件夹（depth > 0）仅折叠同父级兄弟文件夹
- 特殊列（书签栏 + 启用的特殊文件夹）可定位在 store 任意索引位置，不硬编码在末尾
- 拖拽事件使用原生 `addEventListener`（绕过 React 18 事件委托问题），坐标定位使用 `clientY` + `getBoundingClientRect()`
- 拖拽期间不触发 setState 重渲染列，确保 60fps

### 2.3 书签快速搜索
- 在顶部 toolbar 显示一个搜索框，激活时会显示搜索面板，同时为整个界面增加一个类似水玻璃效果的模糊层
- 全局快捷键 `Cmd/Ctrl + K` 唤起搜索面板（shadcn `Command` 组件）
- 索引：启动时与 `chrome.bookmarks.onChanged` 时重建索引
- 范围：书签 title + url（v1 不含 history / topSites）
- 引擎：`fuse.js`，阈值 0.4，keys 权重 title:0.7 / url:0.3
- 使用上下左右快捷键导航搜索结果，回车打开选中项
- 如果不选择结果而直接回车，会使用当前浏览器搜索引擎搜索输入框中的内容
- 搜索框为 topbar 和浮动结果面板共享的单一 input；overlay z-40，results z-50，通过 `createPortal` 渲染到 body

### 2.4 扩展图标快捷分屏
- 点击工具栏图标 → 弹出 popup（`popup.html` 独立页面，内含 shadcn `Dialog` 风格的全屏布局）
- 两个 Tab：**Bookmarks** / **Open Tabs**
- 用户勾选 2-4 个 URL → 选 layout（`2h` / `2v` / `3H` / `4grid`）
- 点击 **Open Split** → 调分屏引擎在新标签页以 `?split=1` 参数渲染分屏视图
- 与文件夹分屏共用同一引擎

### 2.5 主题与样式
- **完全基于 tweakcn 调色板**：内置 4 套主题（Codex / MX-Brutalist / Cyberpunk / AstroVista）从 tweakcn 复制调色板到 `styles/themes/<id>.css`；运行时导入同样以 tweakcn JSON 为唯一来源。无 AI 生成、无独立设计系统。
- **双层结构**：每个 theme file 声明 8 个核心 shadcn 变量（`background` / `foreground` / `primary` / `primary-foreground` / `muted` / `muted-foreground` / `border` / `ring`）+ 11 个 surface 变量（`secondary` / `accent` / `destructive` / `card` / `popover` / `input` + 各自 foreground）+ 设计 token（`radius` / `font-sans/mono/serif` / `shadow-*` / `letter-spacing` / `tracking-normal` / `spacing`）。`styles/globals.css` 的 `:where(:root)` 从这 8 个核心变量派生 6 个 `--newtab-*` 变量（书签背景、文字、hover 高亮、拖拽落点），见 §6。
- **dark mode 是独立 `darkMode` 设置**（v0.2.75）：`Settings.darkMode: 'system' | 'light' | 'dark'`，默认 `'system'`。下拉列表里每个 theme 只出现一次（不再有 `<base>-dark` 副本条目）；dark variant 由 `resolveTheme()` 在 `applyTheme()` 时根据 `darkMode` + theme 的 dark variant 存在性计算（`data-theme` = `<base>` 或 `<base>-dark`）。`'system'` 走 `matchMedia('(prefers-color-scheme: dark)')` 实时跟随 OS 切换。切到 dark 但主题没有 dark 变体时自动 fallback 到 light。
- **运行时导入**（v0.2.73-v0.2.77）：设置面板 → 「自定义主题」tab 的"导入自定义主题"区支持两种格式：
  - **URL paste**（推荐）：粘贴 `https://tweakcn.com/themes/<id>`，自动补 `/r/` 走 service worker fetch 拉 JSON；JSON URL（`/r/themes/<id>`）也直接支持
  - **CSS paste**：粘贴 tweakcn 主题的 `:root { ... }` + `.dark { ... }` CSS 块（CSS 解析器提取 `--name: value;` 对，shadow var 名 `shadow-x` / `shadow-y` rename 成 `shadow-offset-x` / `shadow-offset-y` 以匹配 JSON schema）
  - 两个路径都最终走 `validateThemeJson()` 校验（8 required shadcn var + dark variant 存在性）+ `installCustomTheme()` 写 storage + 自动切到新主题（保留当前 darkMode 设置）
  - 删除前有 `window.confirm()` 二次确认（v0.2.79）
- **主题切换影响所有界面**（newtab、options、popup）—— 同一份 `data-theme` 属性 + `darkMode` 设置跨上下文同步。
- **per-theme per-mode 外观覆盖**（v0.2.97）：外观 tab 的 10 个选项（`font` / `fontSize` / `fontWeight` / 5 颜色 / `shadowBlur` / `highlightRound`）支持 per-(theme, light/dark) 覆盖。新增 `Settings.themeOverrides: Record<themeId, { light?: Partial<Settings>; dark?: Partial<Settings> }>` 存储桶；切换主题 + darkMode 时由 `features/settings/apply.ts → resolveEffectiveSettings()` 解析。**`theme` / `darkMode` / `width` / `hPos` 永远全局**（不进覆盖范围）。其余布局 tab 选项（spacing / align / columnWidth / ...）也保持全局。外观 tab UI 用 `<details>` 折叠区承载 per-theme 选项（首次进入默认展开，之后记忆 `localStorage['newtab01.appearance.themeOverrides.open']`）。链接圆角走 `var(--newtab-link-radius, calc(var(--radius) - 2px))`：用户填 0 → 主题 .rounded-md；填 N → Npx override。字号改为 px 直接存（不再 `/10 em`）以保证 devtools 显示与设置数值一致。

---

## 3. 技术栈

| 维度 | 选型 | 理由 |
|------|------|------|
| 构建 | Vite + `@crxjs/vite-plugin` | 模块化打包、扩展专用 HMR |
| UI | 手写 HTML/CSS | 轻量、高性能、无依赖 |
| 状态 | 简单 JS 模块 + chrome.storage | 无框架开销 |
| 搜索 | `fuse.js` | 7KB、零依赖 |
| 拖拽 | 原生 HTML5 Drag & Drop | 零依赖，HNTP 已有成熟实现 |
| 动效 | CSS transitions/animations | 零依赖 |
| 持久化 | `chrome.storage.sync`（设置） + `chrome.storage.local`（布局缓存） | 跨设备同步、本地大对象 |

---

## 4. 核心设计：分屏引擎抽象

```ts
// src/features/split-engine/types.ts
export type SplitMode = '2h' | '2v' | '3H' | '4grid';

export interface SplitLayout {
  mode: SplitMode;
}

export interface SplitHandle {
  id: string;          // tabId | windowId
  kind: 'iframe-page' | 'native-window';
  urls: string[];
  layout: SplitLayout;
}

export interface SplitEngine {
  readonly id: 'iframe' | 'native';
  readonly displayName: string;
  open(urls: string[], layout: SplitLayout): Promise<SplitHandle>;
  close(handle: SplitHandle): Promise<void>;
}

// src/features/split-engine/manager.ts
class SplitEngineManager {
  private engines = new Map<string, SplitEngine>();
  private fallback = 'iframe';

  register(engine: SplitEngine) {
    this.engines.set(engine.id, engine);
  }

  async open(urls: string[], layout: SplitLayout, prefer?: 'iframe' | 'native') {
    const id = prefer && this.engines.has(prefer) ? prefer : this.fallback;
    const engine = this.engines.get(id)!;
    return engine.open(urls, layout);
  }
}

export const splitManager = new SplitEngineManager();
splitManager.register(new IframeSplitEngine());
// 未来：splitManager.register(new NativeSplitEngine());
```

- v1：注册 `IframeSplitEngine`（打开新标签页 + `newtab.html?split=1` 内部 N 个 iframe）
- 未来：注册 `NativeSplitEngine`（基于 Window Placing API 或 `chrome.tabs` + `chrome.windows`）
- **调用方（folder-action、popup、search）不感知实现**

### 4.1 iframe 分屏页实现要点
- 通过 URL 参数 `?split=1` 切换分屏模式，URL 列表和 layout 通过 URL hash 传参（`#urls=...&layout=2h`）
- 校验：URL 数量、layout 兼容性、URL scheme（仅 http/https）
- iframe 加 `sandbox="allow-scripts allow-same-origin allow-popups allow-forms"`（按需细化）
- `loading="lazy"` + IntersectionObserver 懒加载
- 顶部工具条：刷新当前、关闭单个、全屏切换
- iframe 加载失败显示 "This site cannot be embedded" 消息 + "Open in new tab" 按钮
- 需要 `declarativeNetRequest` 动态规则移除 `X-Frame-Options` 和 `Content-Security-Policy` 响应头

---

## 5. Chrome 扩展架构要点

### 5.1 Manifest V3
```json
{
  "manifest_version": 3,
  "name": "newtab01",
  "version": "0.1.0",
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "action": { "default_popup": "popup.html" },
  "background": { "service_worker": "src/background.ts", "type": "module" },
  "options_ui": { "page": "options.html", "open_in_tab": true },
  "permissions": ["bookmarks", "favicon", "topSites", "tabs", "tabGroups",
                  "storage", "fontSettings", "sessions", "alarms",
                  "declarativeNetRequest", "search", "management", "contextMenus"],
  "host_permissions": ["<all_urls>"],
  "optional_permissions": []
}
```

### 5.2 Service Worker 规则
- 仅作为**消息路由 + 定时任务**，不持业务状态
- 业务状态在 UI 上下文（zustand + chrome.storage）
- 用 `chrome.alarms` 替代 `setTimeout/setInterval`（SW 可能被休眠）
- 监听 `chrome.runtime.onMessage` 时**必须** `return true` 保持异步通道
- 任何消息处理：先校验 `sender.id === chrome.runtime.id`，再校验 message schema（zod）

### 5.3 上下文矩阵
| 上下文 | 入口文件 | 职责 |
|--------|---------|------|
| Service Worker | `src/background.ts` | 消息路由、tabGroups、alarms、storage 写入聚合、declarativeNetRequest 动态规则 |
| New Tab | `newtab.html` | 书签树渲染、搜索、拖拽、分屏视图（`?split=1`） |
| Options | `options.html` | 设置（原生表单 + chrome.storage） |
| Popup | `popup.html` | 选 URL 触发分屏 |

### 5.4 存储分层
- `chrome.storage.sync`：用户设置（主题、字体、布局选项），配额 100KB
- `chrome.storage.local`：布局状态、书签索引缓存（v1 当前）；预留 Fuse 索引快照（v2 计划，v1 启动时全量 `chrome.bookmarks.getTree()` 重建、变更时 300ms 防抖重建），配额 10MB
- **不使用** `localStorage`（chrome-extension-developer 硬规则）

---

## 6. 主题系统

- **theme source of truth = tweakcn**：内置 4 套主题 + 无限运行时自定义，所有调色板都来自 [tweakcn.com](https://tweakcn.com)。无 AI 生成、无独立调色板。tweakcn 主题的 `<id>` 在 newtab01 内部就是 theme file 的 `data-theme` 值（去掉 `-dark` 后缀的 base id）。
- **三层结构**：
  1. `styles/globals.css` 的 `:where(:root)` 定义 6 个 `--newtab-*` 派生变量（`--newtab-bg` / `--newtab-text` / `--newtab-highlight` / `--newtab-highlight-text` / `--newtab-drop-indicator` / `--newtab-surface`），全部 `var(--xxx)` 引用 8 个核心 shadcn 变量，**specificity = 0**
  2. `styles/themes/<id>.css` 的 `:root[data-theme="<id>"]` 声明该主题的 8 个核心 + 11 个 surface + 设计 token，**specificity = 0,1,0**，**赢过** `:where(:root)` —— 这是 `:where()` 选择器特性 + 主题块后于 globals 的综合效果
  3. `chrome.storage.local.customThemes`（运行时导入的 user theme）经 `applyCustomThemes()` 注入到 `<style id="custom-themes">`，同样用 `:root[data-theme="user-xxx"]` 选择器，与内置主题走同一份 CSS 变量体系
- **dark variant 与 `darkMode` 设置解耦**：每个主题的 dark 版本在 CSS 里**物理存在**（同文件里另一段 `:root[data-theme="<id>-dark"]` 块，跟 light 块平级），但**不**作为独立主题列在 dropdown 里。`<html>` 上的 `data-theme` 属性由 `applyTheme()` → `resolveTheme(baseTheme, darkMode)` 计算：
  - `darkMode = 'light'` → `data-theme = <base>`
  - `darkMode = 'dark'` 且主题有 dark 变体 → `data-theme = <base>-dark`
  - `darkMode = 'dark'` 但主题无 dark 变体 → `data-theme = <base>`（fallback）
  - `darkMode = 'system'` → 走 `matchMedia('(prefers-color-scheme: dark)')` 决定，跟 'light' / 'dark' 走相同 fallback 逻辑
  - OS 主题切换时 `matchMedia` 的 `change` 事件触发 `applyTheme(currentTheme)`，仅当 `darkMode === 'system'` 时 re-apply
- **运行时自定义主题**（v0.2.73-v0.2.77）：
  - 入口：设置面板 → 「自定义主题」tab 顶部"导入自定义主题"section
  - 接收两种格式：**URL**（tweakcn 主题 URL 或 JSON URL，自动 normalize）/**CSS**（tweakcn 主题的 `:root` + `.dark` 块）
  - 校验：`validateThemeJson()` 强制 8 个核心 shadcn var 存在；`installCustomTheme()` 写 `chrome.storage.local.customThemes` map（key = theme name）
  - CSS 路径的 shadow var 命名规范化：`shadow-x` / `shadow-y` → `shadow-offset-x` / `shadow-offset-y`，与 JSON 路径的存储形状对齐
  - 删除前 `window.confirm()` 二次确认（v0.2.79）
- **用户自定义 CSS**（HNTP 继承）：放在 `<style id="user-css">` 内，置于主题变量 + dynamic-styles 之后，cascade 优先级最高。位于 Advanced Tab 文本域。
- **颜色使用语义变量**：`var(--newtab-bg)` / `var(--newtab-text)` / `var(--card)` / `var(--card-foreground)` 等，**禁止**硬编码色值。代码内 `getComputedStyle` 读 `oklch()` / `color-mix()` 等 CSS Color 4 表达式时需经过 `resolveCssColor()` 规整成 `rgb()`，否则 `<input type="color">` 和 chrome.storage 会拒绝非 `#rrggbb` 格式。
- **storage 分层**：
  - `chrome.storage.sync.settings.theme` + `settings.darkMode` —— 跨设备同步用户偏好
  - `chrome.storage.local.customThemes` —— 运行时导入的主题，本地大对象（10MB 配额）

### 6.5 i18n 多语言支持

> v0.2.117 ~ v0.2.122 完整周期。**所有用户可见字符串必须走 `t()` 翻译**。详细开发文档见 [`docs/i18n.md`](docs/i18n.md)；新增/修改字符串前**必读**。

- **目录结构**：`src/lib/i18n/` —— `types.ts`（`MessageKey` 联合 + `SUPPORTED_LOCALES` / `RTL_LOCALES` 列表）、`index.ts`（`t()` / `setLocale()` / `initLocale()` / `getLocale()` / `resolveLocale()` / `subscribe()` / `listLocales()` 运行时）、`catalog/<code>.ts`（10 份 locale bundle：`en` / `zh` / `es` / `ar` / `hi` / `fr` / `pt` / `de` / `ja` / `ru`）
- **零依赖 + 编译期完整**：catalog 用 `as const satisfies LocaleMessages` 模式 —— 任何 catalog 漏 key、typo key、参数不一致都**编译期报错**。`CATALOG` 类型从 v0.2.119 起是 `Record<LocaleCode, LocaleBundle>`（10 项全部到位，Partial 已淘汰）。
- **fallback 链** `当前选 → navigator.language → 'en'`：用户选 `'auto'` 且浏览器语言不在 10 种里 → fallback `'en'`。解析算法：先精确匹配（`'zh-CN'` 不命中 `'zh'`），再主子标签（`'zh-CN' → 'zh'`），最后 `'en'`
- **跨设备同步**：`Settings.language: 'auto' | LocaleCode` 字段存在 `chrome.storage.sync`。`apply.ts` 监听 `chrome.storage.onChanged` 调 `setLocale()` → `subscribe()` 通知所有 UI 模块 in-place 刷新
- **live refresh（不刷新页面）**：`applyLocaleToDom()` 在 `newtab/main.ts` 安装，订阅 i18n 模块；切语言时一次性刷新 `topbar` / `appearance-toggle` / `undo` / `search footer` / `renderColumns()`（特殊目录 title 重新走 `t()`）/ `refreshSettingsPanelLocale()`（in-place 重画打开中的 settings panel —— 不要 close+open，否则会闪）
- **background SW 独立表**：SW 是独立 build chunk，不能 import newtab 的 i18n 模块（会拉 chrome bookmarks shims）。`src/background.ts` 维护独立 `SETTINGS_MENU_TITLES: Record<string, string>` 查表 10 项；`chrome.storage.onChanged` 监听 `settings.language` 变化时 `removeAll` + 重建 context menu
- **Arabic RTL**：`<html dir="rtl">` 由 `setLocale()` 自动写；`styles/globals.css` 末尾的 `[dir="rtl"]` 规则强制 URL/hostname 显示节点（search-result-url / split-picker-url / picker-url / bookmark-url / search-result-host / sp-pill-url）走 LTR + `unicode-bidi: isolate`，search input 走 RTL + `text-align: right`。项目 CSS 全部用 `flex + gap`（CLAUDE.md §9.2），column 排布、topbar、settings panel 不需显式镜像
- **bundle 预算**：10 个 locale × ~5KB unzipped ≈ 50KB，gzipped 后 ~16KB；newtab bundle 现在 26.91KB gzipped（含 i18n 全套），仍在 80KB 预算内
- **修改规则**：
  - 新增用户可见字符串：先在 `types.ts` 加 `MessageKey`，再在所有 10 个 catalog 补翻译（编译期强制）—— 漏一个就 build 不过
  - 现有字符串改文案：改所有 10 个 catalog（grep `MessageKey` 反查也行 —— tsc 在 `'settings.xxx' = '...'` 处会因 `LocaleMessages` 联合报错）
  - 静态结构里的 label / placeholder / title / aria-label 走 `t(key)` 现读现译 —— locale 切换时 in-place 更新
  - 静态配置对象里只放 `titleKey: MessageKey` / `labelKey: MessageKey`（参考 `folder-actions.ts` / `appearance-toggle.ts` / `layout-picker.ts` 的模式），不要放裸字符串
  - 动态拼接用户数据：用户提供的 URL、文件名、bookmark title 不进 catalog；只有**项目自有文案**进 catalog

---

## 7. 性能预算与策略

| 指标 | 预算 | 策略 |
|------|------|------|
| 新标签页首屏 JS | ≤ 80KB gzipped | Vite 分 chunk：dnd / search / split 按路由懒加载 |
| 新标签页 FCP | < 200ms | 书签数据走 `chrome.storage.local` 缓存；首屏用 Skeleton |
| Service Worker | < 10KB | 纯路由 + alarms，不引重型库 |
| iframe 分屏 | 每帧 < 5KB 控制代码 | URL 校验后注入，loading=lazy |
| 拖拽 | 60fps | dnd-kit `useSensors` + `restrictToWindowEdges`；不在拖拽期间 setState 重渲染列 |

---

## 8. AI 编码助手行为指令

> AI 编码助手行为指令（Skill 调用规则、编码原则、shadcn/ui 行为准则、Frontend Skill 行为准则等）已迁移至 [`.trae/rules/project_rules.md`](.trae/rules/project_rules.md)。

---

## 9. 工程约束

### 9.1 TypeScript 严格度
- `strict: true`、`noUncheckedIndexedAccess: true`、`exactOptionalPropertyTypes: true`
- 任何 `chrome.*` API 调用必须走 `lib/chrome/` 内的类型化封装
- 禁用 `any`（除外部 SDK 适配的明确注释场景）

### 9.2 组件规则
- 用 `cn()` 或条件 classList 做条件样式，**禁止**手写模板字符串三元
- 用语义 CSS 变量（`var(--newtab-bg)` 等），**禁止**硬编码色值
- 间距一律 `flex + gap` 或 CSS gap，**禁止** `space-x-*` / `space-y-*`
- Dialog/Sheet/Drawer 必须有 Title（可 `class="sr-only"`）
- 任何空状态显示提示文字，不用自造空 div

### 9.3 命名
- 文件名 `kebab-case.ts`
- 业务模块用 feature-sliced 命名（`features/<area>/<unit>.ts`）
- 类型/接口用 `interface`，type 仅用于联合/工具类型
- 不用 `I` 前缀（TypeScript 风格）

### 9.4 文件大小规范
1. 参考阈值：单个代码文件建议不超过 1000 行；行数超标时优先按单一职责进行模块/文件拆分
2. 阈值仅作为优化提示信号，非强制硬性约束
3. 拆分校验原则：若拆分后模块职责边界模糊、依赖关系复杂化、逻辑割裂难以维护，则维持原有合并文件，不强制拆分
4. 补充判定：若文件同时满足「超 1000 行 + 多职责混杂」，必须重构拆分；仅行数超标但职责高度内聚，可保留不拆分

### 9.5 Favicon 加载
- 使用 Chrome 扩展内部 API：`/_favicon/?pageUrl=...&size=16`，配合 `srcSet` 提供 2x 分辨率
- 同源 favicon URL 使用 `Map<string, string>` 缓存，避免重复生成
- 禁止使用 `chrome://favicon/` 协议（MV3 CSP 阻断）

### 9.6 拖拽实现约束
- 拖拽事件使用原生 HTML5 Drag & Drop API
- 坐标定位使用 `clientY` + `getBoundingClientRect()`，不依赖 `e.target`
- 拖拽处理器中的状态通过闭包或模块级变量访问最新值

### 9.7 设置加载顺序
- NewtabApp 必须先调用 `initSettingsStore()` 再初始化 layout store
- 设置加载完成前显示 Loading 状态
- 所有设置项（spacing、vMargin、columnWidth、align、shadowBlur、highlightRound、lockColumns、showTopLevel、hideOptions、autoScale、numberTop）必须正确消费并实现

### 9.8 集成验证与代码同步
- 根据测试结果修复集成问题
- 各 Agent 并行开发时可能存在的接口对齐问题需在运行时验证
- **每次执行任务之前都需要先重新审视代码，因为代码可能由其他任务或 agent 改动**
- 任务开始前的强制步骤：
  1. 用 `Read` / `Grep` 复查目标文件及其依赖模块的当前状态
  2. 对照假设检查函数签名、导出名称、类型定义是否仍匹配
  3. 发现与本任务无关的变更 → 报告但不擅自修改
  4. 假设与现状不符 → 先更新假设再动手
- 集成问题修复原则：
  - 优先修复调用方（适配接口变化），不破坏已稳定模块
  - 接口冲突时与相关 Agent 协商统一，而非各自变体
  - 修复后必须实际运行验证，不可只靠 TypeScript 编译通过

### 9.9 i18n 工程约束
- **所有用户可见字符串必须走 `t()`**。HTML 文本（`<div>`, `<span>`, `<button>`, `<option>`, `<label>`）、`textContent`、`placeholder`、`title`、`aria-label`、`alert()` / `confirm()` 提示 —— 一律不允许硬编码中英文或其他裸字符串
- **新增 key 的流程**：
  1. 在 `src/lib/i18n/types.ts` 的 `LocaleMessages` 类型前一行加新 key 到 `MessageKey` 联合（`grep -n 'settings\.' types.ts` 找位置）
  2. 改 `en.ts` 加翻译（`en` 是 source of truth；中文和其它语言可机器翻译，但术语与 en 一致）
  3. 同步改 9 个其它 catalog —— tsc 因 `as const satisfies LocaleMessages` 会强制要求每个 catalog 都补
  4. **新模块第一次 i18n 化时**，新加的 MessageKey 可能数十个。一次性加完并跑 `pnpm exec tsc --noEmit` 确认 0 error
- **改文案**：先改 `en.ts`（source of truth），再同步改 9 个 catalog；不要只改一个 —— 否则 tsc 不会报但其他语言用户看到旧文案
- **AI 翻译质量**：v0.2.117 周期内 9 种非英文 catalog 由 AI 一次性生成（hi / ar / ru 可能不自然）。`docs/i18n.md` 留校对入口；用户后续手动微调单个 key 即可，无需跑整个翻译流程
- **静态配置对象用 `key` 字段**而不是裸字符串（参考 `folder-actions.ts` / `appearance-toggle.ts` / `layout-picker.ts` 的 `titleKey` / `labelKey` 模式）。在静态数组 / 对象里直接放 `'亮'` 之类的中文字符串会导致 tsc 报错且破坏切语言支持
- **placeholder 插值**：t(key, params) 支持 `{name}` 占位符，例如 `t('folderAction.confirmOpenAll', { count })` → 「打开全部 8 个链接」。**禁止**用字符串模板拼接（`"打开" + count + "个链接"`），那会绕过 catalog
- **不翻译的内容**：用户提供的 URL、文件名、bookmark title、theme id、内部错误堆栈、debug log —— 这些**不**进 catalog
- **`.sp-label` / 长字符串**：v0.2.121 之后 `.sp-label` 走 `white-space: normal; word-break: break-word`，新加的 label 如果仍然太短会被截断就错了 —— 重新检查 label 内容。**禁止**加回 `nowrap` / `ellipsis`（会破坏非英文 locale）
- **测试**：切到每种 locale 跑一遍主要 UI（settings panel 5 tab、popup、split-picker、search footer、context menu、文件夹右键、tab group 标题）确认字符串完整

---

## 10. 风险与未决项

| 风险 | 应对 |
|------|------|
| `chrome.tabGroups` 在 Firefox 缺失 | v1 不支持 Firefox，文档明示（见 1.2） |
| iframe 分屏受同源策略限制 | 提供 "open all in tabs" 兜底；declarativeNetRequest 动态规则移除限制头 |
| shadcn preset 选型 | 默认 `base-nova` 或 `radix-nova`，根据视觉评审调整 |
| 拖拽性能（千级书签） | 列表虚拟化（`@tanstack/react-virtual`），不在 v1 必做 |
| 自定义 CSS 注入 XSS | 仅注入到 `<style>` 节点，不进 `innerHTML`；CSP 已禁 unsafe-inline |
| declarativeNetRequest 规则失效 | 使用动态规则（`updateDynamicRules`）而非静态规则文件，更可靠 |
| 并行 Agent 开发的接口对齐 | 运行时验证，遵循 9.8 集成验证与代码同步规则 |
| 代码被其他任务/Agent 改动导致假设失效 | 任务开始前先 `Read` 复查，再动手 |

---

## 11. 版本号约定

- **每次提交都 bump patch 版本号**（`0.1.0 → 0.1.1 → 0.1.2`）。这样用户能直观判断扩展是否需要刷新。
- bump 与代码改动放在**同一个 commit**，commit message 注明。
- Major / minor 升级仍然按功能里程碑手动决定（不随每次 commit 涨）。
- bump 时同步更新 `CHANGELOG.md` 的 Unreleased / 新版本小节。
