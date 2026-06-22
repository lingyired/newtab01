# Changelog

All notable changes to newtab01 are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.118] - 2026-06-24

### Changed
- **i18n Phase B 收尾**。v0.2.117 完成的 settings 面板迁移继续扩展到所有剩余模块：
  - 搜索结果 footer 4 个 hint label（`↑↓ navigate` / `↵ open` / `esc close` / `↵ web search`）+ 整段 `updateSearchStrings()` 重新挂入，locale 切换时 in-place 替换 footer 不清空已搜索结果
  - 分屏选择器（split-picker）5 个字符串全部 `t()` 化：title（`{max}` 占位符）、counter（`{count} / {max}`）、cancel / open first N / open selected 3 个按钮
  - Popup 入口：顶部 `await initSettings()`（v0.2.118 新引入 — popup 之前不依赖 settings，现在为支持 locale 切换必须 init）；4 个 `textContent` 改 `t()`（2 个 tab + Layout + Open Split）
  - Popup 3 个 picker：`BookmarkPicker` 错误 + fallback folder title 复用 `popup.tab.bookmarks`；`OpenTabsPicker` 空态 + 错误；`LayoutPicker` 4 个 layout 改 `labelKey: MessageKey` 模式（与 folder-actions / appearance-toggle 的 `titleKey` 对齐）
  - 5 个特殊目录 title 之外的「空文件夹占位」`< Empty >` 改成 `t('folder.empty')`（顺带删除尖括号）
  - newtab 主页的 `Loading...` / `Invalid split view URL` / `Failed to load bookmarks` 3 个英文字符串
  - background SW 的 right-click「打开设置」menu 改用查表 + `chrome.storage.onChanged` 监听 `settings.language` 变化时重新注册，SW 维护独立的 `SETTINGS_MENU_TITLES: Partial<Record<string, string>>` 表（v0.2.118 仅 en + zh；v0.2.120 扩到 10 项）
- **newtab/main.ts 新增 `applyLocaleToDom()` + `installLocaleListener()`**。订阅 i18n 模块的 `setLocale()` 通知；locale 切换时一次性刷新 topbar / 外观 toggle / undo / search footer / 整列 columns（特殊目录 title 重新走 `t()`），并重开打开中的 settings 面板。`subscribe()` 内部去重，重复切到同一 locale 不触发重画。

### Added
- `initLocale()` / `setLocale()` / `subscribe()` 配合 chrome.storage.onChanged 链路：用户在设置面板改 language → storage 写入 → apply.ts 监听 → setLocale() → 所有订阅方刷新（不刷新页面）

## [0.2.117] - 2026-06-23

### Added
- **i18n 多语言支持 — Phase A 脚手架**。新增 `src/lib/i18n/` 模块（types / index / catalog/en / catalog/zh），轻量、零依赖、纯 TypeScript 实现的翻译函数 `t(key, params?)`、`setLocale()` / `initLocale()` / `getLocale()` / `resolveLocale()` / `subscribe()`、`RTL_LOCALES` 集合。`Settings.language: 'auto' | LocaleCode` 字段新增，跨设备同步（`chrome.storage.sync`）。**Phase A 包含**：
  - 全套 ~210 个 `MessageKey` 联合类型（`tsc` 在编译期强制每个 catalog 文件 keys 齐全）
  - 完整英文 (en) + 完整中文 (zh) catalog：所有设置面板的 tabs / form labels / descriptions / theme labels / 5 个特殊目录 title / 暗色模式选项 / 链接打开方式 / 批量确认阈值 / 自定义主题 import error / 高级 export + import
  - 布局 tab 末尾加「界面语言」`<select>` 行：「跟随浏览器」+ 当前已支持的全部 locale（v0.2.117 = en + zh 2 项；v0.2.119 扩到 10 项）
  - 用户切换语言后即时生效：`<html lang>` + `<html dir>` 同步更新，settings 面板 + 主题下拉 + 5 个特殊目录 title + tab 标签 + 按钮文字 全部实时刷新，无需刷新页面
  - `chrome.storage.onChanged` 监听在 `apply.ts` 里接入：当 `language` 字段在另一 tab 改动时自动 `setLocale()` 触发所有 subscriber
- **类型安全**：`LocaleMessages = Record<MessageKey, string>` —— 任何 catalog 少一个 key，TypeScript 立刻报错，不会让 UI 出现「`settings.field.spacing`」裸 key 暴露给用户

### Implementation Notes
- **零运行时依赖**：`i18n` 模块不引入 `i18next` 等库，与项目 vanilla JS 风格一致。bundle 增量：newtab 26.56KB gzipped（v0.2.116 → v0.2.117 +0.5KB），未越 80KB 预算
- **不使用 `chrome.i18n.getMessage()`**：项目不依赖 Chrome 标准的 `_locales/<lang>/messages.json` 机制，因为 (1) `chrome.i18n` 是 OS 级只读，无法在设置里切换；(2) `popup` 拿不到 SW 的 `chrome.i18n` 调用；(3) 与项目「Settings 跨设备同步」设计哲学冲突
- **下拉用 selfName (englishName) 格式**：locale 用自己语言写自己的名字 + 英文名作为副标签，方便跨语言用户识别
- **`theme.${id}` 联合约束 fallback**：用户安装的自定义主题（id 不在 8 个内置 theme key 里）调 `t('theme.user-foo')` 返回原 key，`themeLabel()` 检测到这个 fallback 行为后改用 theme id 本身显示，custom theme 名字保留用户起的名字
- **不刷新页面**：locale 切换走 `subscribe` + `applyLocaleToDom()` 流程，settings 面板 rerender、topbar 静态元素 (`updateTopbarStrings()`，v0.2.118 引入) 在订阅通道上重绘
- **Phase B 预告**（v0.2.118）：迁移剩余模块 — topbar (search placeholder + settings button title)、appearance-toggle (3 个 tooltip)、undo-button、search-results (footer hints)、folder-actions、folder-actions-handler、context-menu、split-picker、popup、background SW
- **Phase C 预告**（v0.2.119）：加 es / ar / hi / fr / pt / de / ja / ru 8 种新语言，ar 自动切 `dir="rtl"`，`globals.css` 加 RTL 排版适配
- **Phase D 预告**（v0.2.120）：background SW context menu 标题补全 8 种语言 + CHANGELOG 收尾

## [0.2.116] - 2026-06-22

### Changed
- **Apps 改回 link 视觉**（v0.2.95 原始设计）。v0.2.111-v0.2.115 的 folder 视觉 + `chrome.management.getAll()` 列真 app 方案在实践中不 work：Edge 的 PWA 不通过 `chrome.management` API 暴露（Edge PWA 注册到 OS 级，API 不可见），用户在 Chrome 上 Chrome Apps 也极少（Chrome Web Store 2020 起停止新 Chrome Apps）。v0.2.116 改回 link 视觉——`getSubTreeStub('apps')` **不**设 `children` 字段，让 `column.ts:renderNode` 走 `renderLink` 路径（普通 `<a href>` 链接样式），点击跳浏览器原生 apps 页。
- **URL 浏览器检测**：用 `navigator.userAgent.includes('Edg/')` 区分 Edge vs Chrome——Chrome 走 `chrome://apps`，Edge 走 `edge://apps`。`'Edg/'` 是 Edge UA 独有 token（Chrome UA 包含 `'Chrome/...'` 但**不**含 `'Edg/'`）。
- **`isChromeOrFile` 加 `edge://`**：`link.ts:75-85` 的 chrome.tabs API 短路条件新增 `url.startsWith('edge:')`——Edge 的 `edge://` URL（`edge://apps` / `edge://flags` 等）必须走 chrome.tabs API 而**不**是 `<a target>`，跟 `chrome://` 一致。Chrome 上 `edge://` scheme 不存在，是 no-op。

### Added
- **Apps link 单独拖**：`link.ts:renderLink` 检测 `node.id === 'apps'` 时调 `enableDragFolder(node, a, li)`——复用 folder 拖实现到 link 元素（`enableDragFolder` 接受 `HTMLElement` 已经 generic over header 类型，`<a>` 直接能用）。这样 Apps 拖到其他列是单独拖 Apps 节点（跟 top/recent/closed/devices 四个特殊 folder 的拖拽行为一致），**不**冒泡触发整列 column 拖。

### Removed
- **删 `chrome.management` 全部相关代码**：
  - `lib/chrome/bookmarks.ts:70-109` 的 `getInstalledApps` 函数
  - `features/bookmarks/special-folders.ts:182-204` 的 `getAppsNodes` 函数
  - `features/bookmarks/special-folders.ts:42-70` `getChildren` 的 `case 'apps'` 分支
  - `newtab/app.ts:144-180` 的 `chrome.management.onInstalled` / `onUninstalled` 监听器
  - `manifest.json` 的 `management` permission
- 这些代码 v0.2.111-v0.2.115 引入，v0.2.116 全部回滚。**`contextMenus` permission 保留**（v0.2.112 加的，SW `background.ts:25, 32` 调 `chrome.contextMenus` 需要，**与本任务无关**）。

### Implementation Notes
- **openLink export 保留**：v0.2.109 commit 描述说"Exported so that the Apps special-folder header in folder.ts can use"——这条理由 v0.2.116 不再成立（folder.ts 不再调 openLink），但 `openLink` 仍 export，**没有**外部 caller（v0.2.116 之前的搜索结果显示无人 import）。**仅**改注释不在本任务 scope（§2.3 精确编辑），**只** 删 v0.2.111-v0.2.115 引入的死代码，不动 v0.2.109 的 helper。
- **UA 检测限制**：`navigator.userAgent` 在 Chromium 89+ 已有 `navigator.userAgentData.brands` 替代 API（Edge 暴露了 `{brand: 'Microsoft Edge', version: ...}`）。`includes('Edg/')` 是更老的 API 但 Chromium UA 永远包含这个 token（Edge 不会伪装成 Chrome），稳定可靠。
- **v0.2.108-v0.2.115 Apps 处理历史**：v0.2.108 改 renderFolder 修"拖 Apps link 触发整列拖"bug（根因诊断错），v0.2.110 改回 link 视觉（注释说"浏览器不 bubble"——**部分错**，实际 v0.2.108 之前的 bug 来自 v0.2.95 之后某次 column dragstart handler 改 addEventListener 触发的 bubble），v0.2.111 再改 folder 视觉 + management API 列真 app（用户期望的扩展功能），v0.2.116 折中——**link 视觉 + 用 `enableDragFolder` 显式 stopPropagation** 解决 bubble 问题（这才是 v0.2.108 应该用的修法）。

## [0.2.115] - 2026-06-22

### Changed
- **Apps 文件夹 UX 决策：维持 v0.2.111 folder 行为**。v0.2.114 临时诊断后确认 Edge 的 `chrome.management.getAll()` 返回的 13 个条目**全部**是普通 Chrome 扩展（`type: "extension"` + Edge 特有的 `isApp: false` 字段），**无任何 PWA**（无 `type: "hosted_app"` / `"packaged_app"` 条目，**无 `appLaunchUrl` 字段**）。用户装的"豆包，浏览器 AI 助手"等**是 Chrome 扩展**不是 PWA（`homepageUrl` 指向 Edge Add-ons / Chrome Web Store），按 Chrome/Edge 的设计**本来就该不显示**在 Apps 列表。
- **Edge PWA API 限制**：Edge PWA（从网站 "Install" 安装的 PWA）注册到 OS 级别（Windows 开始菜单 / macOS 启动台），**不通过 `chrome.management` API 暴露**给扩展——这是 Edge 的固有限制，newtab01 没法在 newtab 上列出 Edge PWA。这同样适用于 `edge://apps` 页面管理的 PWA：它们在 `chrome.management.getAll()` 里**根本不存在**。
- **v0.2.115 不改 UX**，保留 v0.2.111 的 folder 视觉 + v0.2.113 的 `appLaunchUrl` filter。Chrome 用户装了 hosted_app / packaged_app 时 Apps 文件夹正常显示真 app；Edge 用户 / 没装真 app 的用户看到空 folder（**这是正确行为**，普通 Chrome 扩展本来就不属于 Apps 列表范围）。

### Removed
- **删除 v0.2.114 临时诊断 console.warn 输出**。`getInstalledApps` 恢复为纯 filter 实现，无副作用 console 输出。诊断目的已完成，devtools console 不应再有 `[newtab01 debug v0.2.114]` 警告刷屏。

### Implementation Notes
- 之前讨论过的两个备选 UX（v0.2.109 link 行为跳 chrome://apps / edge://apps 整页 / 双策略 fallback）已记录在此条目但**不实施**——用户决定维持 v0.2.111。如未来 Edge 暴露 PWA API 或用户重新选 UX，再回来加。
- `isApp: boolean` 字段是 Edge 特有的 chrome.management 扩展（Chrome 的 `chrome.management.ExtensionInfo` 类型没这个字段）。v0.2.115 不读这个字段——Edge PWA 不在 getAll() 返回里，读了也没用。

## [0.2.114] - 2026-06-22

### Added
- **临时诊断日志**：v0.2.113 改 filter 后用户测试仍报 Apps 文件夹空（在 Edge 浏览器，装的 PWA）。`getInstalledApps` 内部加 `console.warn` 输出 `chrome.management.getAll()` 返回的条目总数 + 前 5 个 item 的 `id` / `name` / `type` / `enabled` / `appLaunchUrl`（含 typeof），**不影响 filter 行为**——纯附加日志。Reload 扩展 + 展开 Apps 文件夹触发一次 `getAll` 调用，DevTools console 会输出诊断信息，**用户贴回 console 输出即可**。拿到真实数据后定 v0.2.115 精准 filter 并删掉这段 console.warn。

## [0.2.113] - 2026-06-22

### Fixed
- **Apps 文件夹展开后空**（v0.2.111 修 Apps 显示真实应用列表后用户报"apps 依然是空，但是实际上我是有应用的"）。根因在 `getInstalledApps` filter（`lib/chrome/bookmarks.ts:71`）：v0.2.111 用 `ext.type === 'hosted_app' || ext.type === 'legacy_packaged_app'` 字面量匹配，**漏了** Chrome 实际支持的其他 app type——`packaged_app`（已弃用但有遗留用户）、`platform_app`（ChromeOS 平台 app）、`shared_module`（ChromeOS 内部）。**而且** `@types/chrome` 的 `ExtensionType` enum 本身有 typo：`PACKAGE_APP = "package_app"`（少一个 `d`）≠ Chrome 运行时实际字符串 `packaged_app`——即使加上 `packaged_app` 字面量也命中不到。
- **修法**：放弃 `type` 字段字面量匹配，改用 `appLaunchUrl` 字段存在性判断。Chrome 文档明说 `appLaunchUrl` 是 "The launch url (**only present for apps**)"，所以 `typeof appLaunchUrl === 'string' && appLaunchUrl.length > 0` 就是"是 app"的充要条件——兼容所有 `type` 值（`hosted_app` / `legacy_packaged_app` / `packaged_app` / `platform_app` / `shared_module`）且**不依赖**被 typo 污染的 TS enum。同时加 `ext.enabled` 过滤，禁用的 app 不出现在 Apps 列表里。
- 同步改 `src/newtab/app.ts:152-178` 的 `onInstalled` listener `isApp` 闭包——`onInstalled` 拿到的 `info` 跟 `getAll` 返回的 `ExtensionInfo` shape 一致，filter 必须跟 `getInstalledApps` 对齐否则装新 app 不会触发 re-render。
- `getAppsNodes` (`special-folders.ts:180-200`) 的 `appLaunchUrl ?? 'chrome://apps'` fallback 现在是死代码（filter 后 `appLaunchUrl` 一定存在）——保留一个**防御性** fallback（如果未来 schema 漂移）但加注释标明这是 belt-and-suspenders，不是正常运行路径。

### Implementation Notes
- **为什么不直接加 `packaged_app` 字面量**：TS enum 有 typo（`"package_app"` ≠ `"packaged_app"`），加 `ext.type === 'packaged_app'` 编译过但运行时不匹配。改用 `appLaunchUrl` 存在性是 type 字段无关的更稳判断。
- **为什么不包含 `extension` type**：用户装的"应用"如果是普通 Chrome 扩展（type=`extension`），按 Chrome `chrome://apps` 页面的语义**不会**显示在 Apps 列表——Apps 列表只列有 launch URL 的真 app。这与原 HNTP 行为一致，扩展应该在 chrome://extensions 页面管理。

## [0.2.112] - 2026-06-22

### Fixed
- **`background` service worker 注册失败：Uncaught TypeError: Cannot read properties of undefined (reading 'onClicked')` + `Service worker registration failed. Status code: 15`**。根因：`manifest.json` permissions 列表**缺** `"contextMenus"`，但 `background.ts:25` 调 `chrome.contextMenus.onClicked.addListener(...)` + `background.ts:32` 调 `chrome.contextMenus.create({ contexts: ['action'] })`。`chrome.contextMenus` 在没声明 permission 的扩展里是 `undefined`，访问 `.onClicked` 报 TypeError → SW 启动失败 → Chrome 返回 status code 15。这是项目**长期 latent bug**（v0.2.111 之前 manifest 也缺 contextMenus），但旧 SW 一直没重启所以报错没冒头；v0.2.111 升级添加 `management` permission 触发 SW 重启 + 严格权限校验，latent bug 浮现。修：`manifest.json` permissions 加 `"contextMenus"`。CLAUDE.md §5.1 权限清单也补上这一条以避免后续回归。

## [0.2.111] - 2026-06-22

### Added
- **Apps 特殊 folder 现在填入真实应用列表**。v0.2.95 之前 Apps 是一个 `<a href="chrome://apps">` link；v0.2.108-v0.2.110 几次尝试改 folder 视觉 / 单独拖都不到位。v0.2.111 终于落地：Apps header 视觉 = folder（可单独拖、可拖到任意列），展开后展示用户安装的所有 `hosted_app` / `legacy_packaged_app` Chrome 应用（来自 `chrome.management.getAll()`）。每个 app 是一条 link 节点（`id: app.<extensionId>`, `url: appLaunchUrl`），点击走 `link.ts` 的 chrome.tabs API 路径。permission：`manifest.json` 加 `"management"`（首次安装/升级时 Chrome 弹权限 dialog）。

### Fixed
- **`chrome-extension://` URL 不走 chrome.tabs API path**。`link.ts:74` 旧判断用 `url.substring(0, 6) === 'chrome'`，但 `chrome-extension://<id>/...` 的前 6 字符是 `'chrome-'` ≠ `'chrome'`，**所以 Apps 列表里的 app 链接全部 fall through 到 `<a target="_blank">` 分支**，导致 `_generated_background_page.html` 行为怪（launches in generated iframe 背景页而非 newtab）。修：用 `startsWith('chrome:')` / `startsWith('chrome-extension:')` / `startsWith('file:')` 三个 prefix 统一走 chrome.tabs API。

### Implementation Notes
- `getInstalledApps` (`lib/chrome/bookmarks.ts:71-75`) 之前是 dead code——manifest 缺 `management` 权限所以 `chrome.management?.getAll?.()` 永远不命中。v0.2.111 加了 permission 后真的能跑了。
- `getSubTreeStub('apps')` (`special-folders.ts:153-160`) 改回 `children: []` —— `column.ts:renderNode` 的 `if (node.children)` 现在把 Apps 路由进 `renderFolder`，与 top/recent/closed/devices 4 个 special folder 一致。
- `getChildren` (`special-folders.ts:42-58`) 加 `case 'apps'` 走 `getAppsNodes()`。注意 Apps 的实际 children 是 lazy load——`renderFolder` 内部调 `getChildren` 是 async，**未展开**时不取数据。
- `chrome.management.onInstalled` / `onUninstalled` 监听 (`newtab/app.ts:155-178`)：用户装/卸应用时自动 re-render board。`onInstalled` 过滤 `hosted_app` / `legacy_packaged_app`；`onUninstalled` 拿不到 type，每个卸载都 re-render（render 是 no-op for users with no Apps folder open，便宜）。
- v0.2.109 / v0.2.110 那些 `folder.ts:72-99` 的「Apps 跳 chrome://apps」短路分支已删——`renderNode` 把 Apps 路由回 renderFolder 之后这些是 dead code，留着误导。

## [0.2.110] - 2026-06-22

