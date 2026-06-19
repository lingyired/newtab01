# 从 tweakcn 复制主题到 newtab01

newtab01 的主题系统完全基于 [tweakcn](https://tweakcn.com) 调色板。每个主题文件只声明 8 个核心 shadcn 变量 + 11 个 surface 变量 + 设计 token，6 个 `--newtab-*`（书签背景、文字、hover 高亮、拖拽落点）由 `styles/globals.css` 的 `:where(:root)` 默认值从 8 个核心变量派生（部分走 `color-mix` 保证对比度，Chrome 111+）。

**v0.2.73+ 优先用运行时导入（见第 0 节）** —— 在「自定义主题」tab 粘贴 tweakcn 主题 URL 或 CSS，**无需 build、无需改代码**。本文档剩余的"5 步复制流程"是 v0.2.41 之前的**内置主题添加方式**（v0.2.41 之后是历史 fallback 路径，**新功能不再走这条**）。

## 0. 运行时导入（v0.2.73+，推荐）

newtab01 支持从 tweakcn 直接导入主题，无需 build、无需修改源代码。导入区在「自定义主题」tab 顶部"导入自定义主题"section。

### 0.1 拿 tweakcn 主题的 URL

打开 [tweakcn.com/themes](https://tweakcn.com/themes) 浏览，看到喜欢的主题就复制浏览器地址栏的 URL，例如：

```
https://tweakcn.com/themes/cmo5ifogt000304jm34v746n2
```

theme URL 的 `<id>` 段（路径最后一段）就是 tweakcn 内部主题 ID —— newtab01 会用它去 shadcn CLI 的 raw endpoint 拉 JSON。

如果手头已经有 tweakcn 的 JSON URL（`.../r/themes/<id>` 形式），也可以直接粘贴，URL 检测会跳过 normalize 直接 fetch。

### 0.2 URL 粘贴（推荐）

1. 打开 newtab 设置面板 → 「自定义主题」tab（齿轮图标打开设置面板，导航点「自定义主题」）
2. 在顶部"导入自定义主题"section 的文本框粘贴 `https://tweakcn.com/themes/<id>`
3. （可选）填"主题名称"输入框 —— 留空时用 JSON 里的 `<name>` 字段；填写时**覆盖** JSON 里的 name
4. 点「应用」
5. 进度条（indeterminate shimmer）显示 fetch 中；完成后进度条消失
6. 状态条会显示 `✓ 已安装 "<name>（含深色变体）"` 或具体错误（"URL 格式不正确" / "加载失败: HTTP 404" / "JSON 解析失败: ..."）
7. 页面立即切到新主题，主题下拉框里出现新条目（dark mode 设置决定渲染 light 还是 dark 变体）
8. URL 内的 `?query` / `#hash` 保留

### 0.3 CSS 粘贴（备选）

适合手头已有 tweakcn 主题的 CSS 而非 URL 的场景。

1. 打开 tweakcn 主题详情页 → 点「Code」按钮 → 复制 `:root { ... }` + `.dark { ... }` 两段
2. 整个粘贴到 newtab 设置面板的同一个文本框
3. 必填"主题名称"（CSS 里没有 name 字段，扩展需要这个来生成 storage key）
4. 点「应用」

CSS 解析器会提取 `--name: value;` 对；tweakcn 主题里 `shadow-x` / `shadow-y` 这种命名会自动 rename 成 `shadow-offset-x` / `shadow-offset-y`，**与 JSON 路径产物同形**（保证同一个 tweakcn 主题从两条路径进来是同一个 storage 条目）。

### 0.4 校验规则

无论 URL 还是 CSS 路径，最终都走 `validateThemeJson()` 强制：

- 必须有 8 个核心 shadcn 变量（`background` / `foreground` / `primary` / `primary-foreground` / `muted` / `muted-foreground` / `border` / `ring`）—— 缺一个就拒绝
- `cssVars.dark` 可选 —— 缺它只生成 light 变体，dark mode 切到 dark 时**自动 fallback** 到 light（不会破样式）
- 主题名（URL 路径下从 JSON 读，CSS 路径下从输入框读）必须非空，重复粘贴同名 → 覆盖更新

### 0.5 持久化与同步

- 主题存 `chrome.storage.local.customThemes`（仅本设备，10MB 配额）
- 重复粘贴同名 → 覆盖更新
- "已安装的自定义主题"列表显示名称 + 安装日期 + light/dark 状态
- **删除按钮**先弹 `window.confirm("确定要删除自定义主题 \"<name>\" 吗？")` 二次确认 → 确认后从 storage 移除 + 重新生成 CSS 块
- 删除当前 active 的主题 → 自动 fallback 到 `default` 主题

### 0.6 不被消费的字段

tweakcn JSON 里我们**只取** 8 个核心 + 11 个 surface 颜色变量 + 主题名。其他字段（`font-sans` / `radius` / `shadow-*` / `chart-*` / `sidebar-*` / `tracking-*` / `css` / `files`）**在 JSON 路径下全部丢弃**（newtab01 不消费这些 surface）—— CSS 路径下 shadcn surface vars（`secondary` / `accent` / `destructive` / `card` / `popover` / `input` + 各自 foreground）+ 设计 token 会**保留并 emit** 到 `<style id="custom-themes">`，因为这些影响 UI 元素（link hover、search bg 等）。

### 0.7 dark mode 与 dark variant

- 每个主题的 dark 版本在 CSS 里**物理存在**（同文件里另一段 `:root[data-theme="<id>-dark"]` 块，跟 light 块平级）
- 但**不**作为独立主题列在 dropdown 里 —— 主题列表里每个 theme 只出现一次
- dark variant 由独立的 `darkMode` 设置控制（`跟随系统 / 亮 / 暗`，默认 `跟随系统`）
- 当 `darkMode = 跟随系统` 时，扩展跟随 OS 主题切换实时变化（`matchMedia('(prefers-color-scheme: dark)')` 监听）
- 当切到 dark 但主题没 dark 变体时自动 fallback 到 light 变体

### 0.8 实现

- `src/features/themes/custom-themes.ts` —— validate + storage CRUD + CSS emit
- `src/features/themes/css-import.ts` —— CSS paste 解析（v0.2.74）
- `src/features/themes/url-import.ts` —— URL 检测 + normalize（v0.2.77）
- `src/features/themes/switcher.ts` —— `resolveTheme()` + `hasDarkVariant()` 缓存 + `applyTheme()`（v0.2.75）
- 设计 spec：`docs/superpowers/specs/2026-06-17-runtime-theme-import-design.md` / `2026-06-19-css-paste-import-design.md` / `2026-06-19-url-import-design.md` / `2026-06-19-dark-mode-setting-design.md`

---

## 1. 5 步复制流程（v0.2.41 之前的**内置主题**添加方式）—— **legacy**

> ⚠️ **此流程仅用于"把 tweakcn 主题烧进内置主题"**。日常添加主题请用上面的 §0 运行时导入。除非你想：
> - 不依赖 tweakcn 的 raw endpoint（自定义 URL 或离线使用）
> - 想把某个 tweakcn 主题固定为内置、不让用户删
>
> 日常用法**不要**走这条 —— 运行时导入一行粘贴就完事，build 一次才到位对"用户自己加主题"这个场景是过度工程。

### 1.0 拿 tweakcn 主题的 raw 数据

UI 上的 "Code" 按钮要登录；如果你只是想抓社区公开主题的 CSS，用 tweakcn 给 shadcn CLI 的 raw endpoint：

```bash
# URL 格式：https://tweakcn.com/themes/<id>  →  raw 端点 https://tweakcn.com/r/themes/<id>
curl -sL https://tweakcn.com/r/themes/cmllfu8oc000004l1a0tidj2g
# 返回 shadcn registry item JSON（含 name + cssVars.theme/light/dark + css）
```

或者直接打开 [tweakcn.com/themes](https://tweakcn.com/themes) 浏览，看到喜欢的主题就把 URL 里的 `<id>` 拼到上面。

返回 JSON 后，提取 `light` 块里的 8 个 shadcn 变量（见第 3 步的变量清单），跳到第 2 步。

## 1. 在 tweakcn 选好主题并复制 CSS

tweakcn 主题的 "Code" 面板里有两段形如：

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  /* ...更多 */
}

.dark {
  /* 同上但深色版 */
}
```

只复制 light 版（`:root` 块）—— newtab01 的 "dark" 主题是单独一个 `data-theme="dark"` 主题，不复用 shadcn 的 `.dark` 类。

## 2. 转换 OKLCH → hex

newtab01 主题文件目前都是 hex（保持和其他 10 个主题一致）。把 OKLCH 转 hex 的最简单办法（Node 18+）：

```js
// /tmp/convert.mjs — 需要先 npm i culori
import { formatHex, converter, parse } from 'culori';
const toHex = converter('oklch');
const input = process.argv[2]; // 形如 "oklch(0.97 0 0)"
console.log(formatHex(toHex(parse(input))));
```

```bash
# 批量转 8 个变量
for v in "oklch(0.9923 0.0104 91.4994)" "oklch(0.1759 0.0275 161.2531)" ...; do
  node /tmp/convert.mjs "$v"
done
```

也可以用 [oklch.com](https://oklch.com) 在线转换。

转换后变量值看起来像 `--background: #fafafa;`。

**如果想直接用 OKLCH**：Chrome 111+ 原生支持 `oklch()`，newtab01 的 v0.2.33+ 已经用 `color-mix` 要求 111+（见 `manifest.json` 的 `minimum_chrome_version` —— 之后可能会同步更新到 111）。所以未来可以在 CSS 里直接写 `oklch(...)` 而不用转换。

## 3. 裁剪到 8 个 shadcn 变量

newtab01 只用到下面 8 个变量，**其他全删**（card / popover / secondary / accent / destructive / input / radius / chart-* 等都不需要）：

| 变量 | 派生为（globals.css） | 用途 |
|------|--------|------|
| `--background` | `--newtab-bg` | 页面背景 |
| `--foreground` | `--newtab-text`、`--newtab-highlight-text` | 文字、hover 文字 |
| `--primary` | `--newtab-drop-indicator`、`hover 高亮 mix 15%` | 拖拽落点指示色、hover 底色 |
| `--primary-foreground` | — | 主题点缀色（不直接用） |
| `--muted` | `--newtab-surface 6% mix` | 链接背景 |
| `--muted-foreground` | — | 主题点缀色（不直接用） |
| `--border` | 1px 链接边框 | 链接可见度 |
| `--ring` | — | 主题点缀色（不直接用） |

**例外**：如果新主题想要像 default 主题那样让 link bg === page bg（例如想呈现 "white card on white page" 的极简效果），在 `:root[data-theme="<id>"]` 块末尾加一行 override：

```css
--newtab-surface: #ffffff;
```

这会覆盖 globals.css 的 `color-mix` 派生。参考 `styles/themes/default.css` 第 36 行。

## 4. 改 `:root` 选择器为 `:root[data-theme="<id>"]`

把 tweakcn 的 `:root { ... }` 改写为：

```css
:root[data-theme="my-theme"] {
  --background: #fafafa;
  --foreground: #1a1a1a;
  --primary: #2563eb;
  --primary-foreground: #ffffff;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --border: #e2e8f0;
  --ring: #2563eb;
}
```

**不要**声明 6 个 `--newtab-*` 变量（除上面 3 提到的可选 `--newtab-surface` override 外）—— 派生规则已经写好在 `globals.css`，这里声明反而会和 inline style 覆盖规则打架。

## 5. 注册到 newtab01

### 5a. 保存主题文件

把上一步的内容保存为 `styles/themes/<id>.css`。

### 5b. 加到 globals.css import 列表

编辑 `styles/globals.css` 顶部，加一行：

```css
@import './themes/my-theme.css';
```

### 5c. 注册到 THEMES 数组

编辑 `src/features/themes/switcher.ts`，在 `THEMES` 数组末尾追加：

```ts
const THEMES = [
  // ... 现有主题
  'my-theme',
] as const;
```

### 5d. （可选）加中文标签

编辑 `src/newtab/settings-panel.ts` 的 `THEME_LABELS` 映射：

```ts
const THEME_LABELS: Readonly<Record<string, string>> = {
  // ... 现有
  'my-theme': '我的主题',
};
```

不写也行，主题下拉框会 fallback 到英文 id。

### 5e. build + 重新加载扩展

```bash
pnpm build
```

然后在 `chrome://extensions`（或 `edge://extensions`）点 ↻ 重新加载 newtab01。设置 → 外观 → 主题里就能看到新主题。

## 验证清单

新主题生效后做以下检查：

1. **背景色** —— `--newtab-bg = var(--background)`，应该是新主题的 `--background` 值
2. **文字色** —— `--newtab-text = var(--foreground)`，应该清晰可读
3. **链接背景** —— 默认走 6% color-mix 派生（在浅色主题里应该是比 page bg 深一档的灰），hover 走 15% primary mix
4. **链接边框** —— `1px solid var(--border)`，应该和背景有可见对比
5. **拖拽指示** —— 拖拽时落点高亮颜色 = `--newtab-drop-indicator = var(--primary)`

如果某个看起来不对，检查：是否漏删了 6 个 `--newtab-*` 变量（派生必须生效）、是否忘了改选择器、是否忘了加到 `THEMES` 数组。

## tweakcn 的 dark 主题怎么办

tweakcn 的 dark 主题是 `.dark { ... }` 块。newtab01 的 "dark" 主题已经存在，是单独的 `data-theme="dark"` 主题。

如果你想加多个 dark 变体（比如 "midnight"、"dracula"、"solarized-dark"），每个都需要：

1. 复制 tweakcn 的 `.dark` 块
2. 重命名为 `:root[data-theme="midnight"] { ... }`
3. 走完上面 5 步

`globals.css` 的 `--newtab-bg: var(--background)` 派生会**直接**用深色版的 `--background`，所以深色变体不需要特殊处理。

## 实际案例

- `styles/themes/mx-brutalist.css` —— 来自 [tweakcn cmllfu8oc000004l1a0tidj2g](https://tweakcn.com/r/themes/cmllfu8oc000004l1a0tidj2g)，作者 Victor Hugo Avelar Ossorio。`--border` 设成纯黑 `#000000`，是新标签页里唯一一个有 100% 对比度边框的主题（brutalist 美学的硬边效果）。
