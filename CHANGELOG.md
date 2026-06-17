# Changelog

All notable changes to newtab01 are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.43] - 2026-06-18

### Bug fixes
- **`resolveCssColor` 不再泄漏 `color(srgb ...)` 形式到 color input**。CSS Color 4 函数（`color(srgb ...)` / `oklch(...)` / `oklab(...)` 等）经 `getComputedStyle(probe).color` 第一次读取时，Chrome 111+ 会按规范**原样保留**函数形式而非 normalize 成 `rgb()`。color input 要求 `#rrggbb` 格式，所以直接把它写回去会触发 "The specified value 'color(srgb 0.87 ...)' does not conform to the required format" 报错。
  - 修复：第一次 probe 拿到非 `rgb()` 形式时，再做**第二次** probe（把 `getComputedStyle` 的返回值再 stamp 进 `style.color` 再读一次）。第二次 Chrome 才会 normalize 成 `rgb(r, g, b)`。
  - `hsl()` 也从快路径中移出 —— 同样的根因，hsl() 第一次也会保留为 `hsl()`，需要两跳。
  - 原先的快路径只识别 `rgb`/`rgba`/`hsl`/`hsla`/hex，对 `color()` 形式既不命中快路径也不触发二跳，所以 bug 被掩盖了。

### Notes
- 影响范围：所有 tweakcn 主题在 settings 面板打开颜色选择器时（包括 cyberpunk / astrovista / mx-brutalist，以及任何运行时导入的 tweakcn 主题）。v0.2.42 之后只有 tweakcn 来源主题，命中率变高，所以用户明显感受到。
- 测试方法：选择 cyberpunk 主题 → 设置 → 外观 → 改动任一颜色 → 看到 #rrggbb 格式正常显示，无 color input 报错。

## [0.2.42] - 2026-06-18

### Changed
- **缩减内置主题为 6 个**：保留 `default` / `mx-brutalist` / `cyberpunk` / `cyberpunk-dark` / `astrovista` / `astrovista-dark`，删除 `slate` / `rose` / `dark` / `midnight` / `mocha` / `blue` / `green` / `purple` / `orange` 共 9 个非 tweakcn 内置。
  - 删除 `styles/themes/{slate,rose,dark,midnight,mocha,blue,green,purple,orange}.css`
  - 从 `styles/globals.css` 移除 9 个 `@import`
  - 从 `THEMES` 数组和 `THEME_LABELS` map 移除 9 个 id
  - dist CSS bundle 减少 ~2kB
- **设计意图**：内置主题仅保留 tweakcn 来源（cyberpunk/astrovista/mx-brutalist），其他主题通过 v0.2.41 的运行时导入功能从 tweakcn 社区获取。后续不再维护非 tweakcn 内置主题。
- 选保留 `default` 是因为它是"未设 data-theme"时的基线，删了语义混乱；运行时未匹配的主题（已被删除的）会自然 fall back 到 default 派生值。

### Notes
- **不动的用户状态**：用户已选中的旧主题（如 `slate` / `dark`）的 chrome.storage 字段值不会被迁移 —— 加载时 data-theme 属性设到这些 id，CSS 匹配不到，元素显示 `:where(:root)` 的 default 派生值（与 `default` 主题视觉一致）。用户需从下拉框重选一次或运行时导入其他 tweakcn 主题。
- **测试方法**：打开 newtab → 设置 → 外观 → 主题，下拉框应只显示 6 个内置主题（无 slate/dark/midnight 等）。

## [0.2.41] - 2026-06-18

