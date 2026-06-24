# Chrome Web Store 上架文案（中文版）

> 直接复制粘贴到 Chrome Web Store 开发者控制台。
> 与 [store-description.md](store-description.md)（英文版）一一对应，结构、字段、限制、截图列表完全一致。
> 最后更新：2026-06-24。

Chrome Web Store 上架共有 4 个字段：**摘要**（≤ 132 字符）、**详细描述**（≤ 16,384 字符）、**类别**、**语言**。再加上图片（图标、横幅、小型促销磁贴、截图）。

---

## 1. 摘要（≤ 132 字符）

这是出现在搜索结果和商店页面顶部的句子。必须控制在 132 字符以内。

```
多列书签板，支持拖拽排序、模糊搜索（Ctrl/⌘+K）、弹窗分屏与 12 套内置主题及无限自定义主题。
```

字符数：51 ✓

**备选（更具行动感）：**

```
替换 Chrome 的新标签页，享受一个快速、安静、多列的书签板。拖拽、搜索、分屏、12 套主题。
```

字符数：49 ✓

---

## 2. 详细描述（≤ 16,384 字符）

纯文本 / 轻度排版（商店不渲染 Markdown）。商店支持单行换行和基础列表，所以可以用项目符号。

```
newtab01 是一个快速、克制的 Chrome 新标签页，围绕"打开新标签页时真正重要的事"——你的书签、你的工作、让你安静思考的屏幕——三件事打造。

它把 Chrome 默认的新标签页替换成多列书签板。文件夹可拖拽、可对齐，单个文件夹下的链接可以一次性作为 Chrome 标签组打开、放进真正的 iframe 分屏视图，或者直接铺成一排新标签页。按下 ⌘/Ctrl + K 用模糊搜索直跳到任意书签。内置 12 套 tweakcn 主题，复制粘贴 tweakcn 主题链接即可无限扩展。

═══ 核心亮点 ═══

★ 多列书签板
  • 文件夹以等宽列形式排布
  • 同一列内或跨列拖拽文件夹
  • 拖到列边缘自动新建一列
  • 同一文件夹只会出现在一列 —— 不会重复
  • 空列自动消失（始终至少保留一列）
  • 特殊文件夹（书签栏 / 热门网站 / 最近关闭 / 应用）可放在任意位置

★ 文件夹批量操作
  • 全部打开 —— 文件夹内每个链接各自占一个新标签页
  • 作为组打开 —— 用 Chrome 原生标签组包起来
  • 在分屏视图中打开 —— 整个文件夹放进 2x / 3 / 4 宫格 iframe 视图
  • 右键菜单提供同样三个动作

★ 模糊书签搜索（⌘ / Ctrl + K）
  • 按下快捷键，输入，回车
  • 同时匹配书签标题和 URL
  • ↑/↓ 上下选择结果，回车打开
  • 无选中直接回车时，把关键词转发给浏览器默认搜索引擎

★ 弹窗分屏视图
  • 点击工具栏图标打开小窗
  • 书签 tab 或 打开的标签 tab
  • 挑选 2–4 个 URL，选择布局（2h / 2v / 3H / 4grid）
  • 新标签页用真实 iframe 横向并排显示所选 URL
  • 文件夹「在分屏中打开」共用同一套引擎

★ 主题与个性化
  • 内置 12 套 tweakcn 主题：AstroVista、MX-Brutalist、Remedy's Control、Magic 2、Astra、Mimi、Manga Vibe、win86、Random Theme 02、Rose、Kawi Green、Optimus
  • 无限运行时导入 —— 把 tweakcn 主题 URL 或 :root { ... } CSS 块粘到「自定义主题」tab，扩展会一键校验并安装
  • 独立的深色模式设置（跟随系统 / 浅色 / 深色）—— 每个主题在选择器中只出现一次，深色变体由系统自动匹配
  • 主题级外观覆盖 —— 字体、字号、字重、5 个颜色、阴影模糊、链接圆角可按（主题、浅色/深色）组合独立覆盖
  • 主题级、模式级用户 CSS —— 加一段代码片段覆盖单个（主题、模式）组合
  • 10 种应用内语言：English、 中文、 Español、 العربية、 हिन्दी、 Français、 Português、 Deutsch、 日本語、 Русский —— 切换语言时界面原地实时刷新

★ 隐私
  • 无分析、无埋点、无第三方 SDK
  • 无 content script、无远程代码
  • 所有设置都存在本地或 chrome.storage.sync —— 绝不上传到任何地方
  • 完整权限说明：见 GitHub 仓库的 docs/permissions.md

═══ 技术细节 ═══

• Manifest V3
• Vanilla JS + Vite 构建 —— 无框架运行时
• 原生 HTML5 拖拽，不依赖任何拖拽库
• 搜索使用 fuse.js（7 KB，零依赖）
• 新标签页 bundle gzip 后不到 30 KB

═══ 开源 ═══

MIT 协议。完整源码在 GitHub：
https://github.com/lingyired/newtab01

灵感来源于 ibillingsley 的 Humble New Tab Page（MIT）。
```

字符数：约 1,700 ✓（远低于 16,384）

---

## 3. 类别

Chrome Web Store 类别（选**最贴切**的单一主类别）：

