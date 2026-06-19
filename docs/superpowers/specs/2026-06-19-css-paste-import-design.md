# CSS Paste Import — 设计 spec

> 日期: 2026-06-19
> 目标分支: `feat/css-paste-import`（从 `feat/custom-themes-tab` 拉出）
> 状态: 待 review
> 关联: v0.2.73 引入的「自定义主题」tab、v0.2.50 起的 tweakcn JSON 导入

## 1. 目标

在 v0.2.73 的「自定义主题」tab 里，把**主输入格式从 JSON (registry-item) 切到 CSS**，原因：

- tweakcn 界面的"复制"按钮默认吐出 CSS（`:root` + `.dark` 块），不是 JSON
- CSS 是用户在浏览器 DevTools 里直接看到的格式，复制门槛低
- JSON 是中间表示，结构化字段（`cssVars.theme` 共享块、`$schema`、`type`）对终端用户无意义

**保留 JSON 解析路径**作为「高级 / 测试」路径，UI 上不折叠、不显式 toggle —— auto-detect 在 Apply 时按首字符分发。

## 2. 非目标

- **不**实现 URL 导入（用户在 conversation 中提过作为"远期"方向，本次不做）
- **不**解析 `body { letter-spacing: ... }` 之类 element-level 规则（跟 JSON 路径行为一致；element 规则有 `@layer` 嵌套与 CSS 变量优先级问题，YAGNI）
- **不**计算 `cssVars.theme` 共享块（项目的 `emitBlock` 不读 theme 字段，dead code —— 给空对象即可）
- **不**做格式显式 toggle（auto-detect 足够；将来要"隐藏 JSON"是 UI 折叠层面的事，不影响后端）
- **不**改 `validateThemeJson` / `installCustomTheme` / `emitBlock` 等下游（CSS 路径走完后构造出 `TweakcnJson` 形状，**复用**现有 validator + install + emit 全链路）
- **不**支持 `.dark` 之外的 dark-mode 变体（如 `[data-theme="dark"]`、媒体查询 `@media (prefers-color-scheme: dark)`）

## 3. 架构总览

```
用户粘贴 raw 到 textarea
        ↓
[settings-panel] detectFormat(raw)
        ├─ trim 后以 '{' 或 '[' 开头 → JSON 路径（v0.2.73 既有逻辑，0 改动）
        └─ 含 ':root' / '@import' / '--xxx:' 模式 → CSS 路径
                ↓
[css-import.ts] parseCssTheme(raw, name)
   1. 提取 :root { ... } 块 → light vars
   2. 提取 .dark { ... } 块 → dark vars（可选，缺则无 dark 变体）
   3. 规范化:
      shadow-x  → shadow-offset-x
      shadow-y  → shadow-offset-y
   4. 构造 TweakcnJson: { name, type: 'registry:style', cssVars: { theme: {}, light, dark? } }
        ↓
[custom-themes.ts] validateThemeJson(parsed, existing)  ← 完全复用
   • 检查 8 个 required shadcn var
   • 检查 dark 块（如有）也含 8 个 required
        ↓
[custom-themes.ts] installCustomTheme(entry)  ← 完全复用
   • 写入 chrome.storage.local.customThemes
   • injectCustomThemesStyle 刷新 <style id="custom-themes">
   • rerenderCurrentTab 刷新 custom-themes tab（dropdown + 列表）
```

**下游代码 0 改动**。CSS 路径的产物（storage 里的 entry、emit 出的 `:root[data-theme="user-xxx"]` CSS、dropdown 里的标签）跟 JSON 路径**完全一致**。

## 4. 模块结构

### 4.1 新文件：`src/features/themes/css-import.ts`（~80 行）

**导出**：

