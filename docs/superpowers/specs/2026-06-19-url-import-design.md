# URL Import for Custom Themes — 设计 spec

> 日期: 2026-06-19
> 目标分支: `feat/url-import`（从 `main` 拉出）
> 状态: 待 review
> 关联: v0.2.74 的 CSS paste、v0.2.75 的 darkMode 设置、v0.2.77 的 URL paste

## 1. 目标

在「自定义主题」tab 的导入区加第三种输入格式：**tweakcn 主题 URL**。粘贴 `https://tweakcn.com/themes/<id>`，自动补成 `https://tweakcn.com/r/themes/<id>` 拉 JSON，然后**走和 CSS paste 一样的下游流程**（validate → install → auto-switch）。

**顺便移除** v0.2.74 还在的 "raw JSON 粘贴" 入口（之前用于测试，现在 URL 已能覆盖相同场景）。`detectInputFormat` 从 `'css' | 'json' | 'url'` 缩到 `'css' | 'url'`；`runThemeValidation` 删掉 JSON 分支。`validateThemeJson` 内部仍被 URL 路径调用（fetch 回来的文本要 parse 成 JSON 再 validate），保留不动。

## 2. URL 形式

| 类型 | 形式 | 处理 |
|---|---|---|
| 主题 URL | `https://tweakcn.com/themes/<id>` | 加 `/r/` → JSON URL |
| JSON URL | `https://tweakcn.com/r/themes/<id>` | 原样 fetch |
| 带 query / hash | `https://tweakcn.com/themes/abc?ref=foo` | query/hash 保留，主题 ID 部分加 `/r/` |

ID 是 tweakcn 内部的 nanoid-like 字符串（`cmo5ifogt000304jm34v746n2` 等），正则匹配 `[\w-]+`。

## 3. 非目标

- **不**支持非 tweakcn.com 的主题源（不留 generic URL 路径）
- **不**做内存缓存（用户每次粘贴都是显式 action，重复 fetch 无所谓）
- **不**做 URL 重试 / 超时设置（浏览器 fetch 默认即可）
- **不**做 URL 预览（用户主动粘贴才处理）
- **不**给 hint 解释 URL 怎么拿（用户应该已经知道）
- **不**给暗色 / 浅色 URL 变体做特殊处理（tweakcn 主题的 light/dark 都在同一个 JSON 里，CSS parse 阶段自然处理）

## 4. 架构

```
用户粘贴到 textarea
        ↓
detectInputFormat(raw)        ← 缩为 'css' | 'url'
   ├─ 'css' → parseCssTheme(raw, name) → validateThemeJson → install
   └─ 'url' → 新路径 ↓
        ↓
detectTweakcnUrl(raw)         ← 正则 /^https?:\/\/tweakcn\.com\/(r\/)?themes\/[\w-]+/
   ├─ null  → "URL 格式不正确：tweakcn 主题 URL 应该是 https://tweakcn.com/themes/<id>"
   └─ 'theme' | 'json'
        ↓
toTweakcnJsonUrl(raw)         ← 'json' 原样；'theme' 加 /r/
        ↓
UI: Apply 按钮 disable + 显示进度条
        ↓
chrome.runtime.sendMessage({ type: 'fetchThemeJson', url })
        ↓
background.ts handler:
   fetch(url, { credentials: 'omit' })
   ├─ res.ok = false → { ok: false, error: 'HTTP <status> <statusText>' }
   ├─ fetch 抛异常 → { ok: false, error: <Error.message> }
   └─ 成功 → { ok: true, text: <response body> }
        ↓
UI: 进度条消失 + Apply 按钮 re-enable
        ↓
JSON.parse(text)
   ├─ 失败 → "JSON 解析失败: ..."
   └─ 成功 → 继续 ↓
        ↓
若用户在 name input 填了 name，override parsed.name
（用户给的 name 优先于 JSON 里的 name）
        ↓
validateThemeJson(parsed, existing)   ← 复用 8 required var 检查
        ↓
installCustomTheme + saveThemeChange + ...   ← 完全复用 v0.2.77 之前的所有下游
```

## 5. 模块结构

### 5.1 新文件 [src/features/themes/url-import.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/themes/url-import.ts)（~50 行）

