# i18n 多语言支持

> 状态：Plan Mode 草稿
> 目标分支：`feat/i18n`（从 `main` 切出，约定同 CLAUDE.md §0.1 的"feat 分支冻结"策略）
> 起始 commit：`main` 头（v0.2.116）
> 计划版本：v0.2.117 → v0.2.120（每次 commit bump patch）

---

## 1. Summary

将 newtab01 扩展的所有用户可见字符串（设置面板、tooltip、右键菜单、特殊目录标题、popup 文本、分屏选择器、search 提示、background 右键菜单）抽离为按 locale 索引的翻译资源。新增 `src/lib/i18n/` 模块、`chrome.storage.sync.settings.language` 字段（默认 `'auto'` 跟随浏览器）、10 种初始 locale（en / zh / es / ar / hi / fr / pt / de / ja / ru），并为阿拉伯语加 RTL（`dir="rtl"`）支持。

设计原则：
- **零额外依赖**：i18n 模块完全用 TS + 静态 JSON 写，bundle 增量 < 10KB
- **类型安全**：`MessageKey` 是 `as const` 联合，写错 key TS 编译失败
- **运行时检测**：`language: 'auto'` 时按 `navigator.language` 匹配（`zh-CN` → `zh`、`es-MX` → `es` 等），fallback `'en'`
- **跨上下文同步**：newtab、popup、options（如果未来有）、background 共享同一份 catalog + storage key，切换语言后所有上下文自动跟随（background 通过 `chrome.storage.onChanged` 重新注册 context menu 标题）
- **渐进迁移**：保留 v0.2.116 行为（默认仍是中文界面），用户在设置里改语言才生效

---

## 2. Current State Analysis

### 2.1 现有用户可见字符串分布