### Features
- **运行时主题导入 (runtime theme import)**：用户可以在 newtab 设置面板 → 外观 tab 把 tweakcn 主题 JSON 直接粘贴进文本框，点击「应用」即可立即安装并持久化。无需 build、无需修改 switcher.ts、无需手动添加 CSS 文件。
  - 新文件 `src/features/themes/custom-themes.ts`（约 350 行）：validate + storage CRUD + CSS 生成 + DOM 注入
  - `chrome.storage.local` 存 `customThemes` map，key 为 JSON 的 `name` 字段
  - 启动时调 `applyCustomThemes()`，在 `applyTheme()` 之前注入 `<style id="custom-themes">` 到 `<head>`
  - 严格校验：必须 `type === "registry:style"` + 8 个 shadcn 变量齐备
  - 重复粘贴同名 → 覆盖更新（保留 `installedAt`、更新 `updatedAt`）
  - 缺少 `cssVars.dark` → 黄色警告 + 只生成 light 变体
  - 列表 UI：显示已安装的自定义主题（名称 + 安装日期 + light/dark 状态 + 删除按钮）
  - 删除当前 active 的 custom 主题 → 自动 fallback 到 `default` 主题

### Notes
- 实现 spec 见 `docs/superpowers/specs/2026-06-17-runtime-theme-import-design.md`
- 长期方向：移除全部内置主题，全部使用 tweakcn 导入（本期不动内置）

## [0.2.40] - 2026-06-18

### Features
- **新主题：赛博朋克** (`cyberpunk` / `cyberpunk-dark`) —— 霓虹品红 + 荧光绿，深紫底。来源 tweakcn `cmon6sc5v000204la41n1g1gv`。tweakcn 故意把 light 变体也做成暗色（深紫），dark 变体是更深的纯黑；newtab01 沿用这个双暗色设计。
- **新主题：AstroVista** (`astrovista` / `astrovista-dark`) —— 干净橙色专业风，冷白 / 近黑两套。来源 tweakcn `cmlk6zefr000004lbe9jygsqc`。
- 这两个主题直接使用 OKLCH（与 tweakcn JSON 一致），不再预转 hex。

### Bug fixes
- `styles/themes/mx-brutalist.css` 的 shadow 偏移从硬编码 `5px 5px` 修正为 tweakcn JSON 真实值 `4px 4px`。

### Changed
- `manifest.minimum_chrome_version`: `104` → `111`（globals.css 早就在用 `color-mix()`，要求 111+；本次与新主题的 OKLCH 同步到 manifest）。

## [0.2.39] - 2026-06-18

### Changed
- **Brutalist link style 重构成纯 CSS 变量驱动**。v0.2.37 引入的 `THEME_STYLE_CLASSES` JS 映射 + `body.<class>` 选择器方案被移除 —— 它虽然能工作，但用户从 tweakcn 拷贝主题后还得**手动改 switcher.ts** 加映射，不符合"拷过来就能用"的承诺。
  - 新方案：brutalist 风格完全靠 15 个 `--newtab-link-*` CSS 变量驱动，每个都有 `var(--foo, default)` 内联兜底。`styles/newtab.css` 的 `#main a / :hover / :active / :focus-visible` 全部消费这些变量；`styles/themes/mx-brutalist.css` 只负责声明需要的变量值。
  - 删除了 `THEME_STYLE_CLASSES` 映射和 `applyTheme` 里给 `<body>` 加 class 的代码（约 12 行 JS 减少）。
  - 删除了 `styles/newtab.css` 里 `body.brutalist #main a` 等 4 个选择器块（~45 行 CSS 减少）。
  - 同时给默认（非 brutalist）主题也加了 `:focus-visible` 焦点环（2px solid `var(--primary)` + 2px offset），之前完全没实现，键盘可达性提升。

### Variables exposed for theme authors
主题文件可以覆盖的 15 个 link 变量（都有 fallback，**按需声明**）：

