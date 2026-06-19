# newtab01

> 一个克制、高性能、可分屏的 Chrome 新标签页扩展。
> A minimal, performant, split-screen capable New Tab Page extension for Chrome.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE_MIT.txt)
[![Manifest V3](https://img.shields.io/badge/manifest-MV3-4285F4.svg)](manifest.json)
[![Built with Vanilla JS](https://img.shields.io/badge/stack-Vanilla%20JS%20%2B%20Vite-f7df1e.svg)](#技术栈)
[![Co-authored by TRAE.AI](https://img.shields.io/badge/co--author-TRAE.AI-7c3aed.svg)](#致谢)

---

## 简介

**newtab01** 是在 [Humble New Tab Page](https://github.com/ibillingsley/HumbleNewTabPage) (MIT) 基础上重构而来的 Chrome 新标签页扩展。

它完整保留了原项目的核心能力（apps、topSites、recent、closed、devices、背景图、字体、动画、自定义 CSS），并在其之上叠加 **5 项核心新能力**：文件夹批量操作、拖拽布局、书签快速搜索、Popup 分屏、主题与个性化。

设计风格沿袭 Linear 风的克制美学：calm surface hierarchy、强 typography 与 spacing、少色、密集但可读、minimal chrome。

---

## ✨ 五大新增能力

### 1. 文件夹批量操作
攒了一堆书签的文件夹不用一个一个点——批量打开到新标签页、按 Chrome 标签组归类，或一键丢进分屏视图一起浏览。

- **批量打开**：新标签页铺开所有 URL
- **Group 打开**：按 Chrome 原生标签组归类
- **分屏打开**：直接进入分屏视图一起看

### 2. 拖拽布局
文件夹在列内、跨列自由拖拽；拖到列边缘自动开新列。你的新标签页，你的排版。

- 同一文件夹只在一列出现
- 空列自动消失，至少保留一列
- 特殊文件夹（书签栏、Top Sites 等）可任意安插位置

### 3. 书签快速搜索（⌘/Ctrl + K）
按一个快捷键，所有书签随手可查。模糊匹配标题和 URL，键盘上下选、回车直达。

- 顶栏搜索框，激活即显示
- 无选中时回车走当前浏览器默认搜索引擎

### 4. Popup 分屏
工具栏图标一点，分屏立开——从书签或已打开的标签里选 URL，挑个布局，立刻开始。

- Bookmarks / Open Tabs 双数据源
- 2-4 个 URL，4 种布局（横分 / 竖分 / 三栏 / 四栏）

### 5. 主题与个性化
4 套内置主题（Codex / MX-Brutalist / Cyberpunk / AstroVista）基于 [tweakcn](https://tweakcn.com) 调色板；想换风格直接去 tweakcn 找喜欢的主题，URL 一粘贴到扩展就装好。

- **4 套内置主题** + **无限运行时自定义**（tweakcn URL 或 CSS paste 到「自定义主题」tab）
- **dark mode** 独立的 `darkMode` 设置（`跟随系统 / 亮 / 暗`），每个主题只出现一次，dark variant 由 dark mode 控制
- **自定义 CSS** 仍保留 HNTP 能力（Advanced Tab 文本域），最高 cascade 优先级

---

## 🛠 技术栈

| 维度 | 选型 | 理由 |
|------|------|------|
| 构建 | Vite + `@crxjs/vite-plugin` | 模块化打包、扩展专用 HMR |
| UI | 手写 HTML/CSS | 轻量、高性能、无依赖 |
| 状态 | 简单 JS 模块 + `chrome.storage` | 无框架开销 |
| 搜索 | `fuse.js` | 7KB、零依赖 |
| 拖拽 | 原生 HTML5 Drag & Drop | 零依赖 |
| 动效 | CSS transitions/animations | 零依赖 |
| 持久化 | `chrome.storage.sync`（设置） + `chrome.storage.local`（布局缓存） | 跨设备同步、本地大对象 |

---

## 📦 架构

| 上下文 | 入口文件 | 职责 |
|--------|---------|------|
| Service Worker | `src/background.ts` | 消息路由、tabGroups、alarms、storage 写入聚合、declarativeNetRequest 动态规则 |
| New Tab | `newtab.html` | 书签树渲染、搜索、拖拽、分屏视图（`?split=1`） |
| Options | `options.html` | 设置（原生表单 + chrome.storage） |
| Popup | `popup.html` | 选 URL 触发分屏 |

```
src/
├── background.ts             # Service Worker：消息路由 + alarms
├── lib/
│   ├── chrome/               # chrome.* API 类型化封装
│   ├── storage/              # chrome.storage 统一访问
│   └── settings.ts
├── newtab/                   # 新标签页入口
├── options/                  # 选项页入口
├── popup/                    # 工具栏弹窗入口
└── features/
    ├── bookmarks/            # 书签树渲染、列、文件夹、拖拽目标
    ├── drag-drop/            # 原生 HTML5 DnD
    ├── search/               # fuse.js 搜索 + overlay
    ├── split/                # 分屏引擎抽象 + iframe 引擎
    └── themes/               # 主题切换
```

---

## 🚀 开发

```bash
# 安装依赖
pnpm install

# 开发模式（带 HMR）
pnpm dev

# 构建生产包（产物在 dist/）
pnpm build
```

构建完成后在 Chrome 中加载 `dist/` 目录作为「未打包的扩展程序」即可使用。

### 性能预算

| 指标 | 预算 | 策略 |
|------|------|------|
| 新标签页首屏 JS | ≤ 80KB gzipped | Vite 分 chunk：dnd / search / split 按路由懒加载 |
| 新标签页 FCP | < 200ms | 书签数据走 `chrome.storage.local` 缓存；首屏用 Skeleton |
| Service Worker | < 10KB | 纯路由 + alarms，不引重型库 |
| 拖拽 | 60fps | 原生 DnD + 不在拖拽期间重渲染列 |

---

## 📄 License

本项目基于 MIT 协议开源，详见 [LICENSE_MIT.txt](LICENSE_MIT.txt)。

### 出处与致谢

本项目在 [Humble New Tab Page](https://github.com/ibillingsley/HumbleNewTabPage) (MIT) 基础上重构而来。原始版权属 [ibillingsley](https://github.com/ibillingsley) 与贡献者所有，遵循 MIT 协议发布。

主要维护 / 重构：**[@lingyired](https://github.com/lingyired)**
AI 协作者：**TRAE.AI**

> "Built with humans and AI, in the open."

---

## 🗺 Roadmap

- [ ] 书签编辑 / 新增 / 删除（v1 仅只读 + 拖拽布局）
- [ ] 历史记录搜索（v1 搜索范围仅书签）
- [ ] NativeSplitEngine：基于 Chrome Window Placing API
- [ ] 千级书签的列表虚拟化（`@tanstack/react-virtual` 或同类）
- [ ] Firefox 支持（v1 不支持）
