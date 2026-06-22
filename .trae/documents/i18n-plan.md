# i18n 多语言支持 — 收尾执行计划

> 状态：**执行**（feat/i18n 分支，v0.2.117 已 commit，v0.2.118 处于 uncommitted broken 状态）
> 目标分支：`feat/i18n`（从 `main` 切出，沿用 CLAUDE.md §0.1 的 "feat 分支冻结" 策略）
> 起始 commit：`main` 头（v0.2.116）
> 计划版本：**v0.2.117（已 done）→ v0.2.118（修复 + 收尾）→ v0.2.119（8 新语言）→ v0.2.120（CHANGELOG + 合并）**

---

## 1. Summary

将 newtab01 扩展的所有用户可见字符串（设置面板、tooltip、右键菜单、特殊目录标题、popup 文本、分屏选择器、search 提示、background 右键菜单）抽离为按 locale 索引的翻译资源。新增 `src/lib/i18n/` 模块、`chrome.storage.sync.settings.language` 字段（默认 `'auto'` 跟随浏览器）、10 种初始 locale（en / zh / es / ar / hi / fr / pt / de / ja / ru），并为阿拉伯语加 RTL（`dir="rtl"`）支持。

v0.2.117 已经完成：脚手架 + en + zh 完整 catalog + settings 面板全部迁移。v0.2.118 处于 uncommitted 中间态（有 4 处 TS 编译错误必须先修），剩余 8 个模块（split-picker / popup / background SW / search footer / folder empty / newtab init wiring）待迁移。v0.2.119 / v0.2.120 完全待办。

---

## 2. Current State Analysis（执行前先复查）

### 2.1 Git 状态

```
On branch feat/i18n
Changes not staged for commit:
  modified:   src/features/bookmarks/context-menu.ts          (v0.2.118 partial)
  modified:   src/features/bookmarks/folder-actions-handler.ts (v0.2.118 partial)
  modified:   src/features/bookmarks/folder-actions.ts        (v0.2.118 partial)
  modified:   src/features/search/search-results.ts           (v0.2.118 partial)
  modified:   src/newtab/appearance-toggle.ts                 (v0.2.118 partial)
  modified:   src/newtab/topbar.ts                            (v0.2.118 partial)
  modified:   src/newtab/undo-button.ts                       (v0.2.118 partial)
Untracked:
  docs/选项测试记录.md                                        (与本任务无关，不动)
```

`pnpm exec tsc --noEmit` 当前有 **4 个 error 必须先修**：