```ts
/** Distinguish tweakcn theme URL (no /r/) from JSON URL (has /r/).
 *  Returns null if the input doesn't match the tweakcn URL shape. */
export type TweakcnUrlKind = 'theme' | 'json';
export function detectTweakcnUrl(raw: string): TweakcnUrlKind | null;

/** Normalize any tweakcn URL to the JSON URL form. JSON URLs pass
 *  through; theme URLs get `/r/` inserted into the path. */
export function toTweakcnJsonUrl(url: string): string;
```

### 5.2 改 [src/features/themes/css-import.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/themes/css-import.ts)（+5 / -3 行）

`detectInputFormat` 去掉 'json' 分支，加 'url' 分支：

```ts
// before
export function detectInputFormat(raw: string): 'css' | 'json' {
  const t = raw.trim();
  if (t.startsWith('{') || t.startsWith('[')) return 'json';
  if (t.startsWith(':root') || t.startsWith('@import')) return 'css';
  if (/--[\w-]+\s*:/.test(t)) return 'css';
  return 'json';
}

// after
export function detectInputFormat(raw: string): 'css' | 'url' {
  const t = raw.trim();
  if (t.startsWith(':root') || t.startsWith('@import')) return 'css';
  if (/--[\w-]+\s*:/.test(t)) return 'css';
  if (/^https?:\/\/tweakcn\.com\/(r\/)?themes\/[\w-]+/.test(t)) return 'url';
  return 'css';  // default to css for unrecognized input
}
```

### 5.3 改 [src/lib/chrome/messages.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/lib/chrome/messages.ts)（+8 / -1 行）

加 `fetchThemeJson` 到 Message union + isValidMessage 校验：

```ts
export type Message =
  | { type: 'createTabGroup'; tabIds: number[]; title?: string }
  | { type: 'refreshDeclarativeNetRequest' }
  | { type: 'fetchThemeJson'; url: string };

// in isValidMessage:
if (m['type'] === 'fetchThemeJson') {
  if (typeof m['url'] !== 'string') return false;
  if (!/^https?:\/\/tweakcn\.com\/r\/themes\/[\w-]+/.test(m['url'])) return false;
  return true;
}
```

SW 端只接受已经 normalize 过的 JSON URL（`/r/themes/` 形式），不再二次 normalize —— 单一职责。

### 5.4 改 [src/background.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/background.ts)（+18 行）

新增 handler + dispatch case + response type。背景 fetch 走 `host_permissions: ["<all_urls>"]` 已有的特权，**不依赖** tweakcn 返回 CORS 头。

```ts
type FetchThemeJsonResponse = { ok: true; text: string } | { ok: false; error: string };

// in the switch dispatch:
case 'fetchThemeJson':
  void handleFetchThemeJson(msg, sendResponse);
  return true; // async response

async function handleFetchThemeJson(
  msg: Extract<Message, { type: 'fetchThemeJson' }>,
  sendResponse: (response: FetchThemeJsonResponse) => void,
): Promise<void> {
  try {
    const res = await fetch(msg.url, { credentials: 'omit' });
    if (!res.ok) {
      sendResponse({ ok: false, error: `HTTP ${res.status} ${res.statusText}` });
      return;
    }
    const text = await res.text();
    sendResponse({ ok: true, text });
  } catch (err) {
    sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
```

### 5.5 改 [src/newtab/settings-panel.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/settings-panel.ts)（+30 / -25 行）

`runThemeValidation` 删 JSON 分支、加 URL 分支：

```ts
// before
async function runThemeValidation(
  raw: string,
  nameFromInput: string,
  existing: Awaited<ReturnType<typeof readCustomThemes>>,
): Promise<Awaited<ReturnType<typeof validateThemeJson>>> {
  if (detectInputFormat(raw) === 'css') {
    // CSS path
  }
  // JSON path
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch (e) { ... }
  return validateThemeJson(parsed, existing);
}

// after
async function runThemeValidation(
  raw: string,
  nameFromInput: string,
  existing: Awaited<ReturnType<typeof readCustomThemes>>,
): Promise<Awaited<ReturnType<typeof validateThemeJson>>> {
  if (detectInputFormat(raw) === 'url') {
    // URL path
    const kind = detectTweakcnUrl(raw);
    if (!kind) {
      return { ok: false, error: 'URL 格式不正确：tweakcn 主题 URL 应该是 https://tweakcn.com/themes/<id>' };
    }
    const jsonUrl = toTweakcnJsonUrl(raw);
    const fetched = await chrome.runtime.sendMessage<FetchThemeJsonResponse>({
      type: 'fetchThemeJson',
      url: jsonUrl,
    });
    if (!fetched?.ok) {
      return { ok: false, error: `加载失败: ${fetched.error}` };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fetched.text);
    } catch (e) {
      return { ok: false, error: `JSON 解析失败: ${(e as Error).message}` };
    }
    // User-supplied name overrides the JSON's `name` field
    if (nameFromInput) {
      (parsed as { name?: string }).name = nameFromInput;
    }
    return validateThemeJson(parsed, existing);
  }
  // CSS path (unchanged from v0.2.77)
  if (!nameFromInput) {
    return { ok: false, error: '请先输入主题名称' };
  }
  const parsed = parseCssTheme(raw, nameFromInput);
  if (!parsed.ok) {
    return { ok: false, error: `CSS 解析失败: ${parsed.error}` };
  }
  return validateThemeJson(parsed.json, existing);
}
```

