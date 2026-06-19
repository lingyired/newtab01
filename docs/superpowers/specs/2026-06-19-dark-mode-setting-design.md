# Dark Mode as a First-Class Setting — 设计 spec

> 日期: 2026-06-19
> 目标分支: `feat/dark-mode-setting`（从 `feat/css-paste-import` 拉出）
> 状态: 待 review
> 关联: v0.2.50 的 tweakcn 主题变体支持、v0.2.74 的 CSS paste、v0.2.73 的 custom-themes tab

## 1. 目标

把"暗色模式"从「主题 id 里的 `-dark` 后缀」提升为一等公民 `darkMode` 设置。让用户面对的主题列表里**每个 theme 只出现一次**，旁边有一个独立的「暗色模式」三档开关（跟随系统 / 亮 / 暗）。切到暗但当前主题没 dark 变体时自动 fallback 到 light。

## 2. 非目标

- **不**做 storage migration（旧产品未发布，zero 旧用户，详见 §5 决策）
- **不**改任何 CSS 文件（`styles/themes/*.css` 里的 `default-dark` / `mx-brutalist-dark` 等规则原样保留 —— 它们在 data-theme 为 `xxx-dark` 时仍然生效）
- **不**做"暗色模式快捷键"（如 ⌘⇧L）
- **不**给 `darkMode` 加 revert 按钮（三档不存在"默认"概念 —— 'system' 就是默认）
- **不**改主题下拉排序（仍按 `listAllThemes` 现有顺序：built-in 在前，custom 按安装顺序在后）
- **不**做基于时间的自动切换（日落到日出之类）

## 3. 数据流

### 3.1 用户切主题

```
用户选 theme
   ↓
saveSetting('theme')
   ↓
saveThemeChange(theme: string) {
   applyTheme(theme)                          ← 内部读 darkMode
       resolveTheme(theme, darkMode) {
           const effective = darkMode === 'system'
               ? matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
               : darkMode
           if (effective === 'dark' && hasDarkVariant(theme)) return theme + '-dark'
           return theme
       }
       document.documentElement.dataset.theme = resolved
       // 读 5 个 --newtab-* var，resolveCssColor 规整
   const darkMode = getSetting('darkMode')    ← 读最新 darkMode
   const bundle = {
       theme,                                  ← base id（不再带后缀）
       darkMode,
       backgroundColor, fontColor, highlightColor, highlightFontColor, shadowColor
   }
   updateSettings(bundle)
}
```

### 3.2 用户切 darkMode

```
用户选 darkMode
   ↓
saveSetting('darkMode')
   ↓
updateSetting('darkMode', newValue)           ← 先写 storage
   ↓
saveThemeChange(getSetting('theme'))         ← re-apply，refresh 5 colors
                                          ← 走上面同一套流程
```

### 3.3 OS 切深浅（仅当 darkMode === 'system'）

```
matchMedia('(prefers-color-scheme: dark)') change event
   ↓
if (getSetting('darkMode') === 'system') {
   applyTheme(getSetting('theme'))           ← re-apply，data-theme 自动跟 OS 变
}
                                          ← 不写 storage（下次 saveThemeChange 触发时才更新 5 colors）
```

## 4. 模块结构

### 4.1 `src/features/bookmarks/types.ts`（+8 行）

`Settings` 加 `darkMode` 字段：

```ts
export interface Settings {
  // ... existing fields ...
  theme: string;  // 永远是 base id，不再带 '-dark' 后缀
  /**
   * Dark mode preference. Independent from `theme` — the rendered
   * data-theme attribute is `<theme>` for light, `<theme>-dark` for
   * dark (if the theme has a dark variant), or resolved at runtime
   * via `prefers-color-scheme` for 'system'. Default 'system'.
   */
  darkMode: 'system' | 'light' | 'dark';
  // ...
}
```

### 4.2 `src/lib/storage/settings.ts`（+1 行）

`defaults.darkMode = 'system'`。`initSettings` **不**加 migration 分支（旧用户问题由 §5 决策处理）。

