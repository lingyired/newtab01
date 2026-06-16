# 搜索功能 — 需求整理与现状盘点

> 目的：把当前文档中所有「搜索」相关需求汇总成一份清单，对照代码现状，列出**未实现 / 已坏掉**的部分，提出修复方案，等用户确认后再动手。

---

## 1. 文档来源（已逐字核对）

| 文档 | 章节 | 与搜索相关的关键条款 |
|------|------|----------------------|
| `CLAUDE.md` | § 2.3 书签快速搜索 | 完整需求规格（见下 § 2） |
| `CLAUDE.md` | § 3 技术栈 | 搜索引擎：`fuse.js`（7KB、零依赖） |
| `CLAUDE.md` | § 5.4 存储分层 | `chrome.storage.local` 中存「Fuse 索引快照」 |
| `CLAUDE.md` | § 9.4 性能 | 搜索索引启动时构建，bookmark 变更时重建 |
| `.trae/rules/project_rules.md` | § 1 | 搜索：fuse.js |
| `.trae/rules/project_rules.md` | § 3.4 | favicon URL 使用 Map 缓存；搜索索引启动时构建，bookmark 变更时重建 |
| `.trae/documents/parallel-agent-plan.md` | § 阶段 1 Agent 3 | 实现模块清单：`search-bar / search-results / search-overlay / search-engine / bookmark-index`；overlay z-40，results z-50；Cmd/Ctrl+K 唤起；上下键导航；回车打开；无选择回车 → 浏览器搜索引擎 |

---

## 2. 文档化需求清单（按 CLAUDE.md § 2.3 整理）

> **R1** 顶部 toolbar 显示一个搜索框，激活时显示搜索面板，整个界面增加**水玻璃模糊层**（overlay）。
> **R2** 全局快捷键 `Cmd/Ctrl + K` 唤起搜索面板。
> **R3** 索引：启动时 + `chrome.bookmarks.onChanged` 时**重建索引**。
> **R4** 索引范围：书签 `title + url`（v1 不含 history / topSites）。
> **R5** 搜索引擎：`fuse.js`，阈值 `0.4`，keys 权重 `title: 0.7` / `url: 0.3`。
> **R6** 上下键导航搜索结果，回车打开选中项。
> **R7** 不选择结果直接回车 → 调用**当前浏览器默认搜索引擎**搜索输入框内容。
> **R8** 搜索框为 topbar 和浮动结果面板**共享的单一 input**（不是两个）。
> **R9** 层级：overlay z-40，results z-50，通过 `createPortal` 渲染到 body。
> **R10** 设置项 `showSearch` 控制搜索栏显示/隐藏（默认 1）。
> **R11** v1 性能预算：新标签页首屏 JS ≤ 80KB gzipped；FCP < 200ms。
> **R12** Favicon 使用 `/_favicon/?pageUrl=...&size=16` + `srcSet` 2x + Map 缓存（结果列表里展示 favicon 时适用）。

---

## 3. 当前代码现状

### 3.1 模块存在性

| 文件 | 状态 | 行数 |
|------|------|------|
| `src/features/search/search-engine.ts` | ✅ 存在且符合 R5 | 24 |
| `src/features/search/bookmark-index.ts` | ✅ 存在且符合 R3 / R4 | 71 |
| `src/features/search/search-bar.ts` | ✅ 存在 | 122 |
| `src/features/search/search-results.ts` | ✅ 存在 | 213 |
| `src/features/search/search-overlay.ts` | ✅ 存在 | 40 |
| `src/features/search/search-main.ts` | ✅ 存在，导出 `initSearch()` | 110 |

### 3.2 ⚠️ 关键 Bug：**`initSearch()` 从未被调用**

证据：
- `src/newtab/app.ts` 中没有任何 `import ... from '../features/search/...'`。
- `app.ts` 的初始化流程（`initApp()`）依次是 `initDebug → initSettings → loadLayout → renderColumns`，**没有调用 `initSearch()`**。
- 全项目 grep 不到 `initSearch` 的调用点。

→ 现状：**搜索模块代码完整，但**根本没被装配进 newtab 启动流程，所以用户看到的是「搜索不可用」。

### 3.3 ⚠️ 平行实现冲突

