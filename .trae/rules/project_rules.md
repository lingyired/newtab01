# newtab01 — AI 编码助手行为指令

> 本文件定义 AI 编码助手在处理 newtab01 项目任务时必须遵守的行为规则。
> 项目设计规格见 `CLAUDE.md`。

---

## 1. 技术栈约束

**本项目使用 Vanilla JS + Vite，不使用 React 或任何前端框架。**

- UI：手写 HTML/CSS，不使用组件库
- 状态：简单 JS 模块 + chrome.storage，不使用 zustand
- 拖拽：原生 HTML5 Drag & Drop，不使用 dnd-kit
- 动效：CSS transitions/animations，不使用 framer-motion
- 表单：原生表单 + 手动校验，不使用 react-hook-form + zod
- 搜索：fuse.js

---

## 2. 编码原则

### 2.1 Think Before Coding（先想后写）
**不要假设。不要隐藏困惑。明确暴露权衡取舍。**

- **显式陈述假设** —— 不确定就**先问**，不要猜
- **暴露多种解释** —— 任务有歧义时，**先列出解释**再行动，不默默选一个
- **必要时反向建议** —— 如果有更简单方案，**直接说**，不要闷头干
- **困惑就停** —— 指出哪里不清楚，请求澄清

### 2.2 Simplicity First（简洁优先）
**用最少的代码解决问题，不过度工程化。**

- 不加"未要求"的功能
- 不为一次性代码建抽象
- 不为"未来可能用得上"加配置 / 可扩展性
- 不为不可能发生的场景加错误处理
- 50 行能解决就不写 200 行

### 2.3 Precise Edits（精准编辑）
**只改必须改的，只清理自己产生的烂摊子。**

- 不"顺手"改进相邻代码、注释、格式
- 不重构未坏的部分
- 匹配现有风格，即便你偏好不同写法
- 发现**无关的**死代码 → **提到**但不**删除**
- 自己改动产生的孤儿（import / 变量 / 函数）→ 必须删

### 2.4 Goal-Driven Execution（目标驱动执行）
**定义成功标准，循环直至达成。**

把祈使句任务转成可验证目标。多步任务先列计划，每步有验证项。

---

## 3. Vanilla JS 开发规范

### 3.1 DOM 操作
- 使用 `document.createElement()` 创建元素
- 使用 `element.classList.add/remove/toggle` 管理样式
- 使用 `element.addEventListener()` 绑定事件
- 使用 CSS 变量（`var(--newtab-bg)` 等）控制主题
- 禁止使用 `innerHTML`（XSS 风险），仅 `<style>` 注入自定义 CSS 除外

### 3.2 模块化
- 每个 feature 目录下的模块导出清晰的公共 API
- 状态通过模块级变量 + 导出的 getter/setter 管理
- Chrome API 调用统一走 `src/lib/chrome/` 封装

### 3.3 样式
- 使用语义 CSS 变量，禁止硬编码色值
- 主题变量定义在 `styles/themes/*.css`
- 页面专属样式定义在 `styles/newtab.css` / `styles/options.css` / `styles/popup.css`

### 3.4 性能
- 拖拽期间不触发全量重渲染
- 使用 CSS transitions 而非 JS 动画
- favicon URL 使用 Map 缓存
- 搜索索引启动时构建，bookmark 变更时重建

---

## 4. 产品 UI 原则

**newtab01 的产品 UI 原则（主场景 —— 新标签页 / 选项页 / Popup）**：
- **默认 Linear 风格克制**：calm surface hierarchy、强 typography 与 spacing、少色、密集但可读、minimal chrome
- **组织顺序**：primary workspace → navigation → secondary context → action accent
- **避免**：dashboard-card mosaics、厚边框、装饰性 gradient、多 accent 色竞争
- **Utility copy 优先**：标题说"这是什么 / 能做什么"，不写营销话术
- 默认无 Card；用 section、column、divider、list 表达结构
- 动效：快而克制 / 全站一致 / 纯装饰一律删

---
## 5. Warning Signs（违背原则的信号）

若出现以下任一现象，立即停下并重新校准：
- 代码改动中包含对**无关函数**的"改进"
- 100 行任务膨胀成 1000 行架构
- 模糊需求没问就动手实现
- 引入 React 或其他前端框架
- 使用 `innerHTML` 注入用户输入
- 硬编码色值而非使用 CSS 变量
- 动效是纯装饰、不强化层级

---

## 6. i18n 规则（用户可见字符串必须翻译）