### 4.3 `src/features/themes/switcher.ts`（+35 / -10 行）

新增：

```ts
export type DarkMode = 'system' | 'light' | 'dark';

/** In-memory cache of which themes have a `-dark` CSS variant. Built
 *  by applyCustomThemes() at init; updated by installCustomTheme /
 *  removeCustomTheme on every storage write. Lookup is sync — needed
 *  by applyTheme() which is on the render path. */
const customThemesWithDarkVariant: Set<string> = new Set();

const BUILT_IN_THEMES_WITH_DARK: ReadonlySet<string> = new Set([
  'default', 'mx-brutalist', 'cyberpunk', 'astrovista',
]);

/** True iff the given base theme id has a `-dark` variant in CSS.
 *  Built-in themes always do; custom themes depend on storage. */
export function hasDarkVariant(baseTheme: string): boolean {
  if (BUILT_IN_THEMES_WITH_DARK.has(baseTheme)) return true;
  return customThemesWithDarkVariant.has(baseTheme);
}

/** Mark a custom theme's dark-variant availability. Called by
 *  custom-themes.ts when storage changes. */
export function setHasDarkVariant(baseTheme: string, hasDark: boolean): void {
  if (hasDark) customThemesWithDarkVariant.add(baseTheme);
  else customThemesWithDarkVariant.delete(baseTheme);
}

/** Resolve a base theme id + user darkMode preference to the actual
 *  data-theme value the browser sees. Returns the base id (no suffix)
 *  when the resolved mode is light, or when dark mode is requested
 *  but the theme has no dark variant (fallback). */
export function resolveTheme(baseTheme: string, darkMode: DarkMode): string {
  const effective: 'light' | 'dark' =
    darkMode === 'system'
      ? (typeof window !== 'undefined' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light')
      : darkMode;
  if (effective === 'dark' && hasDarkVariant(baseTheme)) {
    return baseTheme + '-dark';
  }
  return baseTheme;
}
```

`THEMES` 数组改为 4 项（去掉 `-dark` 变体）：

```ts
const THEMES = [
  'default',
  'mx-brutalist',
  'cyberpunk',
  'astrovista',
] as const;
```

`applyTheme(theme)` 内部改用 `resolveTheme`：

```ts
export function applyTheme(theme: string): void {
  // theme is a base id (no '-dark' suffix)
  const darkMode = String(getSetting('darkMode') ?? 'system') as DarkMode;
  const resolved = resolveTheme(theme, darkMode);
  // ... existing inline style logic, but with `resolved` instead of `theme` ...
  root.setAttribute('data-theme', resolved);
  // 5 color var reads use `resolved` selector (so we read from the
  // actually-applied variant, not the light one if user is in dark)
}
```

### 4.4 `src/features/themes/custom-themes.ts`（+8 / -5 行）

`listAllThemes` 不再 push dark 变体：

```ts
// before:
out.push({ value: userThemeId(name, 'light'), label: name, isCustom: true });
if (entry.dark) {
  out.push({ value: userThemeId(name, 'dark'), label: `${name} (Dark)`, isCustom: true });
}

// after:
out.push({ value: userThemeId(name, 'light'), label: name, isCustom: true });
// dark variant handled by darkMode setting, not listed separately
```

`applyCustomThemes` 同步缓存：

```ts
export async function applyCustomThemes(): Promise<void> {
  const map = await readCustomThemes();
  injectCustomThemesStyle(buildCustomThemesStyle(map));
  // Sync the dark-variant cache with current storage
  for (const [name, entry] of Object.entries(map)) {
    if (entry) {
      setHasDarkVariant(userThemeId(name, 'light'), entry.dark != null);
    }
  }
}
```

`installCustomTheme` / `removeCustomTheme` 同步缓存：

```ts
// in installCustomTheme after the storage write:
setHasDarkVariant(userThemeId(entry.light.name, 'light'), entry.dark != null);

// in removeCustomTheme after the storage removal:
setHasDarkVariant(userThemeId(name, 'light'), false);
```