`src/newtab/topbar.ts`（L11-34）自己渲染了一个 `<input id="search-input">`，并注册了一个 Cmd/Ctrl+K 监听器，行为是**把焦点放回这个 topbar input**。它和 `search-bar.ts` 的 `showBar()` 渲染的浮动 input 是**两套独立 input**，互不通讯。

- 行为冲突点：Cmd/Ctrl+K → 焦点去 topbar input，**不**触发 overlay 浮层 → 体验上「按了 K 也只是光标闪一下」。
- 规范冲突点：CLAUDE.md § 2.3 明确说 R8「共享的单一 input」，现在有两套。

### 3.4 已实现细节核对

| 规范 | 文件 | 现状 |
|------|------|------|
| R3 启动+ onChanged 重建 | `bookmark-index.ts:50-71` | ✅ 已有 `scheduleRebuild` 300ms 防抖 |
| R5 fuse 配置 | `search-engine.ts:10-19` | ✅ `threshold: 0.4`，权重 `title:0.7 / url:0.3` |
| R6 上下键 / Enter | `search-results.ts:142-184` | ✅ `handleKeyNavigation` 完整 |
| R7 无选择回车 → 浏览器搜索 | `search-main.ts:30-33 + 88-95` | ✅ 已实现（`createTab(query, true)`） |
| R9 overlay z-40 | `search-overlay.ts:2-4` | ✅ `z-index: 40` |
| R9 results z-50 | `search-results.ts:11` | ✅ `z-index: 50` |
| R9 createPortal 渲染到 body | 各处 | ❌ **实际是 `document.body.appendChild`，不是 `createPortal`**；功能等价（无 React 时两者都是 body 末端），但与文档字面不一致 |
| R12 favicon 缓存 | `search-results.ts:36-40` | ❌ **没有用 Map 缓存**；每次 render 都重新拼 URL |
| R10 `showSearch` 设置 | `topbar.ts:12` | ⚠️ topbar 自己读了设置，但 `search-main.ts` 完全不读 |
| R5 `includeScore` / R6 排序 | `search-engine.ts:17` | ✅ `includeScore: true` |
| 共享 input（R8） | — | ❌ topbar 的 input 和 `showBar` 的 input 是两个 |
| Esc 关闭 | `search-bar.ts:73-78` + `search-main.ts:51-54` | ✅ |
| Overlay 点击关闭 | `search-overlay.ts:20-22` | ✅ |

### 3.5 `?split=1` 模式下的搜索行为

`app.ts:52-58` 当 URL 携带 `?split=1` 时走分屏渲染并 `return`，**不会进入搜索初始化**。这与规范一致（搜索只在新标签页主页生效），但如果以后用户期望在分屏页也能搜索，需要单独约定。**暂不处理。**

---

## 4. 修复方案（待用户确认）

### 4.1 最小修复（修复「不可用」）

只做两件事：
1. 在 `src/newtab/app.ts` 的 `initApp()` 启动流程中（建议放在 `renderColumns()` 之后），调用 `initSearch()`。
2. 让 topbar 的 Cmd/Ctrl+K 不再独立处理焦点，**改为**调用 `search-main.ts` 暴露的 `openSearch()` / `toggleSearch()`。

效果：Cmd/Ctrl+K 唤起 overlay，topbar 的 input 在「搜索激活态」下复用同一个搜索（共享 input 行为）。

### 4.2 中等修复（顺手清理平行实现）

1. **删除** `search-bar.ts` 的 `showBar()` 浮层渲染（与 R8 冲突，且 topbar input 才是规范要求的入口）。
2. `topbar.ts` 的 `#search-input` 改为真正的搜索入口：input 事件 → 触发 `search-main` 的 `performSearch`；Cmd/Ctrl+K → `openSearch()`。
3. 「水玻璃模糊层」用 `search-overlay.ts` 的 overlay 替代（保留其实现，单纯接入）。
4. `search-main.ts` 在 overlay 打开后接管 `keydown`（`ArrowUp/Down/Enter/Escape`）和「无选择回车 → 浏览器搜索」。

### 4.3 顺手补的小项

- `search-results.ts` 给 favicon URL 加 Map 缓存（满足 R12 与 § 3.4 性能）。
- `search-main.ts` 启动时读 `showSearch` 设置；为 0 时不渲染 topbar input 也不绑定 keydown。
- 把 `search-results.ts:1-40` 的内联 `<style>` 字符串移到 `styles/newtab.css`（与现有 `.search-overlay / .sp-panel` 等类对齐；目前用的是 `style.cssText` 内联，与 § 3.1「不硬编码色值」不冲突但风格不一致）。