```ts
export type CssParseResult =
  | { ok: true; json: TweakcnJson }
  | { ok: false; error: string };

/** Parse a tweakcn-generated CSS string into the TweakcnJson shape
 *  that validateThemeJson() already accepts. Caller is expected to
 *  pass the result through validateThemeJson() for the 8 required
 *  shadcn var check + dark variant validation. */
export function parseCssTheme(css: string, name: string): CssParseResult;

/** Cheap format detection used by the settings panel Apply handler.
 *  Returns 'css' or 'json'. Defaults to 'json' for unrecognized
 *  input (backward compat with the v0.2.73 path). */
export function detectInputFormat(raw: string): 'css' | 'json';
```

**实现细节**：

- 用正则（不引 CSS parser 库）：
  - `/:root\s*\{([^}]+)\}/` 提 light 块
  - `/\.dark\s*\{([^}]+)\}/` 提 dark 块
  - 块内 `/--([a-z0-9-]+)\s*:\s*([^;]+);/gi` 提 var pairs
- 注释剥离：`/\/\*[\s\S]*?\*\//g`
- `@import` / `@theme inline` / `@layer base` / `@custom-variant` 整段忽略（不影响 `:root` / `.dark` 提取）
- 命名规范化在 `parseBlock` 内部映射：
  ```ts
  const KEY_NORMALIZE: Record<string, string> = {
    'shadow-x': 'shadow-offset-x',
    'shadow-y': 'shadow-offset-y',
  };
  ```
- 返回 `TweakcnJson` 时 `cssVars.theme = {}`（dead code 字段，但 validator 要求 key 存在）

**`detectInputFormat` 规则**：

```ts
function detectInputFormat(raw: string): 'css' | 'json' {
  const t = raw.trim();
  if (t.startsWith('{') || t.startsWith('[')) return 'json';
  if (t.startsWith(':root') || t.startsWith('@import') || /^[\s@]*(?::root|\.dark|--[\w-]+\s*:)/m.test(t)) return 'css';
  return 'json'; // default to JSON for backward compat
}
```

### 4.2 改动：`src/newtab/settings-panel.ts`（~30 行）

**`buildCustomThemeImportSection` 改动**：

1. 在 textarea 下新增一个 name input
   - `<input type="text" id="sp-custom-theme-name">`
   - placeholder: "主题名称（CSS 粘贴必填，JSON 自动填入）"
2. textarea placeholder 改为：
   - `"粘贴 tweakcn 主题 CSS (:root { ... } .dark { ... } 块)\n或 JSON (registry-item 高级格式)"`
3. 在 textarea 与 Apply 按钮之间加一行小字提示：
   - `"支持 CSS（tweakcn 默认复制格式）和 JSON (registry-item)。"`
4. Apply click handler 前置 `detectInputFormat` 分派
5. CSS 路径额外校验 name 非空，否则 `setCustomThemeStatus(status, 'error', '请先输入主题名称')` 并 return

**JSON 路径**：完全不动原逻辑。新增的 name input 在 JSON 路径下被忽略（仍走 `result.entry.light.name`）。

**CSS 路径**：

```ts
} else {
  const css = raw;
  const name = nameInput.value.trim();
  if (!name) {
    setCustomThemeStatus(status, 'error', '请先输入主题名称');
    return;
  }
  const parsed = parseCssTheme(css, name);
  if (!parsed.ok) {
    setCustomThemeStatus(status, 'error', `CSS 解析失败: ${parsed.error}`);
    return;
  }
  const result = validateThemeJson(parsed.json, existing);
  if (!result.ok) {
    setCustomThemeStatus(status, 'error', result.error);
    return;
  }
  // ↓ 后续 installCustomTheme / inject / rerender 完全复用 JSON 路径
}
```

### 4.3 改动：`styles/newtab.css`（~10 行）

新增 `.sp-name-input` 样式（与 `.sp-input` 同源，但 max-width 限制让 name 不占满整行）：

```css
.sp-name-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--background);
  color: var(--foreground);
  font-size: 1.15rem;
  box-sizing: border-box;
}
.sp-name-input:focus {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}
```

> **注**：原 `.sp-input` class 是 settings panel 里包裹 input + revert-btn 的 flex 容器，复用会带 revert 按钮（不需要）。新 class 是独立样式。

