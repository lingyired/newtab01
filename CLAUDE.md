# newtab01 — 项目设计与工程指南

> 本文档是项目的设计总览与工程约束，供 AI 编码助手与协作者遵循。
> AI 编码助手行为指令见 [`.trae/rules/project_rules.md`](.trae/rules/project_rules.md)。

## 0. 关于本项目

**newtab01** 是一个基于 [Humble New Tab Page](https://github.com/ibillingsley/HumbleNewTabPage) (MIT) 重构而来的 Chrome 扩展新标签页。新增 5 项核心能力。

**出处与致谢**：原始版权属 ibillingsley 与贡献者所有，本项目在 MIT 协议下使用、修改并发布。详见 `LICENSE_MIT.txt` 与 `README.md`。

**目录命名**：`newtab01`

---

## 1. 目标与非目标

### 1.1 目标
- 提供高性能、低资源占用的新标签页体验
- 在保留原项目全部能力（apps、topSites、recent、closed、devices、12 主题、背景图、字体、动画、导入导出、自定义 CSS）的基础上叠加 5 项新能力
- 通过**分屏引擎抽象层**为未来 Chrome Window Placing API 等原生能力预留接入点
- 提供清晰的模块边界与可维护代码

### 1.2 非目标
- v1 不支持 Firefox 或其他非 Chromium 浏览器
- 不做云端同步 / 账号系统（依赖 Chrome 自带 sync 能力）
- 不做书签编辑 / 新增 / 删除（只读 + 拖拽布局）
- 不做历史记录搜索（v1 搜索范围仅书签）
- 不做移动端适配（Chrome 扩展仅桌面端）

---

## 2. 五大新增能力

### 2.1 目录分组 & 分屏打开
- 在每个文件夹 header 渲染 **3 个图标**：
  1. **批量打开**（ExternalLink 图标）：以新标签页方式打开目录下所有 URL
  2. **Group 打开**（FolderPlus 图标）：调用 `chrome.tabGroups` 创建 Chrome 原生标签组
  3. **分屏打开**（Columns2 图标）：调用分屏引擎，URL 传入分屏页
- 仅当目录内 bookmark 数量 ≥ 1 时显示；右键菜单保留等价能力

### 2.2 拖拽排序与布局管理
- 书签文件夹可在列内拖拽排序，也可跨列拖拽
- 拖拽到列边缘可创建新列（左 / 右侧）
- 同一文件夹只能出现在一列中，不允许重复
- 空列（length === 0）自动移除，至少保留 1 列
- 顶层文件夹（depth === 0）自动折叠同列其他顶层文件夹；嵌套文件夹（depth > 0）仅折叠同父级兄弟文件夹
- 特殊列（书签栏 + 启用的特殊文件夹）可定位在 store 任意索引位置，不硬编码在末尾
- 拖拽事件使用原生 `addEventListener`（绕过 React 18 事件委托问题），坐标定位使用 `clientY` + `getBoundingClientRect()`
- 拖拽期间不触发 setState 重渲染列，确保 60fps

### 2.3 书签快速搜索
- 在顶部 toolbar 显示一个搜索框，激活时会显示搜索面板，同时为整个界面增加一个类似水玻璃效果的模糊层
- 全局快捷键 `Cmd/Ctrl + K` 唤起搜索面板（shadcn `Command` 组件）
- 索引：启动时与 `chrome.bookmarks.onChanged` 时重建索引
- 范围：书签 title + url（v1 不含 history / topSites）
- 引擎：`fuse.js`，阈值 0.4，keys 权重 title:0.7 / url:0.3
- 使用上下左右快捷键导航搜索结果，回车打开选中项
- 如果不选择结果而直接回车，会使用当前浏览器搜索引擎搜索输入框中的内容
- 搜索框为 topbar 和浮动结果面板共享的单一 input；overlay z-40，results z-50，通过 `createPortal` 渲染到 body

### 2.4 扩展图标快捷分屏
- 点击工具栏图标 → 弹出 popup（`popup.html` 独立页面，内含 shadcn `Dialog` 风格的全屏布局）
- 两个 Tab：**Bookmarks** / **Open Tabs**
- 用户勾选 2-4 个 URL → 选 layout（`2h` / `2v` / `3grid` / `4grid`）
- 点击 **Open Split** → 调分屏引擎在新标签页以 `?split=1` 参数渲染分屏视图
- 与文件夹分屏共用同一引擎

### 2.5 样式自定义
- 基于 tweakcn 和 shadcn 增加切换皮肤的功能，默认内置多套主题，其中包含多个暗色系和亮色系主题
- **主题切换**：在 `styles/themes/` 定义多套 CSS 变量集（`default`、`slate`、`rose`、`dark` 等），选项页切换
- **自定义 CSS**：保留原项目能力，文本域位于 Advanced Tab
- **低优先级**：抽离 DOM/CSS 结构生成 prompt，让用户借助 AI 生成自定义 CSS（在选项页"Generate with AI"按钮，弹窗展示 prompt 并复制）
- 主题切换影响所有界面（newtab、options、popup）

---

## 3. 技术栈

| 维度 | 选型 | 理由 |
|------|------|------|
| 构建 | Vite + `@crxjs/vite-plugin` | 模块化打包、扩展专用 HMR |
| UI | 手写 HTML/CSS | 轻量、高性能、无依赖 |
| 状态 | 简单 JS 模块 + chrome.storage | 无框架开销 |
| 搜索 | `fuse.js` | 7KB、零依赖 |
| 拖拽 | 原生 HTML5 Drag & Drop | 零依赖，HNTP 已有成熟实现 |
| 动效 | CSS transitions/animations | 零依赖 |
| 持久化 | `chrome.storage.sync`（设置） + `chrome.storage.local`（布局缓存） | 跨设备同步、本地大对象 |

---

## 4. 核心设计：分屏引擎抽象

```ts
// src/features/split-engine/types.ts
export type SplitMode = '2h' | '2v' | '3grid' | '4grid';

export interface SplitLayout {
  mode: SplitMode;
}

export interface SplitHandle {
  id: string;          // tabId | windowId
  kind: 'iframe-page' | 'native-window';
  urls: string[];
  layout: SplitLayout;
}

export interface SplitEngine {
  readonly id: 'iframe' | 'native';
  readonly displayName: string;
  open(urls: string[], layout: SplitLayout): Promise<SplitHandle>;
  close(handle: SplitHandle): Promise<void>;
}

// src/features/split-engine/manager.ts
class SplitEngineManager {
  private engines = new Map<string, SplitEngine>();
  private fallback = 'iframe';

  register(engine: SplitEngine) {
    this.engines.set(engine.id, engine);
  }

  async open(urls: string[], layout: SplitLayout, prefer?: 'iframe' | 'native') {
    const id = prefer && this.engines.has(prefer) ? prefer : this.fallback;
    const engine = this.engines.get(id)!;
    return engine.open(urls, layout);
  }
}

export const splitManager = new SplitEngineManager();
splitManager.register(new IframeSplitEngine());
// 未来：splitManager.register(new NativeSplitEngine());
```

- v1：注册 `IframeSplitEngine`（打开新标签页 + `newtab.html?split=1` 内部 N 个 iframe）
- 未来：注册 `NativeSplitEngine`（基于 Window Placing API 或 `chrome.tabs` + `chrome.windows`）
- **调用方（folder-action、popup、search）不感知实现**

### 4.1 iframe 分屏页实现要点
- 通过 URL 参数 `?split=1` 切换分屏模式，URL 列表和 layout 通过 URL hash 传参（`#urls=...&layout=2h`）
- 校验：URL 数量、layout 兼容性、URL scheme（仅 http/https）
- iframe 加 `sandbox="allow-scripts allow-same-origin allow-popups allow-forms"`（按需细化）
- `loading="lazy"` + IntersectionObserver 懒加载
- 顶部工具条：刷新当前、关闭单个、全屏切换
- iframe 加载失败显示 "This site cannot be embedded" 消息 + "Open in new tab" 按钮
- 需要 `declarativeNetRequest` 动态规则移除 `X-Frame-Options` 和 `Content-Security-Policy` 响应头

---

## 5. Chrome 扩展架构要点

### 5.1 Manifest V3
```json
{
  "manifest_version": 3,
  "name": "newtab01",
  "version": "0.1.0",
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "action": { "default_popup": "popup.html" },
  "background": { "service_worker": "src/background.ts", "type": "module" },
  "options_ui": { "page": "options.html", "open_in_tab": true },
  "permissions": ["bookmarks", "favicon", "topSites", "tabs", "tabGroups",
                  "storage", "fontSettings", "sessions", "alarms",
                  "declarativeNetRequest", "search"],
  "host_permissions": ["<all_urls>"],
  "optional_permissions": []
}
```

### 5.2 Service Worker 规则
- 仅作为**消息路由 + 定时任务**，不持业务状态
- 业务状态在 UI 上下文（zustand + chrome.storage）
- 用 `chrome.alarms` 替代 `setTimeout/setInterval`（SW 可能被休眠）
- 监听 `chrome.runtime.onMessage` 时**必须** `return true` 保持异步通道
- 任何消息处理：先校验 `sender.id === chrome.runtime.id`，再校验 message schema（zod）

### 5.3 上下文矩阵
| 上下文 | 入口文件 | 职责 |
|--------|---------|------|
| Service Worker | `src/background.ts` | 消息路由、tabGroups、alarms、storage 写入聚合、declarativeNetRequest 动态规则 |
| New Tab | `newtab.html` | 书签树渲染、搜索、拖拽、分屏视图（`?split=1`） |
| Options | `options.html` | 设置（原生表单 + chrome.storage） |
| Popup | `popup.html` | 选 URL 触发分屏 |

### 5.4 存储分层
- `chrome.storage.sync`：用户设置（主题、字体、布局选项），配额 100KB
- `chrome.storage.local`：布局状态、书签索引缓存（v1 当前）；预留 Fuse 索引快照（v2 计划，v1 启动时全量 `chrome.bookmarks.getTree()` 重建、变更时 300ms 防抖重建），配额 10MB
- **不使用** `localStorage`（chrome-extension-developer 硬规则）

---

## 6. 主题系统

- `styles/globals.css` 定义 `:root` 语义变量（`--background`、`--foreground`、`--primary` 等）+ newtab 专用变量
- `styles/themes/*.css` 定义各主题变量集（`data-theme="dark"` 等覆盖）
- 选项页切换主题：根节点加 `data-theme` 属性
- 用户自定义 CSS：放在 `<style id="user-css">` 内，置于主题变量后
- 颜色使用语义变量：`var(--newtab-bg)`、`var(--newtab-text)` 等，**禁止**硬编码色值

---

## 7. 性能预算与策略

| 指标 | 预算 | 策略 |
|------|------|------|
| 新标签页首屏 JS | ≤ 80KB gzipped | Vite 分 chunk：dnd / search / split 按路由懒加载 |
| 新标签页 FCP | < 200ms | 书签数据走 `chrome.storage.local` 缓存；首屏用 Skeleton |
| Service Worker | < 10KB | 纯路由 + alarms，不引重型库 |
| iframe 分屏 | 每帧 < 5KB 控制代码 | URL 校验后注入，loading=lazy |
| 拖拽 | 60fps | dnd-kit `useSensors` + `restrictToWindowEdges`；不在拖拽期间 setState 重渲染列 |

---

## 8. AI 编码助手行为指令

> AI 编码助手行为指令（Skill 调用规则、编码原则、shadcn/ui 行为准则、Frontend Skill 行为准则等）已迁移至 [`.trae/rules/project_rules.md`](.trae/rules/project_rules.md)。

---

## 9. 工程约束

### 9.1 TypeScript 严格度
- `strict: true`、`noUncheckedIndexedAccess: true`、`exactOptionalPropertyTypes: true`
- 任何 `chrome.*` API 调用必须走 `lib/chrome/` 内的类型化封装
- 禁用 `any`（除外部 SDK 适配的明确注释场景）

### 9.2 组件规则
- 用 `cn()` 或条件 classList 做条件样式，**禁止**手写模板字符串三元
- 用语义 CSS 变量（`var(--newtab-bg)` 等），**禁止**硬编码色值
- 间距一律 `flex + gap` 或 CSS gap，**禁止** `space-x-*` / `space-y-*`
- Dialog/Sheet/Drawer 必须有 Title（可 `class="sr-only"`）
- 任何空状态显示提示文字，不用自造空 div

### 9.3 命名
- 文件名 `kebab-case.ts`
- 业务模块用 feature-sliced 命名（`features/<area>/<unit>.ts`）
- 类型/接口用 `interface`，type 仅用于联合/工具类型
- 不用 `I` 前缀（TypeScript 风格）

### 9.4 文件大小
- 单文件不超过 1000 行；超过则按职责拆分
- 这是**信号**，不是教条；如果拆完后边界更模糊，保持合并

### 9.5 Favicon 加载
- 使用 Chrome 扩展内部 API：`/_favicon/?pageUrl=...&size=16`，配合 `srcSet` 提供 2x 分辨率
- 同源 favicon URL 使用 `Map<string, string>` 缓存，避免重复生成
- 禁止使用 `chrome://favicon/` 协议（MV3 CSP 阻断）

### 9.6 拖拽实现约束
- 拖拽事件使用原生 HTML5 Drag & Drop API
- 坐标定位使用 `clientY` + `getBoundingClientRect()`，不依赖 `e.target`
- 拖拽处理器中的状态通过闭包或模块级变量访问最新值

### 9.7 设置加载顺序
- NewtabApp 必须先调用 `initSettingsStore()` 再初始化 layout store
- 设置加载完成前显示 Loading 状态
- 所有设置项（spacing、vMargin、columnWidth、align、shadowBlur、highlightRound、fadeMs、slideMs、lockColumns、showTopLevel、hideOptions、autoScale、numberTop）必须正确消费并实现

---

## 10. 风险与未决项

| 风险 | 应对 |
|------|------|
| `chrome.tabGroups` 在 Firefox 缺失 | v1 不支持 Firefox，文档明示（见 1.2） |
| iframe 分屏受同源策略限制 | 提供 "open all in tabs" 兜底；declarativeNetRequest 动态规则移除限制头 |
| shadcn preset 选型 | 默认 `base-nova` 或 `radix-nova`，根据视觉评审调整 |
| 拖拽性能（千级书签） | 列表虚拟化（`@tanstack/react-virtual`），不在 v1 必做 |
| 自定义 CSS 注入 XSS | 仅注入到 `<style>` 节点，不进 `innerHTML`；CSP 已禁 unsafe-inline |
| declarativeNetRequest 规则失效 | 使用动态规则（`updateDynamicRules`）而非静态规则文件，更可靠 |

---

## 11. 版本号约定

- **每次提交都 bump patch 版本号**（`0.1.0 → 0.1.1 → 0.1.2`）。这样用户能直观判断扩展是否需要刷新。
- bump 与代码改动放在**同一个 commit**，commit message 注明。
- Major / minor 升级仍然按功能里程碑手动决定（不随每次 commit 涨）。
- bump 时同步更新 `CHANGELOG.md` 的 Unreleased / 新版本小节。