Apply handler 加 loading UX（disable + 进度条）：

```ts
const apply = ...; // existing ref
const progress = ...; // new <div class="sp-progress">

apply.addEventListener('click', async () => {
  // ... existing pre-validation guards ...
  apply.disabled = true;
  progress.classList.add('sp-progress--active');
  try {
    // ... existing validation + install + auto-switch + status logic ...
  } finally {
    apply.disabled = false;
    progress.classList.remove('sp-progress--active');
  }
});
```

UI 文案更新：

```ts
textarea.placeholder =
  '粘贴 tweakcn 主题 URL（https://tweakcn.com/themes/...）\n' +
  '或 tweakcn 主题 CSS（:root { ... } .dark { ... } 块）';

const hint = el('p', 'sp-hint');
hint.textContent =
  '把 tweakcn 主题粘贴到下方文本框（支持 URL 或 CSS），点击「应用」即可立即安装（持久保存到本地）。';
```

### 5.6 改 [styles/newtab.css](file:///Users/lingsmbp/Documents/aiwork/newtab01/styles/newtab.css)（+18 行）

`.sp-progress` indeterminate shimmer：

```css
.sp-progress {
  display: none;
  position: relative;
  height: 3px;
  margin-top: 12px;
  background: var(--muted);
  border-radius: 2px;
  overflow: hidden;
}
.sp-progress--active {
  display: block;
}
.sp-progress--active::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    var(--primary),
    transparent
  );
  animation: sp-progress-indeterminate 1.2s linear infinite;
}
@keyframes sp-progress-indeterminate {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

放置位置：import section 内，Apply 按钮**下面**、status 元素**上面**。fetch 期间显示，结束后消失。

## 6. 关键边界 case

| 场景 | 行为 |
|---|---|
| 主题 URL `https://tweakcn.com/themes/abc` | 加 `/r/` → fetch `https://tweakcn.com/r/themes/abc` |
| JSON URL `https://tweakcn.com/r/themes/abc` | 原样 fetch |
| URL 带 query `?foo=bar` | query 保留；normalize 时 `/themes/` → `/r/themes/` |
| URL 不匹配 tweakcn 模式 | "URL 格式不正确：..." |
| 404 / 5xx | "加载失败: HTTP 404 Not Found" |
| 网络断开 / DNS 失败 | "加载失败: Failed to fetch" |
| 响应不是合法 JSON | "JSON 解析失败: ..." |
| JSON 不含 8 required var | 走现有 validator 报错（文案不变） |
| 用户填了 name + URL | 用用户的 name（覆盖 JSON 的） |
| 用户没填 name + URL | 用 JSON 的 name |
| 同名主题已存在 | `installCustomTheme` 视为 update（status "✓ 已更新"） |
| 加载期间双击 Apply | disabled 防重入 |
| 加载期间 network 慢 | 进度条持续 shimmer；fetch 完瞬间消失 |

## 7. UI 渲染结果

custom-themes tab 内 import section（v0.2.77 之后）：

