# Runtime Theme Import — 设计 spec

> 日期: 2026-06-17
> 目标分支: `feat/runtime-theme-import`
> 状态: 待 review

## 1. 目标

让用户能直接把 tweakcn 主题 JSON 粘贴到 newtab01 的设置面板，**立即生效并永久安装**，无需 build / 脚本 / 文件编辑。

## 2. 非目标

- **不**发布 newtab01 主题到 shadcn registry
- **不**支持 `registry:font` / `registry:component` / `registry:hook` 等非 style 类型
- **不**支持重命名 / 导出 / 导入 / 排序 custom themes
- **不**改变内置 11 主题（`THEMES` 数组保持不变）
- **不**做 OKLCH → hex 运行时转换（依赖 Chrome 111+；与现有 `color-mix` 一致）
- **不**支持 custom 主题的 `--newtab-link-*` 装饰变量（仅 mx-brutalist.css 那种特例保留内置）
- **不**做主题预览图 / 截图

## 3. 架构总览

```
┌─────────────────────────────────────────────┐
│  chrome.storage.local                       │
│  key: "customThemes"                        │
│  value: { "MX-Brutalist": {light, dark, ...}│
└─────────────────────────────────────────────┘
        ↓ 启动时读取
┌─────────────────────────────────────────────┐
│  newtab / options 启动                      │
│  applyCustomThemes()                        │
│    1. 读 chrome.storage.local.customThemes  │
│    2. 遍历每个条目                           │
│    3. 提取 cssVars.light → 生成             │
│       :root[data-theme="user-mx-brutalist"] │
│       { 8 shadcn vars }                     │
│    4. 提取 cssVars.dark → 同上               │
│    5. 注入 <style id="custom-themes">      │
└─────────────────────────────────────────────┘
        ↓ 设置面板"外观" tab 加 UI
┌─────────────────────────────────────────────┐
│  Import custom theme                        │
│  [textarea] [Apply]                         │
│  ──── Installed custom themes ────          │
│  • MX-Brutalist  installed 6/17 · light+dark│
│       [Delete]                              │
│  • Soft Lavender  installed 6/17 · light    │
│       [Delete]                              │
└─────────────────────────────────────────────┘
```

## 4. 存储 schema

**Key**: `customThemes`（单一 key，存所有 custom 主题的 map）

**Value 结构**:
```ts
type CustomThemeEntry = {
  /** 原始 tweakcn JSON（保留 light 块） */
  light: {
    name: string;
    type: 'registry:style';
    cssVars: {
      theme: Record<string, string>;
      light: Record<string, string>;
    };
  };
  /** 同 light 结构，但 cssVars.dark 覆盖 cssVars.light。可选 —— 用户 JSON 若没提供 cssVars.dark 则不生成 dark 变体 */
  dark?: {
    name: string;
    type: 'registry:style';
    cssVars: {
      theme: Record<string, string>;
      dark: Record<string, string>;
    };
  };
  /** 第一次安装时间戳（覆盖更新时保留） */
  installedAt: number;
  /** 最后一次更新时间戳 */
  updatedAt: number;
};

type CustomThemesStorage = Record<string, CustomThemeEntry>;
```

**外层 key 用什么**：JSON 的 `name` 字段（原文，不做 sanitization）。便于 dedupe 检测和原样显示。

**配额估算**：每条 ~2KB，100 条 = 200KB，远低于 10MB local 配额。

## 5. 命名约定

| 维度 | 规则 |
|------|------|
| 内部 ID | `user-<kebab-case-name>`（light）+ `user-<kebab-case-name>-dark` |
| 显示名 | JSON 的 `name` 字段（原文） |
| 下拉框标签 | `<name>` (light) / `<name> (Dark)` (dark) |
| 冲突 | `user-` 前缀隔离所有 custom ID，与内置 11 个无交集 |
| kebab 化 | 实现函数 `kebab(name) = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')`；`kebab('MX-Brutalist')` → `mx-brutalist`；`kebab('Soft Lavender')` → `soft-lavender`；`kebab('Theme (Beta)')` → `theme-beta` |