### 4.5 `src/newtab/app.ts`（+12 行）

`applyCustomThemes()` 之后无需额外代码（applyCustomThemes 内部已建缓存）。新增 matchMedia listener：

```ts
// After applyTheme(getSetting('theme'))
if (typeof window !== 'undefined' && window.matchMedia) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', () => {
    if (getSetting('darkMode') === 'system') {
      applyTheme(String(getSetting('theme')));
    }
  });
}
```

### 4.6 `src/newtab/settings-panel.ts`（+35 / -10 行）

**saveThemeChange 改：**

```ts
async function saveThemeChange(theme: string): Promise<void> {
  const before = String(getSetting('theme'));
  applyTheme(theme);  // applyTheme now reads darkMode + resolves internally
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const readVar = (name: string): string =>
    resolveCssColor(root.style.getPropertyValue(name).trim());
  const bundle: Partial<Settings> = {
    theme,                                      // base id, no suffix
    darkMode: String(getSetting('darkMode') ?? 'system'),
    backgroundColor: readVar('--newtab-bg'),
    fontColor: readVar('--newtab-text'),
    highlightColor: readVar('--newtab-highlight'),
    highlightFontColor: readVar('--newtab-highlight-text'),
    shadowColor: readVar('--newtab-highlight'),
  };
  await updateSettings(bundle);
}
```

**saveSetting 加 darkMode 分支：**

```ts
if (key === 'theme') {
  void saveThemeChange(String(value));
  return;
}
if (key === 'darkMode') {
  // Update darkMode first, then re-apply theme to refresh the 5 color
  // overrides (they were captured at the previous theme/darkMode combo
  // and need to be re-read from the CSS for the new combo).
  void updateSetting('darkMode', value as Settings['darkMode']).then(() => {
    void saveThemeChange(String(getSetting('theme')));
  });
  return;
}
```

**renderAppearanceTab 加暗色模式 row：**

```ts
container.appendChild(createRow('主题', createSelectInput('theme', themeOptions), 'theme', '...'));
container.appendChild(buildCustomThemeRedirectSection());
container.appendChild(createRow('暗色模式', createDarkModeSelectInput(), 'darkMode', '...'));
// ... rest of appearance settings
```

**buildThemeSelectorSection（新建）加暗色模式 row：**

```ts
const allThemes = await listAllThemesWithLabels(THEME_LABELS);
const themeOptions = allThemes.map((t) => ({ value: t.value, label: t.label }));
section.appendChild(createRow('主题', createSelectInput('theme', themeOptions), 'theme', '...'));
section.appendChild(createRow('暗色模式', createDarkModeSelectInput(), 'darkMode', '...'));
```

**createDarkModeSelectInput 辅助：**

```ts
function createDarkModeSelectInput(): HTMLSelectElement {
  return createSelectInput('darkMode', [
    { value: 'system', label: '跟随系统' },
    { value: 'light', label: '亮' },
    { value: 'dark', label: '暗' },
  ]);
}
```

**import handler auto-switch 简化：**

```ts
// before (v0.2.74 plan that I drafted but never committed):
const currentTheme = String(getSetting('theme'));
const isDarkCurrent = currentTheme.endsWith('-dark');
const lightId = `user-${...}`;
const darkId = `${lightId}-dark`;
const targetId = isDarkCurrent && result.entry.dark ? darkId : lightId;
await saveThemeChange(targetId);

// after:
const baseId = `user-${kebabName(result.entry.light.name)}`;
await saveThemeChange(baseId);
// saveThemeChange reads darkMode from storage and resolves via
// resolveTheme() — dark if user is in dark mode AND new theme has
// dark variant, else light (no manual check needed).
```

**refreshInputsFromSettings 加 darkMode：**

```ts
const darkModeSelect = document.getElementById('sp-darkMode') as HTMLSelectElement | null;
if (darkModeSelect) {
  const next = String(getSetting('darkMode') ?? 'system');
  if (darkModeSelect.value !== next) darkModeSelect.value = next;
}
```

## 5. 关键决策

