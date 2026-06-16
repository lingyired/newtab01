# newtab01 项目初始化与并行开发计划

## 摘要

newtab01 项目当前只有 CLAUDE.md 和 .trae/ 配置文件，没有任何源代码。需要从零搭建 Vanilla JS + Vite 的 Chrome 扩展项目，并实现 CLAUDE.md 定义的 5 项新增能力。

**技术栈决策**：不使用 React，使用 Vanilla JS + Vite，无组件库（手写 UI），保持轻量高性能。

原始 HNTP 是纯 vanilla JS（~41KB newtab.js + ~6KB newtab.css），newtab01 在此基础上用 Vite 做模块化打包，保留轻量特性。

## 当前状态分析

- **目录结构**：只有 `CLAUDE.md`、`.trae/rules/project_rules.md`、`.trae/specs/`
- **源代码**：无（需从零创建）
- **原始项目**：HNTP 使用 vanilla JS，单文件架构（newtab.html + newtab.js + newtab.css）
- **目标架构**：Vanilla JS + Vite + @crxjs/vite-plugin，模块化但无框架

## 技术栈（修订）

| 维度 | 选型 | 理由 |
|------|------|------|
| 构建 | Vite + `@crxjs/vite-plugin` | 模块化打包、扩展 HMR |
| UI | 手写 HTML/CSS | 轻量、高性能、无依赖 |
| 状态 | 简单 JS 模块 + chrome.storage | 无框架开销 |
| 搜索 | `fuse.js` | 7KB、零依赖 |
| 拖拽 | 原生 HTML5 Drag & Drop | 零依赖，HNTP 已有成熟实现 |
| 动效 | CSS transitions/animations | 零依赖 |
| 持久化 | `chrome.storage.sync` + `chrome.storage.local` | 跨设备同步、本地大对象 |

**不再使用的依赖**：React, shadcn/ui, zustand, react-hook-form, zod, dnd-kit, framer-motion, @tanstack/react-virtual

---

## 并行任务分配

### 阶段 0：项目脚手架（必须先完成）

**Agent 0: 项目脚手架搭建**

1. 初始化 Vite + TypeScript 项目（Vanilla JS 模板）
2. 安装依赖：
   - `@crxjs/vite-plugin` — Chrome 扩展 HMR
   - `fuse.js` — 搜索引擎
