# 主题选择器：下拉框 → 预览链接列表

## Summary

把设置面板里"主题"这一行从 `<select>` 下拉框改为**直接显示的主题预览列表**。每个主题渲染为一条**完整的预览条目**：外层 wrapper 用主题的**页面背景**（`--background`）+ 边框色作为该条的视觉容器；内部嵌套一个**用主题链接样式渲染的预览链接**（`--card` / `--card-foreground` / `--radius` / `--shadow-xs` 等）。两者组合 = 用户在选主题之前能看到"如果应用此主题，新标签页会是什么样"的真实预览。

按垂直单列排列。点击立即切换主题；当前主题用项目里既有的 `.selected` 虚线 outline 标记。

**替换范围**：外观 tab + 自定义主题 tab（两处都使用同一 picker 组件，UX 一致）。
**布局**：单列垂直列表。
**当前主题标记**：`outline: 2px dotted var(--ring); outline-offset: -2px;`（沿用 `#main a.selected` / `.column.selected` 既有的 shadcn-style outline）。

**版本**：v0.2.130（patch bump）。

---

## Current State Analysis

### 现状

主题选择器是一个 `<select id="sp-theme">` 下拉框，渲染在两个地方：

| 位置 | 文件:行 | 上下文 |
|------|--------|--------|
| 外观 tab 主行 | [src/newtab/settings-panel.ts:1267](src/newtab/settings-panel.ts#L1267) | 主题 + 暗色模式 + 宽高 + per-theme `<details>` |
| 自定义主题 tab 顶部 section | [src/newtab/settings-panel.ts:1411](src/newtab/settings-panel.ts#L1411) | "选择主题" 快捷切换 section（同时有暗色模式 select） |

两处都通过 `createSelectInput('theme', themeOptions)` 渲染。`id="sp-theme"` 在两 tab 共享 —— 只有当前 tab 在 DOM 里，所以 `getElementById('sp-theme')` 取到的是当前 tab 的实例（settings-panel.ts:460）。

### 主题数据来源

- 内置 4 套（default / mx-brutalist / cyberpunk / astrovista）× light/dark 变体
- 用户安装的自定义主题（chrome.storage.local.customThemes）
- 通过 `listAllThemesWithLabels(buildThemeLabels())`（[src/features/themes/switcher.ts:123](src/features/themes/switcher.ts#L123)）异步获取 `{ value, label, isCustom }[]`
- 当前主题 id 通过 `getSetting('theme')` 读 —— 是 base id（无 `-dark` 后缀），由 `resolveTheme(baseTheme, darkMode)` 计算实际 `data-theme`

### 主题 CSS 架构限制（关键）

`styles/themes/<id>.css` 里的所有规则都用 `:root[data-theme="<id>"] { ... }` 选择器。**`:root` 只匹配 `<html>`，不匹配嵌套 DOM 元素**。所以普通的"嵌套 `<div data-theme="x">` 即可预览"思路不行 —— 内置主题的 CSS 变量只在 `<html>` 上激活。

→ **必须采用"读取 `<html>` 在每个 data-theme 下的 computed CSS vars，再把它们写为内联 CSS vars 注入到预览 wrapper"** 的方案。这是唯一不改 5 个主题 CSS 文件、不污染 `:root` 语义的可行路径。

### 预览的"两层"结构（关键设计）

每个预览条目 = **外层容器（页面背景）+ 内层链接（链接样式）**，两层共用一份内联 CSS vars（由 wrapper 持有，inner 通过 CSS cascade 继承）。

```html
<li class="sp-theme-preview-item"
    style="--background: oklch(1 0 0); --card: oklch(0.99 0 0); ...">
  <!-- 外层 = 主题的页面背景 + 边框色，让用户看到"如果应用此主题，新标签页的页面会是什么颜色" -->
  <a class="sp-theme-preview-link">Default</a>
  <!-- 内层 = 主题的链接样式（卡片背景、文字、阴影、圆角），让用户看到"如果应用此主题，书签链接会长什么样" -->
</li>
```

**两层用的 CSS 变量映射**：

| 层 | 用途 | 主要变量 |
|----|------|----------|
| 外层 `<li>` | 页面背景 + 容器边框 | `--background`、`--border` |
| 内层 `<a>` | 链接卡片（default 态）| `--card`、`--card-foreground`、`--border`、`--radius`、`--shadow-xs`、`--font-sans` |
| 内层 `<a>` hover | 链接高亮 | `--accent`、`--accent-foreground` |
| 选中态 outline | 标记当前主题 | `--ring` |

所有这些变量都内联到 `<li>` 的 `style="..."` 上 —— 子元素 `<a>` 通过 CSS 级联自然继承。无需在 `<a>` 上再写一次。

### 需要读取并注入的 CSS 变量列表

总计约 19 个核心变量（写在 `<li>` 的 inline style 上）：

```
--background --foreground --primary --primary-foreground
--muted --muted-foreground --border --ring
--card --card-foreground
--accent --accent-foreground
--input --secondary --secondary-foreground
--destructive --destructive-foreground
--popover --popover-foreground
--radius --shadow-xs --font-sans
```

为什么不读 `--newtab-bg` / `--newtab-text` 等派生变量：它们在 `<html>` 上是 inline `var(--background)` 等的引用，浏览器解析后展开；为减少复杂度，直接读 8 个 shadcn core + 11 surface vars，从源头注入。链接样式已经在 [styles/newtab.css:73](styles/newtab.css#L73) 写明读 `var(--card-foreground, var(--newtab-text))` —— 只要注入 `--card-foreground` 就能解析，外层 wrapper 自然走 `var(--background)` → 行背景。

### 主题 → data-theme 映射

每个预览要在用户当前的 darkMode 下渲染：
- `darkMode = 'light'` → `<resolved> = <base>`
- `darkMode = 'dark'` 且有 dark 变体 → `<resolved> = <base>-dark`
- `darkMode = 'dark'` 但无 dark 变体 → `<resolved> = <base>`（fallback，custom theme 没 dark 时）
- `darkMode = 'system'` → matchMedia 决定

用现有的 [resolveTheme(baseTheme, darkMode)](src/features/themes/switcher.ts#L94) 即可。

---

## Proposed Changes

### 1. 新模块 `src/features/themes/theme-picker.ts`

**职责**：构建主题预览列表 + 暴露刷新 / 重渲染的 API。

```ts
// 公开 API（命名沿用项目风格）
export interface ThemePreviewEntry {
  value: string;       // base theme id（如 'default'，无 '-dark'）
  label: string;       // 已通过 t() 翻译
  isCustom: boolean;
}

export function buildThemePicker(
  container: HTMLElement,
  onSelect: (themeId: string) => void,
): void;

export function refreshThemePicker(
  container: HTMLElement,
  activeTheme: string,    // base id，无 '-dark'
): void;
```

**核心实现思路**：

```ts
const VARS_TO_COPY = [
  '--background', '--foreground', '--primary', '--primary-foreground',
  '--muted', '--muted-foreground', '--border', '--ring',
  '--card', '--card-foreground',
  '--accent', '--accent-foreground',
  '--input', '--secondary', '--secondary-foreground',
  '--destructive', '--destructive-foreground',
  '--popover', '--popover-foreground',
  '--radius', '--shadow-xs', '--font-sans',
];

function buildOnePreview(entry, darkMode): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'sp-theme-preview-item';
  li.dataset.themeValue = entry.value;

  // 1. 临时切换 <html data-theme> 到该主题的 resolved 变体
  const originalDataTheme = document.documentElement.getAttribute('data-theme');
  const resolved = resolveTheme(entry.value, darkMode);
  document.documentElement.setAttribute('data-theme', resolved);

  // 2. 读取 19 个 CSS 变量
  const styles = getComputedStyle(document.documentElement);
  const inlinePairs: string[] = [];
  for (const name of VARS_TO_COPY) {
    const v = styles.getPropertyValue(name).trim();
    if (v) inlinePairs.push(`${name}: ${v}`);
  }

  // 3. 还原 <html data-theme>
  if (originalDataTheme) {
    document.documentElement.setAttribute('data-theme', originalDataTheme);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  // 4. 写为 inline style 到 wrapper（外层容器）
  li.style.cssText = inlinePairs.join('; ');

  // 5. 渲染内层预览 link（通过 CSS cascade 继承 wrapper 的 vars）
  const a = document.createElement('a');
  a.className = 'sp-theme-preview-link';
  a.textContent = entry.label;
  a.href = '#';
  a.dataset.themeId = entry.value;
  a.setAttribute('role', 'button');
  a.setAttribute('aria-label', entry.label);
  a.addEventListener('click', (e) => {
    e.preventDefault();
    onSelect(entry.value);
  });
  li.appendChild(a);

  return li;
}
```

**关键设计点**：
- **临时切换 `<html data-theme>`** 是必需的，因为 `:root[data-theme="x"]` 只在 `<html>` 上激活。没有这一步，`getComputedStyle` 读到的是当前激活主题的变量，不是我们想要预览的那个。
- 切换 + 读取 + 还原是纯同步操作，约 0.5-1ms 每主题，4-15 个主题完全可接受。
- 字体大小、padding 等**不读** —— 预览的视觉尺寸由 `.sp-theme-preview-link` CSS 决定（固定 1.4rem 字号，比实际书签链接 1.8em 小一点以适应 settings panel 560px 宽度）。
- **click 行为** = 直接调 `saveThemeChange(themeId)`（已有的 settings-panel.ts:975），与现有 dropdown 行为一致 —— `applyTheme()` + 5 色 bundle + chrome.storage 写。

**active 状态管理**：
- 通过 `dataset.themeValue === activeTheme` 匹配 → toggle `.sp-theme-preview-item--active` class
- 不需要在 build 时传入 activeTheme（避免 stale 状态）—— `refreshThemePicker(container, activeTheme)` 在每次 settings panel 重渲染和 `refreshInputsFromSettings` 时调用

---

### 2. 替换 settings-panel.ts 的两处 `<select>`

**修改 1**：[src/newtab/settings-panel.ts:1267](src/newtab/settings-panel.ts#L1267)（外观 tab 主行）

```ts
// 旧
container.appendChild(
  createRow(t('settings.field.theme'), createSelectInput('theme', themeOptions), 'theme', buildThemeRowDescription())
);

// 新
const themeList = document.createElement('div');
themeList.id = 'sp-theme-list';
themeList.className = 'sp-theme-picker';
container.appendChild(
  createRow(t('settings.field.theme'), themeList, 'theme', buildThemeRowDescription())
);
// 渲染预览（在 listAllThemesWithLabels 之后）
buildThemePicker(themeList, async (themeId) => {
  await saveThemeChange(themeId);
});
```

注意：旧的 `id="sp-theme"` 是给 `refreshInputsFromSettings` 用的。新方案里 `refreshInputsFromSettings` 调 `refreshThemePicker(container, activeTheme)`，**不再需要 `sp-theme` 这个 id**（除非 `createRow` 的 key='theme' 还要求 input 元素 id 为 `sp-theme`——见下）。

**`createRow` 兼容**：检查 [src/newtab/settings-panel.ts:692-789](src/newtab/settings-panel.ts#L692-L789) 的 `createRow` 实现——`labelEl.setAttribute('for', inputId(key, scope))` 默认指向 `sp-theme`。如果 input 元素（这里是新 picker 容器）没这个 id，会出问题。两种处理：
- 方案 A：把新 picker 容器加 `id="sp-theme"`（保留原 id 语义，引用它但不再是 `<select>`）。
- 方案 B：修改 `createRow` 接受可空 `for`。

**选 A**，最小变更。

**修改 2**：[src/newtab/settings-panel.ts:1403-1428](src/newtab/settings-panel.ts#L1403-L1428)（自定义主题 tab 的 `buildThemeSelectorSection`）

同样的替换：`createSelectInput('theme', themeOptions)` → 新 picker 容器 + `buildThemePicker`。

---

### 3. 适配 `refreshInputsFromSettings`

[src/newtab/settings-panel.ts:443-538](src/newtab/settings-panel.ts#L443-L538) 的 `refreshInputsFromSettings` 里有这段：

```ts
const themeSelect = document.getElementById('sp-theme') as HTMLSelectElement | null;
if (themeSelect) {
  const next = String(getSetting('theme') ?? '');
  if (themeSelect.value !== next) themeSelect.value = next;
}
```

**改为**：

```ts
const themeList = document.getElementById('sp-theme') as HTMLElement | null;
if (themeList && themeList.classList.contains('sp-theme-picker')) {
  refreshThemePicker(themeList, String(getSetting('theme') ?? ''));
}
```

注意：`getSetting('theme')` 返回的是 base id（无 `-dark`），与 `data-themeValue` 直接匹配。

---

### 4. CSS 新增 `styles/newtab.css`

紧跟 `.sp-theme-overrides` 段落（在 [styles/newtab.css:1086](styles/newtab.css#L1086) 附近）追加：

```css
/* ─── Theme picker (preview links + page bg) ─── */

/* 容器：垂直列表，去除默认 <ul> 样式 */
.sp-theme-picker {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

/* 外层 = 主题的"页面背景"预览。
 * 通过 inline style 注入的 --background / --border 等变量生效。
 * 给该行一个轻微 padding 让内层链接有呼吸空间。 */
.sp-theme-preview-item {
  background-color: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
  /* 让所有 row 在视觉上等高，即使主题不同导致链接高度差异 */
  min-height: 60px;
}

/* 内层 = 主题的"链接样式"预览。
 * 通过 CSS cascade 从 .sp-theme-preview-item 继承 19 个 CSS vars。
 * 这里只定义"链接长什么样"的 layout / sizing，色彩完全由 inline vars 提供。 */
.sp-theme-preview-link {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 1.4rem;
  line-height: 1.4;
  text-decoration: none;
  padding: 8px 12px;
  cursor: pointer;
  font-family: var(--font-sans, inherit);
  background-color: var(--card, var(--background));
  color: var(--card-foreground, var(--foreground));
  border: 1px solid var(--border);
  border-radius: calc(var(--radius, 0.5rem) - 2px);
  box-shadow: var(--shadow-xs, none);
  transition: color 200ms, background-color 200ms, border-color 200ms, box-shadow 200ms;
}

.sp-theme-preview-link:hover {
  background-color: var(--accent, var(--muted));
  color: var(--accent-foreground, var(--foreground));
}

.sp-theme-preview-link:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.sp-theme-preview-item--active > .sp-theme-preview-link {
  /* 与 #main a.selected / .column.selected 一致的虚线 outline */
  outline: 2px dotted var(--ring, var(--primary));
  outline-offset: -2px;
}
```

**不引入新颜色 / 硬编码值** —— 全部走 var()，符合项目 §3.3 / §9.2 约束。

---

### 5. i18n：新增 2 个 MessageKey

类型 [src/lib/i18n/types.ts:42-263](src/lib/i18n/types.ts#L42-L263) 新增：

```ts
// Theme picker
| 'themePicker.preview'
| 'themePicker.previewAriaLabel'
```

在外观 tab 段下加：

```ts
// Theme picker (preview links)
| 'themePicker.preview'
| 'themePicker.previewAriaLabel'
```

**为什么是 2 个 key**：
- `themePicker.preview` = "预览" / "Preview" —— 实际上当前不需要显示（每条预览的 label 就是主题名）。可以先不加。
- **只加 1 个** `themePicker.previewAriaLabel` = "Theme preview list" / "主题预览列表" —— 作为新 picker 容器的 `aria-label`，供屏幕阅读器和 v0.2.119 之后 i18n 校验。

最终：1 个新 MessageKey。

---

### 6. 10 个 catalog 同步翻译

[src/lib/i18n/catalog/en.ts](src/lib/i18n/catalog/en.ts) 加 source of truth：

```ts
'themePicker.previewAriaLabel': 'Theme preview',
```

9 个其它 catalog 加对应翻译。`pnpm exec tsc --noEmit` 验证。

不需要新文案 copy 进 Picker UI（主题名 = `t('theme.xxx')` 已存在），所以翻译量很小。

---

### 7. CHANGELOG + 版本 bump

- `CHANGELOG.md` 在顶部加 `## [0.2.130] - <今天>` 段，描述变更
- `manifest.json` `version` 字段：`0.2.116` → `0.2.130`（注意：CLAUDE.md §11 说"每次提交 bump patch" —— 当前 manifest 是 0.2.116 但 CHANGELOG 已经到 0.2.129，这是历史遗留不一致，**本次不动 main 的 manifest**，等执行阶段再确认策略）
- `package.json` 若有 version 字段同步

实际上 manifest.json 当前是 0.2.116，跟 CHANGELOG 不同步是 base 之前未及时 bump 的问题。本次按 CHANGELOG 推到 0.2.130。

---

## Assumptions & Decisions

| 决定 | 选择 | 理由 |
|------|------|------|
| 替换范围 | 两 tab 都改 | UX 一致；只改一处用户会在自定义主题 tab 看到老 dropdown 困惑 |
| 布局 | 单列垂直 | 用户明确说 "list"；单列最直观 |
| 预览实现方式 | 临时切 `<html data-theme>` + 读 computed vars + 写 inline | 不改 5 个 theme CSS 文件，保持 `:root[data-theme="x"]` 语义纯粹 |
| 预览字体大小 | 1.4rem（比书签 1.8em 小） | 适应 560px panel 宽度；4-8 个预览不显拥挤 |
| 预览是否带 favicon/icon | 不带，纯文本 | 用户说"标题是 A"，简单就是好 |
| 点击行为 | 直接 `saveThemeChange()` 写 storage | 用户说"点击后就选中并切换" |
| 当前主题标记 | `.selected` 同款 2px dotted outline | 项目既有约定（CLAUDE.md §9.2 提到"outline 2px dotted var(--ring)"） |
| 暗色模式预览如何显示 | 用当前 `darkMode` 渲染（不每个主题再开 dark/light 双预览） | 用户明确说"主题+当前的暗色模式" |
| 隐藏内置 dropdown | 整个移除 | 用户说"下拉框改为...list"，是替换不是叠加 |
| hover 颜色 | `var(--accent, var(--muted))` | 与 `#main a:hover` 同一族 CSS vars |
| active 状态刷新时机 | `refreshInputsFromSettings` + `renderAppearanceTab` + `renderCustomThemesTab` 三处 | 与现有 dropdown 的刷新点一致 |
| 重渲染性能 | 一次性读 22 vars × N 主题 < 20ms | 完全可接受 |

---

## Verification

### 编译期

1. `pnpm exec tsc --noEmit` —— 必须 0 error
   - 新 MessageKey 在 10 个 catalog 都补全（`LocaleMessages` 联合强约束）
   - 新模块 `theme-picker.ts` 不引入 `any`
2. `pnpm build` —— vite 也能过

### 运行时（手工测试 checklist）

按 CLAUDE.md §6.7 i18n 测试 checklist 扩展：

1. **外观 tab 渲染**
   - 默认主题（light 模式）：打开面板 → 外观 tab → 看到 4 个内置主题预览（Default / MX-Brutalist / Cyberpunk / AstroVista）
   - 每个预览都有**两层视觉**：外层 = 该主题的页面背景色 + 边框色；内层 = 该主题的链接卡片（背景、文字、阴影、圆角）
   - 当前主题（Default）有 2px dotted outline
   - 切到 dark mode（topbar toggle 切到 🌙）→ 4 个预览的浅色/深色变体自动切换（外层背景和内层卡片都跟着切换到 dark 变体）
2. **点击切换**
   - 点 MX-Brutalist → 立刻应用该主题 → 当前主题 outline 跳到 MX-Brutalist
   - chrome.storage 已写入 `theme = 'mx-brutalist'`
   - `<html data-theme>` 切到 `mx-brutalist` 或 `mx-brutalist-dark`
3. **自定义主题**
   - 安装一个 tweakcn 主题 → 回到外观 tab → 自定义主题预览出现（按插入顺序在最后）
   - 当前如果正好是该自定义主题 → outline 标记正确
   - 删除自定义主题 → 该预览从列表消失
4. **自定义主题 tab**
   - 打开"自定义主题" tab → 顶部的"选择主题" section 也是预览列表
   - 与外观 tab 完全一致（同一组件）
5. **跨标签页同步**
   - Tab A 切到 Cyberpunk，Tab B 的外观 tab 当前主题 outline 立刻同步（`chrome.storage.onChanged` → `refreshInputsFromSettings` → `refreshThemePicker`）
6. **暗色模式**
   - `darkMode = 'system'` 在 macOS 暗色下 → 所有预览显示 dark 变体
   - OS 切换 light/dark → 预览列表实时更新（matchMedia change → `applyTheme` 已有的 storage.onChanged 路径）
7. **i18n**
   - 切到中文 → 主题 label 显示中文（"默认" / "MX 粗野" / "赛博朋克" / "星景"）—— 已有 catalog，无需新增
   - 切到 Arabic（rtl） → 列表自动镜像（flex-direction: column 不受 dir 影响；不需新 RTL 规则）
8. **per-theme per-mode 联动**
   - 在外观 tab 切换主题 → 下方的 per-theme `<details>` summary 文案更新（"Current theme appearance (Cyberpunk · dark)"）—— 与 dropdown 时代行为一致
9. **revert / clearPerTheme 按钮**：原 sp-theme 的 revert 按钮在新设计里自然消失（picker 不是单一可输入控件）。revert 没意义 —— 主题只有"选哪个"没有"输入什么"。需要在 createRow 调用时考虑：
   - 选项 A：`createRow` 接收新参数 `allowRevert: false` 跳过 ↩ 按钮
   - 选项 B：让 revert 按钮在 picker 容器上无效化（按钮仍存在但点击 noop）
   - 选 A 更干净。需要小改 `createRow`：当 input 元素没有 `.value` 属性时跳过 ↩。新 picker 容器没有 `.value`（不是 Form 控件）。

### 视觉验收

每条预览的"外层背景"和"内层链接"都必须与该主题实际应用后看到的视觉效果一致：

- **Default 主题**：外层纯白（`--background: oklch(1 0 0)`）+ 浅灰边框 → 内层白色卡片 + 极淡 drop shadow + 4px 圆角
- **MX-Brutalist 主题**：外层浅黄/暖白（Codex 调色板的白）+ 黑色边框 → 内层硬阴影（4px 4px 0 0 黑色 50%）+ 0px 圆角（`--radius: 0px`）
- **Cyberpunk 主题**：外层深色（dark 模式时近黑） + neon 边框 → 内层 neon 色卡片（青/品红系）
- **AstroVista 主题**：外层暖色（米色/奶白） + 暖色调边框 → 内层 serif 字体（`--font-sans` 主题自带的字体）+ 暖色阴影

切到 dark mode 后所有预览的"外层背景"应该明显变暗（`*-dark` 变体的 `--background` 是深色），内层链接也变深色。

### 不变项

- 下拉框的 onChange 走 `saveThemeChange()`，点击 picker 调同一个函数，行为一致
- `chrome.storage` 写入 schema 不变
- i18n MessageKey schema 仅 +1 项

---

## Branch & Workflow

1. **创建分支**：`git checkout -b feat/theme-picker-list`（基于 main）
2. 实现
3. 自测（编译 + 运行时）
4. `--no-ff` merge 到 main
5. push main + push feat 分支冻结

新分支名遵循 CLAUDE.md §0.1 的 `feat/<feature>` 模式。