**已知限制**: 不同 name 经 kebab 化后可能产生相同 ID（如 `"MX-Brutalist"` 和 `"Mx_Brutalist"` 都 → `mx-brutalist`）。本版不处理 —— dedupe 按 name 走，name 相同的覆盖更新；name 不同但 kebab 相同的两个主题会**互相覆盖 CSS**。v2 可改为 "name + hash" 双键。

**实现**: 修改 `listThemes()` 行为（或新增 `listAllThemes()`）：
```ts
function listAllThemes(): Array<{ value: string; label: string; isCustom: boolean }> {
  const builtIn = THEMES.map(t => ({ value: t, label: THEME_LABELS[t] ?? t, isCustom: false }));
  const custom = readCustomThemes(); // 从 storage 读
  const customEntries: Array<{ value: string; label: string; isCustom: boolean }> = [];
  for (const [name, entry] of custom) {
    const id = `user-${kebab(name)}`;
    customEntries.push({ value: id, label: name, isCustom: true });
    if (entry.dark) {
      customEntries.push({ value: `${id}-dark`, label: `${name} (Dark)`, isCustom: true });
    }
  }
  return [...builtIn, ...customEntries];
}
```

## 6. CSS 注入策略

**注入位置**: `<style id="custom-themes">`，append 到 `<head>`（在 globals.css 之后）。

**CSS 模板**（每个 custom 主题生成两个 selector）:
```css
:root[data-theme="user-mx-brutalist"] {
  --background: <light.background>;
  --foreground: <light.foreground>;
  --primary: <light.primary>;
  --primary-foreground: <light.primary-foreground>;
  --muted: <light.muted>;
  --muted-foreground: <light.muted-foreground>;
  --border: <light.border>;
  --ring: <light.ring>;
}
:root[data-theme="user-mx-brutalist-dark"] {
  --background: <dark.background>;
  --foreground: <dark.foreground>;
  --primary: <dark.primary>;
  --primary-foreground: <dark.primary-foreground>;
  --muted: <dark.muted>;
  --muted-foreground: <dark.muted-foreground>;
  --border: <dark.border>;
  --ring: <dark.ring>;
}
```

**派生复用**: globals.css 的 `:where(:root)` 派生规则（`--newtab-bg = var(--background)` 等）继续生效，custom 主题自动获得 6 个 `--newtab-*`。

**OKLCH 直通**: CSS 直接用 `oklch(...)`，不转换。要求 Chrome 111+。

## 7. 导入流程

```
[用户粘贴 JSON 到 textarea]
    ↓
[点"Apply"按钮]
    ↓
validate(json) → 失败：红色错误，textarea 不清空
    ↓ 通过
parse(json) → CustomThemeEntry
    ↓
storage.local.customThemes[name] = entry
    ↓
rebuildCustomThemesStyle() → 重新生成 <style id="custom-themes"> 内容
    ↓
如当前 data-theme === user-<kebab(name)> → 重新 apply（颜色已变）
    ↓
刷新"Installed custom themes"列表
    ↓
显示绿色 "✓ Installed 'MX-Brutalist' (light + dark)"
```

## 8. 校验规则

`validate(json)` 严格检查（任一失败即拒绝）：

| 检查项 | 不通过时错误消息 |
|--------|-----------------|
| 是 valid JSON | "Not a valid JSON" |
| `type === "registry:style"` | "Only type 'registry:style' is supported" |
| `cssVars.light` 存在且是对象 | "Missing cssVars.light" |
| 8 个变量都存在（`background` / `foreground` / `primary` / `primary-foreground` / `muted` / `muted-foreground` / `border` / `ring`） | "Missing cssVars.light fields: <list>" |
| `name` 存在且非空字符串 | "Missing name field" |