3. 创建 `manifest.json`：
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
                     "declarativeNetRequest"],
     "host_permissions": ["<all_urls>"],
     "optional_permissions": []
   }
   ```
4. 创建入口文件：
   - `newtab.html` + `src/newtab/main.ts`
   - `options.html` + `src/options/main.ts`
   - `popup.html` + `src/popup/main.ts`
   - `src/background.ts`
5. 创建目录结构：
   - `src/newtab/` — 新标签页
   - `src/options/` — 设置页
   - `src/popup/` — 弹出页
   - `src/features/bookmarks/` — 书签渲染
   - `src/features/drag-drop/` — 拖拽系统
   - `src/features/search/` — 搜索功能
   - `src/features/split/` — 分屏引擎
   - `src/features/themes/` — 主题系统
   - `src/lib/chrome/` — Chrome API 封装
   - `src/lib/storage/` — 存储封装
   - `styles/` — 全局样式 + 主题
6. 创建 `vite.config.ts`
7. 创建 `tsconfig.json`（strict: true）
8. 创建 `styles/globals.css` 基础样式
9. 复制 HNTP 的 `icons/` 目录和 `LICENSE_MIT.txt`
10. 验证：`pnpm dev` 能启动、`pnpm build` 能产出 dist/

---

### 阶段 1：4 个 Agent 并行执行

#### Agent 1: Chrome API 封装 + Background Worker + 存储层 + 主题系统

**Chrome API 封装** (`src/lib/chrome/`)：
- `bookmarks.ts` — chrome.bookmarks 封装（getSubTree, getRecent, onChanged 等）
- `topSites.ts` — chrome.topSites 封装
- `sessions.ts` — chrome.sessions 封装（getRecentlyClosed, getDevices）
- `tabs.ts` — chrome.tabs 封装
- `tabGroups.ts` — chrome.tabGroups 封装
- `management.ts` — chrome.management 封装（获取 apps）
- `favicon.ts` — favicon URL 生成（`/_favicon/?pageUrl=...&size=16` + srcSet 2x + Map 缓存）
- `declarativeNetRequest.ts` — 动态规则注册（移除 X-Frame-Options / CSP 头）
- `messages.ts` — 消息类型定义 + 校验

**存储层** (`src/lib/storage/`)：
- `settings.ts` — chrome.storage.sync 封装（用户设置读写 + 默认值）
  - 所有设置项：spacing, vMargin, columnWidth, align, shadowBlur, highlightRound, fadeMs, slideMs, lockColumns, showTopLevel, hideOptions, autoScale, numberTop, rememberOpen, newtab, font, fontColor, backgroundColor, backgroundImage, highlight, highlightText
- `layout.ts` — chrome.storage.local 封装（列布局状态读写）
- `index.ts` — 统一导出

**Background Service Worker** (`src/background.ts`)：
- 消息路由（chrome.runtime.onMessage + sender 校验）
- declarativeNetRequest 动态规则注册
- tabGroups 操作（接收消息创建标签组）
- chrome.alarms（如有定时任务需求）

**主题系统** (`src/features/themes/` + `styles/`)：
- `styles/globals.css` — :root 语义变量（--background, --foreground, --primary 等）+ newtab 专用变量（--newtab-bg, --newtab-text, --newtab-highlight, --newtab-highlight-text, --newtab-spacing, --newtab-vmargin 等）
- `styles/themes/default.css` — 默认亮色主题
- `styles/themes/dark.css` — 暗色主题（--newtab-bg: #000）
- `styles/themes/slate.css` — Slate 主题
- `styles/themes/rose.css` — Rose 主题
- 更多主题可后续添加
- `src/features/themes/switcher.ts` — 主题切换逻辑（data-theme 属性 + chrome.storage.sync 持久化）
- 主题变量应用到 html/body/#root
- 主题切换影响所有界面（newtab, options, popup）

**验证**：settings 能从 chrome.storage 加载/保存；background 能处理消息；主题切换生效

---

#### Agent 2: 书签树渲染 + 拖拽系统

**书签树渲染** (`src/features/bookmarks/`)：
- `board.ts` — 主面板，渲染多列布局
- `column.ts` — 单列，渲染文件夹列表
- `folder.ts` — 文件夹节点（header + 3 操作图标 + 子节点列表）
- `link.ts` — 书签链接节点
- `special-folders.ts` — 特殊文件夹（topSites, recent, closed, devices, apps）
- `favicon.ts` — favicon 渲染（使用 /_favicon/ API + 缓存）
- `folder-actions.ts` — 文件夹 header 操作图标
  - ExternalLink（批量打开）、FolderPlus（Group 打开）、Columns2（分屏打开）
  - 仅当 bookmark 数量 ≥ 1 时显示
  - 点击不触发文件夹展开/折叠
- `context-menu.ts` — 右键菜单
- `render.ts` — 统一渲染入口（参考 HNTP 的 render/renderAll/renderColumn/renderColumns）

**拖拽系统** (`src/features/drag-drop/`)：
- 基于 HNTP 原生 HTML5 Drag & Drop 增强
- `drag-column.ts` — 列拖拽
- `drag-folder.ts` — 文件夹拖拽
- `drop-handler.ts` — 拖放处理（getDropTarget, getDropX, getDropY, isAbove）
- `layout-ops.ts` — 布局操作（addColumn, addRow, removeColumn, removeRow）
- 关键约束：
  - 坐标定位用 clientY + getBoundingClientRect()
  - 拖拽期间不触发重渲染
  - 空列自动移除（至少保留 1 列）
  - 同一文件夹不允许重复
  - 特殊列可作为拖拽目标
- 自动折叠逻辑：
  - 顶层文件夹自动折叠同列其他顶层文件夹
  - 嵌套文件夹仅折叠同父级兄弟
- 拖拽视觉反馈（背景色、插入指示器）
- 右键菜单拖拽等价操作

**验证**：书签树能正确渲染；拖拽能排序/跨列/创建新列；右键菜单可用

---

#### Agent 3: 搜索功能 + 分屏引擎

**搜索功能** (`src/features/search/`)：
- `search-bar.ts` — 搜索输入框（居中 topbar + 浮动面板共享）
- `search-results.ts` — 搜索结果面板
- `search-overlay.ts` — 模糊遮罩层（z-40，不遮挡搜索框和结果）
- `search-engine.ts` — fuse.js 封装（阈值 0.4, title:0.7 / url:0.3）
- `bookmark-index.ts` — 书签索引（启动时 + chrome.bookmarks.onChanged 重建）
- 全局快捷键 Cmd/Ctrl+K 唤起
- 上下左右导航结果、回车打开
- 无选择回车 → 浏览器搜索引擎搜索
- overlay z-40, results z-50
- 设置控制搜索栏显示/隐藏

**分屏引擎** (`src/features/split/`)：
- `types.ts` — SplitMode, SplitLayout, SplitHandle, SplitEngine 接口
- `iframe-engine.ts` — IframeSplitEngine 实现
  - 打开新标签页 newtab.html?split=1
  - URL 列表和 layout 通过 URL hash 传参
- `manager.ts` — SplitEngineManager（register + open）
- `split-view.ts` — 分屏视图渲染（?split=1 模式）
  - 解析 URL hash 参数
  - 校验 URL 数量、layout 兼容性、URL scheme（仅 http/https）
  - 渲染 N 个 iframe（sandbox, loading=lazy）
  - 顶部工具条：刷新、关闭单个、全屏切换
  - iframe 加载失败显示 "This site cannot be embedded" + "Open in new tab"
- `split-layout.ts` — 布局渲染（2h, 2v, 3grid, 4grid CSS Grid/Flexbox）

**验证**：搜索能找到书签并打开；分屏能渲染 iframe 并处理加载失败

---

#### Agent 4: Popup 页面 + Options 页面

**Popup 页面** (`src/popup/`)：
- `popup.ts` — 主逻辑
- `bookmark-picker.ts` — 书签选择 Tab
- `open-tabs-picker.ts` — 打开标签页选择 Tab
- `layout-picker.ts` — 分屏布局选择（2h, 2v, 3grid, 4grid）
- 勾选 2-4 个 URL → 选 layout → Open Split
- 调用 splitManager.open()
- Dialog 风格全屏布局

**Options 页面** (`src/options/`)：
- `options.ts` — 主逻辑
- 各设置 Tab（参考 HNTP 的 options 面板结构）：
  - Layout — spacing, vMargin, columnWidth, align, lockColumns, showTopLevel, autoScale
  - Appearance — 主题切换, font, textColor, backgroundColor, backgroundImage, highlight, highlightText, shadowBlur, highlightRound, fadeMs, slideMs
  - Features — hideOptions, numberTop, numberRecent, showDevices
  - Advanced — 自定义 CSS 文本域
- Close 按钮 → chrome.tabs.update({ url: 'chrome://newtab' })
- 导入/导出设置
- react-hook-form + zod → 改为原生表单 + 手动校验

**验证**：popup 能选 URL 触发分屏；options 能修改设置并持久化

---

## 任务依赖关系

```
阶段 0 (Agent 0: 脚手架) — 必须先完成
  ├── Agent 1: Chrome API + Background + 存储 + 主题
  ├── Agent 2: 书签渲染 + 拖拽
  ├── Agent 3: 搜索 + 分屏引擎
  └── Agent 4: Popup + Options