| 文件 | 行 | 错误 | 原因 |
|------|---|------|------|
| [folder-actions-handler.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder-actions-handler.ts#L74) | 74 | `'打开全部链接'` 不在 `verbKey` 联合里 | 上一轮漏改 — `openAllLinks` 调用 `confirmIfExceedsThreshold(..., '打开全部链接')` 应改为 `... 'folderAction.openAll'`，与 `openAsGroup` 同一行的修法对齐 |
| [folder-actions-handler.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder-actions-handler.ts#L242-L243) | 242, 243 | `t` not found | 上一轮 `t` 改完调用点后**忘了**加 `import { t } from '../../lib/i18n';` |
| [search-results.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/search/search-results.ts#L10) | 10 | `footerEl` declared but never read | 上一轮预声明了 `footerEl` 引用但**没**真的用上（footer 重建逻辑迁了一半就停了） |
| [appearance-toggle.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/appearance-toggle.ts#L30-L32) | 30-32 | `title` does not exist in `Option` | `Option.title` 改成 `titleKey` 后，OPTIONS 数组里 3 项的 `title: '亮'` 字段变成多余的 + TS 报错 |

### 2.2 v0.2.118 已完成（uncommitted）部分

- ✅ [context-menu.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/context-menu.ts) — 9 个 menu item label 全部 `t()`
- ✅ [folder-actions.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder-actions.ts) — 3 个 `ActionButton.titleKey` + `t()` 渲染
- ✅ [topbar.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/topbar.ts) — search placeholder / aria / settings button `updateTopbarStrings()`
- ✅ [undo-button.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/undo-button.ts) — label / title / `updateUndoStrings()`
- ✅ [appearance-toggle.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/appearance-toggle.ts) — 3 个 `Option.titleKey` + `updateAppearanceToggleStrings()`（OPTIONS 数组本身有 TS 报错需修）

### 2.3 v0.2.118 未完成模块

| 文件 | 缺什么 |
|------|--------|
| [search-results.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/search/search-results.ts) | `buildFooter()` 里 4 个 hint label (`'navigate'` / `'open'` / `'close'` / `'no selection → web search'`) 还是英文硬编码；`updateSearchStrings()` 还没 export |
| [split-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/split-picker.ts) | 5 个字符串全硬编码（标题 / counter / 3 按钮），无 `t()` 调用 |
| [popup/app.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/app.ts) | 4 个英文（2 tab + Layout + Open Split） |
| [popup/bookmark-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/bookmark-picker.ts) | `'Failed to load bookmarks'` 错误 + `'Bookmarks'` fallback |
| [popup/open-tabs-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/open-tabs-picker.ts) | `'No open tabs'` 空态 + `'Failed to load tabs'` 错误 |
| [popup/layout-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/layout-picker.ts) | 4 个 layout label 全英文（`'2 Horizontal'` 等） |
| [background.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/background.ts) | `chrome.contextMenus.create({ title: '打开设置' })` 中文硬编码；需要在 `chrome.storage.onChanged` 监听 `language` 变化时 `removeAll` + 重建 |
| [popup/main.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/main.ts) | **不**调 `initSettings()`，所以 popup 里 `t()` 永远返回 en — 需要在 `popup/app.ts` 顶部 `await initSettings()` |
| [newtab/main.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/main.ts) | **缺** `applyLocaleToDom()` + `installLocaleListener()` 入口（已被多个模块注释引用但没实现） |
| [folder.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder.ts#L217) | `'< Empty >'` 占位符硬编码英文 |
| [newtab/app.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/app.ts) | 3 个英文字符串（`'Loading...'` / `'Failed to load bookmarks. Please refresh the page.'` / split invalid URL 错误） |

### 2.4 v0.2.117 已 commit（参考）

- ✅ [src/lib/i18n/types.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/lib/i18n/types.ts) — 全部 ~210 keys 联合定义
- ✅ [src/lib/i18n/index.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/lib/i18n/index.ts) — `t()` / `setLocale()` / `initLocale()` / `getLocale()` / `resolveLocale()` / `subscribe()` / `listLocales()`
- ✅ [src/lib/i18n/catalog/en.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/lib/i18n/catalog/en.ts) — 完整英文（fallback）
- ✅ [src/lib/i18n/catalog/zh.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/lib/i18n/catalog/zh.ts) — 完整中文
- ✅ [Settings.language](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/types.ts) 字段
- ✅ [initSettings()](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/lib/storage/settings.ts#L339) 末尾 `initLocale(resolveLocale(...))`
- ✅ [apply.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/settings/apply.ts#L484-L489) `chrome.storage.onChanged` 监听 → `setLocale()`
- ✅ [settings-panel.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/settings-panel.ts) 完整迁移 + `createLanguageSelect()` 行
- ✅ [special-folders.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/special-folders.ts) 5 个 title 改 `t()`

---

## 3. Proposed Changes

### 3.1 修复 v0.2.118 已 uncommitted 的 4 个 TS 错误

| 文件 | 修改 |
|------|------|
| [folder-actions-handler.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder-actions-handler.ts) | ① L74 `'打开全部链接'` → `'folderAction.openAll'`（与 L106 对齐）；② L1 区域加 `import { t } from '../../lib/i18n';` |
| [search-results.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/search/search-results.ts) | L10 `let footerEl: HTMLElement \| null = null;` — 暂保留，等 footer 迁移完成（见 §3.2）后会真的用上；**当前先**在 `buildFooter()` 末尾 `footerEl = footer;` 占位 |
| [appearance-toggle.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/appearance-toggle.ts) | L30-32 OPTIONS 数组 3 项的 `title: '亮' / '跟随系统' / '暗'` 字段 — **直接删除**（已无用，`t(opt.titleKey)` 在 `createAppearanceToggle` 里现读现译） |

### 3.2 迁移剩余 8 个模块（v0.2.118 收尾）

| 文件 | 修改点 |
|------|--------|
| [search-results.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/search/search-results.ts) | `buildFooter()` 4 个 hint 改 `t('searchResults.footer.navigate' \| 'open' \| 'close' \| 'websearch')`；export `updateSearchStrings()` — 重建 `container` 内 footer（调 `attachResultsContainer(container)` 即可重走 `buildFooter`，因为 footer 内的 text 节点全是 `t()` 现读现译） |
| [split-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/split-picker.ts) | L64 `选择最多 ${SPLIT_MAX} 个链接` → `t('splitPicker.title', { max: SPLIT_MAX })`；L69 `已选 ${selected.size} / ${SPLIT_MAX}` → `t('splitPicker.counter', { count, max })`；L86/L95/L105 3 个 button → `t('splitPicker.cancel' \| 'openFirstN' \| 'openSelected')`；L189 counter 在 `checkbox change` 回调里也用 `t('splitPicker.counter', ...)` 重写 |
| [popup/app.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/app.ts) | 顶部 `await initSettings()`（在 `render(root)` 之前）；L73/L84/L108/L125 4 个 `textContent = '...'` 改 `t('popup.tab.openTabs' \| 'popup.tab.bookmarks' \| 'popup.layout.title' \| 'popup.openSplit')` |
| [popup/bookmark-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/bookmark-picker.ts) | L39 `err.textContent = 'Failed to load bookmarks'` → `t('popup.bookmarkPicker.error')`；L99 `node.title \|\| 'Bookmarks'` → `node.title \|\| t('popup.tab.bookmarks')`（复用已有 key） |
| [popup/open-tabs-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/open-tabs-picker.ts) | L32 `empty.textContent = 'No open tabs'` → `t('popup.openTabsPicker.empty')`；L42 `err.textContent = 'Failed to load tabs'` → `t('popup.openTabsPicker.error')` |
| [popup/layout-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/layout-picker.ts) | LAYOUTS 数组的 4 个 `label: '...'` 改为 `labelKey: 'popup.layout.2h' \| 'popup.layout.2v' \| 'popup.layout.3H' \| 'popup.layout.4grid'`（与 folder-actions / appearance-toggle 同样的 `titleKey` 模式）；`label.textContent = layout.label` → `label.textContent = t(layout.labelKey)` |
| [background.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/background.ts) | ① 在文件顶部加 `SETTINGS_MENU_TITLES: Partial<Record<LocaleCode, string>>` 表 — v0.2.118 只填 `en: 'Open Settings'` + `zh: '打开设置'`，其余 8 个留空（locale 解析命中未填项时 fallback 到 en）；② `registerContextMenu()` 改为 `async`，先 `getSettings()` → `resolveLocale()` → 查表 → `chrome.contextMenus.create({ title })`；③ 新增 `chrome.storage.onChanged.addListener`：当 `settings.language` 变化时调 `void registerContextMenu()`（重建 context menu，title 用新 locale） |
| [folder.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder.ts#L217) | L217 `title: '< Empty >'` → `title: t('folder.empty')`；同步删尖括号（之前 plan 决策 10：v0.2.117 决定改成正常词，附带 i18n 收益） |
| [newtab/app.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/app.ts) | L26 `loading.textContent = 'Loading...'` → `t('newtab.loading')`；L125 split 错误 `error.textContent = '...'` → `t('newtab.split.invalidUrl')`；L169 catch 块 `errorEl.textContent = 'Failed to load bookmarks. Please refresh the page.'` → `t('newtab.error.loadFailed')` |
| [newtab/main.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/main.ts) | 新增 `applyLocaleToDom()`：调 `updateTopbarStrings()` / `updateAppearanceToggleStrings()` / `updateUndoStrings()` + `updateSearchStrings()`（如果 search 已 attach）+ `void renderColumns()` 重建特殊目录 title；如果 settings 面板开着 (`#sp-content` 存在) 调 `renderContent(content)` rerender；新增 `installLocaleListener()`：`subscribe(() => applyLocaleToDom())`；在 `bootstrap()` 末尾调 `installLocaleListener()` 一次 |

### 3.3 新建 8 个 locale 文件（v0.2.119）

```
src/lib/i18n/catalog/
├── es.ts   (Español — 西班牙语)
├── ar.ts   (العربية — 阿拉伯语, RTL)
├── hi.ts   (हिन्दी — 印地语)
├── fr.ts   (Français — 法语)
├── pt.ts   (Português — 葡萄牙语)
├── de.ts   (Deutsch — 德语)
├── ja.ts   (日本語 — 日语)
└── ru.ts   (Русский — 俄语)
```

每个文件结构完全对齐 `en.ts`：

```ts
import type { LocaleBundle, LocaleMessages } from '../types';

const messages = {
  'settings.title': '...',
  // ~210 keys（与 en.ts 一一对应）
} as const satisfies LocaleMessages;

export const es: LocaleBundle = {
  code: 'es',
  selfName: 'Español',
  englishName: 'Spanish',
  messages,
};
```

[src/lib/i18n/index.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/lib/i18n/index.ts) 改动：
- 顶部 import 8 个新 bundle
- `CATALOG` 从 `{ en, zh }` → `{ en, zh, es, ar, hi, fr, pt, de, ja, ru }`
- 删 `Partial<>` 包装（10 个全到位，类型可以收紧到 `Record<LocaleCode, LocaleBundle>`）

### 3.4 RTL 排版适配（v0.2.119）

[styles/globals.css](file:///Users/lingsmbp/Documents/aiwork/newtab01/styles/globals.css) 末尾追加：

```css
/* v0.2.119: RTL support for Arabic (ar) and any future RTL locale. */
[dir="rtl"] .search-result-url {
  direction: ltr;
  unicode-bidi: embed;
}
[dir="rtl"] .split-picker-url {
  direction: ltr;
  unicode-bidi: embed;
}
[dir="rtl"] .picker-url {
  direction: ltr;
  unicode-bidi: embed;
}
[dir="rtl"] .search-input {
  direction: rtl; /* typing direction in search box */
  text-align: right;
}
```

注：column 排布、topbar 居中、folder ellipsis 等不需显式镜像（CLAUDE.md §2.2 已审计项目 CSS 不使用 `margin-left/right`，现有 `flex` + `gap` 在 RTL 下自动镜像）。

### 3.5 background SW 8 种语言补齐（v0.2.120）

[background.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/background.ts) `SETTINGS_MENU_TITLES` 表从 `{ en, zh }` 扩到 10 项，每项 1 行翻译。

### 3.6 文档与版本（v0.2.120）

- [package.json](file:///Users/lingsmbp/Documents/aiwork/newtab01/package.json) `version: 0.2.117` → `0.2.120`
- [CHANGELOG.md](file:///Users/lingsmbp/Documents/aiwork/newtab01/CHANGELOG.md) 新增 `## [0.2.118]` / `## [0.2.119]` / `## [0.2.120]` 三段，按 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) 格式（Added / Changed / Implementation Notes）

### 3.7 合并到 main（v0.2.120 收尾）

按 CLAUDE.md §0.1 策略：
1. `git add -A && git commit` v0.2.118 / v0.2.119 / v0.2.120 三个 commit
2. `git checkout main && git merge --no-ff feat/i18n -m 'merge feat/i18n into main (v0.2.118 → v0.2.120)'`
3. `git push origin main`
4. `git push -u origin feat/i18n` — 分支冻结到 origin 作历史索引
5. （如果用户要求）`git branch -d feat/i18n` 删除本地分支

---

## 4. Implementation Phases

### Phase B (continued): v0.2.118 — 修复 + 收尾

**前置**：先修 4 个 TS 错误（§3.1）。

**修改文件**（清单见 §3.2）：
- search-results.ts（footer + updateSearchStrings export）
- split-picker.ts
- popup/app.ts（含 initSettings）
- popup/bookmark-picker.ts / open-tabs-picker.ts / layout-picker.ts
- background.ts（SETTINGS_MENU_TITLES en+zh + onChanged listener）
- folder.ts（empty 占位）
- newtab/app.ts（Loading / error / split error）
- newtab/main.ts（applyLocaleToDom + installLocaleListener）

**commit**：单独一个 commit，`feat(i18n): translate remaining modules + locale refresh (v0.2.118)`。bump package.json 到 `0.2.118` + CHANGELOG 加 `## [0.2.118]`。

**验证**（pnpm build → 手动 reload dist/）：
1. tsc 0 error
2. 切到 English → 所有 tooltip / 右键菜单 / popup 全部英文（每个模块 1 个 checkbox check）
3. 切到中文 → 全部回中文
4. 浏览器 action 右键菜单 → "Open Settings" / "打开设置" 跟随语言
5. popup 打开 → 2 个 tab + Layout + Open Split 跟随语言

### Phase C: v0.2.119 — 8 种新语言 + RTL

**新文件**：8 个 catalog 文件（§3.3）

**修改**：
- src/lib/i18n/index.ts — 8 个 import + CATALOG 完整 + 删 `Partial<>`
- styles/globals.css — RTL 适配（§3.4）

**commit**：`feat(i18n): ship 8 more locales (es/ar/hi/fr/pt/de/ja/ru) + RTL support (v0.2.119)`。bump 到 0.2.119 + CHANGELOG。

**验证**：
- chrome://settings/languages → 首选语言切到 Deutsch → 重启浏览器 → newtab 变德文
- 切到 العربية → `<html dir="rtl">` → 验证 search 结果里 URL 排版正常（hostname 仍 LTR，不跳行）
- column 水平排布在 RTL 下镜像（每列宽度 1/N，顺序反转 — 期望行为）
- en + zh 在新语言加入后**未受影响**（回归）

### Phase D: v0.2.120 — 收尾 + 合并

**修改**：
- background.ts — SETTINGS_MENU_TITLES 8 项补齐
- package.json → `0.2.120`
- CHANGELOG.md → `## [0.2.120]` 段

**build 验证**：
```bash
pnpm build
# 预期：tsc 0 error，vite build 成功
# 预期：newtab bundle 增量 < 50KB gzipped（v0.2.116 基线 ~35KB + 8 个 catalog × 5KB ≈ 75KB → 未越 80KB 预算）
pnpm exec tsc --noEmit
# 预期：0 error
```

**合并**（按 §3.7）：
1. `git checkout main && git merge --no-ff feat/i18n -m 'merge feat/i18n into main (v0.2.118 → v0.2.120)'`
2. `git push origin main`
3. `git push -u origin feat/i18n` — 冻结分支到 origin

---

## 5. Assumptions & Decisions

1. **不引入 i18n 库**——与项目 vanilla JS 风格一致，bundle 体积受控
2. **`chrome.storage.sync.settings.language`** 跨设备同步（与项目「Settings 跨设备同步」设计哲学一致）
3. **不强制刷新页面**——locale 切换走 `subscribe` + `applyLocaleToDom` 实时刷新所有可见 UI
4. **fallback 链 `当前选 → browser → en`**：用户选 `'auto'` 且浏览器语言不是 10 种之一 → fallback `'en'`
5. **类型安全 MessageKey 联合**——任何 catalog 少翻译一个 key，TS 编译失败
6. **阿拉伯语 RTL 处理最小化**——只设 `<html dir>` + search / picker / split URL hostname 强制 LTR；不复刻完整 RTL layout（项目 CSS 没用 `margin-left/right`，现有 flex/gap 自动镜像）
7. **10 个 locale 全部由 AI 生成**——以 `en.ts` 为唯一信源。AI 翻译可能不完美（特别是 hi / ar / ru），用户后续可手动校对
8. **background SW 维护独立 `SETTINGS_MENU_TITLES` 表**（不与 newtab 的 i18n 模块共享，因为 SW 不能 import newtab 的模块）
9. **不在 popup 选项页加「语言」入口**——popup 的 settings 入口链到 newtab 的设置面板（已有的 `?options` 路由），用户在 newtab 里改
10. **空文件夹占位 `< Empty >` 改成正常词**（不再带尖括号）——视觉上更友好，附带 i18n 收益
11. **v0.2.118 popup 加 `await initSettings()`** — popup 之前不调 `initSettings` 是因为它不需要 settings 字段；现在 i18n 需要 settings.language 所以必须调。这是 v0.2.118 的最小必要修改
12. **`Option.title` → `titleKey` 改名模式**（folder-actions / appearance-toggle / layout-picker 一致）— 在静态配置里只存 key，渲染时 `t(key)`，避免硬编码字符串散落各处

---

## 6. Verification Steps

### 6.1 功能验证（每个 phase 完成后跑）

| 场景 | 步骤 | 预期 |
|------|------|------|
| 默认行为（中文浏览器） | 新装扩展 | newtab / popup / 设置面板全显示中文 |
| 默认行为（英文浏览器） | 新装扩展 | 全显示英文 |
| 默认行为（其他语言） | 浏览器首选语言为 de-DE | 显示德文（fallback 命中 de） |
| 默认行为（不支持的语言） | 浏览器首选语言为 sv-SE | 显示英文（fallback 命中 en） |
| 手动切语言 | 设置 → 布局 → 语言 → Deutsch | newtab 立即刷新为德文，popup 打开也是德文 |
| 持久化 | 切到日文 → 关闭 newtab → 重新打开 | 仍是日文 |
| 跨设备同步 | 切到俄文 → 等 sync → 在另一台设备打开 | 另一台也是俄文 |
| 切到 auto | 切到 auto → 浏览器语言是 zh | 回到中文 |
| RTL 切换（v0.2.119 后） | 切到阿拉伯语 | `<html dir="rtl">`、search URL 排版正常、column 镜像排列 |
| 特殊目录 title | 切语言 | 5 个特殊目录的 title 实时刷新 |
| tooltip 实时刷新 | 切语言 | 设置按钮 / 外观 toggle / undo 按钮 / folder actions 的 tooltip 立即变 |
| settings 面板 | 切语言 | 打开中的面板（如果开着）立即刷新所有字符串 |
| 搜索 footer | 切语言 | 搜索框聚焦时 footer hints 文字变 |
| 浏览器 action 右键 | 切语言 | 「打开设置 / Open Settings / ...」跟随语言 |
| popup 切语言 | 设置里改语言 → 重新打开 popup | popup 内所有文字跟随 |

### 6.2 回归验证（v0.2.116 行为不破坏）

| 项 | 检查 |
|----|------|
| 拖拽排序 | 跨列拖一个文件夹 → 切语言 → 拖一个文件夹仍能正常 |
| 主题切换 | 切到英文界面 → 切到 Default Dark 主题 → 主题正确应用 |
| 自定义主题 | 切到德文 → 导入一个 tweakcn 主题 → UI 状态正常、面板变回德文 |
| 导入/导出设置 | 切到日文 → 导出 settings.json → 文件里 `language: "ja"`；导入到另一台 → 另一台变日文 |
| 标签组打开 | 在德文界面下 → 文件夹右键 → 以分组方式打开 → 标签组标题用文件夹名（不参与翻译） |
| 搜索 Cmd+K | 切语言后按 Cmd+K → 搜索框聚焦 + overlay 出现（与 v0.2.116 一致） |
| Apps 链接 | RTL 模式下 chrome://apps / edge://apps 链接可点击、URL 排版正常 |

### 6.3 类型 / 构建验证

```bash
pnpm exec tsc --noEmit
# 预期：0 error（MessageKey 联合强制每个 catalog 文件 keys 齐全）

pnpm build
# 预期：vite build 成功，新增 bundle 增量 < 50KB gzipped
# 预期：dist/manifest.json name/description 仍是 newtab01 英文（fixupDistManifest 正常）
```

### 6.4 关键文件检查清单

- [ ] `src/lib/i18n/types.ts` — `MessageKey` 联合覆盖所有翻译（无需改）
- [ ] `src/lib/i18n/index.ts` — `t()` / `setLocale()` / `resolveLocale()` / `subscribe()` 都有（无需改）
- [ ] 10 个 `catalog/*.ts` 文件 keys 数量完全一致（en/zh 是「真源」，8 个新增是翻译）
- [ ] `Settings` 类型 + storage defaults + `initSettings` 全部包含 `language`（无需改）
- [ ] 设置面板「语言」行能 round-trip（auto ↔ 具体 locale）
- [ ] `chrome.storage.onChanged` 监听里 `language` 变化时 background 重注册 context menu
- [ ] 所有 hardcoded 中文 / 英文字符串都被 `t()` 替换（grep `textContent = '\|placeholder = '` 应只在 v0.2.118 + 后续 commit 留下的地方出现，**不**是英文 / 中文常数字符串）

---

## 7. Risk & Open Questions

| 风险 | 缓解 |
|------|------|
| 翻译质量（特别是 hi / ar / ru）由 AI 生成可能不自然 | 在 `docs/superpowers/specs/` 留 `i18n-translation-review.md` 说明校对入口（v0.2.120 之后追加，不在本次 scope）；用户后续手动调单个 key |
| popup 加 `await initSettings()` 引入 ~10ms 启动延迟 | 可接受 — popup 已是 400x500 dialog，初始化本来就在 onload 后跑 |
| background SW 重新注册 context menu 时机 | 用 `chrome.storage.onChanged` 而非 postMessage；SW 进程可能被休眠，所以 onChanged 是唯一可靠路径 |
| RTL 下 column 镜像后第一列变成最右 | 符合 RTL 用户预期，无需干预 |
| 印地语 / 阿拉伯语 / 俄语 / 阿拉伯文 / Devanagari 字体渲染 | tweakcn 4 套主题都用 `Inter` / `system-ui` 系列字体栈，自动 fallback 到系统字体；不嵌入字体 |
| bundle 体积 8 个新增 locale 约 5KB × 8 = 40KB | 未越 80KB 预算（v0.2.116 现状 ~35KB gzipped，加 8 个 catalog + 现有 v0.2.117 的 en/zh + 编译上下文 ≈ 70KB） |
| v0.2.118 `pnpm build` 在中间态编译失败 | Phase B 入口先 `tsc --noEmit` 跑一遍确认 0 error，再 `git commit` |

---

## 8. Out of Scope

以下**不**在本次实现范围内：

- 翻译 bookmarks 内部内容（用户自己的书签名称）—— 那是用户数据
- 翻译 settings panel 的 import/export 错误信息里的 stack trace（仍是英文）
- 翻译 debug mode 控制台日志
- 翻译 manifest.json 的 `description`
- 添加更多 locale（如韩语、意大利语、繁体中文）—— 用户后续按需追加
- 把 `t()` 调用改为 t-function 风格（`\{name\}` 占位符已覆盖 90% 用例）
- 文档 `docs/选项测试记录.md`（与本任务无关的 user note，留作 untracked）

---

## 9. Open Decisions for User Review (if any)

无新增开放决策。所有项已在 v0.2.117 plan 阶段确认：
- 自建轻量 i18n（无库）
- AI 生成全部 10 种翻译
- 完整 dir 切换 + 布局验证
- 用户切换语言走 settings 行 + auto fallback