> v0.2.117 ~ v0.2.122 引入。详细开发文档见 [`docs/i18n.md`](../../docs/i18n.md)。

### 6.1 强制性
- **任何用户可见字符串都必须走 `t()` 翻译**，包括：
  - HTML 文本（`<div>`, `<span>`, `<button>`, `<option>`, `<label>`, `<a>`, `<li>`, `<td>`, `<h1>`-`<h6>`, `<p>`）
  - `textContent` / `innerText`
  - `placeholder` / `value`（如果 value 是用户可见文字）
  - `title` / `aria-label` / `alt`
  - `alert()` / `confirm()` 提示
  - `document.title`（动态部分）
  - `meta` / `og:title` / `og:description`（如果暴露给浏览器）
- **裸字符串是 bug**：在 PR 评审中如果看到 `textContent = 'Settings'` 这样的硬编码直接退回。例外是项目自有常量（非用户可见的内部 id / 标志位）

### 6.2 添加 / 修改 key 的流程
1. `src/lib/i18n/types.ts` 的 `MessageKey` 联合加 key
2. `src/lib/i18n/catalog/en.ts` 加英文（**source of truth**）
3. 9 个其它 catalog 同步加翻译 —— tsc 因 `as const satisfies LocaleMessages` 强制要求
4. `pnpm exec tsc --noEmit` 确认 0 error
5. 提交时 `pnpm build` 一次确认 vite 也没问题

### 6.3 静态配置对象模式
- **不要**在静态数组 / 对象里直接放裸字符串：
  ```ts
  // 错误
  const OPTIONS = [
    { value: 'light', title: '亮' },     // 切语言后永远是「亮」
  ];
  ```
- **要**用 `key: MessageKey` 字段，渲染时 `t(opt.titleKey)`：
  ```ts
  // 正确
  const OPTIONS: ReadonlyArray<{ value: 'light' | ...; titleKey: MessageKey }> = [
    { value: 'light', titleKey: 'appearanceToggle.light' },
  ];
  // 在 createAppearanceToggle() 里：
  // btn.title = t(opt.titleKey);
  ```
- 参考实现：[`folder-actions.ts`](../src/features/bookmarks/folder-actions.ts)、[`appearance-toggle.ts`](../src/newtab/appearance-toggle.ts)、[`layout-picker.ts`](../src/popup/layout-picker.ts)

### 6.4 placeholder 插值
- `t(key, params)` 支持 `{name}` 占位符：
  ```ts
  t('folderAction.confirmOpenAll', { count: urlCount })
  // en: "Open all {count} links in this folder?"
  // zh: "打开此文件夹中全部 {count} 个链接？"
  ```
- **禁止**用字符串模板拼接（`"打开" + count + "个链接"`）—— 那会绕过 catalog

### 6.5 不进 catalog 的内容
- 用户数据：URL、文件名、bookmark title、search query、chrome.bookmarks 返回的字段
- 内部标识：theme id、storage key、错误代码、enum 值
- Debug 日志（`console.log`）
- CSS class 名、HTML 属性名（`id` / `name`）
- `data-*` 属性（虽然出现在 DOM 里，但不展示给用户）

### 6.6 RTL 适配
- 项目 CSS 走 `flex + gap`（§3.3），`flex-direction: row` 在 `<html dir="rtl">` 下自动镜像
- URL / hostname 显示节点需要 `direction: ltr; unicode-bidi: isolate`，避免 Arabic 文字中夹杂英文字符断行错乱。看 [`styles/globals.css`](../../styles/globals.css) 末尾 `[dir="rtl"]` 规则
- 新增展示 URL 的元素（如某个新的浮层），需要把 selector 加进 globals.css 的 `[dir="rtl"]` 列表

### 6.7 测试 checklist
- 切到中文：「设置」面板 5 个 tab / popup / split-picker / search footer / 浏览器 action 右键「打开设置」/ 5 个特殊目录 title / context menu
- 切到 Arabic (`ar`)：`<html dir="rtl">` 自动生效；URL 不跳行；search input 走 RTL
- 切到「Follow browser」+ 浏览器语言为日文 → 命中 `ja`
- 浏览器语言为瑞典文（不在 10 种里）→ fallback 到 `en`

### 6.8 翻译质量
- 9 种非英文 catalog 由 AI 翻译生成，**人工校对 hi / ar / ru** 优先（这些语言 AI 翻译错误率较高）
- 校对入口：直接编辑 `src/lib/i18n/catalog/<code>.ts` 里的字符串。**不要**改 key 名字（那会破坏 MessageKey 联合 + tsc 会立刻报）

---
