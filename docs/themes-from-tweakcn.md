# 从 tweakcn 复制主题到 newtab01

newtab01 的主题文件设计成可直接从 [tweakcn](https://tweakcn.com) 复制：每个主题文件只声明 8 个 shadcn 变量，6 个 `--newtab-*`（书签背景、悬停高亮、拖拽指示）由 `styles/globals.css` 的 `:where(:root)` 默认值从这 8 个 shadcn 变量派生。

所以复制一个 tweakcn 主题并落地到 newtab01 只需要 5 步。

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

## 2. 转换 OKLCH → hex（仅当浏览器兼容要求 Chrome 104+ 时需要）

newtab01 的 `manifest.json` 声明 `minimum_chrome_version: 104`（2022 年 8 月），而 `oklch()` 在 Chrome 111（2023 年 3 月）才支持。如果想保留 104 最低支持，把 OKLCH 转 hex：

- 用 [oklch.com](https://oklch.com) 在线转换每个变量
- 或用脚本：

  ```bash
  # Node 18+: 用 culori 库
  npx -y culori -e 'formatHex(parse("oklch(0.97 0 0)"))'
  ```

转换后变量值看起来像 `--background: #fafafa;`。

## 3. 裁剪到 8 个 shadcn 变量

newtab01 只用到下面 8 个变量，**其他全删**（card / popover / secondary / accent / destructive / input / radius / chart-* 等都不需要）：

| 变量 | 派生为 | 用途 |
|------|--------|------|
| `--background` | `--newtab-bg`、`--newtab-surface` | 书签背景、卡片背景 |
| `--foreground` | `--newtab-text`、`--newtab-highlight-text` | 文字、hover 文字 |
| `--primary` | `--newtab-drop-indicator` | 拖拽落点指示色 |
| `--primary-foreground` | — | 主题点缀色（不直接用） |
| `--muted` | `--newtab-highlight` | hover 高亮 |
| `--muted-foreground` | — | 主题点缀色（不直接用） |
| `--border` | — | 主题点缀色（不直接用） |
| `--ring` | — | 主题点缀色（不直接用） |

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

**不要**声明 6 个 `--newtab-*` 变量 —— 派生规则已经写好在 `globals.css`，这里声明反而会被 inline style 覆盖规则搞复杂。

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
3. **hover 高亮** —— 鼠标悬停书签时背景变 `--newtab-highlight = var(--muted)`，文字变 `--newtab-highlight-text = var(--foreground)`
4. **拖拽指示** —— 拖拽时落点高亮颜色 = `--newtab-drop-indicator = var(--primary)`

如果某个看起来不对，检查：是否漏删了 6 个 `--newtab-*` 变量（派生必须生效）、是否忘了改选择器、是否忘了加到 `THEMES` 数组。

## tweakcn 的 dark 主题怎么办

tweakcn 的 dark 主题是 `.dark { ... }` 块。newtab01 的 "dark" 主题已经存在，是单独的 `data-theme="dark"` 主题。

如果你想加多个 dark 变体（比如 "midnight"、"dracula"、"solarized-dark"），每个都需要：

1. 复制 tweakcn 的 `.dark` 块
2. 重命名为 `:root[data-theme="midnight"] { ... }`
3. 走完上面 5 步

`globals.css` 的 `--newtab-bg: var(--background)` 派生会**直接**用深色版的 `--background`，所以深色变体不需要特殊处理。