| 文件 | 主要内容 | 估算条数 |
|------|---------|---------|
| [src/newtab/settings-panel.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/settings-panel.ts) | 5 个 tab 标签、所有 50+ 表单 label、60+ 描述文字、theme 标签 map、错误信息、按钮文字 | ~150 |
| [src/features/bookmarks/special-folders.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/special-folders.ts#L58-L95) | 5 个特殊目录 title：`Most visited` / `Apps` / `Recent bookmarks` / `Recently closed` / `Other devices` | 5 |
| [src/newtab/topbar.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/topbar.ts#L24) | 搜索框 placeholder + `aria-label`、设置按钮 `title` + `aria-label` | 4 |
| [src/newtab/appearance-toggle.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/appearance-toggle.ts) | 3 个 tooltip（亮 / 跟随系统 / 暗）、radiogroup `aria-label` | 4 |
| [src/newtab/undo-button.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/undo-button.ts) | "回退操作" label + "回退操作（N 步）" 动态 tooltip | 2 |
| [src/features/search/search-results.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/search/search-results.ts#L48-L80) | 键盘提示（navigate / open / close / "no selection → web search"）、空态 "Type to search…" | 5 |
| [src/features/search/search-overlay.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/search/search-overlay.ts) | 注释内出现的 overlay 行为说明（无需翻译） | 0 |
| [src/features/bookmarks/folder-actions.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder-actions.ts) | 3 个 folder action 按钮 tooltip（Open all in tabs / Open as tab group / Open in split view） | 3 |
| [src/features/bookmarks/folder-actions-handler.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder-actions-handler.ts#L74-L106) | 阈值确认动词 "打开全部链接" / "以分组方式打开链接"、默认目录名 "当前目录" | 3 |
| [src/features/bookmarks/context-menu.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/context-menu.ts) | 9 个右键菜单项（Open all links in folder / Clear browsing data / History / Edit bookmarks / Create new column / Remove folder / Move column left / Move column right / Remove column） | 9 |
| [src/features/bookmarks/split-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/split-picker.ts) | 标题 "选择最多 N 个链接"、counter "已选 N / M"、3 个按钮（取消 / 打开前 4 个 / 打开选中） | 5 |
| [src/features/bookmarks/folder.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder.ts#L217) | 空文件夹占位 `< Empty >` | 1 |
| [src/newtab/app.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/app.ts) | `Loading...`、错误 `Failed to load bookmarks. Please refresh the page.`、分屏错误 `Invalid split view URL...` | 3 |
| [src/popup/app.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/app.ts) | 2 个 tab 名（Open Tabs / Bookmarks）、Layout section title、Open Split 按钮 | 4 |
| [src/popup/bookmark-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/bookmark-picker.ts) | 空目录 fallback "Bookmarks"、错误 "Failed to load bookmarks" | 2 |
| [src/popup/open-tabs-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/open-tabs-picker.ts) | 空态 "No open tabs"、错误 "Failed to load tabs" | 2 |
| [src/popup/layout-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/layout-picker.ts) | 4 个布局名（2 Horizontal / 2 Vertical / 3 Horizontal / 4 Grid） | 4 |
| [src/background.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/background.ts) | 右键菜单 "打开设置"、标签组 fallback "New Group" | 2 |
| **总计** | | **~210** |

### 2.2 现有架构特点（决定 i18n 方案）

- **无前端框架**：不能借 react-i18next / vue-i18n / svelte-i18n
- **无状态管理库**：状态在 `chrome.storage` + 模块级变量，i18n 模块也应这样
- **`chrome.storage.sync` 已存在 settings**：language 字段直接并入 `Settings`
- **DOM 在多个入口动态构建**：newtab 由 [newtab/app.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/app.ts) 驱动，settings panel 由 [settings-panel.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/settings-panel.ts) 在用户点击齿轮时新建 DOM，popup 是独立 HTML —— 三者独立渲染，但共享 `Settings` → 必须能在运行时切换语言而不需要刷新整页
- **特殊目录 title 当前是英文硬编码**（`special-folders.ts`），且 `board.ts` 在 `getSubTreeStub` 时一次性塞进 columns layout（`{ id: 'top', title: 'Most visited', type: 'top', children: [] }`）—— 需要在 render 时再读取最新 locale
- **background context menu title** 在 `chrome.runtime.onInstalled` 时写入 chrome.contextMenus 一次 —— 必须在 `chrome.storage.onChanged` 监听 `language` 变化时 `removeAll` + `create` 重建

### 2.3 现有 chrome.storage 字段

- `Settings.language` 字段**当前不存在**（[features/bookmarks/types.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/types.ts) 的 `Settings` interface 不含）—— v0.2.117 需要新增
- `chrome.i18n` API **未被使用**（项目 grep `i18n` 无结果）—— 我们不使用 Chrome 标准的 `_locales/<lang>/messages.json` 机制，因为：
  1. 那样会让 `chrome.i18n.getMessage()` 走 MV3 service worker，popup 拿不到
  2. 与现有 `Settings` 跨设备同步的设计哲学冲突
  3. 用户在设置里切换语言的诉求需要可写存储，而 `chrome.i18n` 是只读 OS 级的

### 2.4 RTL 现状

- 项目 CSS 主要用 `flex` + `gap` + `padding`，**没有 hardcoded `margin-left/right`**（已 grep 验证 `newtab.css` / `options.css` / `popup.css`）
- column 布局是水平多列（`#main` 横向 flex），RTL 不需要镜像方向
- topbar search 是居中的（`align-self: center`），不受 RTL 影响
- ⚠️ 风险点：search-results 的 URL hostname 显示，需要 `direction: ltr` 强制 LTR 排版避免阿拉伯语里夹英语 URL 跳行
- ⚠️ 风险点：folder / link 的 ellipsis 截断方向（`text-overflow: ellipsis` 在 RTL 下默认从左边截断，需要 `direction: rtl` 时显式处理）

---

## 3. Proposed Changes

### 3.1 新建 `src/lib/i18n/` 模块

**目录结构**：
```
src/lib/i18n/
├── index.ts            # t() / setLocale() / getLocale() / resolveLocale() / subscribe()
├── types.ts            # LocaleCode 联合 + MessageKey 联合 + LocaleMessages map 类型
├── catalog/
│   ├── en.ts           # 英文（fallback）
│   ├── zh.ts           # 中文（简体，匹配用户当前 UI）
│   ├── es.ts           # 西班牙语
│   ├── ar.ts           # 阿拉伯语
│   ├── hi.ts           # 印地语
│   ├── fr.ts           # 法语
│   ├── pt.ts           # 葡萄牙语
│   ├── de.ts           # 德语
│   ├── ja.ts           # 日语
│   └── ru.ts           # 俄语
```

**`types.ts` 设计**：
```ts
export const SUPPORTED_LOCALES = ['en', 'zh', 'es', 'ar', 'hi', 'fr', 'pt', 'de', 'ja', 'ru'] as const;
export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES = new Set<LocaleCode>(['ar']);

/** 所有翻译 key 的联合类型。任何 locale 文件 export 的 map 必须
 *  满足 Record<MessageKey, string>，少一个 key TS 立刻报错。 */
export type MessageKey =
  | 'settings.title'
  | 'settings.close'
  | 'settings.tab.layout'
  // ... ~210 个 key
  ;

export type LocaleMessages = Record<MessageKey, string>;

/** 一个 locale 的完整 bundle。 */
export interface LocaleBundle {
  code: LocaleCode;
  /** 自身显示名（用 locale 自己的语言写自己），用于设置面板的下拉标签 */
  selfName: string;
  /** 英文显示名，用于「语言」下拉的「English name」副标签（便于跨语言用户识别） */
  englishName: string;
  messages: LocaleMessages;
}
```

**`catalog/en.ts` 设计**（其他 9 个文件结构相同）：
```ts
import type { LocaleBundle } from '../types';

const messages: Record<MessageKey, string> = {
  'settings.title': 'Settings',
  'settings.close': 'Close settings',
  'settings.tab.layout': 'Layout',
  // ...
};

export const en: LocaleBundle = {
  code: 'en',
  selfName: 'English',
  englishName: 'English',
  messages,
};
```

**`index.ts` 设计**：
```ts
import { SUPPORTED_LOCALES, RTL_LOCALES, type LocaleCode, type MessageKey } from './types';
import { en } from './catalog/en';
import { zh } from './catalog/zh';
// ... 其他 8 个 import

const CATALOG: Record<LocaleCode, LocaleBundle> = { en, zh, es, ar, hi, fr, pt, de, ja, ru };

let currentLocale: LocaleCode = 'en';
const listeners = new Set<(locale: LocaleCode) => void>();

/** 解析 `'auto'` 或裸 locale code 到具体 locale code。
 *  `zh-CN` → `zh`，`es-MX` → `es`，未知 → `'en'`。 */
export function resolveLocale(pref: string | undefined | null): LocaleCode {
  if (!pref || pref === 'auto') pref = navigator.language;
  const tag = pref.toLowerCase().replace('_', '-');
  // 1. 精确匹配
  if ((SUPPORTED_LOCALES as readonly string[]).includes(tag)) return tag as LocaleCode;
  // 2. 匹配主语言（`zh-CN` → `zh`、`pt-BR` → `pt`）
  const primary = tag.split('-')[0]!;
  if ((SUPPORTED_LOCALES as readonly string[]).includes(primary)) return primary as LocaleCode;
  return 'en';
}

export function setLocale(locale: LocaleCode): void {
  if (currentLocale === locale) return;
  currentLocale = locale;
  applyDocumentAttributes();
  for (const cb of listeners) cb(locale);
}

export function getLocale(): LocaleCode { return currentLocale; }

export function subscribe(cb: (locale: LocaleCode) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function applyDocumentAttributes(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = currentLocale;
  document.documentElement.dir = RTL_LOCALES.has(currentLocale) ? 'rtl' : 'ltr';
}

/** 翻译函数。`params` 用于简单插值：`t('undo.title', { count: 5 })` →
 *  `Undo (5 steps)`。key 必须是 MessageKey 联合里的一个。 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const bundle = CATALOG[currentLocale];
  let s = bundle.messages[key] ?? CATALOG.en.messages[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}

/** 获取 locale bundle 列表（用于设置面板的「语言」下拉）。 */
export function listLocales(): readonly LocaleBundle[] {
  return SUPPORTED_LOCALES.map((code) => CATALOG[code]);
}
```

### 3.2 `Settings` 加 `language` 字段

修改 [src/features/bookmarks/types.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/types.ts)：
- `Settings` 加 `language: 'auto' | LocaleCode` 字段，默认 `'auto'`
- 由于该文件目前**不** import i18n（避免循环依赖），`LocaleCode` 通过 i18n 模块的独立 type 路径导入

修改 [src/lib/storage/settings.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/lib/storage/settings.ts)：
- `defaults` map 加 `language: 'auto'`
- `initSettings` 在 storage 加载完成后，**调用 `setLocale(resolveLocale(stored.language ?? 'auto'))`** 来初始化 i18n 模块

### 3.3 各模块迁移到 `t()`

按以下顺序修改（每个文件保持最小改动）：

| 文件 | 修改点 |
|------|--------|
| [src/newtab/settings-panel.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/settings-panel.ts) | `THEME_LABELS` map 从静态对象改为函数 `themeLabel(id)` 调 `t(\`theme.\${id}\`)`；所有 `textContent = 'xxx'` / `createRow('xxx', ...)` / `placeholder` / `alert(...)` 字符串替换为 `t('xxx')` |
| [src/features/bookmarks/special-folders.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/special-folders.ts#L58-L95) | `getSubTreeStub` 里 5 个 hardcoded `title: 'Most visited'` 改为 `title: t('specialFolder.top')` 等；`getSubTreeStub` 改为 read locale **at render time**（不变 signature，依赖 i18n 模块的运行时状态） |
| [src/newtab/topbar.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/topbar.ts) | search `placeholder` / `aria-label`、settings 按钮 `title` / `aria-label` 改 `t()`；新增 `updateTopbarStrings()` 函数供 locale 切换时调用 |
| [src/newtab/appearance-toggle.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/appearance-toggle.ts) | 3 个 `title` 字段改为调 `t()`；`aria-label` 同步；新增 `updateAppearanceToggleStrings()` |
| [src/newtab/undo-button.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/undo-button.ts) | `undoBtn.title` / `label.textContent` 改 `t()`；新增 `updateUndoStrings()` |
| [src/features/search/search-results.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/search/search-results.ts) | `buildFooter` 3 个 `appendHint` 的 label + fallback text "no selection → web search"；空态 "Type to search…"；新增 `updateSearchStrings()` 在 `attachResultsContainer` 被重复调用时重建 footer |
| [src/features/bookmarks/folder-actions.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder-actions.ts#L22-L24) | `ACTIONS` 数组 3 个 `title` 改 `t()`；`createFolderActions` 接收 locale 变化时的 refresh hook（不必要，只要 toggle 时再 attach 即可） |
| [src/features/bookmarks/folder-actions-handler.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder-actions-handler.ts#L74-L106) | `confirmIfExceedsThreshold` 的 `verb` 字符串改为 `t('folderAction.openAll')` / `t('folderAction.openAsGroup')`；`'当前目录'` 改 `t('folderAction.currentFolder')` |
| [src/features/bookmarks/context-menu.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/context-menu.ts) | 9 个 `label: 'xxx'` 改 `t()` |
| [src/features/bookmarks/split-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/split-picker.ts) | 标题 / counter / 3 按钮 / `已选 N / M` 模板全改 `t()` |
| [src/features/bookmarks/folder.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder.ts#L217) | `< Empty >` 改 `t('folder.empty')` |
| [src/newtab/app.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/app.ts) | `Loading...` / 错误 / 分屏错误全改 `t()` |
| [src/popup/app.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/app.ts) | tab 名 / Layout / Open Split 全改 `t()` |
| [src/popup/bookmark-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/bookmark-picker.ts) | fallback / 错误改 `t()` |
| [src/popup/open-tabs-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/open-tabs-picker.ts) | 空态 / 错误改 `t()` |
| [src/popup/layout-picker.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/popup/layout-picker.ts) | 4 个 `label` 改 `t()` |
| [src/background.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/background.ts) | context menu `title: '打开设置'` 改 `t('actionMenu.openSettings')`（注意 SW 不会自动跟随 locale 变化，见 §3.5） |

### 3.4 locale 切换时刷新 UI

在 [src/newtab/main.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/main.ts) 或一个新的 `src/lib/i18n/refresh.ts` 里暴露 `applyLocaleToDom()`：

```ts
import { subscribe, getLocale } from '../i18n';
import { updateTopbarStrings } from '../../newtab/topbar';
import { updateAppearanceToggleStrings } from '../../newtab/appearance-toggle';
import { updateUndoStrings } from '../../newtab/undo-button';
import { renderColumns } from '../bookmarks/board';
import { updateSearchStrings } from '../search/search-results';

export function applyLocaleToDom(): void {
  updateTopbarStrings();
  updateAppearanceToggleStrings();
  updateUndoStrings();
  updateSearchStrings();
  void renderColumns();  // 重新读特殊目录 title
  // settings 面板如果开着，重渲染
  const content = document.getElementById('sp-content');
  if (content) renderContent(content);
}

// 在 initApp() 末尾 subscribe
export function installLocaleListener(): void {
  subscribe(() => applyLocaleToDom());
}
```

settings 面板的 `language` 字段 change handler：
```ts
function onLanguageChange(newPref: 'auto' | LocaleCode): void {
  void updateSetting('language', newPref);
  // chrome.storage.onChanged listener in apply.ts 会触发 setLocale()
  // setLocale() 触发 listeners → applyLocaleToDom()
  // setLocale() 内部 applyDocumentAttributes() 改 <html lang/dir>
}
```

### 3.5 background SW 跟随 locale

[src/background.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/background.ts) 新增 `chrome.storage.onChanged` 监听：

```ts
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  const settings = changes['newtab01.settings'];
  if (!settings) return;
  const oldLang = settings.oldValue?.language;
  const newLang = settings.newValue?.language;
  if (oldLang !== newLang) {
    // 重新注册 context menu，新 title 用对应 locale
    void registerContextMenu();
  }
});
```

由于 SW 没有 import chrome.i18n（项目不用 `_locales`），context menu 标题要么 hardcode 全部 10 种语言做切换表（**推荐**），要么 SW 接受一个新消息 `getLocaleString` 从 newtab 推。**采用前者**：

```ts
// background.ts
const SETTINGS_MENU_TITLES: Record<LocaleCode, string> = {
  en: 'Open Settings', zh: '打开设置', es: 'Abrir ajustes', /* ... 8 more */
};

async function registerContextMenu(): Promise<void> {
  const settings = await chrome.storage.sync.get('newtab01.settings');
  const lang = settings['newtab01.settings']?.language ?? 'auto';
  const resolved = lang === 'auto' ? (chrome.i18n.getUILanguage?.() || 'en').slice(0, 2) : lang;
  const title = SETTINGS_MENU_TITLES[resolved as LocaleCode] ?? SETTINGS_MENU_TITLES.en;
  // removeAll + create
}
```

注意：SW 是独立进程，与 newtab 的 i18n 模块**不共享内存**。它必须自己查 storage 决定 title。

### 3.6 RTL 适配

**`src/styles/globals.css` 末尾新增**：
```css
[dir="rtl"] {
  /* search 结果里的 URL hostname 强制 LTR 排版，避免阿拉伯语行内嵌入 URL 跳行 */
  & .search-result-url { direction: ltr; unicode-bidi: embed; }
  /* 链接 ellipsis 保持从右边截断（CSS LTR 行为在 RTL 下会反过来） */
  & .link-text { direction: rtl; unicode-bidi: plaintext; }
}
```

由于项目 CSS 已审计不使用 `margin-left/right`（只 `gap` + `flex`），RTL 下 column 顺序自动镜像。**不**需要为 RTL 单独写 layout 修复。

### 3.7 设置面板加「语言」行

在 `settings-panel.ts` 的「布局」tab **末尾**新增一行（与现有 `createRow` 模式一致）：

```ts
container.appendChild(createRow(
  t('settings.field.language'),
  createLanguageSelect(),
  'language',  // 注意：language 不在 PER_THEME_KEYS，因为是全局
  t('settings.field.languageDesc'),
));

function createLanguageSelect(): HTMLSelectElement {
  const select = document.createElement('select');
  select.id = 'sp-language';
  // 'auto' 是第一项
  const autoOpt = document.createElement('option');
  autoOpt.value = 'auto';
  autoOpt.textContent = t('settings.language.auto');
  select.appendChild(autoOpt);
  for (const bundle of listLocales()) {
    const opt = document.createElement('option');
    opt.value = bundle.code;
    opt.textContent = `${bundle.selfName} (${bundle.englishName})`;
    select.appendChild(opt);
  }
  const current = String(getSetting('language') ?? 'auto');
  select.value = current;
  select.addEventListener('change', () => {
    const newPref = select.value as 'auto' | LocaleCode;
    void updateSetting('language', newPref);
    // chrome.storage.onChanged 触发 setLocale → applyLocaleToDom
  });
  return select;
}
```

`RERENDER_KEYS` Set **不需要**加 `'language'`（不触发重渲染列，但 chrome.storage.onChanged 会触发 setLocale → applyLocaleToDom 全套刷新）。

---

## 4. Implementation Phases

> 单分支 `feat/i18n`，多个 commit。每个 commit bump patch 并写 CHANGELOG。

### Phase A: v0.2.117 — i18n 脚手架 + 接入设置面板

**新文件**：
- `src/lib/i18n/types.ts`
- `src/lib/i18n/index.ts`
- `src/lib/i18n/catalog/en.ts`（完整 ~210 keys）
- `src/lib/i18n/catalog/zh.ts`（完整 ~210 keys）

**修改**：
- `src/features/bookmarks/types.ts` — `Settings.language` 字段
- `src/lib/storage/settings.ts` — defaults + `initSettings` 末尾调 `setLocale(resolveLocale(...))`
- `src/newtab/settings-panel.ts` — 接入 `t()` + 新增「语言」行
- `src/newtab/app.ts` — `initApp` 末尾 `installLocaleListener()` + `applyLocaleToDom()`

**验证**（pnpm build）：
1. 装到 chrome://extensions 加载 dist/
2. 默认（auto）应当检测浏览器语言 → 中文浏览器显示中文、英文浏览器显示英文
3. 设置面板 → 布局 tab 末尾 → 「语言」下拉包含 2 个选项（auto + English + 中文）
4. 切到 English → 设置面板所有 label/description/按钮/placeholder/error 立即变英文
5. 切回 auto → 中文浏览器回到中文
6. 在 console 跑 `chrome.storage.sync.get('newtab01.settings', s => console.log(s.language))` 验证 storage 写入

### Phase B: v0.2.118 — 翻译剩余模块（newtab / popup / search / context menu / folder actions / split picker / background）

**修改**（清单见 §3.3）：
- topbar / appearance-toggle / undo-button：每个 export 一个 `update*Strings()` 函数
- search-results.ts：footer 重建逻辑（locale 变 → 调 `attachResultsContainer` 重新挂）
- special-folders.ts：5 个 title 改 `t()`
- folder-actions.ts / folder-actions-handler.ts / context-menu.ts / split-picker.ts / folder.ts
- popup/app.ts / popup/bookmark-picker.ts / popup/open-tabs-picker.ts / popup/layout-picker.ts
- background.ts — `SETTINGS_MENU_TITLES` 表（仅 en + zh）+ onChanged 监听重注册

**验证**：
- 所有 tooltip / 右键菜单 / popup tab / 错误提示 立即随语言切换
- 切到英文浏览器 → 5 个特殊目录 title 变 `Most visited / Apps / Recent bookmarks / Recently closed / Other devices`
- 切回中文 → 变 `常用网站 / 应用 / 最近访问 / 最近关闭 / 其他设备`
- popup 打开 → 标签 / 布局 / 按钮 跟随语言
- 浏览器 action 右键 → 「打开设置 / Open Settings」跟随语言

### Phase C: v0.2.119 — 8 种新语言 + RTL 适配

**新文件**：
- `src/lib/i18n/catalog/es.ts` / `ar.ts` / `hi.ts` / `fr.ts` / `pt.ts` / `de.ts` / `ja.ts` / `ru.ts`
- 每个文件结构同 en/zh.ts，TS 会强制检查 ~210 keys 全部存在

**修改**：
- `src/lib/i18n/index.ts` — `CATALOG` 加 8 项 + `listLocales()` 跟随
- `src/styles/globals.css` — RTL 规则（§3.6）

**验证**：
- 在 chrome://settings/languages 把浏览器首选语言改到西班牙语 → 重启浏览器 → newtab 面板变西语
- 选 Arabic → `<html dir="rtl">` → 验证 search 结果里 URL 排版正常（不跳行）
- 验证 column 排布在 RTL 下仍正常（每列宽度 1/N，水平排列顺序反转）
- 验证 en + zh 在加入新语言后**未受影响**（回归）

### Phase D: v0.2.120 — 收尾 + 文档

- [src/background.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/background.ts) 补齐 8 种语言的 `SETTINGS_MENU_TITLES`（en + zh + 8 新增 = 10）
- [CHANGELOG.md](file:///Users/lingsmbp/Documents/aiwork/newtab01/CHANGELOG.md) 新增 `## [0.2.120]` 条目
- 检查 `package.json` 体积（新增 ~9 个 locale 文件，每个 ~5KB → 预计 dist 增量 < 50KB，未越 80KB 预算）
- `pnpm build` 验证

---

## 5. Assumptions & Decisions

1. **不引入 i18n 库**——与项目 vanilla JS 风格一致，bundle 体积受控
2. **使用 `chrome.storage.sync.settings.language`** 而非 `chrome.storage.local`——语言偏好应当跨设备同步（与现有其他 setting 字段一致）
3. **不强制刷新页面**——locale 切换时通过 `subscribe` + `applyLocaleToDom` 实时刷新所有可见 UI
4. **fallback 链 `当前选 → browser → en`**：若用户选 `'auto'` 且浏览器语言不是 10 种之一 → fallback `'en'`
5. **类型安全 MessageKey 联合**——任何 locale 文件少翻译一个 key，TS 编译失败
6. **阿拉伯语 RTL 处理最小化**——只设 `<html dir>`，强制 search URL 排版方向；不复刻完整 RTL layout（项目 CSS 没用 `margin-left/right`，现有 flex/gap 自动镜像）
7. **所有 10 个 locale 的翻译由本次生成的 AI 输出**——以 `en.ts` 为唯一信源。AI 翻译可能不完美（特别是印地语 / 阿拉伯语 / 俄语），用户后续可手动校对
8. **background SW 独立维护一份 `SETTINGS_MENU_TITLES` 表**（不与 newtab 的 i18n 模块共享，因为 SW 不能 import newtab 的模块）
9. **不在 popup 选项页加「语言」入口**——popup 的 settings 入口链到 newtab 的设置面板（已有的 `?options` 路由），用户在 newtab 里改
10. **空文件夹占位 `< Empty >` 改成正常词**（不再带尖括号）——视觉上更友好，附带 i18n 收益

---

## 6. Verification Steps

### 6.1 功能验证

| 场景 | 步骤 | 预期 |
|------|------|------|
| 默认行为（中文浏览器） | 新装扩展，浏览器首选语言为 zh-CN | newtab / popup / 设置面板全显示中文 |
| 默认行为（英文浏览器） | 新装扩展，浏览器首选语言为 en-US | 全部显示英文 |
| 默认行为（其他语言） | 新装扩展，浏览器首选语言为 de-DE | 显示德文（fallback 命中 de） |
| 默认行为（不支持的语言） | 新装扩展，浏览器首选语言为 sv-SE | 显示英文（fallback 命中 en） |
| 手动切语言 | 设置 → 布局 → 语言 → Deutsch | newtab 立即刷新为德文，popup 打开也是德文 |
| 持久化 | 切到日文 → 关闭 newtab → 重新打开 | 仍是日文 |
| 跨设备同步 | 切到俄文 → 等 sync → 在另一台设备打开 | 另一台也是俄文 |
| 切到 auto | 切到 auto → 浏览器语言是 zh | 回到中文 |
| RTL 切换 | 切到阿拉伯语 | `<html dir="rtl">`、search URL 排版正常、column 镜像排列 |
| 特殊目录 title | 切语言 | 5 个特殊目录的 title 实时刷新 |
| tooltip 实时刷新 | 切语言 | 设置按钮 / 外观 toggle / undo 按钮 / folder actions 的 tooltip 立即变 |
| settings 面板 | 切语言 | 打开中的面板（如果开着）立即刷新所有字符串 |
| 搜索 footer | 切语言 | 搜索框聚焦时 footer hints 文字变 |
| 浏览器 action 右键 | 切语言 | 「打开设置 / Open Settings / ...」跟随语言 |

### 6.2 回归验证（v0.2.116 行为不破坏）

| 项 | 检查 |
|----|------|
| 拖拽排序 | 跨列拖一个文件夹 → 切语言 → 拖一个文件夹仍能正常 |
| 主题切换 | 切到英文界面 → 切到 Default Dark 主题 → 主题正确应用 |
| 自定义主题 | 切到德文 → 导入一个 tweakcn 主题 → UI 状态正常、面板变回德文 |
| 导入/导出设置 | 切到日文 → 导出 settings.json → 文件里 `language: "ja"`；导入到另一台 → 另一台变日文 |
| 标签组打开 | 在德文界面下 → 文件夹右键 → 以分组方式打开 → 标签组标题用文件夹名（不参与翻译） |
| 搜索 Cmd+K | 切语言后按 Cmd+K → 搜索框聚焦 + overlay 出现（与 v0.2.116 一致） |

### 6.3 类型 / 构建验证

```bash
pnpm build
# 预期：tsc 0 error（MessageKey 联合强制每个 locale 文件 keys 齐全）
# 预期：vite build 成功，新增 bundle 增量 < 50KB gzipped
# 预期：dist/manifest.json name/description 仍是 newtab01 英文（fixupDistManifest 正常）

# 单独跑 tsc 验证类型
pnpm exec tsc --noEmit
# 预期：0 error
```

### 6.4 关键文件检查清单（每个 commit 后回访）

- [ ] `src/lib/i18n/types.ts` — `MessageKey` 联合覆盖所有翻译
- [ ] `src/lib/i18n/index.ts` — `t()` / `setLocale()` / `resolveLocale()` / `subscribe()` 都有
- [ ] 10 个 `catalog/*.ts` 文件 keys 数量完全一致（en/zh 是「真源」，8 个新增是翻译）
- [ ] `Settings` 类型 + storage defaults + `initSettings` 全部包含 `language`
- [ ] 设置面板「语言」行能 round-trip（auto ↔ 具体 locale）
- [ ] `chrome.storage.onChanged` 监听里 `language` 变化时 background 重注册 context menu
- [ ] 所有 hardcoded 中文 / 英文字符串都被 `t()` 替换（grep 验证）

---

## 7. Risk & Open Questions

| 风险 | 缓解 |
|------|------|
| 翻译质量（特别是阿拉伯语 / 印地语 / 俄语）由 AI 生成可能不自然 | 在 `changes/` 留 `i18n-translation-review.md` 说明校对入口；用户后续手动 `sed` 调整单个 key |
| popup 拿不到 `chrome.storage.sync` 时的初始化时序 | popup 的 `popup/app.ts` 也要 `initSettings()`；`initSettings` 末尾 `setLocale()` 是幂等的，重复调用无副作用 |
| background SW 重新注册 context menu 时机 | 用 `chrome.storage.onChanged` 而非监听每个 tab 的 postMessage；SW 进程可能被休眠，所以 onChanged 是唯一可靠路径 |
| 印地语 (hi) 在 Devanagari 字体下的渲染 | tweakcn 4 套主题都用 `Inter` / `system-ui` 系列字体栈，自动 fallback 到系统 Devanagari 字体；无 CSS 改动 |
| 阿拉伯语连字 + 系统字体 | 同上，依赖 OS Arabic shaping；不主动嵌入字体 |
| bundle 体积 9 个新增 locale 约 5KB × 9 = 45KB | 未越 80KB 预算（v0.2.116 现状约 35KB gzipped） |
| 翻译 key 命名冲突 / 漏译 | TS `satisfies Record<MessageKey, string>` 约束在编译期捕获；CI 必跑 `pnpm exec tsc --noEmit` |
| RTL 下 column 镜像后第一列变成最右 | 符合 RTL 用户预期，无需干预；如要复刻 LTR 行为可后续在 column 上加 `direction: ltr`（v0.2.121+ 再决定） |

---

## 8. Out of Scope

以下**不**在本次实现范围内（v0.2.121+ 视情况追加）：

- 翻译 bookmarks 内部内容（用户自己的书签名称）—— 那是用户数据，不归扩展
- 翻译 settings panel 的 import/export 错误信息里的 stack trace（仍是英文）
- 翻译 debug mode 控制台日志
- 翻译 manifest.json 的 `description`（chrome 扩展默认走 chrome.i18n，但本项目已用 storage 方案，不重复）
- 添加更多 locale（如韩语、意大利语、繁体中文）—— 用户后续按需追加
- 把 `t()` 调用改为 t-function 风格（`\{name\}` 占位符已覆盖 90% 用例；少数如"X 个链接"用模板字符串拼接实现，不引入 ICU MessageFormat）

---

## 9. Open Decisions for User Review (if any)

> 已在 Phase 2 通过 AskUserQuestion 询问并决定：
> 1. **实现方式** → 自建轻量 i18n（确认）
> 2. **翻译来源** → 由我生成全部 10 种翻译（确认）
> 3. **RTL 处理** → 完整 dir 切换 + 布局验证（确认）
