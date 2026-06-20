# Settings Gear Reposition — 设计 spec

> 日期: 2026-06-20
> 目标分支: `feat/settings-gear-reposition`（从 `main` 拉出）
> 状态: 已确认，待实现
> 关联: v0.2.83 的 link/search 用 `--card` 表面（`#main` 仍是 `width: 96%; margin: 0 auto`）

## 1. 目标

把顶栏右上角的设置齿轮（`#options_button`）从「视口右边固定 24px / 顶部固定 8px / 26×26」调到「与下方书签列右边沿对齐 + 跟 search bar 视觉垂直居中 + 38×38」。

## 2. 三件事的现状 vs 目标

| 维度 | 现状 | 目标 |
|---|---|---|
| **水平位置** | `right: 24px`（绝对像素，跟视口宽无关）| `right: 2%`（视口宽的 2%，跟 `#main` 的右边沿重合 —— 因为 `#main { width: 96%; margin: 0 auto }`，左右各留 2%）|
| **垂直位置** | `top: 8px`（固定 top offset，不对齐）| `top: 50%; transform: translateY(-50%)`（跟 search bar 视觉中线对齐）|
| **尺寸** | SVG 18×18 + padding 4px = 按钮 ~26×26 | SVG 30×30 + padding 4px = 按钮 38×38 |

## 3. 为什么是这些数

### 3.1 水平：`right: 2%`

`#main` 是 `width: 96%; margin: 0 auto` —— 居中，左右各 `(100% - 96%) / 2 = 2%` 视口宽。书签列在 `#main` 里填满 100%，所以**列的右边沿 = `#main` 的右边沿 = 视口右边 2%**。

当前 `right: 24px` 是绝对像素，**只在 1200px 视口**刚好约等于 2%。在窄屏（< 1200px）按钮会**压在列右边沿之外**（视觉溢出），在宽屏（> 1200px）按钮会**离列右边沿有间隙**。`right: 2%` 跟列严格对齐，跨视口宽度都正确。

### 3.2 垂直：`top: 50%; transform: translateY(-50%)`

`#topbar` 是 `display: flex; align-items: center;` —— flex 子（search-wrap 和 undo button）自动垂直居中。但 `#options_button` 是 `position: absolute` 脱出 flex 流，`top: 8px` 是固定 offset 不跟随 search bar。

`top: 50%` + `transform: translateY(-50%)` 是标准 vertical-center 写法：top 50% 相对于 topbar 的 height，translateY 补偿按钮自身 height 的一半。配合 topbar 16px 上下 padding，这个 50% + 50% 抵消 = 按钮中心 = topbar 中心 = search bar 中心（因为 align-items: center）。

### 3.3 尺寸：38×38 + 30×30 SVG

用户直接指定 38×38。SVG 30×30 + padding 4px × 2 = 38px 视觉框。`transform: scale(1)` 的 SVG 在 flex 子里默认是 30px 实际占位（看 `<svg width="30" height="30">` 显式属性）。

**不加 border / 不加 radius**：用户原话"和 search bar 差不多高"≠"长得一样"。Search bar 是 input（带 1px border + radius 跟 theme），齿轮是 icon button（无装饰）。**两者高度匹配，视觉语义分开**。

## 4. 改动文件

| 文件 | 改动 |
|---|---|
| [src/newtab/topbar.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/topbar.ts) | SVG `<svg width="18" height="18">` → `<svg width="30" height="30">` |
| [styles/newtab.css](file:///Users/lingsmbp/Documents/aiwork/newtab01/styles/newtab.css) | `#options_button` 块：`position: absolute` 保留；`top: 8px` → `top: 50%` + `transform: translateY(-50%)`；`right: 24px` → `right: 2%`；加 `width: 38px; height: 38px;`；`padding: 4px` 保留；不加 border / 不加 radius |
| [CHANGELOG.md](file:///Users/lingsmbp/Documents/aiwork/newtab01/CHANGELOG.md) | `[0.2.84]` Changed 段 |
| [package.json](file:///Users/lingsmbp/Documents/aiwork/newtab01/package.json), [manifest.json](file:///Users/lingsmbp/Documents/aiwork/newtab01/manifest.json) | 0.2.83 → 0.2.84 |

总改动 ~6 行代码 + 1 spec doc。

## 5. 边界 case

| 场景 | 行为 |
|---|---|
| 视口宽 800px | `right: 2%` = 16px；齿轮右边沿 = 视口右边 16px = 跟列右边沿重合 |
| 视口宽 1920px | `right: 2%` = 38.4px；齿轮右边沿 = 视口右边 38.4px = 跟列右边沿重合 |
| search bar 隐藏（`showSearch = 0`）| topbar 还在，齿轮仍在 topbar 视觉中心（topbar 是 flex + align-items center，absolute 按钮的 50% 仍然相对 topbar 中心）|
| undo button 显示时 | undo 按钮是 absolute 外的 flex 子，在 search 右侧；齿轮是 absolute 在 topbar 右上，**互不干扰**（独立定位）|
| 暗色主题 | 颜色走 `var(--newtab-text)`，自动适配；无 border 也不依赖主题色 |
| 拖拽列时 | 列在 `#main` 内、视口 96% 居中；齿轮 `right: 2%` 始终跟列右边沿对齐 |
| 设置面板打开 | 齿轮被 `.sp-overlay` (z-index 110) 遮住，`#topbar` z-index 100 在它下面 —— v0.2.83 已经修了 z-index 序列，**不动** |

## 6. 不做（YAGNI）

- **不做 z-index 调整** —— v0.2.83 已修正 `#topbar` (z 100) 和 `.sp-overlay` (z 110) 的顺序，齿轮被遮是正确的
- **不改 hover / focus 样式** —— 0.6 opacity → 1 opacity 的过渡已经够用
- **不改 onclick handler** —— `openSettingsPanel()` 不变
- **不加 tooltip** —— `title="Settings"` 和 `aria-label="Open settings"` 已有
- **不改 `cursor: pointer` / `transition: opacity 0.15s`** —— 保持现状

## 7. 验证

- **手动**：加载 dist → 调浏览器宽度从 800 到 1920 → 齿轮右边沿始终跟列右边沿重合，垂直跟 search bar 中线对齐，38×38 大小
- **build**：`pnpm build` 通过，CSS 增量 ≤ 0.2KB