| 变量 | 默认 | 用途 |
|------|------|------|
| `--newtab-link-border` | `1px solid var(--border)` | 边框 shorthand |
| `--newtab-link-radius` | `0.6em` | 圆角 |
| `--newtab-link-bg` | `var(--newtab-surface)` | 背景色 |
| `--newtab-link-weight` | `normal` | 字重 |
| `--newtab-link-shadow` | `none` | 默认态阴影 |
| `--newtab-link-shadow-hover` | `0 0 var(--newtab-shadow-blur) var(--newtab-highlight)` | hover 阴影 |
| `--newtab-link-shadow-active` | `none` | active 阴影 |
| `--newtab-link-bg-hover` | `var(--newtab-highlight)` | hover 背景 |
| `--newtab-link-color-hover` | `var(--newtab-highlight-text)` | hover 文字 |
| `--newtab-link-border-color-hover` | `var(--primary)` | hover 边框色 |
| `--newtab-link-transform-hover` | `none` | hover transform |
| `--newtab-link-transform-active` | `none` | active transform |
| `--newtab-link-outline-focus` | `2px solid var(--primary)` | focus 轮廓 |
| `--newtab-link-outline-offset-focus` | `2px` | focus 轮廓偏移 |
| `--newtab-link-transition-duration` | `var(--newtab-fade-ms)` | 过渡时长 |

### Notes
- 这次删除 `THEME_STYLE_CLASSES` 是有意识的取舍：如果未来需要"layout-level"差异（比如整个 column 是侧边栏布局、整个 newtab 改 grid），再加回 body class 机制；现在 brutalist 这种"element-level"差异用变量就够。
- docs/themes-from-tweakcn.md 会在下个 commit 更新，加 link 变量表。

## [0.2.38] - 2026-06-18

### Changed
- **链接间距从硬编码 4px 改为 `var(--newtab-spacing)`**（`styles/newtab.css` 的 `#main ul`）。`--newtab-spacing` 之前在 globals.css 定义但**没人消费**（CLAUDE.md § 9.7 列为 required setting），所以 spacing setting 在 UI 上能调但实际不影响排版。默认 10px —— 对 brutalist 主题（3px 边 + 5px 偏移阴影）刚好够呼吸，对其他主题也明显比 4px 舒服。

### Notes
- 用户在设置面板里调 spacing setting 现在能真正生效了（之前是被 hardcoded gap: 4px 覆盖）。
- `--newtab-vmargin`（vertical margin）也定义但同样未消费，下个 PR 修。

## [0.2.37] - 2026-06-18

### Added
- **Theme "style class" 机制 + brutalist 风格类**：某些主题需要的视觉处理超出 CSS 变量能表达的范围（重边框、硬偏移阴影、按压交互），所以新增了"主题可选 style class"机制：
  1. `THEME_STYLE_CLASSES` 映射（`src/features/themes/switcher.ts`）：`{ 'mx-brutalist': 'brutalist' }`。`applyTheme` 在切换主题时先清掉所有已知 class，再给 `<body>` 加上新主题对应的 class。
  2. CSS 在 `styles/newtab.css` 末尾以 `body.brutalist #main a` 为选择器写 brutalist 专用样式，不影响其他主题（默认走 soft 1px border + 0.6em radius + soft glow 路径）。

- **MX-Brutalist 主题的链接视觉对齐 tweakcn 原版**：
  - 3px 纯黑实线边框（替代默认 1px + theme color）
  - 0 圆角（替代默认 0.6em）
  - 5px 5px 0 黑色硬偏移阴影（无 blur，对比默认的 `0 0 7px var(--newtab-highlight)` soft glow）
  - 加粗字重（`font-weight: 600`）
  - 白色背景（替代默认的 6% color-mix 派生，让 brutalist 风格的"white card on cream page"对比成立）
  - Hover：translate(2px, 2px) + shadow 缩到 3px 3px + 背景变 `--primary` + 文字变 `--primary-foreground`（按钮"被拉向"光标）
  - Active：translate(5px, 5px) + shadow 缩到 0（按钮"完全按下"）
  - Focus-visible：3px `var(--primary)` outline + 2px offset（保证键盘可达性，看得见焦点）