### Fixed
- **Apps header 显示 v0.2.108 视觉回归：folder 外观 + 展开后 `< Empty >` 占位**。v0.2.108 把 Apps 路由进 `renderFolder` 修「拖 Apps header 触发整列 column 拖拽」bug，但 v0.2.109 改了点击行为后 Apps header 仍是 folder 视觉，展开后看到空 folder 占位（`getSubTreeStub('apps')` 无 `children` 字段）。修：**回滚 v0.2.108 的 `renderNode` 改动**——Apps 重新走 `renderLink` 路径，恢复 v0.2.95 之前的 link 视觉（一个 `<a href="chrome://apps">` 的链接样式）。**根因纠正**：v0.2.108 诊断错了——「拖 link header 触发整列拖」不是因为 link 没 draggable，而是 v0.2.108 之前的某个改动让 Apps 走了非 draggable 的 header 元素。实际上 `<a href>` HTML5 默认 `draggable=true`，拖 link 时浏览器不向上 bubble 到 column 的 dragstart，link 自身成为 drag subject，无需任何特殊路由。`v0.2.109` 的 `folder.ts` 顶部 `node.type === 'apps'` 特殊分支保留作为 dead-code 防御性 short-circuit（万一未来再误路由到 renderFolder，click 仍跳 `chrome://apps`）；`link.ts:91` 的 `openLink` export 同样保留无害。

## [0.2.109] - 2026-06-22

### Changed
- **Apps 特殊 folder 点击行为回到 v0.2.95 之前：点击 header 直接跳 `chrome://apps` 整页**。v0.2.108 修拖拽时把 Apps 路由进 `renderFolder`（`column.ts:104`），header 看起来是 folder 但 `getSubTreeStub('apps')` 没有 `children` 字段 → 展开后是空 folder（`< Empty >` 占位）。v0.2.109 修正：保留 folder 视觉（folder icon + 可单独拖拽 + 参与列布局），但点击和 Enter 走 `link.ts` 的 `openLink('chrome://apps', newtab)`，跟 `chrome://` bookmark 链接完全一致——尊重用户「打开链接方式」设置（当前标签 / 新标签 / 后台标签），Ctrl+click 强制后台。`enableDragFolder` / `auxclick`（中键 no-op）/ context menu（右键菜单）行为不变。`link.ts:91` 的 `openLink` 改 export 给 `folder.ts` 共用。
- 不走「用 `chrome.management.getAll()` 填入真实应用列表」路线：需要新增 `management` 权限（Chrome 弹权限 dialog）、`getSubTreeStub` 同步转异步会级联到 `column.ts:50-89` `renderColumn` 整条调用链、`appLaunchUrl` 经常是 `chrome-extension://<id>/_generated_background_page.html` 这种不适合直接当 link 打开、新增/删除应用时需要 refresh。综合复杂度高，且用户实测不需要——点击 header 跳 `chrome://apps` 是 HNTP 原始行为且足够直观。

## [0.2.108] - 2026-06-22

### Fixed
- **Apps 特殊 folder 不支持单独拖拽：拖它的 header 触发整列 column 拖拽**。根因在 `src/features/bookmarks/column.ts:73` 的 `renderNode`：判定 folder vs link 走 `if (node.children)`。`getSubTreeStub('apps')` 返回的 stub（`special-folders.ts:64`）结构是 `{ id: 'apps', title: 'Apps', type: 'apps', url: 'chrome://apps' }`——**没有 `children` 字段**（Apps 是 `chrome://apps` 页面，不是书签容器），所以走 `renderLink` 分支→不调 `enableDragFolder`→Apps header 不可拖；拖 Apps header 落进 column 的 draggable region（`drag-column.ts:14` `columnDiv.draggable = true`）→ 整列拖。其他 4 个 special folder（top/recent/closed/devices）的 stub 都有 `children: []`，走 renderFolder → enableDragFolder → 单独拖；只有 Apps 例外。修：`renderNode` 加 `node.type === 'apps'` 显式路由到 `renderFolder`。Apps 走 `renderFolder` 后 header 调 `enableDragFolder`，成为可单独拖的 folder。action 图标走 `folder.ts:63` 的 `node.children?.length ?? 0 = 0` 分支，无 children 时不显示 action（符合 Apps 不是书签容器的语义）。

## [0.2.107] - 2026-06-22

### Changed
- **layout 导出/导入现在包含特殊文件夹 ID（`apps` / `top` / `recent` / `closed` / `devices`）**。v0.2.106 走的是「全部剥掉、verifyColumns 按当前 show* 补回」路径，问题是用户精心把 `top` / `apps` 拖到特定列、特定位置的布局会丢失。v0.2.107 反转策略：**保留**这些 ID，import 走 `saveLayout → verifyColumns`（`layout-ops.ts:80-127`）按当前 `showTop / showApps / ...` 开关过滤**可见性**（不显示的折叠进背景），但 `coords` map 仍写入 `coords['top'] = ...`，所以用户日后开 `showTop=1` 立即回到原位置，**不会**被 verifyColumns 弹到默认的特殊列。跨环境：B 拿 A 的 JSON，`showTop=0` 则 `top` 不显示；B 自己开 `showTop=1` 时按 A 导出的位置插入。
- **「包含布局」checkbox 默认取消勾选**。v0.2.106 默认勾选（「重装/换设备/换 profile 时一键完整恢复是最常见用法」），v0.2.107 改回默认不勾——特殊文件夹位置已包含在导出里是用户用得上的功能，但 layout payload（每列 folder 顺序 + movedOut map）仍然不算「偏好设置」，对单纯想备份设置的用户是大量冗余数据。默认不勾让「导出设置」按钮保持「导设置」的语义；需要完整恢复的用手动勾选。

### Fixed
- **「包含布局」checkbox 文字与勾勾垂直方向不对齐**。v0.2.106 把 `<input>` + `<label>` 直接放进了通用的 `.sp-actions` row，inline 元素走 text baseline，box 浮在顶部、label 落 baseline，差几像素。v0.2.107 单独建 `.sp-export-options` 容器，`display: flex; align-items: center; gap: 8px`，并加 `cursor: pointer; user-select: none` 到 label 上。位置锁定到 box 中心 + 文字 baseline（flex 默认 stretch 改 center 后两轴都光学居中）。

## [0.2.106] - 2026-06-22

### Added
- **高级 tab 导出 settings JSON 时可包含布局（列布局 + 嵌套隐藏可见性）**。导入侧自动检测 `layout` 字段恢复，**完全可撤销**。解决用户「想快速恢复之前组织的书签位置」的需求。
  - **UI**：导入/导出按钮下方新增独立一行 checkbox「包含布局（列布局 + 嵌套隐藏可见性）」，**默认勾选**（用户验证：重装/换设备/换 profile 时一键完整恢复是最常见用法）。
  - **导出**：checkbox 勾上时，payload 顶层多一个 `layout: { columns, movedOut }` 字段：
    - `columns` = 当前 `getColumns()`（`chrome.storage.local` 里的 `Columns: string[][]`）
    - `movedOut` = `getMovedOut()`（`MovedOutMap: Record<parentId, childId[]>`，嵌套子文件夹从父级隐藏出去的可见性记录）
    - **特殊文件夹 ID**（`apps` / `top` / `recent` / `closed` / `devices`）从 `columns` 和 `movedOut` **两侧**都剥掉——导出文件对 `showTop / showApps / ...` 开关是环境无关的，导入后这些特殊列由 `verifyColumns` 按**当前**的开关状态自动补出来。
  - **导入**：检测到 `imported.layout` 字段就触发 layout 恢复（**不读 UI checkbox**——是 JSON 内容决定，不是 UI 状态；pre-v0.2.106 文件无 `layout` 字段被正确识别为 settings-only）：
    1. 同样剥掉 `MOVED_OUT_SPECIAL_IDS`（防止异环境 force-enable 特殊文件夹）
    2. `captureSnapshot()` 取当前 (columns + movedOut) → `pushSnapshot()` 压进撤销栈——用户可点撤销按钮回到 import 前的 layout（沿用 `history.ts:28 HistorySnapshot` 形状，`undo-button.ts:78` 已经按这个形状走）
    3. `setColumns(next)` + `setMovedOutCache(next)` 写模块级 cache
    4. `Promise.all([saveLayout(), setLocal('movedOut', next)])` 持久化到 `chrome.storage.local`
    5. `renderColumns()` 强制全板重渲染，让已展开的 folder 立即按新 movedOut 重新 filter
  - **安全边界（关键）**：layout 导入**只动 newtab 显示**——`saveLayout` → `verifyColumns` 只走 `setLocal` + `renderColumns` + `isSpecialVisible`，**绝不调 `chrome.bookmarks.*` API**。`columns` 里已经删除的书签 ID 在 verifyColumns 里按当前 `chrome.bookmarks.getTree()` 快照自动剔除。`movedOut` 里的失效 ID 无害（`filterChildren` 看不到的 parent 当作没记录），无需清理。用户 Chrome 书签树本身**永不**被 export/import 流程修改。

### Notes
- `payload.layout` 只在勾上 checkbox 时出现；不勾则 settings JSON 形状与 v0.2.105 完全相同（forward-compat）。
- 导入 layout 部分 try/catch 包裹：失败（columns 解析错 / 数组不规整）走 `console.warn` 跳过，**不让一个损坏的 layout 阻塞 settings 主体导入**。
- `special-folder stripping` 走单一来源——`moved-out.ts:12` 导出的 `SPECIAL_IDS` 常量，导入/导出两侧共用，避免重复定义。

## [0.2.105] - 2026-06-22

### Fixed
- **导入 settings 后 `darkMode` 变化不生效，必须刷新才能看到新 dark mode**。根因在 `src/features/settings/apply.ts:483` 的 `chrome.storage.onChanged` 监听器：原本只检查 `newValue.theme !== oldValue.theme` 决定是否调 `applyTheme(newValue.theme)`，没考虑 `darkMode` 变化。但 `<html data-theme>` 属性的实际值由 `applyTheme → resolveTheme(baseTheme, darkMode)` 计算（`dark` 时变 `<base>-dark`，`light` / `system→light` 时变 `<base>`），所以 `darkMode` 变化时也必须重跑 `applyTheme` 才能刷新这个属性。`applySettingsToDOM` 只重写 5 颜色和 dynamic styles，不碰 `data-theme`，所以监听器跳 `applyTheme` 时整个 DOM 卡的旧值必须等刷新。修：把判断条件扩成 `theme` 或 `darkMode` 变化都触发 `applyTheme`，并新增注释说明 darkMode 这条路径的来由。手改 `darkMode`（`appearance-toggle.ts:60`）走的不是这条监听器所以原本正常；v0.2.104 起的 import 路径只走 `updateSetting` + onChanged 链，所以浮出来了。

## [0.2.104] - 2026-06-22

### Changed
- **高级 tab 导出的 JSON 不再包含 10 个 per-theme appearance 字段**。这 10 个字段（`font` / `fontSize` / `fontWeight` / 5 个 palette 颜色 / `shadowBlur` / `highlightRound`）自 v0.2.97 起已迁到 `themeOverrides[themeId][mode]`（per-theme per-mode 存储桶，v0.2.102 又把 `customCss` 加进去），全局 settings 里再保留这些值只会误导（它们实际只对当前主题 + 模式生效）。导出时按 `PER_THEME_APPEARANCE_KEYS` 集合过滤；`themeOverrides` 桶和所有非 appearance 设置（theme / darkMode / 布局 / 列宽 / align / 等）原样导出。
- **高级 tab 导入时静默丢弃这 10 个 per-theme 字段**。与 v0.2.102 删 `css` 字段同路径：只接受 `getDefaults()` keys 中**且不在** `PER_THEME_APPEARANCE_KEYS` 中的字段。即便用户导入了 pre-v0.2.104 文件里残留的 `font` 等键，也不会污染全局 settings。`themeOverrides` 桶本身继续按 `Settings.themeOverrides` 类型透传。

### Added
- **`CustomThemeEntry.sourceUrl?: string` 字段**（`src/features/themes/custom-themes.ts`）。URL 安装路径（设置面板「自定义主题」tab 顶部"导入自定义主题"）在 `runThemeValidation` 检测到 URL 输入时，validation tuple 多返回一个 `sourceUrl: string`（保留**用户原始粘贴**的 URL，不走 SW normalize 后的 JSON URL），Apply handler 调 `installCustomTheme(entry, { sourceUrl })` 把它持久化到 entry 上。CSS paste 路径不传，entry 上 `sourceUrl` 保持 `undefined`。同一主题从 URL → CSS paste → URL 三次再安装时，最后一次的 URL 覆盖（最直觉）。
- **高级 tab 导出 `customThemes: [{ name, url }]` 数组**。从 `chrome.storage.local.customThemes` 读出所有 entry，把有 `sourceUrl` 的挑出来按 `{ name, url: sourceUrl }` 序列化到导出文件顶层。**CSS paste 主题无源 URL 跳过**，并在 alert 提示「已导出 N 个 URL 主题；另有 M 个 CSS 主题因无源 URL 而未导出」——避免静默丢失用户主题。空数组仍然发出 `customThemes: []` 字段（forward-compat）。
- **高级 tab 导入重装 URL 主题**。新加 `imported.customThemes: Array<{ name?, url }>` 处理块：每个 entry 走和手动安装 URL 主题一样的 `detectTweakcnUrl → toTweakcnJsonUrl → sendMessage('fetchThemeJson') → JSON.parse → validateThemeJson → installCustomTheme(entry, { sourceUrl: url })` 流程；`name` 字段（如果存在）覆盖 JSON 里的 `name`（与手动 URL 路径一致）。失败（URL 非法 / fetch 失败 / JSON parse 失败 / validate 失败 / install 失败）走 `console.warn` 跳过，**不**让一个坏主题阻止整个导入。所有装完之后重 inject `<style id="custom-themes">` 让新主题立刻可用。

### Notes
- `installCustomTheme` 签名扩展：`installCustomTheme(entry, options?: { sourceUrl?: string })`（`src/features/themes/custom-themes.ts:343`）。CSS 路径的所有现有调用点不传 2nd 参数（仍然兼容），URL 路径的 Apply handler（`src/newtab/settings-panel.ts:1537`）传 `sourceUrl` 字符串。
- `runThemeValidation` 返回类型从 `Promise<ValidationResult>` 改为 `Promise<{ result: ValidationResult; sourceUrl: string | undefined }>`（`src/newtab/settings-panel.ts:1368`）。所有失败分支（URL 形状错 / fetch 失败 / JSON parse 失败 / CSS 缺 name / CSS parse 失败）都返回 `{ result: { ok: false, ... }, sourceUrl: undefined }`，让 Apply handler 的 `if (!result.ok)` 分支保持原样。
- import 走的是用户原始粘贴的 URL（不是 SW 内部 normalize 后的 `/r/themes/<id>` JSON URL），所以 `detectTweakcnUrl` 会检测为 `'theme'` kind 并 `toTweakcnJsonUrl` 重新 normalize，逻辑闭合。
- import 失败策略：单条 `console.warn` 后 continue；导入 settings 主体不受影响（已经在 import 上半段 `updateSetting` 写完）。`renderContent` 在最后统一重渲染，所以新装的 theme 会出现在下拉框 + 「自定义主题」列表里。

## [0.2.103] - 2026-06-22

### Fixed
- **外观 tab 切换主题/暗色模式时 per-theme per-mode "自定义 CSS" textarea 不刷新**（v0.2.102 引入的回归）。`refreshInputsFromSettings` 里的 `PER_THEME_KEYS` 循环会刷新 10 个镜像 `keyof Settings` 的 per-theme 字段（font / fontSize / ... / highlightRound），但 `customCss` 不是 `keyof Settings`（全局 `Settings.css` 已在 v0.2.102 删除），所以漏在循环外。切到 (theme B, light) 后 textarea 仍显示 (theme A, light) 的 CSS，看起来「卡住」。现在循环后追加一段：
  ```ts
  const customCssEl = document.getElementById('sp-perTheme-customCss') as HTMLTextAreaElement | null;
  if (customCssEl) {
    const next = readPerThemeCustomCss();
    if (customCssEl.value !== next) customCssEl.value = next;
  }
  ```
  change 事件仍走 `writePerThemeCustomCss`，读写路径一致。

## [0.2.102] - 2026-06-22

### Added
- **外观 tab 末尾追加"自定义 CSS"（per-theme per-mode）**。新加 `themeOverrides[themeId][mode].customCss` 字段（`src/features/bookmarks/types.ts:ThemeModeOverrides`），跟其他 10 个 per-theme per-mode 字段（font / fontSize / ...）走同一份存储桶和解析路径。UI 是 `<details>` 折叠区最下面的 `<textarea id="sp-perTheme-customCss">`，配 `↩` revert 按钮。change 事件写 `themeOverrides[currentBaseTheme()][currentMode()].customCss`，`storage.onChanged` 触发 `applySettingsToDOM` → `rebuildUserThemeCss` 实时把内容写进 `<style id="user-theme-css">` 节点——填完即生效，无需刷新。
  - 注入位置：`<head>` 里 `<style id="dynamic-styles">` 之后；cascade 优先级高于主题内置样式，需要进一步 override 时用 `!important`。
  - 切主题 / 切 dark mode 时 CSS 自动跟着切到对应 bucket；留空 = 不注入，主题默认样式透出。

### Removed
- **高级 tab 的全局"自定义 CSS" textarea**。`<textarea id="sp-css">` + `Settings.css` 字段 + `LEGACY_KEY_MAP` 的 `customCSS` 条目 + `rebuildUserCss()` + `<style id="user-css">` 节点全部移除。所有 CSS 走 per-theme per-mode 路径，不再有「全局 CSS」概念。
- **高级 tab 的导入过滤**。导入设置 JSON 时只接受当前 `Settings` shape 里存在的 key；pre-v0.2.102 导出的 `css` 字段会被静默丢弃（已迁移到 `themeOverrides[currentTheme][currentMode].customCss`，无需再导入）。

### Fixed
- **v0.2.102 升级时自动迁移老用户的全局 CSS**。`initSettings` 在 settings 加载完成后调 `migrateLegacyGlobalCss(merged)`：
  1. 读取已存 settings 上的 `css` 字段（已不在 `Settings` 类型里，所以走 `getSync<unknown>` + cast）
  2. 读取 bare `customCSS` 键（pre-unified 时代遗留）
  3. 取两者中非空的那份（unified 优先），解析当前 `(theme, mode)` bucket
  4. 写入 `themeOverrides[theme][mode].customCss`
  5. `delete next.css` + `removeSync('customCSS')` 清源
  - 老用户的 CSS 不会丢，会落到他升级时刻的 (theme, mode) bucket 里。

### Notes
- `Settings.css` 从 `Settings` 接口删除（`types.ts:Settings`）。`Settings.themeOverrides` 的 type 仍走 `chrome.storage.sync`（用户预算 100KB 充足；8 主题 × 2 模式 × 平均 3KB CSS = 48KB）。
- `applySettingChange` 删除 v0.2.101 的 `if (key === 'css') { rebuildUserCss(); }` 分支；`themeOverrides` 改变时除了 `rebuildDynamicStyles` 还多调一次 `rebuildUserThemeCss`，让 per-theme CSS 在 `themeOverrides` 改变后立刻跟到新 bucket。
- `ThemeModeOverrides` 是 `Partial<Pick<Settings, 10 keys>> & { customCss?: string }`：`customCss` 是这个 bucket 里唯一**不**镜像 `Settings` 全局 key 的字段——全局 `Settings.css` 移除后它没有 fallback。

## [0.2.101] - 2026-06-22

### Changed
- **Folder 三个小图标（open all links / open as group / open in split view） tooltip 改用 CSS-only 方案**。原来直接 `btn.title = '...'` 走浏览器原生 `title` 提示框，需要鼠标 hover 约 500ms-1s 才显示，三个小图标小（22×22）又位于半透明 (.folder-actions opacity:0.5) 容器内，体感上「经常没反应」。新方案照搬 v0.2.88 在 `.sp-appearance-toggle-btn` / `#options_button` 上落地的 `::after` 伪元素 + `attr(title)` 模式：CSS 层面 0 延迟出气泡，浏览器原生 `title`（无障碍 + 屏幕阅读器）继续保留。
  - 影响：hover 三个图标瞬间出 tooltip 文字。
  - 气泡背景 `var(--muted)` + 文字 `var(--muted-foreground)` + 1px `color-mix(--muted-foreground 25%, transparent)` 描边，跨主题视觉一致。z-index 1000 拉到 sp-overlay (110) / sp-panel (120) / split-picker (130) 之上。
  - 父级 `.folder-actions` `opacity: 0.5` 会级联影响 `::after`，气泡显式 `opacity: 1` 重置保持不透明。