### 4.4 不在本次范围

- 不实现 `chrome.storage.local` 中 Fuse 索引快照（v1 重建足够快，规范是优化项）。
- 不做搜索历史 / 拼音 / 中文分词（v1 不要求）。
- 不在分屏页（`?split=1`）加搜索（保持范围纯净）。

---

## 5. 验证标准（修复后必须达成）

1. `pnpm build` 通过，无 TypeScript 错误。
2. 加载扩展到 Chrome：
   - [ ] topbar 显示搜索框（受 `showSearch` 控制）。
   - [ ] 直接点 topbar input 输入 → 浮层结果面板出现，**overlay 模糊背景可见**。
   - [ ] Cmd/Ctrl+K 在任意焦点状态下唤起 overlay。
   - [ ] `↓/↑` 在结果列表移动高亮，`Enter` 打开。
   - [ ] 不动高亮直接 `Enter` → 走浏览器默认搜索引擎。
   - [ ] `Esc` / 点击 overlay 关闭搜索。
   - [ ] 书签增删改（DevTools 改一下书签）后，搜索结果能反映新内容（验证 R3）。
3. `?debug=1` 打开时控制台能看到 `search / index` 标签的 debug 日志，索引构建耗时可见。

---

## 6. 待用户确认的关键决策

请用户回复以下问题（默认按括号内选择执行）：

- **Q1 范围**：采用 § 4.1「最小修复」还是 § 4.2「中等修复（删 search-bar 浮层）」？
  - 默认：**§ 4.2 中等修复**（彻底解决 R8 共享 input 的问题，避免后续债务）。
- **Q2 topbar input 形态**：保留 topbar 的常驻 input（点击即激活搜索），还是 Cmd/Ctrl+K 才出现（topbar 一直空）？
  - 默认：**保留常驻 topbar input**（与 CLAUDE.md § 2.3「顶部 toolbar 显示一个搜索框」字面一致）。
- **Q3 favicon 缓存**：是否现在加 Map 缓存？
  - 默认：**加**（一行 Map 即可，符合 § 3.4 性能规则）。
- **Q4 createPortal 字面合规**：是否要替换成 `document.body.appendChild` → `createPortal(...)` ？
  - 默认：**不替换**（无 React 环境下两者等价，文档字面 ≠ 必须）。
- **Q5 是否同步 bump patch 版本号（`0.1.0 → 0.1.1`）并更新 CHANGELOG**？
  - 默认：**是**（按 CLAUDE.md § 11 约定）。

---

## 7. 提议的改动文件清单（待确认后执行）

| 文件 | 改动 |
|------|------|
| `src/newtab/app.ts` | 在 `initApp()` 启动序列里 `await initSearch()` |
| `src/newtab/topbar.ts` | input 事件 → 调 `search-main` 的搜索回调；Cmd/Ctrl+K → `openSearch()`；不再自己 `e.preventDefault` 抢焦点 |
| `src/features/search/search-main.ts` | `initSearch()` 改为导出 `openSearch / closeSearch / performSearch / onQueryChange` 公共 API；启动时读 `showSearch`；为 0 时跳过 topbar 绑定 |
| `src/features/search/search-bar.ts` | **删除 `showBar` 浮层渲染**（与 R8 冲突），仅保留 `getInputElement()` 等与 topbar input 对接的辅助 |
| `src/features/search/search-results.ts` | 加 favicon URL Map 缓存；保留 DOM 接口 |
| `src/features/search/search-overlay.ts` | 基本不动，只在 `initSearch()` 时确保能挂上 body |
| `manifest.json` | 版本号 bump（若 Q5 = 是） |
| `CHANGELOG.md` | 追加 Unreleased / 0.1.1 条目（若 Q5 = 是） |

---

## 8. 不确定 / 仍需确认

- 4.2 删 `showBar` 后，搜索激活态的视觉信号（顶栏 input 边框变色等）是否需要在 `styles/newtab.css` 加 `.search-input--active` 类？**默认：加**（保持 R1「激活时显示搜索面板」的视觉反馈）。
- 4.3 中提到的「内联 style → CSS 类」整理，是否一并做？**默认：本次不做**（避免 scope 蔓延，与 § 2.3「Precise Edits」一致）。