```

- 阶段 0 必须先完成
- Agent 1-4 可完全并行执行
- Agent 2 的拖拽和 Agent 3 的分屏有轻微耦合（文件夹操作图标调用分屏引擎），但可先各自独立开发再集成

## 假设与决策

1. **不使用 React**：用户明确要求 Vanilla JS + Vite
2. **不使用组件库**：手写 UI，保持轻量
3. **不使用 zustand**：用简单 JS 模块 + chrome.storage 管理状态
4. **不使用 dnd-kit**：用原生 HTML5 Drag & Drop（HNTP 已有成熟实现）
5. **不使用 framer-motion**：用 CSS transitions/animations
6. **不使用 react-hook-form + zod**：用原生表单 + 手动校验
7. **包管理器**：pnpm
8. **TypeScript**：使用 TS 做类型检查，但运行时是纯 JS
9. **CLAUDE.md 需同步更新**：技术栈部分需从 React + shadcn/ui 改为 Vanilla JS

## 验证步骤

1. 阶段 0 完成后：`pnpm dev` 启动、`pnpm build` 产出 dist/
2. 每个 Agent 完成后：对应功能模块可独立验证
3. 全部完成后：
   - 新标签页能渲染书签树 + 拖拽 + 搜索 + 分屏
   - 选项页能修改设置
   - Popup 能选 URL 分屏
   - 主题切换影响所有界面
   - `pnpm build` 产出可加载的 Chrome 扩展