### Notes
- 这次没有把 `<a>` 重构成 `<button>`。brutalist 风格完全靠 CSS class 实现，DOM 结构保持不变（书签仍是 `<a href>`，folder header 仍是 `<a class="folder">`）。
- 后续如果想加更多 style class（neumorphic / glassmorphism / outline-only），往 `THEME_STYLE_CLASSES` 加映射，CSS 写在 `body.<class>` 块里就行。
- folder header 里的 3 个 action 图标（ExternalLink / FolderPlus / Columns2）**不**走 brutalist 样式 —— 它们是 `<button>`/`<span>`，不匹配 `#main a` 选择器。如果未来想让 action 图标也 brutalist，再加 `body.brutalist .folder-actions button` 规则。

## [0.2.36] - 2026-06-18

### Fixed
- **颜色选择器在带 color-mix 派生的主题上报格式错误**（"The specified value 'color-mix(in srgb, #fffcf5, #008f47 15%)' does not conform to the required format '#rrggbb'"）。根因：`applyTheme` 用 `getComputedStyle().getPropertyValue('--newtab-highlight')` 读派生变量时，浏览器返回的是**保留 color-mix 表达式 + 替换内部 var() 引用**的字符串，不是最终 hex/rgb。`saveThemeChange` 把这个字符串原样写进 chrome.storage，下次 color input 渲染时 Chrome 拒绝接受。修法：
  1. 新增 `resolveCssColor(cssValue)` 工具（`src/features/themes/switcher.ts`）—— 把 CSS 颜色表达式盖到一次性 `<span>` 的 `style.color` 上，让浏览器用 `getComputedStyle` 解析成 `rgb(...)` / `rgba(...)`。带 fast-path：已经是 hex/rgb/hsl 的直接返回。
  2. `applyTheme` 写 inline style 之前先 `resolveCssColor`，确保 inline style 永远存的是真实颜色。
  3. `saveThemeChange` 的 `readVar` 也包一层 `resolveCssColor`（写 inline 后再读，理论上是 pass-through，但作为防御层保留）。
  4. `createColorInput` 和 `refreshInputsFromSettings` 在设置 input.value 之前也走 `resolveCssColor`，修复 0.2.36 之前的用户 storage 里残留的 `var()` / `color-mix()` 字符串（迁移：升级后第一次打开设置面板就被自动 normalize）。

### Notes
- 这一类 bug 在 v0.2.33 加了 `color-mix` 派生之后才出现。MX-Brutalist 是第一个会触发 `--newtab-highlight` 走 color-mix 路径的"亮色 + 高饱和 primary"主题，之前 default / slate / dark 等主题里 color-mix 算出来的值碰巧还能被 color input 接受（实际不是 —— 是用户没切换过主题所以 storage 里没有 bad value）。
- 临时 `<span>` 性能：~0.1ms/次，每次设置面板 render 最多 5 次（5 个 color field），可以忽略。设置面板不是热路径。

## [0.2.35] - 2026-06-18