## 5. UI 渲染结果

custom-themes tab 的导入 section 渲染出来：

```html
<section class="sp-custom-import">
  <h3 class="sp-custom-heading">导入自定义主题</h3>
  <p class="sp-hint">
    把 tweakcn 主题的 CSS 粘贴到下方文本框，点击「应用」即可立即安装
    （持久保存到本地）。JSON (registry-item) 格式同样支持。
  </p>
  <textarea id="sp-custom-theme-json" rows="8" spellcheck="false"
            placeholder="粘贴 tweakcn 主题 CSS (:root { ... } .dark { ... } 块)
或 JSON (registry-item 高级格式)"></textarea>
  <input type="text" id="sp-custom-theme-name" class="sp-name-input"
         placeholder="主题名称（CSS 粘贴必填，JSON 自动填入）">
  <p class="sp-hint" style="...">
    支持 CSS（tweakcn 默认复制格式）和 JSON (registry-item)。
  </p>
  <div class="sp-actions">
    <button id="sp-custom-theme-apply" class="sp-btn-primary">应用</button>
  </div>
  <div id="sp-custom-theme-status" role="status" aria-live="polite"></div>
</section>
```

`#sp-custom-theme-json` 的 id **保留**（与已有 CSS 规则 + 任何旧测试 selector 兼容），DOM 含义现在是"粘贴区"而非"JSON 文本框"。

## 6. 错误处理

| 场景 | 错误提示 | 来源 |
|---|---|---|
| 文本框为空 | "请先粘贴 CSS 或 JSON" | detect 前置 |
| JSON 解析失败 | "JSON 解析失败: {native error}" | `JSON.parse` catch |
| CSS 缺 `:root` 块 | "CSS 解析失败: 未找到 :root { ... } 块" | parseCssTheme |
| CSS 缺 name (CSS 路径) | "请先输入主题名称" | Apply handler 前置 |
| 缺 8 required shadcn var | `validateThemeJson` 既有错误 | validator |
| dark 块缺 8 var | `validateThemeJson` 既有错误 | validator |
| name 重复 | `installCustomTheme` 视为 update，status 显示 `✓ 已更新 "{name}"` | 既有逻辑 |

## 7. 测试 / 验证

- **手动测试**（用户描述）：
  1. 从 tweakcn 复制任意主题的 CSS（含 `:root` + `.dark`），粘贴到 textarea
  2. 输入 name "Test Theme"，点 Apply
  3. 期望：主题出现在「已安装的自定义主题」列表，theme dropdown 出现 `user-test-theme` 选项
- **JSON 路径回退测试**：
  1. 粘贴一个 tweakcn JSON 到 textarea（name 内嵌），点 Apply
  2. 期望：行为跟 v0.2.73 完全一致（name input 被忽略）
- **格式检测边界**：
  - 空白 + JSON → 仍走 JSON 路径（trim 后判首字符）
  - CSS 不带 `.dark` → 走 CSS 路径，仅 light，无 dark 变体（status 显示 "No cssVars.dark provided" 警告，与 JSON 路径一致）
- **Build 验证**：`pnpm build` 通过，newtab JS 增 ≤ 2KB（css-import.ts 预计 ~2KB minified）

## 8. 未来扩展

- **URL 导入**：在 `detectInputFormat` 加 `'url'` 分支（如 `tweakcn.com/themes/...` → fetch CSS），复用 `parseCssTheme` 整条路径
- **隐藏 JSON 路径**：UI 上把 JSON 折叠到"高级"section（`<details>` 元素或折叠面板），不再主推；本次不做
- **CSS 路径的 element-level 规则支持**：解析 `body { ... }` / `.dark body { ... }` 等规则，emit 到 `custom-themes` style block 之外；本次不做

## 9. 分支策略

`feat/css-paste-import` 从 `feat/custom-themes-tab` 拉出（v0.2.73 的 custom-themes tab 是这次 import UI 的载体）。**两个分支的 commits 一起 review、一起合并**，未来如果要 rebase 到 main 一起做。
