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

它完整保留了原项目的全部能力（apps、topSites、recent、closed、devices、12 套主题、背景图、字体、动画、导入导出、自定义 CSS），并在其之上叠加 **5 项核心新能力**：目录分组与分屏打开、拖拽排序与布局管理、书签快速搜索、扩展图标快捷分屏、样式自定义。

设计风格沿袭 Linear 风的克制美学：calm surface hierarchy、强 typography 与 spacing、少色、密集但可读、minimal chrome。

---

## ✨ 五大新增能力

### 1. 目录分组 & 分屏打开
- 每个文件夹 header 渲染 **3 个图标**：
  - **批量打开** —— 以新标签页方式打开目录下所有 URL
  - **Group 打开** —— 调用 `chrome.tabGroups` 创建 Chrome 原生标签组
  - **分屏打开** —— 调用分屏引擎，URL 传入分屏页
- 仅当目录内 bookmark 数量 ≥ 1 时显示；右键菜单保留等价能力

### 2. 拖拽排序与布局管理
- 书签文件夹可在列内拖拽排序，也可跨列拖拽
- 拖拽到列边缘可创建新列（左 / 右侧）
- 同一文件夹只能出现在一列中，不允许重复
- 空列（length === 0）自动移除，至少保留 1 列
- 顶层文件夹自动折叠同列其他顶层文件夹；嵌套文件夹仅折叠同父级兄弟文件夹
- 特殊列（书签栏 + 启用的特殊文件夹）可定位在 store 任意索引位置
- 拖拽事件使用原生 HTML5 Drag & Drop，坐标定位使用 `clientY` + `getBoundingClientRect()`，拖拽期间不触发重渲染，确保 60fps

### 3. 书签快速搜索
- 顶部 toolbar 搜索框，激活时显示搜索面板 + 全局水玻璃模糊层
- 全局快捷键 `Cmd/Ctrl + K` 唤起搜索面板
- 索引：启动时构建，`chrome.bookmarks.onChanged` 时重建
- 引擎：`fuse.js`，阈值 0.4，keys 权重 title:0.7 / url:0.3
- 上下左右导航搜索结果，回车打开选中项；无选中时按当前浏览器默认搜索引擎搜索
- 搜索框为 topbar 和浮动结果面板共享的单一 input

### 4. 扩展图标快捷分屏
- 点击工具栏图标 → 弹出 `popup.html` 独立页面（Dialog 风格全屏布局）
- 两个 Tab：**Bookmarks** / **Open Tabs**
- 用户勾选 2-4 个 URL → 选 layout（`2h` / `2v` / `3grid` / `4grid`）
- 点击 **Open Split** → 调分屏引擎在新标签页以 `?split=1` 参数渲染分屏视图
- 与文件夹分屏共用同一引擎

### 5. 样式自定义
- 内置多套主题（含 `default` / `slate` / `rose` / `dark` 等暗色与亮色主题），选项页一键切换
- 保留原项目自定义 CSS 能力，文本域位于 Advanced Tab
- 低优先级：抽离 DOM/CSS 结构生成 prompt，让用户借助 AI 生成自定义 CSS（在选项页"Generate with AI"按钮，弹窗展示 prompt 并复制）
- 主题切换影响所有界面（newtab、options、popup）

---

## 🧱 核心设计：分屏引擎抽象

为未来 Chrome Window Placing API 等原生能力预留接入点。

```ts
// src/features/split-engine/types.ts
export type SplitMode = '2h' | '2v' | '3grid' | '4grid';

export interface SplitEngine {
  readonly id: 'iframe' | 'native';
  readonly displayName: string;
  open(urls: string[], layout: SplitLayout): Promise<SplitHandle>;
  close(handle: SplitHandle): Promise<void>;
}

// src/features/split-engine/manager.ts
class SplitEngineManager {
  register(engine: SplitEngine) { ... }
  async open(urls: string[], layout: SplitLayout, prefer?: ...) { ... }
}

splitManager.register(new IframeSplitEngine());
// 未来：splitManager.register(new NativeSplitEngine());
```

- **v1**：注册 `IframeSplitEngine`（打开新标签页 + `newtab.html?split=1` 内部 N 个 iframe）
- **未来**：注册 `NativeSplitEngine`（基于 Window Placing API 或 `chrome.tabs` + `chrome.windows`）
- **调用方**（folder-action、popup、search）不感知实现

iframe 分屏页实现要点：
- 通过 URL 参数 `?split=1` 切换分屏模式，URL 列表和 layout 通过 URL hash 传参
- 校验：URL 数量、layout 兼容性、URL scheme（仅 http/https）
- iframe 加 `sandbox="allow-scripts allow-same-origin allow-popups allow-forms"`（按需细化）
- `loading="lazy"` + IntersectionObserver 懒加载
- `declarativeNetRequest` 动态规则移除 `X-Frame-Options` 和 `Content-Security-Policy` 响应头

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