### Fixed
- **Folder 三个小图标 hover 背景色与部分主题外观模式不兼容**。`.folder-action-btn:hover` 原来用 `var(--newtab-highlight)`——这个是用户可调的高亮色（v0.2.97 per-theme per-mode 化后，覆盖值随主题 + 暗色模式走），某些主题 + 自定义 highlight 组合下 hover 背景与图标前景对比度差。改为 `var(--muted)`（shadcn 约定的「subdued surface」），跨主题读起来都是统一中性灰。
- **Folder 三个小图标点击行为无法响应设置中的「打开链接方式」**。`openAllLinks` / `openAsGroup` / `openSplit` 三个 handler 原本硬编码 `createTab(url, false, ...)`，全部以 background 形式打开，无视 `Settings.newtab`。现在三个 handler 接收 `MouseEvent` 参数，`resolveNewtabMode(event)` 解析出 `0|1|2` 后按模式分发：
  - **mode 0（当前标签页）**：`openAllLinks` / `openAsGroup` 把第一个 URL 用 `chrome.tabs.update` 替换当前 tab，剩下的 URL 用 `createTab(_, false, ...)` 在后台开；`openSplit` 用 `chrome.tabs.update` 把当前 tab 直接导航到分屏 URL（不走 `splitManager.open` + `active=false` 的「开新后台 tab」路径）。
  - **mode 1（新前台标签）**：所有 URL `createTab(_, true, ...)`。
  - **mode 2（新后台标签）**：所有 URL `createTab(_, false, ...)`（原行为）。
  - 调用方更新：`folder-actions.ts` 给三个按钮的 `click` 监听器传入 `e`；`context-menu.ts` 的 "Open all links in folder" 菜单项合成 `new MouseEvent('click', { button: 0 })` 传入（让右键菜单走的还是用户配置的 newtab，而不是被当作中键强制 background）；`folder.ts` 的 folder header 中键监听器直接传原始 `e`。
- **Folder 三个小图标不支持鼠标中键打开**。现在 `folder-actions.ts` 给三个按钮加 `auxclick` 监听器，`e.button === 1` 时调 handler 并传原始 `e`；handler 内 `resolveNewtabMode` 识别中键 → 强制 `newtab = 2`（background），行为与 `link.ts:renderLink` 一致。`folder.ts` 已有的 header 中键 `openAllLinks` 调用同步传 `e`（之前传的是无参版本）。

### Notes
- `SplitEngine.open` 签名扩展：`open(urls, layout, title?, active?)`（`src/features/split/types.ts:25`）。`active` 默认 `true` 保持向后兼容。`IframeSplitEngine.open` / `SplitManager.open` 透传该参数。`src/popup/app.ts:138` 的 popup 调用显式传 `active=true` 保持原行为（点 popup 的 "Open Split" 永远前台打开）。folder-action 三个 handler 按 newtab 模式动态传。
- `folder-actions-handler.ts` 新增 `NewtabMode` 类型别名 + `resolveNewtabMode(event)` + `openUrlsInNewtabMode(urls, mode)` 辅助函数。三个 handler 内部按 mode 分支处理 `mode === 0` 的「第一 URL 替换当前 tab」特殊路径。

## [0.2.100] - 2026-06-21

### Fixed
- **阴影颜色 picker 改色后 input 又变回原色（display bug）**。v0.2.99 修了 #rrggbb 格式报错后浮出：per-theme `shadowColor` 的 picker 通过 `sourceKey = 'highlightColor'` 间接从 `highlightColor` storage 桶读值，但 `apply.ts` 写 `--newtab-highlight` 时 `writeResolvedColor('shadowColor', ...)` 是最后写（last-write-wins），所以 storage 的 `shadowColor` 桶是新值、`highlightColor` 桶是旧值。`refreshInputsFromSettings` 重读 picker 时拿到的是 highlightColor 桶的旧值 → 显示旧色。`applySettingsToDOM` 已经把 `--newtab-highlight` 覆盖为新色，但 picker 显示的是错值。
- **阴影颜色与高亮颜色 picker 同步修改（design bug）**。根因是 `shadowColor` 与 `highlightColor` 共享 CSS 变量 `--newtab-highlight`（v0.2.45 hover-glow 时期遗留，glow 在 v0.2.53 移除后别名没拆）：box-shadow 颜色和 folder / menu / undo 按钮 hover 背景都走同一个 var，导致改 shadow 会静默改这些 UI 元素的背景。修：拆开。

### Changed
- **拆 `shadowColor` 与 `highlightColor` 的 CSS 变量共享**（v0.2.45 hover-glow 时代遗留）。新增 `--newtab-shadow` CSS 变量（`styles/globals.css:97`，默认 `var(--newtab-highlight)` 保持视觉兼容），`apply.ts` 的 `COLOR_KEYS.shadowColor` 从 `'--newtab-highlight'` 改为 `'--newtab-shadow'`，`rebuildDynamicStyles` 的 box-shadow 规则改用 `var(--newtab-shadow, var(--newtab-highlight))` chained fallback（unset 时回退到 highlight）。`settings-panel.ts` 的 `COLOR_INPUT_CSS_VAR.shadowColor` 同步改为 `'--newtab-shadow'`。
- **移除 `shadowColor` ↔ `highlightColor` 的 sourceKey 镜像**：v0.2.99 起的 `applyUserColorOverride`、`createColorInput`、`refreshInputsFromSettings`（global + per-theme 两处）、`saveSetting`、`saveShadowColorChange`（整函数删除）、全局 ↩ revert、per-theme ↩ revert 里的 `key === 'shadowColor' ? 'highlightColor' : key` 全部去掉。`shadowColor` 现在是普通 5 色 picker，独立读写 `themeOverrides[theme][mode].shadowColor` 和 `--newtab-shadow`。
- **`<details>` 阴影颜色行描述更新**（`settings-panel.ts:1086`）：从 "与"高亮颜色"共享同一 CSS 变量，修改会自动同步到高亮颜色" 改为 "默认与"高亮颜色"相同（共用同一色调），可独立设置为不同颜色"。

### Migration
- **对已有用户无破坏**：新装的 `--newtab-shadow` 默认 `var(--newtab-highlight)`，未设置 shadowColor 的用户视觉无变化（box-shadow 还是 highlight 色）。
- 之前通过 `saveShadowColorChange` 镜像写入的 `themeOverrides[theme][mode].highlightColor` 值（即"间接设过 shadowColor"的用户）会在下次 `applySettingsToDOM` 时被独立解析为 highlightColor 自己的值，shadowColor 桶如果是空则保持空 → 视觉上 highlight 色不变；如果用户曾显式设过 shadowColor 桶的值，现在会真的控制 box-shadow 颜色（之前是被 highlight 桶覆盖而看不出效果）。

## [0.2.99] - 2026-06-21

### Fixed
- **改色时 `<input type="color">` 报 "does not conform to '#rrggbb'"**（v0.2.97 引入 per-theme per-mode 后首次暴露）。根因：5 个调色板字段（`backgroundColor` / `fontColor` / `highlightColor` / `highlightFontColor` / `shadowColor`）的默认 storage 值是 `''`（"无 override，用主题色"），v0.2.97 之前的 `resolveCssColor('')` 也返回 `''`——这个空串被直接赋给 `<input type="color">.value`，浏览器拒绝。报错出现在 `newtab-*.js:5:8475` 之类的 asset 路径，因为是 v0.2.97 引入的"打开面板 / 切换主题"路径频繁触发（`createColorInput` 渲染 + `refreshInputsFromSettings` 监听 + 4 处 `input.value = ...`）。
  - 修：新增 `resolveColorForInput(key, stored)` 辅助函数（`src/newtab/settings-panel.ts:332`）。三层回退保证永远返回合法 `#rrggbb`：
    1. stored 非空 → 走原 `resolveCssColor`（处理 `var()` / `color-mix()` / oklch 等）
    2. stored 为空 → 从 `<html>` 读对应的 `--newtab-*` CSS 变量（`COLOR_INPUT_CSS_VAR` 映射），用当前真正渲染到屏幕的颜色——既满足 picker 的 `#rrggbb` 格式要求，又让用户看到的是主题色而不是误导性的黑白占位
    3. 极端兜底 `#000000`（CSS var 也为空时）
  - 替换 5 处 `input.value = resolveCssColor(...)` → `input.value = resolveColorForInput(...)`：`createColorInput`、global `refreshInputsFromSettings`、per-theme `refreshInputsFromSettings`、per-theme revert、全局 revert。
  - 全局 ↩ 按钮特殊处理：palette 字段 revert 写入的是 `''`（清 override），但 `saveSetting` 会从 `input.value` 反读——直接走 `updateSetting(key, '')` + 同步用 helper 刷 picker，避免 `saveSetting` 把"helper 渲染的 hex"误存进 storage（那会变成显式 override，跨主题切换时不会跟着主题走，破坏"revert = 用主题色"语义）。`shadowColor` revert 走 `saveShadowColorChange('')` 同步清 `highlightColor`。
  - 影响：5 个颜色 picker 在 storage 为空时（全新安装 / 之前没改过颜色的用户）不再报错；picker 显示的就是当前主题色，用户编辑时看到的是他们真正在改的东西。

## [0.2.98] - 2026-06-21

### Changed
- **字号全局默认值 18 → 16**（v0.2.97 把 `fontSize` 改成 px 直接存后，18 显得偏大、视觉上压过 newtab 整体层级；16 是中性默认，更贴近 OS / Chrome zoom 基线）。同步把 `16` 从 `PRIOR_FONT_SIZE_DEFAULTS` 迁移集里移除（已经是新默认值，不再算「需要升级的旧值」）；`getDefaults()`（settings-panel.ts）和 `resolveEffectiveSettings()`（apply.ts）的 `?? 18` 兜底也改为 `?? 16`。**per-theme override 不受此影响**——已经在 `themeOverrides[theme][mode].fontSize` 写过的用户值原样保留。
  - 影响范围：全新安装 / 之前未手动调过字号的用户的初始值。其他用户不受影响。

## [0.2.97] - 2026-06-21

### Changed
- **外观 tab 的 10 个选项 per-theme per-mode 化**：字体 / 字号 / 字重 / 5 颜色 / 阴影模糊 / 高亮圆角 全部支持「当前主题+外观模式」独立覆盖，不再全局共享。新增 `Settings.themeOverrides: Record<themeId, { light?: Partial<Settings>; dark?: Partial<Settings> }>` 存储桶（存在 `chrome.storage.sync`，跨设备同步）。
  - 外观 tab 加 `<details>` 折叠区承载 per-theme 选项；首次进入默认展开，之后记忆开/合状态（`localStorage['newtab01.appearance.themeOverrides.open']`）。
  - 切换主题 / 暗色模式，这 10 个 input 的 value 自动从对应桶读（`themeOverrides[newTheme][newMode]?.key ?? Settings.key`）；切换瞬间 DOM 也跟着重算（`applySettingsToDOM` → `resolveEffectiveSettings`）。
  - 10 个 input 的 revert（↩）按钮改为「清除当前主题+模式的 override」，不会动全局值。
  - 主题 + 暗色模式 + 宽度 + 水平位置 仍然全局，不在覆盖范围。
- **高亮圆角单位从 em scale 改为 px**：旧实现是 `#main a { border-radius: ${scale(highlightRound, 0.2, 1.5)}em }` 直接覆盖；新实现写 `--newtab-link-radius: ${highlightRound}px` 到 `:root`，配合 `newtab.css:105` 的 `var(--newtab-link-radius, calc(var(--radius) - 2px))` fallback。**用户填 0 时不 emit 该 CSS 变量，主题 .rounded-md 自动生效**；填 N → 强制 Npx。
  - input 默认值 = 当前主题 `calc(var(--radius) - 2px)` 的 px 值（Codex = 4px，MX-Brutalist = 0px），用户能直接看到主题的派生圆角。
  - 旧版 `highlightRound=1` 迁移到 `0`（保持 v0.2.96 之前的 em-scale midpoint 视觉等效）。
- **字号改为 px 直接存**（顺手修不生效调查路径）：旧 `${fontSize / 10}em` 改为 `${fontSize}px`。Devtools 之前显示 1.8em（`fontSize=18` 默认），改后直接显示 18px，跟 input 数值一致，便于排查覆盖源。

### Notes
- `Settings.themeOverrides` 字段对老用户默认 `undefined` → 全部 10 项 fall back 到全局值，行为兼容 v0.2.96。`initSettings` 迁移只针对 `fontSize` 和 `highlightRound=1 → 0`，`themeOverrides` 不需要迁移。
- `applySettingsToDOM` 内部新增 `resolveEffectiveSettings()` 解析器，storage.onChanged 触发时一并重算；listener 路径未改。
- `applyTheme` (themes/switcher.ts) 末尾追加 `rebuildDynamicStyles()` 兜底，防止 listener 接走时漏算 dynamic-styles。
- `removeCustomTheme` 同步清除 `themeOverrides[deletedThemeId]`，保持 storage 干净。
- 字号 13.5px (= 18 × 0.75) 根因未在本 PR 复现；改 px 后如果用户仍看到 13.5px，怀疑点是 Chrome 浏览器缩放（`chrome://settings` → Page zoom）或 `#main` / 祖先有 font-size 75% 覆盖。排查：devtools 选中 `<a>` → Computed → font-size 是不是 18px，不是就往上找覆盖源。

## [0.2.96] - 2026-06-20

### Fixed
- **apps 在「后台新标签」下打开两个后台标签页**（v0.2.95 修复 string→number 后暴露的次生 bug）。根因：`features/bookmarks/link.ts` 之前对 chrome:// / file:// URLs 同时走了「generic newtab 分支」+ 「chrome:// 分支」两套 click handler。`newtab === 2` 时 generic 分支加了一个 `addEventListener('click', ...)`，chrome:// 分支又加一个；同一 click 触发两个 handler → `openLink(url, 2)` 调两次 → 两个后台 tab。`apps` 的默认 launchUrl 是 `chrome://apps` 所以踩中。
  - 修：把 `urlStart` 提到前面提取并算 `isChromeOrFile` boolean，generic newtab 分支（`a.target = '_blank'` 和 `addEventListener('click', ...)`）用 `if (!isChromeOrFile)` 跳过，chrome:// 分支保留。chrome:// / file:// URL 一律只走专用 click handler（`<a target="_blank" href="chrome://...">` 在扩展 newtab override 里不可靠，必须走 `chrome.tabs` API，所以让专用 handler 全权处理是对的）。
  - 行为：`newtab=0/1/2` 对 chrome:// URL 全部通过 `openLink` → `createTab` / `updateTab` 走 chrome.tabs API，不会再双开。

## [0.2.95] - 2026-06-20

### Fixed
- **「打开链接方式」实际生效**（v0.2.94 只把 `newtab` 加进 `RERENDER_KEYS`，没有修真正根因）。根因：`saveSetting` 提取 `<select>` 值时直接 `value = input.value`（string），但 `Settings.newtab` 声明为 `number`，所以 `getSetting('newtab')` 返回 `'0'/'1'/'2'`（string），`link.ts` 的 `newtab === 1` 严格比较永远 false，结果「打开链接方式」三个选项全部无效果（默认 0 时与原行为一致，但 1/2 都退化为「不变」）。
  - 修 1：`src/newtab/settings-panel.ts:saveSetting` 提取 value 后调 `coerceToSettingType(key, value)`，reference 当前存储值（默认 number），若是 number 就 `Number(value)` 规整；同步处理 boolean 字段（虽然当前 checkbox 路径已转 0/1，留作防御）。
  - 修 2：`src/lib/storage/settings.ts:initSettings` 加 `coerceNumberSettings()` 一次性迁移：扫描 storage 里所有「defaults 是 number 但 stored 是 string」的字段，rewrite 并 `setSync()` 写回。处理 v0.2.94 及之前已经存进去的脏值（用户即使没重新打开面板，下次启动也会自动修复）。
- **应用（apps）跟随「打开链接方式」设置**：apps 的 URL 走 `chrome://apps` / `appLaunchUrl`，命中 `link.ts:58-70` 的 chrome:// 分支，调 `openLink(url, newtab || (e.ctrlKey ? 2 : 0))`。修 1 之后 `newtab` 是 number，openLink 的 `if (newtab)` + `createTab(url, newtab === 1, ...)` 都正确分流。
  - 选 0（同一标签）：`updateTab` 把当前 newtab 跳到 app（chrome:// 协议在 newtab override 里能跳）。
  - 选 1（前台新标签）：`createTab(url, true, tab.id)`。
  - 选 2（后台新标签）：`createTab(url, false, tab.id)`。
  - 之前因为 string 误判 `newtab === 1` 永远 false，apps **总是**走 `createTab(url, false, ...)`，表现为「永远后台」，符合用户反馈「应用页面现在是新建后台页面的方式打开的」。

## [0.2.94] - 2026-06-20

### Fixed
功能 tab 选项 bug 修复（基于 [docs/选项测试记录.md](./docs/选项测试记录.md) 「新增」段落）。branch：`fix/settings-options-bugs`（延续 v0.2.93）。

- **5 个 show* toggle 实际生效**（`showTop` / `showApps` / `showRecent` / `showClosed` / `showDevices`）：根因——`verifyColumns` 只 ADD special ID 到列布局，从不 REMOVE，所以即使 toggle 关闭，special folder 仍存储在 columns 数组里并在每次 re-render 时渲染。
  - 修：把 `SHOW_KEY_MAP` + `isSpecialVisible` 从 `layout-ops.ts` 移到 `bookmarks/special-folders.ts`（避开 layout-ops → board import cycle），让 `column.ts:renderColumn` 和 `board.ts:renderColumns` 都能导入。
  - `column.ts:renderColumn` 用 `rawIds.filter((id) => isSpecialVisible(id))` 在渲染前过滤掉隐藏的 special。layout 存储里仍保留 ID——重新开启 toggle 后 special 在原位置回来。
  - `board.ts:renderColumns` 用 `columns.filter(col => col.some(id => isSpecialVisible(id)))` 过滤整列，避免一整列全是隐藏 special 时渲染成空白 1/N 列 div。
- **number input step 修复**：3 个 count 输入（`numberTop` / `numberRecent` / `numberClosed`）从 `step="0.1"` 改为 `step="1"`。
  - `createNumberInput(key)` 加可选第二参 `step: string = '0.1'`，默认保持 0.1 不影响其他 scale 驱动的 setting（spacing / fontSize / shadowBlur 等）。
  - 3 个 count 行显式传 `'1'`。
- **`newtab`（打开链接方式）加入 `RERENDER_KEYS`**：原 `RERENDER_KEYS` 不含 `newtab`，所以改设置后既有的 `<a>` 元素仍带旧 `target` 属性 / 旧 click handler，必须刷新页面才生效。加 `'newtab'` 后切换会立即触发 `renderColumns()`，新 `<a>` 重新生成。
- **`getDevicesNodes` 错 key 修复**（顺手）：`special-folders.ts:105` 原代码读 `getSetting('numberClosed')`（最近关闭数量）来控制 devices 数量，明显的 copy/paste 残留。改成 hardcode 10（与其他 count default 一致）。如果未来要暴露 `numberDevices` 滑块，在这一行 wire 即可。

### Notes
- 重新开启 show* toggle 后，special folder 在原列原位置恢复（layout 存储未变）。
- 「功能」tab 的「显示根节点」与「布局」tab 的「显示顶层文件夹」是同字段（showRoot）的重复——按 v0.2.93 决策保留，本 PR 不动。

## [0.2.93] - 2026-06-20

### Fixed
设置面板 8 个选项 bug 修复（基于 [docs/选项测试记录.md](./docs/选项测试记录.md)）。所有改动集中在 layout tab 的语义/接线 + 移除多余选项。branch：`fix/settings-options-bugs`。