- **主类别：** Productivity（生产力）
- （不设次要类别；书签管理是核心功能，主类别选 Productivity）

商店还有一个"隐私实践"单选。选：

- **扩展是否处理个人数据？** 是 —— 书签和标签页 URL 是通过权限访问的用户数据
- **是否将数据传给第三方？** 否
- **是否收集与扩展核心功能无关的数据？** 否

---

## 4. 语言

- **主语言：** English
- （应用内 UI 有 10 种语言 catalog，但商店 listing 是 listing，English 是 Chrome Web Store 上架可发现性的标准语）

> 注：如果要加中文 listing，可在此处选 "中文（简体）" 作为次要语言，把上方"详细描述"的中文版本粘进去；摘要字段可保留英文版不变（≤ 132 字符原文）。

---

## 5. 图片

Chrome Web Store 图片要求（截至 2026-06）：

| 素材 | 尺寸 | 说明 |
|------|------|------|
| 图标 | 128×128 PNG | 必填。用 `icons/icon_128.png` |
| 横幅促销磁贴 | 1400×560 PNG 或 JPG | 可选。强烈推荐。 |
| 小型促销磁贴 | 440×280 PNG 或 JPG | 可选 |
| 截图 | 1280×800 或 640×400 PNG 或 JPG | 最多 5 张。**上架必填** |

`extension-previews/` 下的 14 张图大部分是新标签页 / 弹窗 / 设置界面的截图。商店推荐截图选择：

| 顺序 | 文件 | 内容 |
|------|------|------|
| 1 | `extension-previews/newtab.png` | 主新标签页板 —— 最重要 |
| 2 | `extension-previews/drag to create new column.png` | 拖拽新建列 —— 招牌特性 |
| 3 | `extension-previews/split view.png` | 分屏视图实战 |
| 4 | `extension-previews/search.png` | ⌘/Ctrl + K 搜索面板 |
| 5 | `extension-previews/install theme 2.png` | 主题选择器（12 套 + 运行时导入） |

商店最多接受 5 张截图，所以选最能打动人的 5 张。所有 14 张在仓库里都保留供 README 使用。

图片尺寸说明：1280×800 是首选。如果 `extension-previews/*.png` 比例不一致，用 1280×800 的画板打开，二选一：
- 加 letterbox / pillarbox 留白（用主题色填充以保持品牌调性）
- 或者裁掉最底部非必要 UI

`extension-previews/open split by click icon.png` 以及其他弹窗 / 设置截图作为 GitHub README 配图很合适，但可能需要按商店的严格长宽比裁剪 / 调整。

---

## 6. 隐私 tab 答案

在 Chrome Web Store 开发者控制台 → 隐私实践中：

| 问题 | 答案 | 说明 |
|------|------|------|
| 扩展是否处理个人数据？ | **是** | 访问用户的书签和标签页 URL |
| 数据是否传给第三方？ | **否** | 一切留在本地或 chrome.storage.sync |
| 数据是否被用于与核心功能无关的目的？ | **否** | 书签只用于渲染新标签页 |
| 扩展是否收集 13 岁以下儿童的数据？ | **否** | |

**"单一目的 + 数据使用"文本框粘贴的单段说明**：

```
newtab01 读取用户的 Chrome 书签树，以便在每个新标签页上渲染多列
书签板。它还会读取当前打开的标签页和最近关闭的标签页列表，让用
户可以把它们选为分屏视图的候选。不会有任何数据离开本机。所有设置
（主题、深色模式、语言、布局、自定义主题、撤销历史）都存放在
chrome.storage.sync 和 chrome.storage.local。扩展不注入 content
script、不运行远程代码、也不联系任何第三方分析服务。
```

---

## 7. "What's new" / 更新说明（每次发版时填到控制台的"Release notes"字段）

**v1.0.9 — 2026-06-24**

```
• 在 extension-previews/ 下新增 14 张扩展截图，并嵌入到 README 的对应功能段落。
• 无功能改动。1.0.9 版本号反映本次文档 / 资源的更新。
```

**v1.0.5 — 2026-06-24**

```
• 首次提交到 Chrome Web Store。
• 新增：12 套 tweakcn 主题（AstroVista、MX-Brutalist、Remedy's Control、Magic 2、Astra、Mimi、Manga Vibe、win86、Random Theme 02、Rose、Kawi Green、Optimus）。深色模式是单一全局设置；每个主题在选择器中只出现一次。
• 新增：无限 tweakcn 主题导入 —— 把主题 URL 或 :root { ... } CSS 块粘到「自定义主题」tab，扩展会校验并安装。
• 新增：主题级、模式级外观覆盖 —— 字体、字号、字重、5 个颜色、阴影模糊、链接圆角。
• 新增：外观 tab 内主题级、模式级用户 CSS。
• 新增：10 种应用内语言（en / zh / es / ar / hi / fr / pt / de / ja / ru），切换语言时 UI 原地实时刷新（Arabic 支持 RTL）。
• 新增：完整权限说明文档 docs/permissions.md。
```

---

## 8. 定价

- **免费**，无应用内购买、无试用
- 在「定价」section 选 "Free" + 不勾选 "In-app purchases"