### 5.1 不要 storage migration

产品未发布，零旧用户。`Settings.theme` 字段约定永远是 base id。`initSettings` 不加 `-dark` 后缀剥离逻辑。

如果未来真出现"老用户用着 -dark 后缀 id 升级上来"的情况：补一个一行迁移 `if (theme.endsWith('-dark')) { theme = base; darkMode = 'dark' }` 即可。YAGNI。

### 5.2 `data-theme` 内部仍带 `-dark` 后缀

CSS 选择器 `[data-theme="user-xxx-dark"]` 是项目支持 dark 变体的基石。`resolveTheme` 是 JS 层抽象，**不动** CSS 文件。storage 里的 `theme` 字段不带后缀；DOM 上的 `data-theme` 属性带后缀。两者不同步正好是设计意图。

### 5.3 dark variant 缓存的维护点

`custom-themes.ts` 是 chrome.storage.local.customThemes 写入的唯一入口，让它负责 `setHasDarkVariant` 同步。`app.ts` 启动时 `applyCustomThemes()` 一次性把缓存建好。lookup 永远 sync。

### 5.4 applyTheme 不接受 darkMode 参数

保持旧 API `applyTheme(theme)`，内部 `getSetting('darkMode')` 读。Callers（app.ts / saveThemeChange）签名不变。darkMode 的变化由 `saveThemeChange` 走完整流程（updateSetting → re-apply）处理。

### 5.5 system 模式的 matchMedia listener 写在哪

`app.ts` init 末尾。listener 回调里 if (darkMode === 'system') 早退，避免 OS 切换在用户已经强制 light/dark 时触发多余 re-apply。listener 不写 storage —— 5 colors 不变，re-apply 仅刷新 data-theme 即可。

## 6. UI 渲染结果

### 6.1 外观 tab

主题 row 下方新增「暗色模式」row：

```html
<div class="sp-row sp-row--with-desc">
  <label class="sp-label" for="sp-darkMode">暗色模式</label>
  <div class="sp-input">
    <select id="sp-darkMode">
      <option value="system">跟随系统</option>
      <option value="light">亮</option>
      <option value="dark">暗</option>
    </select>
  </div>
  <p class="sp-desc">决定主题使用浅色还是深色变体。选「跟随系统」会随 macOS / Windows 的外观设置自动切换。</p>
</div>
```

主题下拉里**不再有** `default-dark` / `mx-brutalist-dark` 等条目 —— 每个 base theme 只出现一次。

### 6.2 自定义主题 tab

新建的「选择主题」section 内部包含两个 row：

```html
<section class="sp-theme-selector">
  <h3 class="sp-custom-heading">选择主题</h3>
  <div class="sp-row sp-row--with-desc">
    <label class="sp-label" for="sp-theme">主题</label>
    <div class="sp-input">
      <select id="sp-theme">…</select>
      <button class="sp-revert">↩</button>
    </div>
    <p class="sp-desc">在此切换当前主题。</p>
  </div>
  <div class="sp-row sp-row--with-desc">
    <label class="sp-label" for="sp-darkMode">暗色模式</label>
    <div class="sp-input">
      <select id="sp-darkMode">
        <option value="system">跟随系统</option>
        <option value="light">亮</option>
        <option value="dark">暗</option>
      </select>
    </div>
    <p class="sp-desc">决定主题使用浅色还是深色变体。</p>
  </div>
</section>
```

## 7. 边界 case

| 场景 | 行为 |
|---|---|
| 装一个有 dark 的主题，darkMode='light' | 主题正常显示 light 变体；切到 darkMode='dark' 立即切到 dark 变体 |
| 装一个**没有** dark 的主题，darkMode='dark' | resolveTheme fallback 到 light（CSS 没 `xxx-dark` 匹配，data-theme 设为 base id） |
| 用户在 system 模式，OS 从 light 切到 dark | matchMedia 监听器触发，applyTheme 重算 → 主题立即变深色（无 storage 写） |
| 新用户首次安装 | storage 没 theme 也没 darkMode；defaults 给 darkMode='system'，theme='default'；新用户立刻看到他系统当前的样子 |
| 用户在 system 模式，但 matchMedia 不可用（罕见 / 旧浏览器） | resolveTheme 永远 fallback 到 light（safe default） |
| 装主题后立刻切 darkMode='dark' | darkMode 写 storage → saveThemeChange re-apply → 新主题的 dark 变体（如果有）或 light（fallback）渲染 |
| 跨标签页 / 跨窗口 | 已有 `chrome.storage.onChanged` listener 会同步 `sp-theme` 和 `sp-darkMode` 两个 select |