#### 布局 tab
- **「行间距」修复语义**：原来是写 `#main a { line-height; padding-left/right }`（`apply.ts`），但 label 是「行间距」——视觉上两个相邻 link 之间的间距。改成写 `:root { --newtab-spacing: Xpx }`（specificity 0,1,0 盖过 globals.css 0），cascade 进 `newtab.css` 的 `gap: var(--newtab-spacing)`。scale 0.5/1/1.5 → 4px/10px/20px。link 的 line-height / padding 维持 `newtab.css` 静态 1.4 + `0.45em 0.8em 0.45em 1.2em` 不动。description 同步改为「书签链接之间的垂直间距（行与行之间的距离）」。
- **「垂直边距」移除**：用户反馈「可以移除」。从 `Settings` 类型 + `defaults` + `STYLE_KEYS` + `settings-panel.ts` layout tab + `lib/storage/settings.ts` legacy migration 全链路删。同时 `globals.css` 那个「定义但未消费」的 `--newtab-vmargin` CSS var 一并清掉（CHANGELOG v0.2.79 提过「下个 PR 修」，本 PR 落地）。
- **「对齐方式」实现为生效**：原 `apply.ts` 没消费 `align` 设置（只在 `RERENDER_KEYS` 里，没有对应 CSS 规则输出），切换无反应。改成 emit `#main { text-align: ${align} }`（column 是 `inline-block`，走 text-level flow）。从 `RERENDER_KEYS` 移除 align（不需 re-render，纯 CSS 规则更新）。description 加一句「需配合「列宽」使用（auto 模式下整组列填满整宽，无效果）」提醒用户。
- **「锁定列」接线到右键菜单 + 列拖拽 + 列 drop**：
  - 根因 1：`context-menu.ts` 之前 `const lock = false; // Will be read from settings when integrated`（未集成），所以即使开启「锁定列」，右键仍能看到「Move column / Remove column / Create new column / Remove folder」。改为 `Number(getSetting('lockColumns')) !== 0` 在 right-click 时读。
  - 根因 2：`enableDragColumn` 之前只检查 `getSetting('lock')`，没看 `lockColumns`，所以「锁定列」开启时列头仍可拖。改为同时检查 `lock` 和 `lockColumns`。
  - 根因 3：`drop-handler.ts` 的 `captureAndDrop` 调 `addColumn` 时没看 `lockColumns`，所以拖出多列场景仍能 addColumn。改为在 `addColumn` 分支前置 `if (getSetting('lockColumns')) return;`（`addRow` 不受影响，是列内 reorder 不是列结构变更）。
- **「显示顶层文件夹」接线错误修复**：layout tab 的 toggle 之前绑 `showTop`，但实际渲染走 `getSetting('showRoot')`（`column.ts:21, 32`），所以关掉 toggle 完全无效。改绑 `showRoot`。功能 tab 的「显示根节点」（`settings-panel.ts`）本来就是 `showRoot` 字段，重复了但保留——按用户决策 layout tab 是用户测试时使用的地方，重复项保留为无关改动不动。
- **「锁定拖拽」运行时重新检查**：
  - 根因：`enableDragFolder` / `enableDragColumn` / `enableDragDrop` 都在 `enable*` 调用时一次性 check `getSetting('lock')`，之后设置变更不会重新生效。toggle 后仍可拖一次（因为旧的 dragstart listener 还在），刷新页面后才彻底锁住。
  - 修：在 `dragstart` handler 内部再 `if (getSetting('lock')) { event.preventDefault(); return; }`，`drop-handler.ts` 的 `onDrop` 同理。这样 toggle 设置后**下一次** drag 立即生效，无需刷新、无需 re-render。`lockColumns` 复用同模式在 `dragstart` 重检（与上面「锁定列」修复共用一套代码）。

#### 功能 tab
- **「隐藏设置按钮」移除**：用户反馈「不允许隐藏」。从 `Settings` 类型 + `defaults` + `legacy migration`（`hideOptions` key）+ `settings-panel.ts` 功能 tab + `app.ts:158-161` 的 `if (getSetting('hideOptions'))` 隐藏齿轮的代码全链路删。设置按钮（齿轮）始终可见。
- **「显示搜索栏」移除**：用户反馈「不允许隐藏」。从 `Settings` 类型 + `defaults` + `legacy migration`（`showSearchBar` key）+ `settings-panel.ts` 功能 tab + `topbar.ts` 的 `if (showSearch)` 包装 + `search-main.ts` 的 `if (getSetting('showSearch') === 0) return;` 早返回 + `undo-button.ts` 的 `renderUndoButton(topbar, showSearch)` 第二参数全链路删。搜索栏始终显示（`⌘K` 仍可唤起，是同一 DOM 节点）。顺手把 `search-main.ts` 那个不再使用的 `getSetting` import 删掉。

### Notes
- 所有被移除的 legacy 迁移 key 都不在活跃用户数据里（pre-0.2.30 才有可能出现），实测用户群体 > 99% 都是 0.2.30+ 直接拿 `Settings` 字段。
- `align` 在 `columnWidth: auto`（默认）下无可见效果（整组列填满 100% 宽），需要「列宽」设固定值（如 `200px`）才能看出 left/center/right 的差异。已在 description 里写明。

## [0.2.92] - 2026-06-20

### Fixed
- 在 §0.1 「已弃分支策略」列表里加 `feat/appearance-options-fix`（跟其他冻结分支同等待遇）。merge commit `4618553` 已把 feat 分支同步到 main，`db72b95` 是 feat 分支上 v0.2.91 改动的原始 commit（merge 前的 history 在 `feat/appearance-options-fix` 远程分支完整保留，§0.1 流程）。

## [0.2.91] - 2026-06-20

### Removed
- **「外观」tab 的「滑动时长」「淡入淡出时长」两个 transition 选项 + folder 展开/折叠动画整体移除**。
  - **slide 不生效的根因**：`.wrap` CSS 规则（静态 + 动态）跟 `folder.ts` 的 `wrap.dataset.wrap = ''` 是 class vs attribute 错配，规则从 initial commit 起就是 dead code。同时 `folder.ts:toggleFolder` 走的是 mount/unmount 模式（`wrap.remove()` / `renderChildrenInto()`），CSS `transition: height` 对 mount/unmount 本来就不会触发。即使把 selector 改对，slide 仍然看不见。要让动画真正可见必须在 JS 端改成 height 测值动画（`scrollHeight` → 0 → remove / 0 → scrollHeight → auto），这是个独立的大改动，用户决定不维护这条路径。
  - **fade 同步作废**：slide 移除后 fade 变成"调节 link hover 颜色过渡时长"——是**唯一**还在用的 transition，但作为单点可调参数已无价值（folder 没有动画了，UI 里的 transition 只剩 hover 颜色变化 + drag-start opacity），保留一个可调项让用户徒增困惑。一并移除。
  - **改动范围**：
    - `Settings.slide` / `Settings.fade` 两个字段 + types 移除
    - `slideMs → slide` / `fadeMs → fade` legacy 迁移移除（`settings.ts` LEGACY_KEY_MAP）
    - `styles/globals.css` 的 `--newtab-slide-ms` / `--newtab-fade-ms` 两个 var 移除
    - `styles/newtab.css` 的 `.wrap` 块整段移除（slide）
    - `styles/newtab.css` line 111 `#main a { transition-duration: ... }` 从 `var(--newtab-link-transition-duration, var(--newtab-fade-ms))` hardcode 为 `200ms`（fade）——保留 hover 颜色/bg 平滑过渡但不再让用户调
    - `apply.ts` STYLE_KEYS 去 `'fade'` / `'slide'` + 两段动态规则删除
    - `settings-panel.ts` 外观 tab 删「滑动时长」「淡入淡出时长」两行 + `getDefaults()` 删两个字段
    - CLAUDE.md §9.7 设置项清单去 `fadeMs` / `slideMs`
  - **保留**：`folder.ts` 里 `wrap.dataset.wrap = ''` 不动——JS 内部仍用它 querySelector 找元素做 mount/unmount，只是 CSS 不再针对它设规则。
  - **影响**：folder 展开/折叠回到 instant render（预期行为）；link hover 仍 200ms 颜色/bg 平滑过渡（视觉基础保留）；两个 transition 选项不再出现在设置面板。

### Changed
- **`createNumberInput` 给所有 scale()-驱动 input 加 `step="0.1"`**（shadowBlur / highlightRound / spacing / vMargin / width / hPos / fontSize / fontWeight / numberTop / numberRecent / numberClosed / folderActionConfirmThreshold）。原默认 `step="1"` 让小数（如 0.5 / 1.5）触发 `stepMismatch`，浏览器在 input 上加 `:invalid` 红框 + tooltip 提示"请输入有效值"。虽然 `change` 事件大多数浏览器仍然 fire 且 value 仍是用户输入的字符串，但 UX 明显"这个 input 不接受我要的值"—— 容易让人误以为选项不生效。`step="0.1"` 覆盖所有用户合理的小数取值（scale 函数对 [0, 1, 2] 之外的输入线性外推，所以 0.3 / 1.7 等也合法）。fade / slide 已移除，不再列。

### Fixed
- **`settings-panel.ts` 的 `getDefaults()` 跟 `settings.ts` 的 storage defaults 不一致**（2 处）。
  - `fontSize`：`16` → `18`。`settings.ts` 实际默认是 18（v0.2.55 migrate 后的值），但 `getDefaults()` 返回 16 —— 点设置面板里任一行的「恢复默认 ↩」会把字号重置到错误的 16。
  - 5 个 palette 字段（`fontColor` / `backgroundColor` / `highlightColor` / `highlightFontColor` / `shadowColor`）：`#555555` / `#ffffff` / `#e4f4ff` / `#000000` / `#57b0ff` → `''`。`settings.ts` 注释明确说空字符串是"故意"的——`applyUserColorOverride` 把 `''` 当"no override"调 `removeProperty` 清掉 inline 值，theme palette 重新生效。如果 `getDefaults()` 返回 hex，「恢复默认 ↩」会把 hex 写进 storage 并 apply 为永久 override，**永久覆盖当前主题的对应 palette**——切到新主题时这五个 hex 还会跟着走，破坏主题切换。修复后恢复默认 = 清除 override = 让主题 palette 重新接管，行为跟 `settings.ts` 的语义对齐。
  - 顺手删了误导的注释 `// Re-import defaults from settings module`（实际是手抄副本，从未被真正 re-import），换上一段跟 `settings.ts` 对齐的说明。

## [0.2.87] - 2026-06-20

### Added
- **Topbar 3 段外观 toggle**（亮 / 跟随系统 / 暗）。在设置按钮左边，32px 高（与设置按钮同高），pill 形 segmented control，Lucide `sun` / `zap` / `moon` 图标。**和设置面板「暗色模式」select 双向同步**——读 / 写同一个 `Settings.darkMode`（v0.2.75 single source of truth），不新增字段。topbar 端有独立的 `chrome.storage.onChanged` listener（不依赖 settings-panel 的开/关 listener pair）。点段 → `updateSetting('darkMode', value)` + `applyTheme(theme)` 重算 `data-theme`；从设置面板改 → 收到 storage change → `aria-checked` 同步。
- **5 个 tooltip**（HTML native `title`）：设置按钮 (`设置`，原 `Settings`)、3 个 toggle 段 (`亮` / `跟随系统` / `暗`)、folder header 3 个动作图标（`Open all in tabs` / `Open as tab group` / `Open in split view`，**保留原英文**——已是 tooltip，0 改动，避免范围蔓延）。

## [0.2.88] - 2026-06-20

### Fixed
- **Topbar 5 个元素的 tooltip 在 32px 小尺寸下"几乎看不见"**。v0.2.87 加了 `title` 属性，但浏览器原生 tooltip 是延迟 200ms+ 的灰色小气泡，**在 topbar 右上角 + 32px 按钮**的语境下用户报告看不到。
  - **修复**：新增 CSS-only 自定义 tooltip —— `#options_button` 和 `.sp-appearance-toggle-btn` 元素加 `position: relative`；`:hover::after { content: attr(title); }` 浮一个主题色气泡**立即**显示（无延迟），位置 `bottom: calc(100% + 8px)` 在按钮上方 8px 居中。背景 `var(--newtab-text)` + 文字 `var(--newtab-bg)`，主题切换自动反色。`z-index: 1000` 保证在 topbar (z 100) / sp-overlay (z 110) / 任何 panel 之上。`pointer-events: none` 不挡点击。
  - **JS 0 改动** —— 复用既有的 `title` 属性（CSS `attr(title)` 提取），button 模块也不用知道 tooltip 存在。
  - **Native tooltip 副作用**：Chrome 在桌面端长 hover（~500ms+）可能仍会触发原生 tooltip 作为补充信息；先看到 CSS 自定义气泡，原生后出。用户视觉上是"看到 tooltip"，行为正确。

### Changed
- **Toggle 选中态颜色**：从 `opacity: 0.5 / 1` 改为 `color: var(--muted-foreground) / var(--primary)`。原方案靠明暗区分，用户反馈"选中状态不明显"——浅灰 + 主色（品牌色）对比度比"50% 透明文本 vs 100% 透明文本"明显得多。Unselected hover: `color` 从 `--muted-foreground` 渐变到 `--newtab-text`（仍比 selected 浅），保留 hover 反馈但不破坏 selected 视觉信号。Selected hover: 不变。

## [0.2.89] - 2026-06-20

### Fixed
- **设置按钮位置错乱**（v0.2.88 引入的 bug）。v0.2.88 加的 CSS rule 写了 `#options_button, .sp-appearance-toggle-btn { position: relative; }`，**覆盖了** v0.2.84 给 `#options_button` 设的 `position: absolute`，把齿轮从 topbar 右上角的绝对定位推出，回到 topbar 文档流里错位显示。修复：把 `position: relative` 单独加到 `.sp-appearance-toggle-btn`（之前确实没 position），`#options_button` 不动（它的 `position: absolute` 本身也是 `::after` tooltip 的合法 anchor 上下文）。**完全回归 v0.2.84 的齿轮定位**。
- **Tooltip 在按钮上方显示不全**。topbar 紧贴视口顶，按钮在 topbar 边缘，`bottom: calc(100% + 8px)` 把 tooltip 顶到视口顶部被裁切（或被某些窗口管理器的 URL bar 遮挡）。修复：tooltip 改到**按钮下方** —— `top: calc(100% + 8px)`，落在 topbar 的 16px 下 padding 里 + 8px 间距，安全且不撞视口边缘。

## [0.2.90] - 2026-06-20

### Fixed
- **切换主题时 console 仍然出现 `oklch(...) does not conform to #rrggbb` 警告**。v0.2.86 的 canvas fix 用 `ctx.fillStyle` setter+getter 试图归一化 oklch，但 Chrome/Edge 111+ 的 `fillStyle` getter **保留 CSS Color 4 函数形式**（oklch / oklab / color() / lab）—— 跟 v0.2.86 之前的 `getComputedStyle` 同样的问题，只是换了 getter。`resolveCssColor("oklch(0.9383 ...)")` 实际还是返 `oklch(0.9383 ...)`，regex `^#[0-9a-f]...|^rgba?...` 不匹配，fall through 到 getComputedStyle 也保留 oklch，最终 oklch 字符串到 `<input type="color">.value` 触发警告。
  - **修复**：把 canvas 路径从 "setter+getter 字符串对" 换成 "**setter+fillRect+getImageData**"。Canvas backing store 永远是 sRGB，rasterization pipeline 把任何 CSS 颜色函数强制转 sRGB 像素，`getImageData(0, 0, 1, 1)` 返 sRGB bytes（始终是 `#rrggbb` 形式，无视 fillStyle getter 行为）。这是 html2canvas / dom-to-image 等库通用的"跨浏览器 CSS Color 4 → sRGB" trick。
  - **out-of-gamut 行为**：rasterizer 把色域外的 oklch 裁剪到 sRGB 的 closest representable。视觉差异通常**肉眼不可见**（AstroVista 的 `oklch(0.9383 ...)` 裁剪后 `#eff3f4`），但**始终是合法 hex**。Alpha 暂时忽略（`#rrggbb` 而非 `#rrggbbaa`），当前所有 oklch 值都是 opaque。
  - **影响面**：`applyTheme` / `saveThemeChange` / `refreshInputsFromSettings` / `createColorInput` 全部走 `resolveCssColor`，callers 0 改动。chrome.storage 里残留的 oklch 值在下次切换主题时（触发 `refreshInputsFromSettings`）**一次性自愈**为 hex。
  - **跨浏览器一致**：所有支持 CanvasRenderingContext2D 的浏览器（Chrome / Safari / Firefox / Edge 全覆盖）行为一致 —— 跟 v0.2.86 同样的覆盖范围，但这次是真正 working。

## [0.2.86] - 2026-06-20

### Changed
- **顶栏设置齿轮（`#options_button`）重定位 + 放大**（v0.2.84 / v0.2.85 累积工作，在 main 历史里按时间线合并到 v0.2.86）：
  - **水平位置**：`right: 24px`（绝对像素，~1200px 视口才刚好对齐）→ `right: 2%`（视口宽度的 2%，跟 `#main`（`width: 96%; margin: 0 auto`）的右边沿严格重合）。跨视口宽度（800 / 1280 / 1920 / 2560）都跟下面书签列右边沿对齐。
  - **垂直位置**：`top: 8px`（固定 top offset）→ `top: 50%; transform: translateY(-50%)`。齿轮是 `position: absolute` 脱出 `#topbar` 的 `align-items: center` flex 流，transform 补偿自身高度，视觉中线跟 search bar 对齐。
  - **尺寸**：26×26 → 38×38（v0.2.84）→ 32×32（v0.2.85 用户回退一档）。SVG 18×18 → 30×30 → 24×24。`width/height="24"` 填满 32px 按钮的 4px 内 padding 区域（24 + 4×2 = 32）。
  - **图标**：Feather "settings"（复杂多曲线 path，渲染小尺寸时右下角段视觉错位）→ Lucide "settings"（8 齿圆 + center circle 的标准齿轮形态，单 path 干净）。Lucide ISC 协议。
  - **不**加 border / **不**加 radius（保持 icon button 的语义，跟 search bar 的 input 形态区分开）。0 不动 hover / focus / click 行为。

### Fixed
- **切换主题时 console 大量 `oklch(...)` 不符合 `#rrggbb` 格式的警告**。根因：`switcher.ts:resolveCssColor()` 的"two hops"转换（`probe.style.color = v` + `getComputedStyle().color` 读两次）在 Chrome 111+ 是**假归一化**——CSS Color 4 规范规定 `getComputedStyle().color` 返回原 function 形式（oklch / lab / color() 等），**不**强制转 rgb。两次 read 拿到的是同一个 oklch 字符串，所以 `resolveCssColor("oklch(0.1418 0.0662 295.805)")` 实际返回的还是 `oklch(...)`。这个返回值随后被 `settings-panel.ts:refreshInputsFromSettings()` 直接设到 `<input type="color">.value`，浏览器拒绝非 `#rrggbb` 字符串 → 警告。功能正确是因为 oklch 仍是合法 CSS（作为 inline style 接受），但 input 不显示颜色 picker 选中的位置。
  - **修复**：把 `resolveCssColor` 的主路径从「span + getComputedStyle two hops」换成「**canvas fillStyle**」。HTML Living Standard 强制要求 `ctx.fillStyle = v` 接受任何合法 CSS 颜色（oklch / lab / color() / hsl / named 等），**getter 永远返回归一化后的 `#rrggbb` 或 `rgb(...)`**。这是浏览器内置的、规范保证的 CSS 颜色归一化路径。getComputedStyle 路径保留为 fallback，仅处理 canvas 不接受的 `var(--foo)` / `color-mix(...)`（需要 cascade 解析）。
  - **跨浏览器一致**：所有支持 CanvasRenderingContext2D 的浏览器（Chrome / Safari / Firefox / Edge 全覆盖）行为一致，无需 manifest `minimum_chrome_version` 上调。
  - **影响面**：`applyTheme()` / `saveThemeChange()` / `refreshInputsFromSettings()` / `createColorInput()` 全部走 `resolveCssColor`，所以一次性覆盖所有"显示主题色到 input"和"读 inline style 写 storage"的路径。一次切换主题触发的 N 条警告 → 0 条；同时 storage 里残留的 oklch 值会在下次 `refreshInputsFromSettings()` 触发时**一次性自愈**为 hex。

## [0.2.83] - 2026-06-20