**软警告（不阻塞）**:
- `cssVars.dark` 缺失 → 警告："No cssVars.dark provided, dark variant will fall back to built-in dark theme"

## 9. 重复粘贴处理

按 `name` dedupe：
- 找到同名 → 覆盖更新（保留 `installedAt`，更新 `updatedAt`），绿色提示 "Updated 'MX-Brutalist'"
- 找不到 → 新增，绿色提示 "Installed 'MX-Brutalist' (light + dark)"

## 10. 删除流程

```
[用户点 custom 主题行的"Delete"]
    ↓
delete storage.local.customThemes[name]
    ↓
rebuildCustomThemesStyle() → 重新生成 CSS
    ↓
如当前 data-theme 是被删的 user-xxx：
  - applyTheme('default')
  - storage.theme = 'default'
  - 刷新下拉框
    ↓
刷新"Installed custom themes"列表
```

## 11. UI 布局（newtab 设置面板"外观" tab）

在现有主题下拉框**下方**加两个区块：

```html
<section class="sp-custom-import">
  <h3>Import custom theme</h3>
  <p class="sp-hint">Paste a tweakcn registry item JSON to install as a new theme.</p>
  <textarea id="sp-custom-theme-json" rows="6" spellcheck="false"
            placeholder='{ "$schema": "...", "name": "...", "type": "registry:style", "cssVars": { ... } }'></textarea>
  <div class="sp-actions">
    <button id="sp-custom-theme-apply" class="sp-btn-primary">Apply</button>
  </div>
  <div id="sp-custom-theme-status" class="sp-status" role="status" aria-live="polite"></div>
</section>

<section class="sp-custom-list">
  <h3>Installed custom themes</h3>
  <ul id="sp-custom-theme-list"></ul>
  <div id="sp-custom-theme-empty" class="sp-empty">No custom themes installed yet.</div>
</section>
```

**状态消息样式**:
- 错误：红色（`color-mix(in srgb, var(--destructive, #d4183d), transparent 60%)`）
- 警告：黄色
- 成功：绿色

**列表项结构**:
```html
<li>
  <span class="sp-custom-name">MX-Brutalist</span>
  <span class="sp-custom-meta">installed 2026-06-17 · light + dark</span>
  <button class="sp-custom-delete" aria-label="Delete MX-Brutalist">Delete</button>
</li>
```

## 12. 文件改动

| 文件 | 改动 |
|------|------|
| `src/features/themes/custom-themes.ts` | **新增** —— storage CRUD + validate + CSS 注入 + 启动加载 |
| `src/features/themes/switcher.ts` | 修改 `listThemes()` 改为 `listAllThemes()`，合并内置 + custom |
| `src/newtab/settings-panel.ts` | 加 import textarea + list UI + delete handler |
| `src/newtab/app.ts` | 启动时调 `applyCustomThemes()` |
| `src/popup/main.ts` | 启动时调 `applyCustomThemes()`（popup 也用主题） |
| `src/options/app.ts`（如存在） | 启动时调 `applyCustomThemes()` |
| `styles/options.css` / `styles/newtab.css` | 加 custom theme section 样式 |
| `manifest.json` | **bump version**（v0.2.40 → v0.2.41） |
| `CHANGELOG.md` | 加 0.2.41 条目 |
| `docs/themes-from-tweakcn.md` | 加章节：在 UI 里导入主题 |

## 13. 边界情况 / 错误处理