## 8. 改动文件总览

| 文件 | 改动 | 行数 |
|---|---|---|
| [src/features/bookmarks/types.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/bookmarks/types.ts) | `Settings.darkMode` 字段 | +8 |
| [src/lib/storage/settings.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/lib/storage/settings.ts) | `defaults.darkMode = 'system'` | +1 |
| [src/features/themes/switcher.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/themes/switcher.ts) | `DarkMode` type / `resolveTheme` / `hasDarkVariant` 缓存 / `setHasDarkVariant` / `applyTheme` 内部用 `resolveTheme` / `THEMES` 数组去 `-dark` | +35 / -10 |
| [src/features/themes/custom-themes.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/features/themes/custom-themes.ts) | `listAllThemes` 不 push dark；`applyCustomThemes` / `installCustomTheme` / `removeCustomTheme` 同步缓存 | +8 / -5 |
| [src/newtab/app.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/app.ts) | matchMedia listener | +12 |
| [src/newtab/settings-panel.ts](file:///Users/lingsmbp/Documents/aiwork/newtab01/src/newtab/settings-panel.ts) | `saveThemeChange` 写 darkMode；`saveSetting('darkMode')` 分支；外观 tab 加 darkMode row；新建 `buildThemeSelectorSection`；auto-switch 简化；`refreshInputsFromSettings` 加 darkMode 同步 | +50 / -10 |
| [styles/newtab.css](file:///Users/lingsmbp/Documents/aiwork/newtab01/styles/newtab.css) | 0 改动 | 0 |
| [styles/themes/*.css](file:///Users/lingsmbp/Documents/aiwork/newtab01/styles/themes/) | 0 改动（`*-dark` 规则原样保留） | 0 |
| [CHANGELOG.md](file:///Users/lingsmbp/Documents/aiwork/newtab01/CHANGELOG.md) | `[0.2.75]` Added + Changed 段 | +10 |
| [package.json](file:///Users/lingsmbp/Documents/aiwork/newtab01/package.json), [manifest.json](file:///Users/lingsmbp/Documents/aiwork/newtab01/manifest.json) | 0.2.74 → 0.2.75 | 1 / 1 |

总改动：~130 行。CSS 0 改动。

## 9. 测试 / 验证

- **手动**：
  1. 加载 dist，打开设置 → 外观 → 主题 + 暗色模式
  2. 切主题 dropdown → 主题立即变
  3. 切暗色模式 dropdown → 主题立即切深浅
  4. 选「跟随系统」→ 改 macOS / Windows 外观 → 主题跟着变
  5. 切到自定义主题 tab → 在「选择主题」section 也能切主题 + 暗色模式
  6. 装一个没有 dark variant 的主题（CSS 故意只写 :root 不写 .dark）→ 切到 dark → fallback 到 light
- **JSON 路径**：粘贴 JSON，自动切到新主题（按当前 darkMode 决定变体）
- **CSS 路径**：粘贴 CSS，自动切到新主题（同上）
- **跨标签**：popup / options 改主题，newtab 的 `sp-theme` 和 `sp-darkMode` 同步
- **Build 验证**：`pnpm build` 通过，newtab JS 增 ≤ 3KB

## 10. 不做（YAGNI）

- 系统深浅变化的 schedule 切换（仅响应实时事件）
- 暗色模式快捷键
- `darkMode` 的 revert 按钮
- 主题下拉排序调整
- `data-theme` 的 devtools override 警告