### Added
- **MX-Brutalist 主题**（来自 [tweakcn cmllfu8oc000004l1a0tidj2g](https://tweakcn.com/r/themes/cmllfu8oc000004l1a0tidj2g)，作者 Victor Hugo Avelar Ossorio）。文件 `styles/themes/mx-brutalist.css`，注册到 `globals.css` 的 `@import` 列表、`switcher.ts` 的 `THEMES` 数组、`settings-panel.ts` 的 `THEME_LABELS`（标签"MX 暴力"）。复制流程：
  1. `curl https://tweakcn.com/r/themes/<id>` 拿 raw shadcn registry JSON
  2. 从 `light` 块挑 8 个 shadcn 变量（background / foreground / primary / primary-foreground / muted / muted-foreground / border / ring）
  3. 用 `culori` 把 OKLCH 转 hex（Chrome 104 还不能原生解析 OKLCH）
  4. 写 `:root[data-theme="mx-brutalist"] { ... }` 文件
  5. 三个地方注册

### Notes
- 只取了 tweakcn 给的 light 变体（cream 背景 + 纯黑边框 + 亮绿主色 = 典型 brutalist 风格）。dark 变体要等用户需要再补。
- brutalist 风格的特征在 border 变量上：MX-Brutalist 把 `--border` 设成纯黑 `#000000`，所以新标签页里 1px 边在 cream 背景上对比度极高，和其他 9 个主题完全不同（其他都是浅灰边）。这是有意为之 —— brutalist 的视觉冲击来自硬边。
- hex 值（culori 转的）：`--background: #fffcf5; --foreground: #05140d; --primary: #008f47; --primary-foreground: #ffffff; --muted: #f5edd6; --muted-foreground: #423b24; --border: #000000; --ring: #008f47;`

## [0.2.34] - 2026-06-18

### Changed
- **默认主题链接背景色改为纯白**：`styles/themes/default.css` 新增 `--newtab-surface: #ffffff;` 覆盖全局的 `color-mix(in srgb, var(--newtab-bg), var(--newtab-text) 6%)` 派生。默认主题下 link bg === page bg === #ffffff，链接定义完全靠 1px `--border` 边框 + 文本/图标，呈现"clean white card"风格。其他 9 个主题继续走 6% 派生。

### Notes
- 这是 newtab-specific 的第 9 个变量（8 个 shadcn 变量 + 1 个 `--newtab-surface` override），不破坏 tweakcn 复制流程 —— 从 tweakcn 拷过来的主题删掉这行就回到默认的 6% mix。
- 由于 link bg = page bg = 白，1px `--border`（默认 #e2e8f0，浅灰白）是唯一的区分信号。如果觉得边框太弱看不清，可以把 default 的 `--border` 改成更深的灰（例如 `#cbd5e1` slate-300）—— 这同样只是 8 个 shadcn 变量之一。

## [0.2.33] - 2026-06-18

### Changed
- **链接可见性提升（全部主题）**：
  1. `--newtab-surface` 从 `var(--background)` 改为 `color-mix(in srgb, var(--newtab-bg), var(--newtab-text) 6%)` —— 浅色主题链接变深灰、深色主题链接变浅、彩色主题链接变深一点的同色调，自动保证和页面背景有可见差异。之前 default / slate / rose 主题里 muted 跟 background 只差 1-2%，链接几乎融进背景。
  2. `--newtab-highlight` 从 `var(--muted)` 改为 `color-mix(in srgb, var(--newtab-bg), var(--primary) 15%)` —— hover 状态用主题主色淡染，比 muted 强一档，跨主题行为一致。
  3. `#main a`（书签 + 文件夹 header）新增 `border: 1px solid var(--border)`，hover 时 border-color 切到 `var(--primary)`，移除原来 `0 1px 2px rgba(...)` 的硬编码 slate 阴影（深色主题下不可见）。
- 两个 color-mix 都从 `--newtab-bg` / `--newtab-text` / `--newtab-bg` 派生（不是 raw shadcn vars），用户通过设置面板改的 5 个 color override 写在 `<html style>` 上（specificity 1,0,0,0）依然完全生效。

### Notes
- 8 个 tweakcn 主题文件不需要任何修改 —— 派生逻辑全在 `styles/globals.css` 的 `:where(:root)` 块里。
- `color-mix` 需要 Chrome 111+，manifest 已声明 `minimum_chrome_version: "104"`，新要求 Chrome 111+。如果要回到 104 兼容，把 `color-mix` 改成手算 hex。

## [0.2.32] - 2026-06-17

### Changed
- **主题文件格式对齐 tweakcn**：每个主题 CSS 改为 `:root[data-theme="<id>"] { ... }` 包裹，**只声明 8 个 shadcn 变量**（`--background`、`--foreground`、`--primary`、`--primary-foreground`、`--muted`、`--muted-foreground`、`--border`、`--ring`）。`styles/globals.css` 的 `:where(:root)` 默认值把 6 个 `--newtab-*` 变量改为从这 8 个 shadcn 变量派生（`--newtab-bg: var(--background)`、`--newtab-highlight: var(--muted)`、`--newtab-drop-indicator: var(--primary)` 等）。从 tweakcn 复制主题变成 5 步：复制 `:root` 块 → 改选择器 → 裁剪到 8 个变量 → 转 OKLCH 为 hex（如果需要 Chrome 104 兼容）→ 加 import 和 THEMES 数组注册。详见 `docs/themes-from-tweakcn.md`。
- **删除两个相似灰色主题**：`zinc` 和 `stone`（与 default 视觉差异极小，冗余），保留 `slate`（冷蓝灰）作为唯一的次级中性灰。
- **新增 4 个彩色主题**：`blue`（海蓝）、`green`（森林）、`purple`（紫罗兰）、`orange`（暖橙）。同样只声明 8 个 shadcn 变量。

### Notes
- dark 主题背景从 `#000000` 变成 `#0f172a`（shadcn 标准 dark 的 `--background`），这是派生规则的副作用 —— 如果需要纯黑背景，可以在 dark.css 里手动加一行 `--newtab-bg: #000000;` override。tweakcn 的 `.dark` 块改成 `:root[data-theme="my-dark"]` 后不需要任何 newtab-specific 编辑。

## [0.2.31] - 2026-06-17

### Fixed
- **首次安装背景是白色而不是默认主题的灰色**：`src/lib/storage/settings.ts` 的 `defaults` 5 个 color 字段（`fontColor` / `backgroundColor` / `highlightColor` / `highlightFontColor` / `shadowColor`）写死了具体 hex（`#ffffff` 等），首次安装时 storage 是空的 → `currentSettings = { ...defaults }` → `applyUserColorOverride('backgroundColor')` 用 `#ffffff` 写 inline style → 覆盖 default 主题的 `--newtab-bg: #f1f5f9`（灰色）→ 背景变白。切到别的主题再切回 default 后背景变灰是因为 `saveThemeChange` 把 5 color 重新设为新主题的色（含 default 的灰色）。修复：
  1. 5 个 color 的 `defaults` 改为 `''`（空字符串）。`applyUserColorOverride` 看到空值会走 `removeProperty` 让主题 CSS 变量独立生效
  2. 在 `initSettings` 加 `looksLikeLegacyPaletteDefaults` 检测：如果 unified storage 已存在 + 5 color 全部等于 v0.2.30 之前的默认 hex → 视为"未设置的死亡值"、清空 5 color、写回 storage。这样老用户从 v0.2.30 升级到 v0.2.31 也会自动迁移；v0.2.30+ 显式改过 color 的用户不受影响（hex 不再匹配旧默认）

## [0.2.30] - 2026-06-17

### Fixed
- **用户误加载项目根目录触发 `application/octet-stream` + Service worker status code 11 错误**：源 `manifest.json` 的 `background.service_worker` 指向 `src/background.ts`、`chrome_url_overrides.newtab` 指向 `newtab.html`（引用 `/src/newtab/main.ts`）。如果用户在 `chrome://extensions` 选「加载已解压的扩展程序」时选了**项目根**而不是 `dist/`，Chrome 直接从 `chrome-extension://` 协议静态服务 `.ts` 文件，扩展名是 `.ts` 不是 `.js`、MIME 降级为 `application/octet-stream`，module script 严格 MIME 检查拒绝加载 → newtab 空白 + service worker 注册失败（Status code 11 = `SERVICE_WORKER_RESOURCE_ERROR`）。修复：
  1. 源 `manifest.json` 的 `name` 改为 `newtab01 [dev — DO NOT LOAD: load dist/ instead]`、`description` 加明显警告，让误加载项目根的用户立刻看到提示
  2. `vite.config.ts` 加 `fixupDistManifest` Vite plugin，在 `closeBundle` hook 里把 dist/manifest.json 的 `name` / `description` 改回公开版本（避免「DO NOT LOAD」提示蔓延到 dist/，影响实际加载的扩展）

### Why load `dist/`
- `pnpm dev` 跑的是 Vite dev server（`http://localhost:5173`），但 Chrome 扩展从 `chrome-extension://` 协议加载静态资源，**dev server 不参与**这条路径。所以 dev server 启动不能代替 build + load dist/ 的工作流
- build 后 `dist/` 里的 `.js` 文件被 Rollup 打包、MIME type 正常（`text/javascript`），Chrome module script 正常加载

## [0.2.29] - 2026-06-17

### Fixed
- **打开扩展报 `Failed to load module script: ... MIME type of "application/octet-stream"`**：Rollup 用 source 路径给 chunk 命名，`src/background.ts` 直接拼成 `background.ts-<hash>.js`。Chrome 扩展资源服务看到这个 `.ts-` 段时无法决定扩展名（介于 `.js` 和 `.ts-` 之间），把 MIME 降级为 `application/octet-stream` —— 严格 module-script MIME 检查直接拒绝加载。修复：`vite.config.ts` 加 `rollupOptions.output.entryFileNames` + `chunkFileNames` 自定义函数，从 chunk name 里剥掉 source 扩展名（`background.ts` → `background`），输出名变为 `background-<hash>.js`，Chrome 识别为 `text/javascript` 正常加载。`service-worker-loader.js` 引用的路径同步更新（vite plugin 自动重写），无需改 manifest。

## [0.2.28] - 2026-06-17

### Fixed
- **`highlightColor` 改完被 `shadowColor` 默认值覆盖**：`COLOR_KEYS.shadowColor` 在 `src/features/settings/apply.ts` 映射到 CSS 变量 `--newtab-highlight`（与 `highlightColor` 共享，因为 `newtab.css:61` 的 `box-shadow` 用 `var(--newtab-highlight)`），但 `applyUserColorOverride` 之前从 `getSetting('shadowColor')` 读值写 inline style，而 storage 里 `shadowColor` 默认 `#57b0ff`。`applySettingsToDOM` 在每个 storage 变更后跑 5 个 `applyUserColorOverride`，顺序是 highlightColor 先、shadowColor 后 → 后者用旧 `#57b0ff` 覆盖了用户刚设的 highlightColor，hover 时仍是默认蓝。修复：让 `applyUserColorOverride('shadowColor')` 的 source 改为 `highlightColor`（与 CSS 渲染源一致），5 个 override 永远写同一个值，幂等。
- **切主题时 5 个 color input + theme select 不刷新**：`src/newtab/settings-panel.ts` 的 `renderAppearanceTab` 只在 panel 打开或 tab 切换时跑一次；`saveThemeChange` 写 storage 后，panel 已经显示的 input/select 仍是旧值，要关闭再打开才能看到新主题色。修复：settings-panel 内部维护一个 `chrome.storage.onChanged` 监听器（`openSettingsPanel` 时安装、`closeSettingsPanel` 时 `removeListener`），触发时调 `refreshInputsFromSettings` 把 5 个 color input 和 theme select 同步到 `currentSettings`（shadowColor input 显示 highlightColor 值以匹配实际渲染）。这样切主题、跨 tab 改色、跨设备同步都能立即反映在 panel UI 上，且不重新 render tab 不会破坏用户 focus。
- **改 `shadowColor` input 不生效**：`shadowColor` 改值只写自己的字段，CSS 共用变量 `--newtab-highlight` 实际由 `highlightColor` 决定，所以改完视觉无变化。修复：`saveSetting('shadowColor')` 走新 `saveShadowColorChange`，把值原子 mirror 到 `highlightColor`（一次 `updateSettings`），再调 `applyUserColorOverride('highlightColor')` 立即写 inline style。Description 加注"与高亮颜色共享同一 CSS 变量，修改会自动同步到高亮颜色"。

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