### Changed
- **链接和搜索框默认背景/文字色改为 `--card` / `--card-foreground`**。原方案：链接 bg = `var(--newtab-bg)` (= `--background`，与页面同色)、文字 = `var(--newtab-text)` (= `--foreground`)；搜索框 bg = `transparent`、文字 = `var(--foreground)` —— 链接读起来是"页面本身的延伸"，搜索框读起来是"页面挖空的一块"。新方案：链接 bg = `var(--newtab-link-bg, var(--card, var(--newtab-bg)))`、文字 = `var(--card-foreground, var(--newtab-text))`；搜索框 bg = `var(--card, transparent)`、文字 = `var(--card-foreground, var(--foreground))` —— 两者都落在 tweakcn "card" 这个 shadcn-conventional 的卡片表面，链接 / 输入框读起来都是**独立的 surface**，不再融进页面。
  - **代码改动**：[styles/newtab.css:73](file:///Users/lingsmbp/Documents/aiwork/newtab01/styles/newtab.css#L73) + [styles/newtab.css:103](file:///Users/lingsmbp/Documents/aiwork/newtab01/styles/newtab.css#L103)（`#main a` 的 `color` + `background-color`，3 个属性微调 + 1 段注释更新）+ [styles/newtab.css:428-429](file:///Users/lingsmbp/Documents/aiwork/newtab01/styles/newtab.css#L428-L429)（`.search-input` 的 `background-color` + `color`，2 个属性微调 + 1 段注释更新）。其它代码 0 改动。
  - **chained fallback 的目的**：4 套内置主题（Codex / MX-Brutalist / Cyberpunk / AstroVista）从 v0.2.55 起都在 theme file 里声明了 `--card` 和 `--card-foreground`，所以新方案对内置主题直接生效。但通过运行时导入（粘贴 tweakcn URL / JSON）的**老**主题在 v0.2.55 之前可能没声明这两个 var，CSS var 查询返回无效值，浏览器会回退到下一个 fallback —— `var(--newtab-bg)` / `var(--newtab-text)` / `transparent`（即 v0.2.57-baseline 的行为）。等用户在 v0.2.55+ 重新粘贴一次 URL 之后 `--card` / `--card-foreground` 进入 storage，链接和搜索框就会自动切到 card surface，无需额外操作。CLAUDE.md §0 已记录的"主题化兼容性"问题（runtime import 升级需要重新粘贴）这里天然适配，不引入新的迁移负担。
  - **hover / active / focus / selected / border / shadow 全部不动**。hover 仍然走 shadcn `hover:bg-accent hover:text-accent-foreground`；focus / focus-visible 仍然 `border-color: var(--ring)` + `box-shadow: 0 0 0 3px color-mix(... ring 50% ...)`；selected 仍然 `outline: 2px dotted var(--ring)`。link 的 `--newtab-link-bg` per-theme escape hatch 保留不变，未来 brutalist / glassmorphism 主题想恢复"链接 = 页面 bg" 的视觉效果，只需在 theme file 里写一行 `--newtab-link-bg: var(--newtab-bg);` 即可。
  - **视觉影响**（4 套内置主题）：
    - Codex light (`--card: oklch(0.9761 0 0)`，bg `oklch(1)` → `oklch(0.9761)`，#fff → #f8f8f8)：链接和搜索框由纯白变成非常浅的灰白，与页面 bg 形成**细微但可见**的层级感，靠 1px `--border` 区分
    - Codex dark (`--card: oklch(0.2178 0 0)`，bg `oklch(0.1776)` → `oklch(0.2178)`，#2d2d2d → #383838)：链接和搜索框由接近黑变成稍浅的灰，文字 (`--card-foreground: oklch(0.9911)` = 近白) 仍清晰
    - MX-Brutalist light (`--card: oklch(1.0000 0 0)`，bg `oklch(0.9923)` → `oklch(1.0000)`)：链接和搜索框变成纯白，对比 1px 黑色 `--border` 视觉更锐利
    - MX-Brutalist dark (`--card: oklch(0.2283 ...)`，bg `oklch(0.1649)` → `oklch(0.2283)`)：链接和搜索框变成更亮的灰绿调
    - AstroVista (`--card: oklch(1.0000 0 0)`，bg 是 `oklch(0.9383)` 冷白)：链接和搜索框变成纯白，从冷白页面里"浮"出来 —— 视觉差异最明显
    - Cyberpunk (`--card: oklch(0.2310 ...)` 略浅的紫，bg `oklch(0.1418)` 深紫)：链接和搜索框变成稍浅的紫色

## [0.2.82] - 2026-06-20

### Fixed
- **同一 folder 在收藏夹栏和自定义 column 中的展开状态独立**。修复前从收藏夹栏把 folder A 拖到新 column、展开 A 后刷新页面，收藏夹栏里的 A 也会跟着展开 —— 因为 `folder.ts` 的展开/收起状态以 `chrome.storage.local` key `'open.' + node.id` 持久化，**key 只用 node id 不带 column 信息**，收藏夹栏和自定义 column 共用同一份 storage；当前 session 内 click handler 是 per-DOM 的所以两边 DOM `.open` class 看起来独立，但刷新后两边都从 storage 重读同一 key 就同步了。修复后 key 加 scope：[folder.ts:19-24](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder.ts#L19-L24) 新增 `openKey(nodeId, inBookmarkBarContext)` —— 收藏夹栏内 folder → `open.bar.{id}`，自定义 column 内 folder → `open.col.{id}`。够用是因为 [CLAUDE.md §2.2](file:///Users/lingsmbp/Documents/aiwork/newtab01/CLAUDE.md) 已约束"同一文件夹只能出现在一列中"（[layout-ops.ts:152-164](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/drag-drop/layout-ops.ts#L152-L164) 在 `addColumn` / `addRow` 强制去重），所以一个 folder 至多在「收藏夹栏 + 一个自定义 column」两处出现，两个 scope 足够。`autoCloseSiblings` 路径走的是 DOM `.click()`，会自然复用新的 scope-aware 路径，行为零变化。代码改动仅 [folder.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/folder.ts) 一个文件（1 个 helper + 3 处 set/remove + 1 处 read + 1 处调用方传参），其它代码 0 改动。未做旧 key 迁移（产品未发布，无需兼容旧 storage），旧的 `open.{id}` key 会留为 storage 死数据，KB 量级，不影响功能。

## [0.2.81] - 2026-06-20

### Changed
- **搜索结果栏底部右侧新增「↵ no selection → web search」hint**。明确告诉用户：不选中任何结果直接按 Enter 会用浏览器默认搜索引擎搜当前输入框文本。原 footer 已有 `↑↓ navigate` / `↵ open` / `esc close` 三个 hint，现在把"无选中 → 兜底搜索"这条行为也常驻可见。CSS 用 `margin-left: auto` 把这个 hint 推到 footer 最右，与左侧三个键盘 hint 在视觉上分组（左侧键盘导航，右侧 fallback 行为说明）。窄屏（搜索框宽度 < 4 个 hint 总宽）会自动 wrap 到下一行单独占满。
- **点搜索结果栏内部不再误关**。`#search-results` 容器新增 `mousedown` 监听器：左键（`button === 0`）mousedown 时调 `e.preventDefault()`，阻止默认的 focus transfer —— 这样 input 不会失焦、blur 监听器不会触发、150ms 后 hide 的逻辑不会被错误触发。右键 / 中键不走 preventDefault，保留默认行为（不影响 context menu）。点具体某项仍然正常打开 URL（item 自己的 click handler 仍然 fire，调用 `onSelectCallback → closeAll` 主动清空状态，这是预期行为：URL 已经在新标签页打开了，留着旧搜索状态无意义）。点 overlay（背景层）仍然走 `onClose → closeAll` 路径关闭。代码改动仅 [search-results.ts:20-29](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/search/search-results.ts#L20-L29)（mousedown guard，6 行新增）+ [search-results.ts:67-77](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/search/search-results.ts#L67-L77)（fallback hint span，11 行新增）+ [newtab.css:496-499](file:///Users/lingsmbp/Documents/aiwork/newtab01/styles/newtab.css#L496-L499)（fallback 右对齐 CSS，4 行新增），其它代码 0 改动。

## [0.2.80] - 2026-06-20

### Fixed
- **搜索框按回车不再被中文输入法抢词**。topbar 搜索 input 的 keydown 监听器在最前面加 `e.isComposing` 早返回 —— IME（拼音 / 注音 / 其他基于 composition 的输入法）组字过程中按 Enter 用于确认第一个候选词时，浏览器派发的 keydown 事件 `isComposing === true`，此时不再进入 `handleKeyNavigation`（避免误打开上一次的搜索候选结果）和 `searchInCurrentTab` 兜底分支（避免误跳转搜索结果页）。组字结束、用户**再**按一次 Enter 时 `isComposing === false`，正常走搜索兜底逻辑，行为零变化。改动 [search-main.ts:108-115](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/search/search-main.ts#L108-L115) 一个 keydown 监听器，6 行新增（3 行注释 + 1 行 if + 2 行 body），其它代码 0 改动。

## [0.2.73] - 2026-06-19

### Changed
- **导入自定义主题 & 已安装的自定义主题 独立成新 tab**。设置面板左侧 nav 从 4 项（布局 / 外观 / 功能 / 高级）扩到 5 项，新增「自定义主题」tab —— 位于「外观」之后，「功能」之前。原「外观」tab 底部堆的「导入自定义主题」textarea、「应用」按钮、状态条、以及「已安装的自定义主题」列表（每项一个删除按钮）整体迁到新 tab。
  - **入口**：跳转入口内联在「外观」tab 主题下拉行自己的 `sp-row--with-desc` 里，是一段说明文字 + 一个普通 `<a class="sp-link">` 链接（「管理自定义主题 →」），点击直接切到新 tab。`setActiveTab('custom-themes')` 复用了 nav 按钮的同一条路径，避免 nav 重渲染逻辑和内容刷新逻辑分叉。
  - **结构**：`renderCustomThemesTab` 走和 `renderAppearanceTab` 相同的「placeholder → async 渲染 → swap children」模式，chrome.storage.local 读取期间不闪空。install 成功 / delete 成功后调 `rerenderCurrentTab()` 刷新当前 tab（重命名自 `rerenderAppearanceTab` —— 现在两个 tab 都可能触发刷新，函数命名按"动作"而非"调用方"）。
  - **行为不变**：导入、校验、应用、删除、删除后回退到 default 主题的逻辑完全没动；CSS 变量系统、chrome.storage 读写、tweakcn JSON 解析、theme dropdown 同步都没动。tab 物理位置变化 + 入口从按钮改为内联链接，行为零变化。
  - **CSS**：`.sp-link` 新增内联链接样式（`var(--primary)` 上色，hover 下划线 + 0.85 透明，`:focus-visible` 用 `var(--ring)` 描边）—— 与 shadcn link 风格一致，沿用现有 shadcn token。
  - **API**：`createRow` 的 `description` 参数从 `string` 扩到 `string | HTMLElement`（一个 `if` 分支），允许调用方在 row description 里塞富内容（链接、图标等）。所有现有调用方都传 string，零修改。

## [0.2.74] - 2026-06-19

### Added
- **自定义主题 tab 支持粘贴 tweakcn CSS**。v0.2.73 的导入区只接受 tweakcn JSON (`registry-item`)，本版本把主输入格式切到 tweakcn 的"Copy"按钮默认吐出的 CSS（`:root` + `.dark` 块）—— 少一道「点 Show Code → 选 CSS → 复制 → 改粘贴成 JSON」的来回，对终端用户更直接。JSON 路径**保留**作为测试 / 高级入口，由 `detectInputFormat()` 在 Apply 时按首字符自动分发。
  - **模块拆分**：新增 `src/features/themes/css-import.ts`（~80 行）—— `parseCssTheme(css, name)` 用 4 条正则（`:root` 块、`.dark` 块、注释剥离、`--name: value;` 提取）把 CSS 解析成 `TweakcnJson`，**直接复用** `validateThemeJson` / `installCustomTheme` / `emitBlock` / `injectCustomThemesStyle` 的整条下游 —— 8 required shadcn var 校验、storage 写入、CSS emit、tab 刷新等逻辑 0 重复。
  - **规范化**：`shadow-x` / `shadow-y` 在 CSS 路径里 rename 成 `shadow-offset-x` / `shadow-offset-y`，与 JSON 路径的存储形状对齐 —— 同一个 tweakcn 主题从 CSS 进和从 JSON 进得到同一个 storage 条目（否则 `installCustomTheme` 视为不同主题，无法 update）。
  - **UI**：textarea 下方新增 name `<input>`（`#sp-custom-theme-name` / `.sp-name-input`），placeholder「主题名称（仅 CSS 粘贴必填）」。JSON 路径忽略该 input，CSS 路径必填。hint 文案 + textarea placeholder 都同步更新，明确两种格式都支持。
  - **错误处理**：CSS 缺 `:root { ... }` → "CSS 解析失败: 未找到 :root { ... } 块"；CSS 缺 name → "请先输入主题名称"；其余 8 required var / dark 校验复用 validator 既有错误文案。
  - **不改**：`cssVars.theme` 共享块（项目 `emitBlock` 不读，dead code 字段，给空对象即可）、`css` 顶层 element-level 规则（JSON 路径也忽略，行为一致）、任何下游 storage / emit / refresh 逻辑。
  - **未来扩展**：`detectInputFormat` 是 URL 导入（tweakcn URL → fetch CSS → 走同一条 `parseCssTheme`）的自然接入点 —— 本次不做。

## [0.2.75] - 2026-06-19

### Added
- **「暗色模式」独立成 Settings 字段**。`Settings.darkMode: 'system' | 'light' | 'dark'`，默认 `'system'`。主题列表里每个 theme 只出现一次（不再有 `default-dark` / `user-xxx-dark` 等独立条目）；深浅由这个独立开关控制。选「跟随系统」会同步 macOS / Windows 的外观设置 —— OS 切深浅时扩展内主题**自动跟随**（`matchMedia('(prefers-color-scheme: dark)')` 的 change listener 在 `app.ts` 初始化时挂上，仅当 `darkMode === 'system'` 时 re-apply）。
  - **架构**：`switcher.ts` 新增 `DarkMode` type、`resolveTheme(baseTheme, darkMode)` 函数、`hasDarkVariant()` + `setHasDarkVariant()` 同步缓存（缓存由 `custom-themes.ts` 在 install/remove 时维护，保证 sync lookup）。`applyTheme(theme)` 内部 `resolveTheme()` 算 `data-theme` 值 —— `theme` 入参永远是 base id（不再带后缀），但实际 `data-theme` 属性仍是 `<base>` 或 `<base>-dark`（CSS 选择器不变）。
  - **存储**：`theme` 字段约定永远是 base id；`darkMode` 是新字段。`{theme, darkMode, 5 colors}` 在每次主题切换 / 暗色模式切换时一起写入。**无 storage migration**（产品未发布，零旧用户）。
  - **CSS**：`styles/themes/*.css` 里 `*-dark` 规则全部保留 —— 这套机制能 work 的关键。0 改动。
  - **UI**：外观 tab 在「主题」row 下方新增「暗色模式」row（`跟随系统 / 亮 / 暗` 三档）。自定义主题 tab 的「选择主题」section 同样含主题 + 暗色模式两个 select —— 用户从哪个 tab 都能切。两处的 `id="sp-theme"` / `id="sp-darkMode"` 相同（同一时间只有一个 tab 在 DOM，duplicate id 不冲突）。
  - **Import 后 auto-switch 简化**：从原本需要手动算 `endsWith('-dark')` + 选 lightId / darkId，简化为 `await saveThemeChange(baseId)`。`saveThemeChange` 读 `getSetting('darkMode')`，`resolveTheme` 算最终变体 —— 当前是 dark 模式且新主题有 dark variant 就用 dark，否则 fallback 到 light。

## [0.2.76] - 2026-06-19

### Changed
- **「自定义主题」tab 内部 section 顺序调整**。v0.2.75 的 tab 是「选择主题」→「导入自定义主题」→「已安装的自定义主题」（theme switcher 顶部，因为它的"快速切主题"是当时认为的主场景）。v0.2.76 调整为「导入自定义主题」→「选择主题」→「已安装的自定义主题」—— 把 tab 的**主操作**（装新主题）放最顶部，「切到已装好的主题」次之，「管理已装好的（删除等）」最底。匹配"装 → 用 → 管"的 top-to-bottom 工作流。代码改动仅 2 行 appendChild 顺序对调 + 注释更新；DOM 结构、行为、事件绑定全部 0 改动。

## [0.2.77] - 2026-06-19

### Added
- **tweakcn 主题 URL 粘贴导入**。在「自定义主题」tab 的导入区粘贴 `https://tweakcn.com/themes/<id>`，自动补成 `https://tweakcn.com/r/themes/<id>`，通过 service worker fetch 拿 JSON，走和 CSS 粘贴同一条下游（validate → install → auto-switch）。`https://tweakcn.com/r/themes/<id>` 形式的 JSON URL 也直接支持。fetch 期间 Apply 按钮 disable，import section 下方显示 indeterminate 进度条（`var(--primary)` 颜色的 shimmer 动画，1.2s 循环）。
  - **新模块**：[src/features/themes/url-import.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/themes/url-import.ts) (~50 行) —— `detectTweakcnUrl(raw)` 区分主题 URL / JSON URL，`toTweakcnJsonUrl(url)` 主题 URL 加 `/r/`（保留 query / hash）。严格匹配 `^https?://tweakcn\.com/(r/)?themes/[\w-]+`，不松到任意 URL。
  - **背景 fetch**：[background.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/background.ts) 新增 `fetchThemeJson` message handler —— service worker 有完整扩展特权（`host_permissions: ["<all_urls>"]`），**不依赖** tweakcn 是否返回 CORS 头。`isValidMessage` 在 [messages.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/lib/chrome/messages.ts) 严格校验 URL 必须已是 `/r/themes/` 形式（SW 端不再二次 normalize，单一职责）。
  - **UI**：`#sp-custom-theme-progress` 进度条元素（CSS 控制 visible / hidden 切换）。name input 的 placeholder 改为 "CSS 必填；URL 可选，未填用主题里的名字" —— URL 路径下用户填的 name 覆盖 JSON 里的 name 字段。
  - **错误处理**：4 类错误各有文案 —— URL 格式不正确 / 加载失败 (HTTP / network) / JSON 解析失败 / 验证失败。全部在 status 区显示，复用现有 `setCustomThemeStatus`。
  - **进度条 UX**：3px 高，shimmer 动画从左滑到右 + Apply 按钮 disable。fetch 完成（无论成败）都消失。CSS 路径是 sync 的，进度条只闪一下；URL 路径是 async 的，进度条持续到响应到达。

### Removed
- **v0.2.74 引入的 raw JSON 粘贴**。`detectInputFormat` 从 `'css' | 'json' | 'url'` 缩到 `'css' | 'url'`；`runThemeValidation` 删掉 JSON 分支。`validateThemeJson` 内部仍被 URL 路径用（fetch 回来的文本要 parse 成 JSON 再 validate），保留不动。textarea placeholder 不再列 JSON 格式；用户想粘贴 JSON 的场景都被 URL 粘贴覆盖了。

## [0.2.78] - 2026-06-19

### Fixed
- **主题下拉列表里仍有 `<name> (Dark)` 条目**。v0.2.75 把 dark mode 提升成一等 `darkMode` 设置的 commit 意图是从 `listAllThemes()` 里去掉 dark variant 的 push —— 但那次 `SearchReplace` edit 静默失败了，dark 那段 `if (entry.dark)` 没真删，只是注释（连注释也是后来才加）改了。从用户视角表现：装一个**有** dark 变体的自定义主题后，外观 tab 主题下拉里能看到 `Whatsapp` 和 `Whatsapp (Dark)` 两个条目；切到 dark 那个实际渲染没问题但 dropdown 出现了本不该有的冗余。修复：`listAllThemes` 不再 push dark 入口 —— 用户统一通过 `darkMode` 设置决定变体。`buildCustomThemesStyle` 的 `[data-theme="user-xxx-dark"]` CSS 规则 emit **不动**（那是 `resolveTheme` 切到 dark variant 必需的）。

## [0.2.79] - 2026-06-19

### Added
- **删除自定义主题加确认对话框**。在「自定义主题」tab 的「已安装的自定义主题」列表里点「删除」按钮时，先弹 native `window.confirm("确定要删除自定义主题 \"<name>\" 吗？")`；用户取消则不执行任何操作。沿用项目现有 pattern（CLAUDE.md 提到的 `folderActionConfirmThreshold` 给 folder 批量操作加 confirm 也是 `window.confirm()`），0 DOM 改动、0 新组件。

## [0.2.72] - 2026-06-19

### Fixed
- **拖单个 folder 原地松开会合并到左边列**。`getDropTargetElement` 在"目标列只有 1 个 folder"时把 LI promote 成 UL，目的是把"拖到 header"解读成 column drop。但当源列自身也是单 folder 列时（典型场景：`[A], [B], [C], [D]` 拖 B），drop 走 `addRow('B', x=1, y=0|1)` 路径：
  1. 从列 1 移除 B → 列 1 变空
  2. 删空列 1 → `xPos > x` 命中，xPos 从 1 变成 0
  3. 把 B 插到 columns[0]（现在的 A）row 0

  结果 `[A], [B], [C], [D]` 变成 `[BA], [C], [D]` —— 用户拖了一下没动位置却把 B 合并进 A 了。
  - **修复**：`drop-handler.ts:captureAndDrop` 在取 snapshot 前检测 self-drop on single-folder source column（`dragIds.length === 1 && y !== null && sourceCoords.x === x && sourceColumn.length === 1`），命中直接 return —— 不取 snapshot、不改 layout、不进 undo 栈。
  - 多文件列的 in-column 重排（`[A, X]` 拖 X 到 row 0）仍然走 addRow，不受影响（因为 `sourceColumn.length === 1` 失败，guard 不触发）。多文件列的列间 drop 也不受影响。

## [0.2.71] - 2026-06-19

### Added
- **拖拽源（被拖拽的 folder / column）点状边框高亮**。`drag-folder.ts` 和 `drag-column.ts` 早就在 dragstart 时给源元素加 `.dragstart` class、dragend 时移除，但 CSS 只设了 `opacity: 0.5`，没有边框 —— 用户不知道"现在拖的是谁"。
  - **样式**：跟右键选中 (`#main a.selected` / `.column.selected`) 同属一个"2px dotted"家族但用**不同颜色**：
    - `#main li.dragstart` → `outline: 2px dotted var(--newtab-drag-ring); outline-offset: -2px;`（匹配包裹整个 folder 树的 `<li>` —— header + 全部子孙，因为拖一个 folder 本来就含整个子树）
    - `.column.dragstart` → `border: 2px dotted var(--newtab-drag-ring); border-radius: calc(var(--radius) - 2px);`（匹配 column div，column 已有 `box-sizing: border-box`，加 border 不影响布局）
  - **JS 端**：`enableDragFolder` 多接一个 `li` 参数，dragstart/dragend 时把 `.dragstart` 加在 `<li>` 上而不是 `<a>` 上，确保高亮范围覆盖整个 folder 树（包括未展开时只有 header、展开时 header + 所有子孙 `<li>`）。`header.draggable = true` 和 drag 监听器仍然挂在 `<a>` 上（`<a>` 才是用户实际抓的元素），`<li>` 仅承担视觉 class。
  - **颜色**：新增 `--newtab-drag-ring` CSS 变量，默认 `var(--foreground)`（shadcn 的文字色，设计上就跟 `--background` 形成高对比 —— light 主题里深色，dark 主题里浅色）。跟右键用的 `--ring`（多数主题 ≈ `--primary`）视觉上必然区分开。每个主题可以单独 override `--newtab-drag-ring`。
  - 配合现有的 `.dragstart { opacity: 0.5 }`，整个 folder 树拖拽时同时"半透明 + 点状边框"，双重视觉提示当前拖的是哪个（含所有子孙）。drop target 的指示器（`solid 4px var(--newtab-drop-indicator)`）未改动。

## [0.2.70] - 2026-06-19

### Fixed
- **drag-drop 多目录源列的 compensation 过补偿**。v0.2.69 把"任何 `index < targetX` 且包含 dragIds 任一元素的源列"都计入 compensation，但只有**源列拖空**（即该列里**所有**目录都在被拖）才会被 addColumn 的空列清理移除、才需要补偿。当源列拖走一部分还剩一部分时（例如 `[A], [B, C], [D]` 拖 B），源列不会被移除，新数组里 `targetX` 位置不变 —— v0.2.69 在这种情况下错把 `[B, C]` 当成会被移除的列，compensation 多算了 1，结果 `[A, B, C, D]`（B 错位到 C 之前）而不是用户期望的 `[A, C, B, D]`。
  - **修复**：把条件从 `dragIds.some(id => col.includes(id))` 改为 `col.every(id => dragIds.includes(id))` —— 只有当源列里**每个** id 都在 dragIds 里（即拖空）时才算补偿。`[B, C]` 拖 B 不会通过 every 检查（因为 C 不在 dragIds），compensation = 0，targetX 直传到 addColumn。
  - 单目录源列（`[A], [B], [D]` 拖 B 等）的行为不变 —— `[B]` 经 every 检查通过，compensation 正常算上，v0.2.69 修过的"右半边 overshoot"问题保持修复。

## [0.2.69] - 2026-06-19

### Fixed
- **drag-drop 拖列到右半边直接跳到末尾（与 v0.2.68 的 Move column right 同源 bug）**。`drop-handler.ts:captureAndDrop` 之前传 `addColumn(dragIds, finalX)` 时 `finalX` 直接用 `x + 1`（x = 目标列在**原数组**里的索引），但 `addColumn` 的 `index` 参数是**移除源列后**的数组索引 —— 配合 `Math.min(insertIndex, columns.length)` clamp 会让所有 `x + 1 >= source` 的右半边 drop 落到最右边。
  - **修复**：在 drop-handler 里把"原数组坐标"翻译成"移除后坐标"。`targetX = (右半边 ? x + 1 : x)` 是原数组坐标；然后数原数组里 `index < targetX` 且包含 `dragIds` 任一元素的源列数 `compensation`，`finalX = targetX - compensation`。
  - 例子：`[A, B, C, D]`，拖 A（源 0）丢到 C 右半边 → targetX = 3, compensation = 1（A 在 0 < 3）, finalX = 2 → 落 `[B, C, A, D]` ✓（旧代码 → `[B, C, D, A]` ✗）。
  - **不改 `addColumn` API**：本仓库还有 context-menu 的 Move column right（已在 v0.2.68 用 old-array 语义修过）也调 `addColumn`，保持 `addColumn` 的 post-removal 语义不变；只在 drop-handler 这个把 drop 坐标当 old-array 的 caller 做翻译。多源列（dragged ids 跨多列）也被同一循环覆盖：每个 `< targetX` 的源列各贡献一次 compensation。
  - `debug.log` 增补 `targetX / compensation` 字段方便后续抓 bug。

## [0.2.68] - 2026-06-19

### Fixed
- **右键菜单 `Move column right` 一次性跳到最右边**。`context-menu.ts` 里调用 `addColumn(ids, index + 2)` 的 `+2` 是错的 —— `addColumn` 内部先把 ids 从原列移除，所以 splice 的位置应该基于**移除后的数组**。"右移 1 位" 在新数组里就是 `index + 1`，但之前传了 `index + 2`，配合 `Math.min(insertIndex, columns.length)` 的 clamp 永远落到最右端。改为 `index + 1` 后行为与 `Move column left`（用 `index - 1`，本就正确）对称。同时加了一段说明注释解释 +1 的语义，防回归。

## [0.2.67] - 2026-06-19

### Changed
- **右键菜单隐藏 `Move folder up / down / left / right` 4 个 item**。用户反馈"移动目录的体验不好"，先用注释临时隐藏（不删逻辑代码），folder 右键菜单现只剩 `Remove folder` + `Create new column`。`src/features/bookmarks/context-menu.ts` 的 4 个 `items.push({ label: 'Move folder ...', ... })` 整体包在 `/* ... */` 块里 + 上方一段说明注释解释为何隐藏 / 怎么重新启用。`addRow` / `getCoords` 等底层代码原封不动，未来重新设计交互后删除注释块即可恢复显示。同时移除因此变成 unused 的 `const columns = getColumns();` 局部变量（`tsconfig.json:noUnusedLocals` 会触发编译错误）。

## [0.2.66] - 2026-06-19

### Added
- **右键菜单的布局变更也支持 undo 回退**。topbar 的「回退操作」按钮现在覆盖 4 个右键菜单的列 / 目录操作，与 v0.2.61 的 drag-drop undo 共用同一个 `history` 栈和同一个按钮。
  - 覆盖操作：`Create new column` / `Move column left` / `Move column right` / `Remove column` / `Remove folder` —— 用户在右键菜单触发后，topbar 出现 `[N]` 计数 badge，点击即完整恢复到操作前的 columns + movedOut 状态。
  - `src/features/bookmarks/context-menu.ts` 新增内部 helper `withUndo(action)` —— 模式与 drag-drop 的 `captureAndDrop` 完全一致：先 `await captureSnapshot()` → 执行 layout mutation → `pushSnapshot(snapshot)`。只有 mutation 成功才 push，mutation 失败（抛错）栈保持干净。
  - `src/features/drag-drop/history.ts` 新增并导出 `captureSnapshot()` helper —— 把 drop-handler 原有的 inline 克隆逻辑搬过来作为单一来源；drop-handler 改为调用该 helper，行为不变但去重了 `cloneMovedOut` 实现（现作为 `history.ts` 的导出函数复用）。
  - `src/features/bookmarks/types.ts` 的 `MenuItem.action` 类型从 `() => void` 扩展为 `() => void | Promise<void>` —— 让 layout action 可以是 async 以便 `await` 内部的 `addColumn / removeRow` 等 Promise。
  - 「Move folder up / down / left / right」（同右键菜单、调用 `addRow`）按 v0.2.66 用户列表未明确要求，**未接入 undo** —— 如需要可在一个后续小版本统一补齐，模式与列移动完全一致（`withUndo(() => void addRow(...))`）。

## [0.2.65] - 2026-06-18

### Changed
- **拖出去的目录可以找回来 + 收藏夹栏始终保持完整树**。
  - **收藏夹栏完整树**：`filterChildren` 新增 `inBookmarkBarContext` 参数。当一个 folder 是从收藏夹栏所在的列渲染（`column.ts:renderColumn` 判断 `ids.includes('1')`），整条 render chain（`renderFolder` → `renderChildrenInto` → `renderNodeInto` → `filterChildren`）传 `true`，跳过 moved-out 过滤。效果：拖 A 到 col 2 后再拖 A 的子 B 到 col 3，A 在收藏夹栏 view 里依然能看到 B（不管 B 是不是在 col 3）。Other Bookmarks（id="2"）继续走原有 `DEFAULT_ROOT_IDS` 直通路径，不变。
  - **右键删除恢复**：`layout-ops.ts:removeRow` 在删行后调 `unmarkMovedOut(parent, id)`，把该 folder 从它物理 parent 的 moved-out 列表里移除。效果：右键删 col 3 里的 B 之后，B 重新出现在 A 的展开视图里（之前是孤儿）。`restoreMovedOutForRemovedId` 跳过特殊 folder / 根 folder / 非数字 id，错误 console.error 不抛。

## [0.2.64] - 2026-06-18

### Fixed
- **右键菜单的浏览器内部页面跳转在 Edge 上失败**。`context-menu.ts` 里 3 个 `window.open('chrome://...')` 调用(Edit bookmarks / History / Clear browsing data)在 Edge 浏览器上抛 `Not allowed to load local resource` —— Edge 拿到 `chrome://` 后会转成 `edge://` 但 `window.open` 路径被部分 Chromium 版本拦掉。
  - 新增 `openInternalPage(path)` helper,通过 `navigator.userAgent` 检测 Edge(`/Edg\//`),自动用 `edge://` 还是 `chrome://` scheme。
  - 改用 `chrome.tabs.create` (`lib/chrome/bookmarks.ts` 里的 `createTab` 封装)替代 `window.open` —— 这是 extension context 打开内部页面的官方路径,在 Chrome / Edge / Brave / Opera 上都稳定。
  - 三处调用全部走 `openInternalPage('bookmarks/?id=' + node.id)` / `'history'` / `'settings/clearBrowserData'`。

## [0.2.63] - 2026-06-18

### Added
- **右键菜单：高亮当前被作用的 item**。右键 folder header 或 column 空白区唤起 context menu 后，对应元素自动获得 `.selected` 类（folder 用 `--accent` / `--accent-foreground` + 2px `--ring` dotted 内嵌 ring；column 用 2px `--ring` dotted border 圈出整列），菜单关闭时自动清除——鼠标移到菜单上后用户仍能看清 menu 作用于哪个 item。
  - `src/features/bookmarks/context-menu.ts` 新增模块级 `selectedTarget` 引用；`renderMenu(items, x, y, target?)` 第 4 参数为可选目标元素，调用方传入时自动加 class；`closeMenu()` 同步清除（被 click / mousedown / contextmenu / ESC 四条路径覆盖，调用方无需手动清理）。
  - `src/features/bookmarks/folder.ts` 右键 handler 把 folder header 作为第 4 参数传入；`src/features/bookmarks/column.ts` 同样把 column div 作为第 4 参数传入——v0.2.62 暂定仅 folder 高亮，本版本按用户反馈扩展到 column，整列视觉锚点更明确。
  - `styles/newtab.css` 新增 `#main a.selected` / `.column.selected` 规则：folder 复用 `--newtab-link-color-hover` / `--newtab-link-bg-hover`（主题 escape hatch 优先）+ `outline: 2px dotted var(--ring)` 内嵌 dotted ring；column 用 `border: 2px dotted var(--ring)` 圈出整列（column 已有 `box-sizing: border-box`，加 border 不影响布局）。dotted 风格主题一致、视觉克制不抢戏。5 套主题（Codex / MX-Brutalist / Cyberpunk / AstroVista / default）自动适配。

### Changed
- `manifest.json` 版本号同步 bump 到 0.2.63（之前只 bump 了 `package.json`，遗漏 `manifest.json` 导致 dist 里的版本号还是 0.2.62）。

## [0.2.62] - 2026-06-19

### Changed
- **Popup: Bookmarks 文件夹默认仅第一层展开**。`src/popup/bookmark-picker.ts` 把 folder 默认展开条件从"全展开"改为 `depth === 0`：只有顶层 folder 默认展开（`▼`，`children.hidden = false`），嵌套 folder 默认折叠（`▶`，`children.hidden = true`）。点击 header 仍可手动 toggle。

## [0.2.61] - 2026-06-19

### Added
- **拖拽撤销按钮（文字标签 + 计数角标）**。每次拖拽（folder header 或整列）落地后，topbar 搜索框右侧出现 `回退操作 [N]` 形式的按钮。点击按钮可撤销该次拖拽——恢复 columns 布局 + moved-out 隐藏映射，重渲染整个 board。多次拖拽可依次回退，最多保留 10 次历史；超出时丢弃最旧的。
  - 新模块 `src/features/drag-drop/history.ts`：纯内存快照栈（不写 chrome.storage，刷新页面清空），导出 `pushSnapshot` / `popSnapshot` / `getHistoryLength` / `clearHistory` / `subscribe`，常量 `MAX_HISTORY = 10`。快照包含 `{ columns, movedOut }` 两份深度克隆——只回退 columns 不回退 moved-out 会导致 folder 在原 parent 下仍然被隐藏（UX 不一致）。
  - 新模块 `src/newtab/undo-button.ts`：渲染 `#undo_button`（文字 `回退操作` + 内联 `.undo-count` 角标 pill），subscribes history 模块的 `subscribe` 自动更新可见性 / tooltip（`回退操作（N 步）` 当栈深 > 1）。**角标始终显示数字**（包括 count=1 → 显示 "1"），不再有空 pill 状态——用户反馈 "1 次时角标空着、2 次时显示 2" 视觉割裂。点击 handler 调 `popSnapshot` → `setColumns` / `setMovedOutCache`（新增 setter，详见下） → 写回 `chrome.storage.local.movedOut` → `saveLayout` 触发 verifyColumns + 持久化 + 重渲染。
  - `src/features/drag-drop/drop-handler.ts:onDrop` 重构：原先 fire-and-forget `void addRow/addColumn` 改为 `async captureAndDrop()`——在调用 `addRow` / `addColumn` 之前深克隆当前 columns + movedOut 作为快照，等 mutation 完成（包含 `recordMovedOutForIds` 的 await）后再 `pushSnapshot`。这样快照只在 drop 真正落地后才入栈，避免 no-op drop 占位。
- **layout-ops / moved-out 暴露 setter 给 undo 流程使用**。
  - `src/features/drag-drop/layout-ops.ts` 新增 `setColumns(next)`：直接替换模块级 `columns` 引用（不做克隆；history 模块已经 deep-clone 入栈）。调用方需随后 `saveLayout()` 让 verifyColumns 重建 coords 并触发渲染。
  - `src/features/bookmarks/moved-out.ts` 新增 `setMovedOutCache(next)`：直接替换模块级 `cache` 引用（同样的不克隆约定）。调用方需随后 `setLocal('movedOut', cache)` 持久化。

### Changed
- **Topbar 布局**：`.search-wrap` 之后增加 `#undo_button` 作为 flex sibling（`flex: 0 0 auto; margin-left: 8px`）。两者一起被 `#topbar { justify-content: center }` 居中，所以 (search + undo) 整体仍然在视口水平居中。settings 齿轮仍是 `position: absolute` 在右上角，与 undo 按钮互不影响。
- **`styles/newtab.css`** 新增 `#undo_button` 与 `.undo-count` 样式：按钮用 `display: flex; gap: 8px` 横向排布"文字 + 角标"，文字部分 1.2rem / 500 weight（沿用设置面板 `.sp-btn` 语汇），角标用 `--primary` 背景 + `--primary-foreground` 文字 + 9px 圆角胶囊，inline 布局（不是 absolute）所以和文字基线对齐。hover 时按钮 `border-color` 与 `background-color` 都切到 `--newtab-highlight`。
- **`src/newtab/undo-button.ts`** `updateVisibility` 始终把 count 写入角标 `textContent`（无空状态）；`aria-label` 和 `title` 中文为 `回退操作` / `回退操作（N 步）`。

### Notes
- **状态只在内存**：刷新 newtab 页面后 history 自动清空（模块级数组随页面销毁）。如果以后需要"刷新后仍可撤销"，需要把 history 持久化到 `chrome.storage.session`（Chrome 113+ 提供，会话级存储，关闭浏览器即清空，正好契合"不想跨会话保留撤销"的语义）。
- **覆盖范围**：仅捕获 `addRow` / `addColumn`（drop-handler 主路径）的拖拽——其他修改 columns 的入口（如 settings 面板的 columnWidth 调整）不入栈，因为这些操作不是用户的"拖动"，混进 undo 栈会让人困惑。如果以后加"重置 columns"按钮，那种操作应该入一个独立的 history 通道。
- **JS bundle 体积**：`dist/assets/newtab-*.js` ≈ 68 kB / gzip ≈ 24 kB（介于初版角标方案和纯文字方案之间），远低于 CLAUDE.md §7 的 80 KB gzip 预算。

## [0.2.60] - 2026-06-19

### Added
- **鼠标中键点击目录 = 打开全部链接**。`src/features/bookmarks/folder.ts` 的 `renderFolder()` 在 folder header 上注册 `auxclick` 监听器（`button === 1`），触发 `openAllLinks(node)`。子目录不会被展开/打开，只取直接 link 子项。点击位置在 `.folder-action-btn` 上时忽略，避免与现有 3 个 action 图标冲突；中键事件调 `e.preventDefault()` 防止浏览器对 `<a>` 的默认行为。
- **批量打开 / 分组打开的 confirm 阈值**。新设置 `folderActionConfirmThreshold`（默认 10，可在设置面板"功能"tab 调整；设为 0 关闭确认）。当目录的 URL 子项数超过阈值时，`openAllLinks` / `openAsGroup` 先弹一个 `window.confirm()`（`「{folder}」包含 N 个链接，确认{verb}？`）再执行；用户取消则 no-op。阈值对两种动作共用——因为产生的标签数 / 体感成本相同。
- **Split view link picker**。新模块 `src/features/bookmarks/split-picker.ts` 暴露 `showSplitPicker(entries)` / `showSplitPickerFromNodes(nodes)`：居中模态浮窗（`.split-picker-panel`，z-index 130，比设置面板的 sp-panel 120 高一档；复用 `sp-overlay` 背景层）。当 `openSplit` 发现目录 URL 子项 > 4（`SPLIT_VIEW_MAX` 常量）时弹出；默认前 4 项预选，复选框最多勾 4 个（达到上限时其余复选框置 disabled），底部三按钮：
  - **取消** → resolve(null)，不分屏
  - **打开选中** → resolve(当前勾选)，至少 1 项
  - **打开前 4 个** → resolve(前 4 项 URL)，无视当前勾选
  ESC / 点击 overlay 同等于"取消"。选中 0 项时 "打开选中" 不响应（无操作）。样式新增在 `styles/newtab.css` 末尾，沿用 `--background` / `--border` / `--primary` / `--muted` / `--muted-foreground` 等 shadcn 变量，与设置面板同语汇。
- **设置面板：批量打开确认阈值**。「功能」tab 新增一行 `批量打开确认阈值`（number input，复用现有 `createNumberInput` 模板），"高级"tab 的导入/导出 schema 自动跟随新字段（因为是 `Settings` interface 的成员）。

### Changed
- **`src/features/bookmarks/folder-actions-handler.ts` 重构**。`openAllLinks` / `openAsGroup` 现在先 `getChildren` 过滤出 URL 子项（替代原来无差别遍历 `children`），空列表直接 no-op。新增 `confirmIfExceedsThreshold(node, count, verb)` 私有 helper（依据 `folderActionConfirmThreshold` 决定是否弹 confirm）。`openSplit` 拆出 `urlChildren` 变量后根据数量走 direct / picker 两条路径；URL 列表传入 `splitManager.open` 之前不再 `slice(0, 4)`——picker 已经保证 ≤ 4。

## [0.2.59] - 2026-06-19

### Changed
- **Newtab folder header 的 3 个操作图标（分屏 / 分组 / 批量打开）默认常驻显示**。`styles/newtab.css` 的 `.folder-actions` 从 `display: none` 改为 `display: inline-flex` + `opacity: 0.5`，folder header hover 时 `opacity` 升到 `1`。移除原 `#main a:hover .folder-actions` / `#main a.folder:hover .folder-actions` 的 `display` 切换规则。空文件夹（`bookmarkCount === 0`）仍由 `folder-actions.ts` 返回空容器，行为不变。

## [0.2.58] - 2026-06-19

### Changed
- **Split View: 移除顶部 toolbar**。`src/features/split/split-view.ts` 的 `createToolbar()` 函数（"Split View" 标签 + "Close All" 按钮 + 32px 高的灰色条）整段删除，`renderSplitView()` 改为直接返回 grid container（`position: fixed; inset: 0;`）而不再用 flex column wrapper 包裹 toolbar。顶部 32px 空间让给 iframe grid，让 split view 视觉上"只剩网页"。
- **Split View: 浏览器 tab 标题动态化**。`SplitEngine.open()` 新增可选 `title?: string` 第 3 参数；`iframe-engine.ts` 把 title 写入 URL hash (`#urls=...&title=...`)；`split-view.ts:parseSplitParams()` 解析后由 `app.ts:initApp()` 写入 `document.title`。两个来源：
  - **从 newtab folder 打开** — `folder-actions-handler.ts:openSplit()` 传 `node.title`，split view tab 显示 folder 名称（如 "我的书签"）。
  - **从扩展图标 popup 打开** — `popup/app.ts:buildPopupTitle()` 提取每个 URL 的根域名（hostname 取最后两段，"www.weibo.com" → "weibo.com"），用 ` | ` 拼成 "weibo.com | v2ex.com"。**已知限制**：没有 Public Suffix List，"bbc.co.uk" 会被错误截成 "co.uk"；如需精确 eTLD+1 需要额外引入 PSL 库。
- **Split View: `3grid` → `3H`，且 layout 改为 3 列等分**。`SplitMode` 联合类型、`layoutConfigs`、`validateLayout`、`parseSplitParams`、folder-actions 默认 layout 选择、popup layout picker 的 mode 与 label（"3 Grid" → "3 Horizontal"）、`styles/newtab.css` 的 `.split-3grid` → `.split-3H`。新 3H = 3 列等分（`grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr;`，三格水平排开）。旧 3H 的 "1+2 横向" 实现（`1fr 1fr / 1fr 1fr` + 首项 `grid-row: span 2` + areas `main/side-top/side-bottom`）整段移除——`split-layout.ts:createFrameSlot` 里的 `if (mode === '3H' && index === 0)` 分支删掉，所有 slot 走同一条 cssText；`styles/newtab.css` 的 `.split-3H iframe:nth-child(3) { grid-column: 1 / -1; }` 删掉。**注意**：`.split-2h` / `.split-2v` / `.split-3H` / `.split-4grid` 这 4 个 CSS class 在 newtab.css 里是 dead code（当前 split-view 用 inline style 渲染，没人 apply 这些 class），但保持命名一致以防以后复用。
- **Popup: 调换 Tab 顺序，默认 Open Tabs**。`src/popup/app.ts` 把 `Open Tabs` 放到 tab bar 第一位（左侧），`Bookmarks` 放第二位；`currentTab` 初值从 `'bookmarks'` 改为 `'open-tabs'`，打开 popup 默认显示当前已打开的标签列表。
- **Popup: Bookmarks 文件夹默认展开**。`src/popup/bookmark-picker.ts` 移除 `children.hidden = true`（folder 默认渲染为展开态），初始箭头从 `▶` 改为 `▼`。点击 header 仍可折叠/展开。

### Fixed
- **Popup: Bookmarks 文件夹展开/折叠不生效**。`styles/popup.css` 的 `.picker-folder-children` 设了 `display: flex; flex-direction: column;`，把 HTML `hidden` 属性默认的 `display: none` 覆盖掉了（`hidden` 是 UA stylesheet 规则，特异性 (0,0,0) 输给 author class (0,1,0)）。修法：加 `.picker-folder-children[hidden] { display: none; }`，class + attribute selector 特异性 (0,2,0) 覆盖前面的 flex 规则。`bookmark-picker.ts` 的 `children.hidden = !children.hidden` 不动。
- **Popup 宽度异常**。根因是 `styles/globals.css` 给 `<html>` 设了 `width: 100vw` —— Chrome 测量 action popup 大小时看的是 `documentElement`（即 `<html>`），不是 `<body>`。在 popup 上下文里 `100vw` 是 popup 自己的宽度（循环引用），Chrome 把它 resolve 成初始内容固有 min-width ≈ 30-50px，所以 body 即便设了 400px 也救不回来。`body.popup-body` 单修不够，因为 popup 的尺寸锚点在 `<html>`。
  - **真修**：
    1. `popup.html` 的 `<html>` 和 `<body>` 都加 inline `style="width:400px; height:500px; margin:0; padding:0;"`（`<body>` 额外加 `overflow:hidden`）。inline style 在 HTML parser 命中标签瞬间就生效，比 `<link>` CSS 早，确保 Chrome 测 popup 尺寸时 html 已经是 400px。
    2. `popup.html` 加 `class="popup-html"` / `class="popup-body"`，`styles/popup.css` 加 `html.popup-html, body.popup-body { width: 400px; height: 500px; margin: 0; padding: 0 }` 作为备份（防止以后有人删掉 inline style）。
    3. 顺手删掉 `<meta name="viewport" content="width=device-width">` —— popup 不是移动端，这玩意儿把 layout viewport 锁到设备宽度，反而帮倒忙。
  - **顺手修**：`styles/popup.css` 的 `.picker-title` 和 `.picker-folder-title` 加 `flex: 1; min-width: 0;`，让 400px popup 内的长书签/文件夹名正确触发 `text-overflow: ellipsis`。

## [0.2.57-baseline] - 2026-06-18

### Meta (分支重置：把 `main` 强制重置到 v0.2.57)

`main` 分支 HEAD 从 v0.2.36 (`0fb4f88`) **强制重置**到 v0.2.57 (`68fa259`)，作为新的"稳定基线"。

**为什么 v0.2.57 是基线**：
1. v0.2.57 的 UI 是用户测试确认的"完美"状态——链接 40px 高、列宽 1/N 等分、长链接截断、box-sizing: border-box 正确、4 套 tweakcn 主题的 link hover 全部生效。
2. v0.2.36 缺 v0.2.37 ~ v0.2.57 的 19 个主题化 hotfix，default 主题仍是手调 hex 基线（不是 tweakcn Codex 调色板）。
3. v0.2.58 / v0.2.59 仍带 link 颜色与下划线回归，未通过完整视觉验证。
4. v0.3.x 的 Vue 3 + Pinia + shadcn-vue 重构（`feat/vue-migration` 分支）被弃用——8 次 hotfix 后用户认为 Vue 重构"不明智"。

**保留的冻结分支**（不删除，保留为历史 commit 索引）：
- `feat/runtime-theme-import`：v0.2.57 → v0.2.59 的 runtime theme import 后期增量
- `feat/vue-migration`：v0.3.0 → v0.3.12 的 Vue 重构实验

**新功能 / hotfix 只在 `main` 上做**——不要 merge 任何 v0.3.x commit 进 main。CLAUDE.md §0.1 是分支策略的权威说明。

**未决项**（v0.2.57 遗留）：
- tweakcn 主题通过 runtime import 时，需重新粘贴 JSON 一次以补全 11 个 shadcn surface vars（Chrome storage 不会自动升级）。
- Codex light 主题下 link 默认态保留 `var(--shadow-xs)` 极淡 drop shadow，视为"主题本身效果"。

## [0.2.57] - 2026-06-18

### Refactored (架构修复：CSS 变量作为 newtab.css 与主题文件的接口)
**v0.2.56 的修复方式破坏了主题可扩展性**（用户反馈 "如果那么多硬编码，那如何能适配多种不同的主题？"）。v0.2.56 在 `styles/themes/default.css` 末尾加了 theme-scope rule：
```css
:root[data-theme="default"] #main a { box-shadow: none; }
:root[data-theme="default"] #main a:focus-visible { box-shadow: 0 0 0 3px ...; }
```
这个写法是反模式——每加一个需要"无 link shadow"的主题，就得在它的 `.css` 文件里复制粘贴一份 theme-scope rule，新加主题时改不到 newtab.css 根本写不出对称的样式。`mx-brutalist.css` 早就有同样的硬编码（`:root[data-theme="mx-brutalist"] #main a { border, radius, box-shadow }` + `:root[data-theme="mx-brutalist"] .search-input { border }`），v0.2.56 走的是同样的错误路线，**等于把 debt 翻倍**。

正确的架构是 CSS 变量作为 newtab.css 与主题文件之间的接口：
- **newtab.css** 只用 `var(--newtab-*, var(--shadcn-*))` 读取主题意图，不写针对具体选择器的 theme-scope rule。
- **主题文件** 只声明变量（`--newtab-link-shadow: none` / `var(--shadow-xs)`），不写 theme-scope rule。
- 加新主题 = 加一个 `styles/themes/xxx.css` + `globals.css` 末尾 `@import` 一行 + 主题列表注册。**零修改 newtab.css**。

具体重构：
- **`styles/newtab.css`**:
  - `#main a:focus-visible` 的 stacked box-shadow 第二项 `var(--shadow-xs)` → `var(--newtab-link-shadow, var(--shadow-xs))`（focus 时的 drop shadow 跟随主题意图；Codex 想要"focus 也不要 drop"就在自己的 block 里写 `--newtab-link-shadow: none`，自动覆盖）。
  - `#main a:active` 的 `var(--newtab-link-shadow-active, var(--shadow-xs))` → `var(--newtab-link-shadow-active, var(--newtab-link-shadow, var(--shadow-xs)))`（chain fallback：active 专属 escape hatch → default 状态的 var → shadcn 默认值；Codex 不写 `--newtab-link-shadow-active` 也能继承到 default 的 `none`）。
- **`styles/themes/default.css`**:
  - 末尾的 v0.2.56 theme-scope rule **整段删除**（specificity 0,2,2 那种硬编码的 `:root[data-theme="default"] #main a` 形式）。
  - `default` + `default-dark` 两个 block 各加一行 `--newtab-link-shadow: none;`（主题意图通过变量声明）。
- **`styles/themes/mx-brutalist.css`**:
  - `mx-brutalist` + `mx-brutalist-dark` 两个 block 各加一行 `--newtab-link-shadow: var(--shadow-xs);`（主题的 brutalist hard offset shadow 是视觉签名，必须 opt-in）。
  - 末尾的两个 theme-scope rule **整段删除**：
    - `:root[data-theme="mx-brutalist"] #main a { border, radius, box-shadow }`：border (`1px solid var(--border)`) / radius (`calc(var(--radius) - 2px)`) 跟 newtab.css 默认值重复（`--border: oklch(0 0 0)` 纯黑，`--radius: 0` clamp 到 0），box-shadow 现在通过 var 注入。
    - `:root[data-theme="mx-brutalist"] .search-input { border: 1px solid var(--border) }`：跟 newtab.css `.search-input` 的 border 默认值重复。
  - 保留 v0.2.54 的 specificity 警示注释（"不要在 override 里设 background-color"），把那段注释挪到文件末尾作为"历史教训"。

### Architecture
- **新约定（v0.2.57 起的强制架构）**:
  1. newtab.css 是唯一的"shape provider"——决定哪些属性用 var、var 的 fallback 是什么。所有 var-driven 属性都按 `var(--newtab-*, var(--shadcn-*))` 形式读取。
  2. 主题文件是"value provider"——只声明 var，不写任何选择器 rule（除了 v0.2.57 之前已经存在的、无法用 var 表达的特殊处理，比如 brutalist 的 `.search-input` border-width 早期是 3px 那种 1px 以上的硬编码，但那在 v0.2.53 已经统一为 1px 后变成冗余了——新代码不要再加这种 rule）。
  3. 加新主题时只动 `styles/themes/<name>.css` + `styles/globals.css` 的 `@import` + `src/features/themes/` 的注册——**不动 newtab.css / popup.css / options.css**。
  4. 如果某个主题需要的属性**无法用现有 var 表达**（如 v0.2.57 之后出现的新形状需求），先在 newtab.css 增加一个 `var(--newtab-xxx, ...)` 占位符，所有主题都通过 var 注入——不要直接在主题文件里写针对具体选择器的 rule。

## [0.2.56] - 2026-06-18

### Fixed
- **Codex 主题下 link 有"额外阴影"**（用户反馈 "codex 主题的 hover 和我们的 hover 有差异，我们明显额外多了一些阴影。这些也移除。只保留主题本身的效果"）。newtab.css `#main a` 里的 `box-shadow: var(--shadow-xs)` 在 Codex 主题下解析为：
  - light: `0px 2px 4px 0px hsl(0 0% 0% / 0.05)`（5% 黑 drop，勉强可见）
  - dark:  `0px 4px 8px 0px hsl(0 0% 0% / 0.25)`（25% 黑 drop，明显可见）
  这个 drop shadow 不会因为 hover 而改变（hover 规则只改 bg / color），所以 hover 状态下 link 周围还拖着一个 4px 8px 的灰色阴影，对比 tweakcn Codex preview 里 flat 的按钮就是"额外阴影"。`:active` 同理，`:focus-visible` 的 stacked box-shadow 里也叠了一个 `var(--shadow-xs)`，focus 时 ring + drop shadow 一起出现也算"额外"。修复——给 default.css 末尾加 theme-scope rule：
  - **`styles/themes/default.css`**: `:root[data-theme="default"] #main a, :root[data-theme="default-dark"] #main a { box-shadow: none; }` — specificity `(0, 2, 2)` 高于 `#main a` `(0, 1, 1)` 和 `#main a:hover/:active/:focus-visible` `(0, 1, 2)`，覆盖所有状态。`:focus-visible` 单独加一个 rule `box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)` — 保留 shadcn 标准的 3px focus ring（键盘可访问性需要），去掉叠在 ring 后面的 `var(--shadow-xs)`。
  - 其他主题（mx-brutalist / cyberpunk / astrovista）不受影响：mx-brutalist 有自己的 theme-scope rule 设 `box-shadow: var(--shadow-xs)`（brutalist 硬阴影签名），cyberpunk / astrovista 通过 `var(--shadow-xs)` 继承（neon glow / subtle drop）。

### Architecture
- Codex 的"主题本身效果"严格定义为：hover 切 `var(--accent)` 底 + `var(--accent-foreground)` 字。box-shadow / transform / border-color 等都不算。这与 shadcn button-outline 的 hover 行为一致（只动 bg + color）。v0.2.52 把 link 对齐到 shadcn Button 时，box-shadow 默认值仍保留（影响所有主题，包括 light theme 下 5% 黑 drop），v0.2.55 补全 `--shadow-xs` 后 Codex dark 下的 25% 黑 drop 变得可见。v0.2.56 显式在 Codex 主题下关掉。

## [0.2.55] - 2026-06-18

### Fixed
- **default / cyberpunk / astrovista 三个主题的 link hover 也都不生效**（用户反馈 "也要修复一下其他几个主题的 hover，我发现其他的主题的 hover 也不生效"）。v0.2.53 给 mx-brutalist.css 补全了 11 个 shadcn surface vars（`secondary` / `accent` / `destructive` / `card` / `popover` / `input` + 各自 foreground）后 mx-brutalist hover 正常；v0.2.53 同时也给 `globals.css` 加了同样 11 个 vars 的 shadcn slate 兜底，期望"没补全主题的 hover 仍能看到"。但 default / cyberpunk / astrovista 三个主题在 v0.2.53 期间**没补**这 11 个 surface vars。globals.css 也只定义了 `--newtab-highlight: var(--accent)` 等 alias，**没有** `--accent` / `--accent-foreground` / `--secondary` 等 var 的 `:` 兜底。后果：`#main a:hover` 里的 `var(--accent)` / `var(--accent-foreground)` 解析为 `unset`，CSS 引擎 fallback 到 background-color / color 属性的**初始值**（`transparent` + `canvastext`），与 default state 几乎无差异 → hover 视觉上看不出来。修复——按 tweakcn JSON verbatim 补全 11 个 surface vars：
  - **`styles/themes/default.css`**：light (`--accent: oklch(0.5286 0.1734 254.9750)` 蓝) + dark 两套。同时把 default 主题的 27 个 design tokens（radius、shadow 系统、fonts、tracking、spacing）一并补全——之前只有 8 个 vars，Codex 主题应有的 0.375rem radius + 2px 4px 0.05 阴影 + Inter 字体 都没传过来。
  - **`styles/themes/cyberpunk.css`**：light (`--accent: oklch(0.6354 0.2541 15.4582)` 霓虹红，dark purple bg 上对比强烈) + dark (--shadow-color 改 `#ff0055` 亮红，--shadow-blur 12px → 20px) 两套。补全 27 design tokens：radius=0rem 配 sharp neon look，Orbitron / Fira Code / Rajdhani 字体家族，neon glow shadow (0 0 12px 2px magenta / red)。
  - **`styles/themes/astrovista.css`**：light (`--accent: oklch(0.9119 0.0222 243.8174)` 浅蓝，cool-white bg 上有清晰 blue tint) + dark (`--accent: oklch(0.3380 0.0589 267.5867)` 深蓝，near-black bg 上对比明显) 两套。补全 27 design tokens：radius=0.5rem + subtle 1px 3px shadow + Outfit / Fira Code / Merriweather 字体。

### Architecture
- v0.2.53 给 mx-brutalist 补 11 vars + 给 globals.css 加 shadcn slate 兜底时，假设"globals.css 兜底够用了"。但 globals.css 当时**没**在 `:where(:root)` 定义 11 个 surface vars（只有 alias `--newtab-highlight: var(--accent)` 等）——`var(--accent)` 在没定义的情况下解析为 unset，fallback 到属性初始值。globals.css 这次没改是因为默认主题（default.css）已经完整定义了 11 vars，覆盖了 globals.css 兜底。v0.2.55 给所有 4 个内置主题都补全，runtime import 走 `custom-themes.ts:73-116` 的 `THEME_VARS_OPTIONAL` 已包含 11 surface vars（v0.2.53 加的）— 用户从 tweakcn paste 进来的主题直接有这 11 vars，无需操作。

## [0.2.54] - 2026-06-18

### Fixed
- **MX-Brutalist 主题下 link hover 无效果**（用户反馈 "但是链接的 hover 没了，hover 没效果"）。v0.2.53 在 `styles/themes/mx-brutalist.css` 的 link override 里写了 `background-color: var(--newtab-bg)`。该 override 选择器 `:root[data-theme="mx-brutalist"] #main a` 的 specificity 是 `(0, 2, 2)`（`:root` 伪类 + `[data-theme]` 属性 + `#main` ID + `a` 类型），而 newtab.css 的 `#main a:hover` specificity 是 `(0, 1, 1)`。CSS cascade 中 override 永远胜出，hover 时的 `background-color: var(--accent)` 永远不会生效。修复：删除 `mx-brutalist.css:133` 的 `background-color: var(--newtab-bg)` 行（与 newtab.css 默认 `var(--newtab-link-bg, var(--newtab-bg))` 冗余），加注释说明"不要在 override 里设 background-color，否则会锁死 hover"。default state 行为不变，hover 现在能切到 `var(--accent)` + `var(--accent-foreground)`（MX-Brutalist light = 橙黄底 + 深绿字；dark = 浅黄底 + 深绿字）。

## [0.2.53] - 2026-06-18

### Removed (全面移除"借鉴"装饰，使用主题自己的风格)
用户反馈"不需要从其他地方借鉴，直接使用主题的风格。请全面检查一下，有借鉴的地方都移除，使用主题的风格"。v0.2.48 / v0.2.50 我加的 neobrutalist 装饰（从 dribbble 风格参考借鉴）和 v0.2.45 之前的 `--newtab-highlight` 派生 hover 风格都**不是** tweakcn / shadcn 主题风格的元素。系统全面移除：

- **`styles/themes/mx-brutalist.css`**:
  - link + search-input `border: 3px solid` → `1px solid`（v0.2.48 借鉴的 2-3px neobrutalist 硬边；shadcn 实际是 1px，brutalist 视觉签名由 `var(--shadow-xs)` = `4px 4px 0 0` 撑起）。
  - link `:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 0 var(--shadow-color) }` 整块删除（v0.2.48 借鉴的"按下浮起"动画；shadcn button hover 不位移、不改 shadow）。
  - link `:active { transform: translate(0, 0) }` 删除（v0.2.48 借鉴的"active 复位"；shadcn button 没有 :active override，drop shadow 由 `:active` 默认态保留）。
  - **新增**：补全 11 个 shadcn surface vars（`secondary` / `secondary-foreground` / `accent` / `accent-foreground` / `destructive` / `destructive-foreground` / `card` / `card-foreground` / `popover` / `popover-foreground` / `input`）light + dark 各 1 套，按 tweakcn JSON verbatim。
- **`styles/newtab.css` link hover / active**:
  - hover 改用 shadcn button-outline 风格 `color: var(--accent-foreground) + background-color: var(--accent)`。移除：
    - `border-color: var(--primary)`（hover 不改 border）
    - `box-shadow: 0 0 var(--newtab-shadow-blur) var(--newtab-highlight)`（v0.2.45 之前的发光 hover 效果）
    - `transform: var(--newtab-link-transform-hover, none)`（hover 不位移）
  - active `box-shadow: var(--newtab-link-shadow-active, none)` → `var(--shadow-xs)`（保留 default 状态的 drop shadow，避免按下时闪烁）。
- **`styles/globals.css`**:
  - 兜底 11 个新增 shadcn surface vars（shadcn `slate` 调色板默认）。
  - 移除 `--newtab-surface: color-mix(in srgb, var(--newtab-bg), var(--newtab-text) 6%)` 派生（v0.2.32 引入，v0.2.50 后 link / search-input 都不再用，无人引用）。
  - `--newtab-highlight: color-mix(in srgb, var(--newtab-bg), var(--primary) 15%)` → `var(--accent)`（alias 到主题 accent，不再用 newtab 派生 15% mix）。
  - `--newtab-highlight-text: var(--foreground)` → `var(--accent-foreground)`。
- **`src/features/themes/custom-themes.ts`**: `THEME_VARS_OPTIONAL` 增加 11 个 shadcn surface keys（`secondary` / `secondary-foreground` / `accent` / `accent-foreground` / `destructive` / `destructive-foreground` / `card` / `card-foreground` / `popover` / `popover-foreground` / `input`）。runtime import tweakcn 主题时这些 vars 会随 paste 一并写入 storage（之前被丢弃）。

### Architecture
- 8 vars 限制 → 15 vars 实际。验证门槛仍是 8 个颜色 vars（`secondary` / `accent` 等是可选 pass-through）。这反映了一个 v0.2.41 时的简化判断错误——我们 link / search-input 实际渲染的是 shadcn Button / Input 组件，shadcn 组件依赖 `--accent` / `--input` 等 surface token。8 vars 兜底 hover 只能用 newtab 派生 (`--newtab-highlight`)，不是主题风格。v0.2.53 补全后 link / search-input 能直接用主题的 accent / accent-foreground / input 等。

### Migration
- **用户操作**：v0.2.53 之前 import 的主题需要重新粘贴 JSON 一次（11 个新 vars 在 storage 里没存，theme-scope hover / border 不会激活）。与 v0.2.50 类似。

## [0.2.52] - 2026-06-18

### Changed
- **link (button) / search-input 样式对齐 shadcn Button + Input class**（用户提供了两个完整 Tailwind class，要求"忽略一些布局相关的和字体大小相关的，但是其他的样式颜色那些你可以参考一下作为映射"）：
  - **`styles/newtab.css:106`** `#main a` `border-radius: 0.6em` → `calc(var(--radius) - 2px)`（shadcn `rounded-md` 派生：内 border-radius 比 --radius 小 2px，让可见圆角坐在 radius 圆内）。MX-Brutalist 主题下 `var(--radius) = 0` → `calc(0 - 2px)` clamp 到 0。
  - **`styles/newtab.css:129-142`** `#main a:focus-visible` 从 `outline: 2px solid var(--primary) + outline-offset: 2px` 改为 shadcn 标准的 `border-color: var(--ring) + box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent), var(--shadow-xs)`。`outline: none` 避免双 focus 指示。`var(--shadow-xs)` 保留在 shadow 栈第二项，focus 时主题 drop shadow 仍在（避免 brutalist 主题 focus 时 drop shadow 闪烁）。
  - **`styles/newtab.css:369`** `.search-input` `border-radius: var(--radius)` → `calc(var(--radius) - 2px)`（同上 rounded-md 派生）。
  - **`styles/newtab.css:376`** `.search-input` `background-color: var(--newtab-surface)` → `transparent`（shadcn `bg-transparent`）。原本的 6% color-mix 灰色在 search bar 上读起来像"灰底输入框"；改 transparent 让 search bar 与 page bg 融合。Glassmorphism 主题需要带色 search bar 时通过 theme-scope rule 覆盖。
  - **`styles/newtab.css:390-405`** `.search-input:focus / :focus-visible` 从 `border-color: var(--primary) + box-shadow: var(--shadow-xs), 0 0 0 2px var(--ring)`（2px ring）改为 shadcn 标准的 3px ring of `color-mix(oklab, var(--ring) 50%, transparent)` + 保留 `var(--shadow-xs)`。`outline: none`。
  - **`styles/newtab.css:411-418`** 新增 `.search-input::selection { background-color: var(--primary); color: var(--primary-foreground); }`（shadcn `selection:bg-primary selection:text-primary-foreground`）。
- **未引入的 shadcn 状态**（按 Simplicity First 暂不实现，等需要再加）：
  - `disabled:pointer-events-none disabled:opacity-50`：search bar 不 disabled，link folder 也不需要。
  - `aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40`：未引入 `--destructive` 到 8 vars（不属于必要 surface），先不加。等出现 form validation 场景再补。
  - `[&_svg]:size-4 / pointer-events-none / shrink-0`：link + folder header 的 svg 图标由各 element 自己的 .icon class 控制，不沿用 button 内部的 svg 处理。

## [0.2.51] - 2026-06-18

### Changed
- **所有 box-shadow 统一用 `var(--shadow-xs)`**（用户反馈 "给他们的 shadow 都使用 shadow-xs 的效果，看起来是这样的 .shadow-xs { --tw-shadow: var(--shadow-xs); box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow); }"）：
  - shadcn 的 `.shadow-xs` 完整定义里有 5 个 box-shadow 层组合（前 4 个 `--tw-*` 是 Tailwind 内部，初始值都是 `0 0 transparent`，加上不影响渲染；最后一个是真正的 `var(--shadow-xs)` 值）。我们没引入 Tailwind，所以用简化形式 `box-shadow: var(--shadow-xs)` 视觉效果等价。
  - **`styles/newtab.css:103`** `#main a` `box-shadow: var(--shadow-sm)` → `var(--shadow-xs)`。
  - **`styles/newtab.css:364`** `.search-input` `box-shadow: var(--shadow)` → `var(--shadow-xs)`。
  - **`styles/newtab.css:376`** `.search-input:focus` `box-shadow: var(--shadow), 0 0 0 2px var(--ring)` → `var(--shadow-xs), 0 0 0 2px var(--ring)`。
  - **`styles/themes/mx-brutalist.css:118,133`** link default + active `box-shadow: var(--shadow)` → `var(--shadow-xs)`。MX-Brutalist 主题下 `--shadow-xs` = `4px 4px 0px 0px hsl(0 0% 0% / 0.50)`，从 v0.2.50 的全不透明（1.00）变为半透明（0.50），符合 shadcn `.shadow-xs` 标准定义。Hover 状态仍用 `6px 6px 0 0 var(--shadow-color)`（独立计算的不跟随 --shadow-xs）。

## [0.2.50] - 2026-06-18

### Architecture
- **tweakcn 主题装饰细节不再丢失**（用户反馈 "MX-Brutalist 的 search bar 应该是这样的，所以要看看直接使用 tweakcn 主题的时候，不能丢失这些细节"）。v0.2.41 决定 runtime import 只接受 8 个 shadcn 颜色 vars，丢弃 tweakcn 的 radius / shadow / 字体系统。后果：直接 import MX-Brutalist 后 search bar 还是 8px 圆角 + 0 阴影 + system-ui 字体，tweakcn 的 brutalist 装饰（0px 圆角 + 4px 4px 0 0 黑阴影 + Montserrat）一个都没传过来。修复——完整架构调整：
  - **`src/features/themes/custom-themes.ts`**：把 `THEME_VARS` 拆成两层。8 个颜色 vars 仍是 validate 必填门槛；新增 `THEME_VARS_OPTIONAL`（27 个 vars：`radius`、6 个 shadow primitives、8 个 shadow 预设、3 个字体、7 个 letter-spacing / tracking、1 个 `spacing`）作为 pass-through。`pickVars` 把两者都收集，存储大小从 ~1KB/entry 涨到 ~1.5KB/entry。`emitBlock` 按 keys 顺序输出所有非空 vars。Tweakcn 其他不相关的 vars（chart-* / sidebar-* / card* / popover* / secondary / accent / destructive / input）仍然丢弃——newtab01 不渲染这些 surface。**用户操作**：v0.2.50 之前 import 的主题需要重新粘贴 JSON 一次，因为 storage 里只存了 8 vars，升级不会自动回填。
  - **`styles/globals.css`**：`:where(:root)` 增加 27 个 optional vars 的 shadcn 默认值兜底（`--radius: 0.5rem`、shadcn 风格 `--shadow` 栈、system 字体栈、`--letter-spacing: 0em` 等）。任一主题块不写这些 vars 也能渲染出 sensible 的样式。
  - **`styles/newtab.css` `.search-input`**：硬编码 `border-radius: 8px` 改为 `var(--radius)`；加 `box-shadow: var(--shadow)` 默认状态。`:focus` 状态 box-shadow 改为 `var(--shadow), 0 0 0 2px var(--ring)` 保留主题的 drop shadow + 叠 focus ring。`.search-input` 整元素现在从 theme vars 自动派生——MX-Brutalist 主题下 `var(--radius)` = 0px，`var(--shadow)` = 4px 4px 0 0 黑阴影，无需 theme-scope override。
  - **`styles/newtab.css` `#main a`**：硬编码 `box-shadow: 0 1px 2px hsl(0 0% 0% / 0.05)` 改为 `var(--shadow-sm)`。Codex 主题下得到柔光 shadcn 阴影；MX-Brutalist 主题下（`--shadow-sm: 4px 4px 0 0 ...`）自动得到硬阴影。
  - **`styles/themes/mx-brutalist.css`**：补全 8 vars + 27 optional vars（按 tweakcn JSON verbatim）。light 主题 shadow color = `hsl(0 0% 0%)` 纯黑；dark 主题 = `hsl(45 100% 80%)` 暖白。Link override 改用 `var(--shadow)` / `var(--shadow-color)`（v0.2.48 硬编码 `4px 4px 0 0 hsl(0 0% 0% / 1)` 改为 `var(--shadow)`，dark variant 自动跟随 `--shadow-color` 切换）。**新增** `:root[data-theme="mx-brutalist"] .search-input` theme-scope override：3px 硬黑边（tweakcn 不定义 input border width，brutalist 风格典型是 2-3px）+ 由 `var(--radius)` 和 `var(--shadow)` 自动派生的 0 圆角 + 4px 4px 0 0 阴影——search bar 与 link 视觉一致。

## [0.2.49] - 2026-06-18

### Changed
- **齿轮按钮微调**（用户反馈 "setting 按钮在现在的基础上大一丢丢，然后再往左边一些，增大 right 值"）：
  - `styles/newtab.css:485` `#options_button` `right: 16px` → `24px`（增大 right 值 → 齿轮往左挪 8px，离视口右边 24px 留白）。
  - `src/newtab/topbar.ts:55` SVG `width/height: 16` → `18`（大一丢丢：齿轮图标从 16px 增到 18px，stroke-width=2 不动保持视觉粗细感）。

## [0.2.48] - 2026-06-18

### Fixed
- **还原 v0.2.47 误改的齿轮按钮位置**（用户反馈 "setting 图标修改后更靠右了都看不到了"）。v0.2.47 我把 `#options_button` 的 `right` 从 `16px` 改到 `0` 时**误判了 CSS containing block**：absolute 子元素的 `right` 是相对祖先的 **padding box**（content + padding），不是 content box。`#topbar` 的 `border-width: 0`、`padding-right: 16px` 时，padding box 的右 edge **就是**视口右 edge —— `right: 0` 把齿轮顶到屏幕最右边缘而不是"距视口 16px"。改回 `right: 16px`。
- **重写 MX-Brutalist 主题**（用户反馈 "请移除现在 MX-Brutalist 的主题，重新安装 `https://tweakcn.com/r/themes/cmllfu8oc000004l1a0tidj2g`，主题名称不要乱汉化。同时它的 button 链接应该是带有效果的"）：
  - `styles/themes/mx-brutalist.css` 整文件重写，8 vars 严格按 tweakcn 原始 JSON（light 块用 `oklch(0.9923 0.0104 91.4994)` 系米色背景 + 深绿 primary + 纯黑 border；dark 块用 `oklch(0.1649 0.0308 162.2739)` 系深绿背景 + 亮绿 primary + 暖白 border）。
  - **重新引入 brutalist link 装饰**（v0.2.45 删过一次）：以 `:root[data-theme="mx-brutalist"] #main a` 主题作用域选择器实现，3px 硬黑边 + 0 radius + `4px 4px 0 0` 实心阴影。hover 时 `translate(-2px, -2px)` + 阴影扩到 `6px 6px`（neo-brutalist "按下" 动画），active 复原。dark 变体 shadow 颜色用 tweakcn dark 主题原配 `hsl(45 100% 80%)` 暖白代替纯黑。Selector specificity (0,2,1) 高于 newtab.css 的 `#main a` (0,1,1) 胜出，但不影响其他内置主题。
  - `settings-panel.ts` 的 `THEME_LABELS` 移除"乱汉化"：`'mx-brutalist': 'MX 暴力'` → `'mx-brutalist': 'MX-Brutalist'`、`'mx-brutalist-dark': 'MX 暴力·暗'` → `'mx-brutalist-dark': 'MX-Brutalist Dark'`（尊重原作者命名 Victor Hugo Avelar Ossorio）。其他主题中文名不动（用户常规偏好）。

## [0.2.47] - 2026-06-18
> **Retracted in 0.2.48** — the CSS containing block was misread. The change
> below pinned the gear flush against the viewport right edge instead of
> giving it a 16px gutter. Reverted in v0.2.48.

### Fixed
- 右上角齿轮按钮顶到视口边缘（用户反馈 "那个 Settings 图标太靠右了，可以加点右边距"）：`#options_button` 是 `#topbar`（`position: relative; padding: 16px`）的绝对定位子元素，CSS 规范规定 `right` 相对父容器的 **padding edge**（不是 border edge），所以 `right: 16px` 与 topbar 的 `padding-right: 16px` 互相抵消，齿轮实际距视口右 0px。改为 `right: 0`，由 topbar 的 padding 提供视觉间距 —— 以后调整 topbar padding 齿轮会同步跟随。

## [0.2.46] - 2026-06-18

### Fixed
- **修复 v0.2.45 Codex 主题 link 背景变灰 + 无阴影的视觉回归**（用户反馈 "codex 的 button 是白色背景的，但是你生成的是灰色的。而且它的还是带一点点的阴影的"）：
  - **`styles/newtab.css:82`** link 默认 `background-color` 由 `var(--newtab-surface)` 改为 `var(--newtab-bg)`。`--newtab-surface` 在 `globals.css` 是 `color-mix(in srgb, var(--newtab-bg), var(--newtab-text) 6%)` 派生，light theme 下读起来就是"灰色填充"而不是 Codex 风格的"白底按钮"。v0.2.34 时代 `default.css` 还有一行 `--newtab-surface: #ffffff;` override 视觉 reset 到白底，v0.2.45 把 `default.css` 改成 `[data-theme="default"] { 8 shadcn vars }` 块时这个 override 被一并删掉了，灰色派生顺势生效。
  - **`styles/newtab.css:86`** link 默认 `box-shadow` 由 `none` 改为 `0 1px 2px hsl(0 0% 0% / 0.05)`（Tailwind `shadow-sm` 等价，Codex 真实按钮的微阴影）。
  - `globals.css` 的 `--newtab-surface` 派生本身不动（其他地方仍依赖，如 `.search-input` 区分搜索框与 page bg）。
  - `--newtab-link-bg` / `--newtab-link-shadow` 仍是 per-theme 出口：brutalist / glassmorphism 等未来 link 装饰预设直接覆盖这两个变量即可。

## [0.2.45] - 2026-06-18

### Features
- **default / default-dark 改用 tweakcn "Codex" 调色板**（`cmpu4oh99000304l404e1ct14`）。原本 `:where(:root)` 是一组手调 hex 基线，现在对齐到 tweakcn 的 shadcn 默认风格：白底 / 近黑字 + 蓝主色，干净专业。下拉框里的 "默认 / 默认·暗" 名字不变。
- **MX-Brutalist 补齐 dark variant**：从 tweakcn JSON 提取 dark 块（深绿底 + 亮绿 primary + 奶白文字）作为 `mx-brutalist-dark` 主题。同时 v0.2.40 那个 6 个 `--newtab-link-*` 装饰（4px 4px shadow、3px border、0 radius 等）从 CSS 文件中删除 —— 所有内置主题现在统一只声明 8 个 shadcn vars，不再硬编码 link 装饰。brutalist 视觉特色由默认 8 vars（0 radius 的 `--border`、高对比的 `--foreground` 等）自然呈现，shadow 装饰以后作为"link 装饰预设"功能单独设计。
- **`.globals.css` `:where(:root)` 基线** 与 `default` 主题一致：8 shadcn vars 改为 Codex 调色板，确保任何"已删除主题"的 chrome.storage 状态（v0.2.42 删除的主题）落到 fallback 视觉 = `default` 主题，与 explicit 选 `default` 一致。

### Built-in themes (8 total)
- `default` (Codex light) / `default-dark` (Codex dark)
- `mx-brutalist` (tweakcn `cmllfu8oc000004l1a0tidj2g` light) / `mx-brutalist-dark` (dark)
- `cyberpunk` / `cyberpunk-dark` (tweakcn `cmon6sc5v000204la41n1g1gv`)
- `astrovista` / `astrovista-dark` (tweakcn `cmlk6zefr000004lbe9jygsqc`)

## [0.2.44] - 2026-06-18

### Changed
- **目录与子目录层级间距全面调整**（用户反馈 "目录之间也要大一些，父和子之间尤其要大一些"）：
  - **父→子列表 边距**：`margin-top: 4px` → `calc(var(--newtab-spacing) * 1.4)`（10px 默认 → 14px）—— 4px 太紧，文件夹与子列表视觉上粘在一起
  - **子层级缩进**：`padding-left: 24px` → `calc(var(--newtab-spacing) * 1.8)`（10px 默认 → 18px）—— 减少深嵌套树的水平占位
  - **子 ul 内 gap**：`var(--newtab-spacing)` → `calc(var(--newtab-spacing) * 0.8)`（10px 默认 → 8px）—— 子层级读起来"更细"，与父层级形成视觉差
  - **子层级 folder 额外 top margin**：`calc(var(--newtab-spacing) * 0.2)`（10px 默认 → 2px）—— 解决子层级内 folder 挨在一起的密集感
  - 所有值都用 `calc(var(--newtab-spacing) * X)` 形式，用户的 `spacing` 设置会按比例缩放整个层级（spacing 6px → 父→子 8.4px / 缩进 10.8px / 子 gap 4.8px；spacing 16px → 父→子 22.4px / 缩进 28.8px / 子 gap 12.8px），不会破坏可读性。

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