```html
<section class="sp-custom-import">
  <h3>导入自定义主题</h3>
  <p class="sp-hint">
    把 tweakcn 主题粘贴到下方文本框（支持 URL 或 CSS），点击「应用」即可立即安装。
  </p>
  <textarea id="sp-custom-theme-json" rows="8" spellcheck="false"
            placeholder="粘贴 tweakcn 主题 URL（https://tweakcn.com/themes/...）
或 tweakcn 主题 CSS（:root { ... } .dark { ... } 块）"></textarea>
  <input type="text" id="sp-custom-theme-name" class="sp-name-input"
         placeholder="主题名称（CSS 粘贴必填；URL 粘贴时可选，未填则用 JSON 里的）">
  <div class="sp-actions">
    <button id="sp-custom-theme-apply" class="sp-btn-primary">应用</button>
  </div>
  <div id="sp-custom-theme-progress" class="sp-progress"></div>      <!-- ★ 新增 -->
  <div id="sp-custom-theme-status" role="status" aria-live="polite"></div>
</section>
```

加载期间：`#sp-custom-theme-apply[disabled]` + `.sp-progress--active` 类 → shimmer 进度条。fetch 完成（无论成败）：按钮 re-enable + 进度条 class 移除 + status 文案显示。

## 8. 改动文件总览

| 文件 | 改动 | 行数 |
|---|---|---|
| 新文件 [src/features/themes/url-import.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/themes/url-import.ts) | `detectTweakcnUrl` + `toTweakcnJsonUrl` | +45 |
| [src/features/themes/css-import.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/themes/css-import.ts) | `detectInputFormat` 缩为 `'css' \| 'url'`，默认 'css' | +3 / -3 |
| [src/lib/chrome/messages.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/lib/chrome/messages.ts) | `Message` union 加 `fetchThemeJson` + validator 校验 | +8 |
| [src/background.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/background.ts) | `handleFetchThemeJson` handler + dispatch case | +18 |
| [src/newtab/settings-panel.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/settings-panel.ts) | `runThemeValidation` URL 分支 + 删 JSON 分支；Apply handler loading UX；progress bar 控制；placeholder + hint 文案 | +30 / -25 |
| [styles/newtab.css](file:///Users/lingsmbp/Documents/aiwork/newtab01/styles/newtab.css) | `.sp-progress` indeterminate shimmer | +18 |
| [CHANGELOG.md](file:///Users/lingsmbp/Documents/aiwork/newtab01/CHANGELOG.md) | `[0.2.77]` Added + Removed 段 | +8 |
| [package.json](file:///Users/lingsmbp/Documents/aiwork/newtab01/package.json), [manifest.json](file:///Users/lingsmbp/Documents/aiwork/newtab01/manifest.json) | 0.2.76 → 0.2.77 | 1 / 1 |

总改动：~130 行。CSS 0 改（除了新增的 `.sp-progress`）。`validateThemeJson` / `installCustomTheme` / `injectCustomThemesStyle` / `saveThemeChange` / emit / auto-switch —— 全部 0 改动。

## 9. 测试 / 验证

- **真实 URL**：粘贴 `https://tweakcn.com/themes/cmo5ifogt000304jm34v746n2` → 进度条显示 → fetch → 进度条消失 → 主题出现在列表 + 切到新主题
- **JSON URL**：粘贴 `https://tweakcn.com/r/themes/cmo5ifogt000304jm34v746n2` → 同上（不经 normalize）
- **URL 错误**：`https://google.com` → "URL 格式不正确：..."
- **404 URL**：`https://tweakcn.com/r/themes/nonexistent123` → "加载失败: HTTP 404 Not Found"
- **网络断开**（DevTools Network → Offline）→ "加载失败: Failed to fetch" / "TypeError: Failed to fetch"
- **JSON 缺失 8 required**（mock 服务返回不完整 JSON）→ validator 既有错误
- **覆盖 name**：URL fetch 回来 `name: "Whatsapp"`，用户在 input 填 "MyTheme" → 存储里 name 是 "MyTheme"
- **加载期间 disabled**：双击 Apply 不会触发两次
- **build**：`pnpm build` 通过，newtab JS 增 ≤ 2KB，background JS 增 ≤ 1KB

## 10. 不做（YAGNI）

- **不做内存缓存** —— YAGNI
- **不支持非 tweakcn.com URL** —— YAGNI
- **不做 retry / 超时** —— 失败用户重新粘贴
- **不做 URL 预览** —— 用户主动粘贴
- **不删 validateThemeJson 内部对 JSON 字段的解析** —— 仍被 URL 路径用
- **不**改 settings-panel.ts 里其他 tab（外观 / 功能 / 高级） —— 不相关
- **不**改 storage schema —— name 字段仍是 `string`
- **不**改 auto-switch 行为 —— `saveThemeChange(baseId)` 走完全相同的流程