| 场景 | 行为 |
|------|------|
| 非 valid JSON | 红色错误，textarea 不清空 |
| 不是 registry:style | 红色错误，textarea 不清空 |
| 缺 cssVars.light | 红色错误，textarea 不清空 |
| 8 个变量缺一些 | 红色错误，列出缺哪些 |
| 没有 cssVars.dark | 黄色警告 + 只生成 light 主题；dark 模式 fallback 到内置 dark |
| 已存在同名 | 覆盖更新 + 绿色提示 "Updated 'MX-Brutalist'" |
| 用户删除当前 active 的 custom 主题 | 切回 `default` + 同步更新 storage.theme |
| local 存储 quota 满 | catch error，显示 "Storage full, cannot install theme" |
| OKLCH 在 Chrome 104-110 解析失败 | 不处理（依赖 111+）；文档写明要求 |
| 注入 CSS 与 globals.css 优先级冲突 | 用 `:root[data-theme="user-xxx"]` (0,1,0) 而非 `:root`，优先级高于 `:where(:root)` (0,0,0) |
| 用户粘贴恶意 JSON（含 javascript: / eval / 内联事件） | validate 严格只取 8 个具体变量名；不执行 JSON 内的 `css` / `files` 字段；不做 innerHTML 注入 |

## 14. 启动加载顺序

1. `chrome.storage.local.get('customThemes')`
2. 解析每个 entry 的 cssVars.light/dark
3. 生成 CSS 字符串（含 8 个 shadcn 变量 × 2 个 variant）
4. 创建或更新 `<style id="custom-themes">` 节点

**失败回退**:
- 单个 entry 解析失败 → console.warn 跳过，**不**阻塞其他 entry
- 整个 storage 读取失败 → 不创建 `<style>`，主题切换走内置 fallback

## 15. 测试

| 用例 | 期望 |
|------|------|
| 粘贴有效 JSON | 列表新增项 + 主题下拉框多两个选项（light + dark） |
| 粘贴无效 JSON | 红色错误，列表不变 |
| 粘贴非 style 类型 | 红色错误 |
| 粘贴缺 cssVars.light | 红色错误 |
| 粘贴 8 个变量缺 1 个 | 红色错误列出缺哪个 |
| 粘贴没有 cssVars.dark | 黄色警告 + 只生成 light |
| 粘贴同名主题 | 列表项更新，installedAt 不变，updatedAt 变 |
| 删除未选中的 custom 主题 | 列表少一项，主题下拉框少两个选项 |
| 删除当前 active 的 custom 主题 | 切回 default，下拉框同步 |
| 关掉新标签页再开 | custom 主题还在，CSS 注入依然存在 |
| 安装 5 个 custom 主题（全部有 light + dark） | 列表显示 5 个，下拉框多 10 个选项 |
| 选中 custom 主题 | 8 个 shadcn 变量 + 6 个 `--newtab-*` 派生全部正确应用 |

## 16. 实施步骤

1. Commit 4px 修正在 main 上（v0.2.40）
2. `git checkout -b feat/runtime-theme-import`
3. 实现 `src/features/themes/custom-themes.ts`（storage + validate + CSS 生成）
4. 修改 `src/features/themes/switcher.ts` 合并 custom 主题到下拉框
5. 在 `src/newtab/settings-panel.ts` 加 import textarea + list UI + delete handler
6. 在 `src/newtab/app.ts` / `src/popup/main.ts` 启动时调 `applyCustomThemes()`
7. 加 settings panel 样式
8. `pnpm build` + 手动测试全部 13 个测试用例
9. 文档更新（`docs/themes-from-tweakcn.md` + `CHANGELOG.md`）
10. Bump version（v0.2.41）
11. Commit on branch

## 17. 风险

| 风险 | 缓解 |
|------|------|
| chrome.storage.local quota | 10MB，每条 ~2KB，可存 5000+ 条 |
| 用户粘贴恶意 JSON | validate 严格只取 8 个具体变量名；不执行 `css` / `files` 字段；不 innerHTML 注入 |
| OKLCH 在旧 Chrome 不支持 | 文档要求 111+；不动 minimum_chrome_version |
| 注入 CSS 优先级冲突 | 用 `:root[data-theme="user-xxx"]` (0,1,0) |
| 启动时大量 custom 主题加载慢 | 每条 <1KB CSS 生成 <1ms；50 条也才 50ms |
| 与 future `npx newtab01 theme add <url>` CLI 冲突 | 当前无 CLI 计划，spec 留扩展点但本期不实现 |
