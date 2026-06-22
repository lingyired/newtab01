# 外观/主题 per-theme per-mode 设置重构 — Plan

> 日期: 2026-06-21
> 目标分支: `feat/appearance-theme-overrides`（从 `main` 拉出）
> 状态: 待 review / 实施前
> 关联: v0.2.75 `Settings.darkMode` 独立设置 + v0.2.83 link bg 走 `--card` shadcn 派生
> 涉及版本: bump → v0.2.97（patch）

---

## 1. Summary

四个独立但相关的修复，统一在一个 PR 里：

1. **链接圆角走主题的 `.rounded-md`** — `#main a` 的 `border-radius` 不再被 `apply.ts` 强行覆盖为 `em` scale 后的固定值；改为 `var(--newtab-link-radius, calc(var(--radius) - 2px))`，主题决定默认圆角，`highlightRound` 只是 px 覆盖。
2. **`highlightRound` 改为 px 单位** — 从 scale 0.5/1/1.5 → 0.2/1/1.5em 改为直接存 px 数值。默认填入当前主题的 `calc(var(--radius) - 2px)` 的 px 值（用户在 input 里能看到「Codex 主题的圆角是 4px」）。
3. **10 个外观选项 per-theme per-mode 化** — 字体/字号/字重/5 颜色/阴影模糊/高亮圆角，共 10 项。新增 `Settings.themeOverrides: Record<themeId, { light?: Partial<Settings>; dark?: Partial<Settings> }>`，切换主题 + darkMode 时用对应桶覆盖全局值（除 `width` / `hPos` 仍全局）。
4. **字号不生效排查** — 13.5 = 18 × 0.75，强烈指向 CSS 覆盖或 Chrome zoom 75%。Plan 中列出 3 个最可能的覆盖位置 + 排查方法。

---

## 2. Current State Analysis

### 2.1 圆角现状

**`styles/newtab.css:105`**：
```css
border-radius: var(--newtab-link-radius, calc(var(--radius) - 2px));
```
这已经是 shadcn `.rounded-md` 派生（`calc(var(--radius) - 2px)`），**没毛病**。

**`src/features/settings/apply.ts:102-103`**（`STYLE_KEYS` 触发 + `rebuildDynamicStyles`）：
```ts
const highlightRound = scale(settings('highlightRound'), 0.2, 1.5);
rules.push(`#main a { border-radius: ${highlightRound}em; }`);
```
这条动态规则（`#main a` specificity 0,0,1,0）与静态 newtab.css 规则 specificity 相同，dynamic-styles 注入位置在 newtab.css 之后 → **直接覆盖** `newtab.css:105` 的 `var(--newtab-link-radius, ...)` 派生。所以当前 `highlightRound` 真的是 0/1.5em 这种线性 em 值，**主题的 `--radius` 派生的圆角完全失效**。

### 2.2 `highlightRound` 现状

- `Settings.highlightRound: number`（`types.ts:53`）
- `defaults.highlightRound = 1`（`settings.ts:33`）
- `Settings` UI 行：`<input type="number" step="0.1">`，label「高亮圆角」，description「书签高亮背景的圆角大小，0 为直角，数值越大越圆」（`settings-panel.ts:738`）
- 实际效果：scale(1) = 1em = 10px（root 62.5% 技巧下）。用户期望「圆角」是 4-8px 范围，1em 太大。

### 2.3 10 个外观选项现状

**`src/newtab/settings-panel.ts:709-743`** `renderAppearanceTab`：
- 主题、暗色模式（2 个 — 不在 per-theme per-mode 范围）
- 字体、字号、字重、文字颜色、背景颜色、高亮颜色、高亮文字颜色、阴影颜色、阴影模糊、高亮圆角（**10 个 — per-theme per-mode 范围**）
- 宽度、水平位置（2 个 — 留在全局）

`STYLE_KEYS` (`apply.ts:43-48`) 和 `COLOR_KEYS` (`apply.ts:26-32`) 的内容基本就是这 10 个 + `spacing` + `width` + `hPos` + `align` + `font`/`fontWeight`/`fontSize`/`shadowBlur`/`highlightRound`。

### 2.4 字号 13.5px 不生效 — 根因排查

`apply.ts:87` 写 `#main a { font-size: ${settings('fontSize') / 10}em; }`。
- `fontSize = 18`（默认）→ `1.8em`
- html `font-size: 62.5%` (`globals.css:113`) → html 10px（62.5% × 16px 浏览器默认）
- 1.8em × 10px = **18px**（理论上）

用户看到 **13.5px = 18 × 0.75**，3 个最可能位置（按概率排序）：

| # | 怀疑点 | 验证方法 |
|---|--------|----------|
| 1 | **Chrome 浏览器缩放在 75%**（Ctrl+- 三次或系统级辅助缩放） | `chrome://settings/appearance` 看 Page zoom；或 cmd+0 重置 |
| 2 | **`#main` 或祖先有 `font-size: 75%` / `0.75em`** | devtools 选中 `#main` 看 Computed → font-size 是不是 7.5px |
| 3 | **`font` 字段空字符串触发回退** | `font: 'Sans-serif'` 是 default，但 apply.ts:86 用 `"${settings('font')}"` 拼字符串，font 字段无效值时浏览器 fallback 到 inherit |

**修复方向**：与其猜，不如**改成 px 直存**，让用户看到「我填 18，computed 就是 18」是符合直觉的。同步把 `apply.ts:87` 的 `${fontSize / 10}em` 改为 `${fontSize}px`。这样既修了「单位不直观」，又能通过 devtools 看到 18px 而不是 1.8em，便于排查覆盖。

> **注意**：如果改 px 后用户还是看到 13.5px，那就是真覆盖（怀疑点 2）。`font-size: 62.5%` 的 10px root 技巧同时被废除，整个 UI 字号体系走真实 px，跟现代 Chrome new tab 风格对齐（v0.2.45 重构时确定的 1.8em 比例换算其实就是 `0.8rem` 比例 = 12.8px@16px root → 18px@22.5px root，新方案直接 18px 反而更接近 HNTP 原始行为）。

---

## 3. Proposed Changes

### 3.1 分支 + 版本

```bash
git checkout main
git pull
git checkout -b feat/appearance-theme-overrides
# 实施完成 commit:
#   v0.2.97 bump + 实施改动
# merge: --no-ff 到 main
# push: origin main + origin feat/appearance-theme-overrides（冻结为历史索引）
```

`package.json` `version` `0.2.96 → 0.2.97`，`CHANGELOG.md` 加 `## [0.2.97] - 2026-06-21`。

### 3.2 文件级改动清单

#### A. `src/features/bookmarks/types.ts`（**Settings 类型扩展**）

```ts
// 新增：每个主题 + 每个外观模式 的覆盖
export type ThemeModeOverrides = Partial<Pick<Settings,
  'font' | 'fontSize' | 'fontWeight' |
  'fontColor' | 'backgroundColor' | 'highlightColor' | 'highlightFontColor' | 'shadowColor' |
  'shadowBlur' | 'highlightRound'
>>;

export interface Settings {
  // ... 既有字段 ...
  /**
   * 主题 + 外观模式(light/dark) 维度的覆盖。Key 是 base theme id
   * (不带 -dark 后缀, 跟 `theme` 字段同一 namespace)。
   * 切换主题时, applySettingsToDOM 用 themeOverrides[theme][mode]
   * 覆盖全局 10 个外观选项 (font/fontSize/fontWeight/5 颜色/
   * shadowBlur/highlightRound); 缺省 → fall back 到全局值。
   * width / hPos 永远读全局, 不在覆盖范围。
   */
  themeOverrides?: Record<string, { light?: ThemeModeOverrides; dark?: ThemeModeOverrides }>;
}
```

#### B. `src/lib/storage/settings.ts`（**defaults + init 迁移**）

1. `defaults` 不加 `themeOverrides` 字段（保持空 = 不覆盖，全局生效）。理由：v0.2.96 之前的用户数据没有这个字段，缺省处理比写 `{}` 干净。
2. `initSettings` 里的 `LEGACY_KEY_MAP` 不动（这些 legacy key 都早于 0.2.30，跟 per-theme 无关）。
3. `coerceNumberSettings` 跳过 `themeOverrides`（它是对象不是 number）。
4. `PRIOR_FONT_SIZE_DEFAULTS` 不变。
5. `fontSize` 默认 18 不变（之后改 px 单位不影响数值）。

#### C. `src/features/settings/apply.ts`（**核心 — 解析 + 渲染**）

新增 1 个函数 + 改 1 个函数 + 改 1 个常量：

```ts
/**
 * 拿到「当前主题+外观模式」生效的外观值。
 * - 全局字段(width / hPos / align / spacing / columnWidth / ...)走 Settings 原值
 * - 10 个外观选项(font/fontSize/.../highlightRound)优先用
 *   themeOverrides[baseTheme][mode], 缺省 fall back 到全局
 *  返回一个"解析后"的局部对象, 之后 rebuildDynamicStyles + applyUserColorOverride 都从这个对象读。
 *
 *  baseTheme 跟 mode 都从 storage 现读, 不接受入参 — 调用方都是
 *  applyTheme 之后, theme 已写入 document.documentElement。
 */
function resolveEffectiveSettings(): {
  font: string;
  fontSize: number;
  fontWeight: number;
  fontColor: string;
  backgroundColor: string;
  highlightColor: string;
  highlightFontColor: string;
  shadowColor: string;
  shadowBlur: number;
  highlightRound: number;
} {
  const baseTheme = String(getSetting('theme') ?? 'default');
  const darkMode = String(getSetting('darkMode') ?? 'system') as DarkMode;
  const mode: 'light' | 'dark' = darkMode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : darkMode;
  const overrides = (getSetting('themeOverrides') ?? {})[baseTheme]?.[mode] ?? {};
  // 注意：getSetting('fontSize') / getSetting('fontWeight') 等是 Settings 上的
  //  既有字段, 编译器自动从 type 推. 跟 ThemeModeOverrides 字段对齐.
  return {
    font: overrides.font ?? String(getSetting('font') ?? 'Sans-serif'),
    fontSize: overrides.fontSize ?? Number(getSetting('fontSize') ?? 18),
    fontWeight: overrides.fontWeight ?? Number(getSetting('fontWeight') ?? 400),
    fontColor: overrides.fontColor ?? String(getSetting('fontColor') ?? ''),
    backgroundColor: overrides.backgroundColor ?? String(getSetting('backgroundColor') ?? ''),
    highlightColor: overrides.highlightColor ?? String(getSetting('highlightColor') ?? ''),
    highlightFontColor: overrides.highlightFontColor ?? String(getSetting('highlightFontColor') ?? ''),
    shadowColor: overrides.shadowColor ?? String(getSetting('shadowColor') ?? ''),
    shadowBlur: overrides.shadowBlur ?? Number(getSetting('shadowBlur') ?? 1),
    highlightRound: overrides.highlightRound ?? Number(getSetting('highlightRound') ?? 0),
  };
}
```

`rebuildDynamicStyles` 改造（最关键）：

```ts
function rebuildDynamicStyles(): void {
  const eff = resolveEffectiveSettings();
  const rules: string[] = [];

  // Font — 改 px 直存 (修了 13.5px 调查路径)
  rules.push(`#main a { font-family: "${eff.font}"; }`);
  rules.push(`#main a { font-size: ${eff.fontSize}px; }`);   // 改 1
  rules.push(`#main a { font-weight: ${eff.fontWeight}; }`);

  // Shadow blur 跟原来一样
  const shadowBlurPx = scale(eff.shadowBlur, 7, 100);
  rules.push(`#main a:hover { box-shadow: 0 0 ${shadowBlurPx}px var(--newtab-highlight); }`);

  // ★ 高亮圆角: 改为写 --newtab-link-radius CSS var,
  //   不再直接覆盖 border-radius. newtab.css:105 的
  //   `var(--newtab-link-radius, calc(var(--radius) - 2px))` 接管默认值.
  //   用户填 0 → 主题 .rounded-md; 填 Npx → Npx.
  rules.push(`:root { --newtab-link-radius: ${eff.highlightRound}px; }`);

  // Spacing / width / hPos / align 全部从全局 Settings 取(不走 eff)
  // —— 跟现状一致, 不动
  const rowGap = scale(Number(getSetting('spacing')), 10, 20, 4);
  rules.push(`:root { --newtab-spacing: ${rowGap}px; }`);

  if (getSetting('autoScale')) {
    const widthPct = scale(Number(getSetting('width')), 96, 100, 60);
    const slackPct = 100 - widthPct;
    const marginLeftPct = (Number(getSetting('hPos')) / 2) * slackPct;
    rules.push(`#main { width: ${widthPct}%; margin-left: ${marginLeftPct}%; }`);
  } else {
    const widthPx = scale(Number(getSetting('width')), 1200, 3000, 800);
    rules.push(`#main { width: ${widthPx}px; margin-left: calc((${Number(getSetting('hPos'))} / 2) * (100vw - ${widthPx}px)); }`);
  }
  rules.push(`#main { text-align: ${String(getSetting('align'))}; }`);

  // ★ 颜色写 inline custom property (跟现在一样, 但从 eff 读)
  //   applyUserColorOverride 单独负责这个, rebuildDynamicStyles 不管.

  // 写入 / 替换 <style id="dynamic-styles">
  const style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
    ?? Object.assign(document.createElement('style'), { id: STYLE_ELEMENT_ID });
  style.textContent = rules.join('\n');
  if (!style.isConnected) document.head.appendChild(style);
}
```

`STYLE_KEYS` 改：把 `'highlightRound'` 从「直接 emit 到 #main a border-radius」改为「emit 到 :root --newtab-link-radius」。其他 9 个外观选项保持 STYLE_KEYS 不变（font / fontSize / fontWeight / shadowBlur 还是 emit CSS 规则触发 rebuildDynamicStyles 重新走 resolveEffectiveSettings）。

新增函数 `applySettingChangeFor(key)` 路由（**避免单 key 路径错过 per-theme 解析**）：

```ts
export function applySettingChange<K extends keyof Settings>(key: K): void {
  log('apply', 'applySettingChange', { key, value: getSetting(key) });
  if (key === 'theme') {
    applyTheme(String(getSetting('theme')));
    return; // applyTheme 内部会调 applySettingsToDOM, 不用再走下面
  }
  if (key === 'darkMode') {
    // darkMode 变 → resolveTheme 重算 data-theme → 走整个 applySettingsToDOM
    applySettingsToDOM();
    return;
  }
  if (key in COLOR_KEYS) {
    applyUserColorOverride(key as ColorKey);
    return;
  }
  // 9 个外观 STYLE_KEYS + 4 个布局 STYLE_KEYS 全部走 rebuildDynamicStyles
  //  (rebuildDynamicStyles 内部 resolveEffectiveSettings 拿当前 theme+mode)
  if (STYLE_KEYS.has(key) || key === 'themeOverrides') {
    rebuildDynamicStyles();
    return;
  }
  if (key === 'css') {
    rebuildUserCss();
  }
}
```

> **关键改动**：`applySettingChange` 不再依赖 `key === 'theme'` 单独处理 `applyTheme` 后的「色覆盖写 inline」路径。改成「darkMode 变 → 整个 applySettingsToDOM」一把梭（包含 color 5 个 inline + rebuildDynamicStyles + rebuildUserCss）。这是因为 per-theme per-mode 化后, darkMode 变化会影响 `resolveEffectiveSettings().fontColor` 等 5 个颜色字段, 单纯 `applyTheme` + 5 个 `applyUserColorOverride` 不够, 必须重算。

`applySettingsToDOM` 简化（不再循环 5 个 color key 走 applyUserColorOverride, 改成走 resolveEffectiveSettings 后批量写 inline）：

```ts
export function applySettingsToDOM(): void {
  log('apply', 'applySettingsToDOM');
  const eff = resolveEffectiveSettings();
  // 5 个 color: 从 eff 读 (per-theme per-mode 解析过), 直接写 inline
  writeInlineColor('backgroundColor', eff.backgroundColor);
  writeInlineColor('fontColor', eff.fontColor);
  writeInlineColor('highlightColor', eff.highlightColor);
  writeInlineColor('highlightFontColor', eff.highlightFontColor);
  // shadowColor 跟 highlightColor 共享 CSS var(--newtab-highlight)
  writeInlineColor('shadowColor', eff.shadowColor);
  rebuildDynamicStyles();
  rebuildUserCss();
}

function writeInlineColor(key: ColorKey, value: string): void {
  if (typeof document === 'undefined') return;
  const cssVar = COLOR_KEYS[key];
  const v = String(value ?? '').trim();
  if (!v) document.documentElement.style.removeProperty(cssVar);
  else document.documentElement.style.setProperty(cssVar, v);
}
```

`installSettingsChangeListener` (`apply.ts:234-265`) 的 storage.onChanged 路径不变（已经在 settings 变化时调 `applySettingsToDOM`，`applySettingsToDOM` 内部会重算 resolveEffectiveSettings）。

#### D. `src/features/themes/switcher.ts`（**applyTheme 也要重算 dynamic-styles**）

`applyTheme` (`switcher.ts:158-205`) 当前写完 5 个 inline color 后就 `for (const cb of listeners) cb(resolved);`。现在需要在 `cb` 循环之后（或者之前，位置不重要）调一次 `rebuildDynamicStyles()`，因为：

- 主题切换后，主题的 `--radius` 变了，link 的圆角默认（`calc(var(--radius) - 2px)`）跟着变，但 `rebuildDynamicStyles` 写的 `--newtab-link-radius: ${eff.highlightRound}px` **没变**（因为高亮圆角是用户 px 值，不依赖主题）
- 实际上**不需要**在 `applyTheme` 调 `rebuildDynamicStyles`。dynamic-styles 在 `applySettingsToDOM` 里调，`applySettingsToDOM` 在 settings.onChanged 里调，主题切换是经 `saveThemeChange` → `updateSettings` → 触发 `onChanged` → `applySettingsToDOM`，这条链路已经覆盖。

但**有个边角**：`saveThemeChange` (`settings-panel.ts:570-599`) 调 `applyTheme(theme)` **同步**写完 inline color，然后 `updateSettings(bundle)` **异步**写 storage。`applyTheme` 内部 listener 触发 → 没有任何 listener 当前会调 `rebuildDynamicStyles`（listeners 是空 set）。所以 `saveThemeChange` 路径下，dynamic-styles **不重算** —— 但因为只有 color 和 dynamic-styles 联动，而 color 走 inline custom property 不经过 dynamic-styles，所以目前**没问题**。

**新增 1 处**：`applyTheme` 末尾在 listener 循环里加一个 `void rebuildDynamicStyles()` 兜底（防 listener 以后被接走）。或者最干净是在 applyTheme 内部直接调 `rebuildDynamicStyles()`。`rebuildDynamicStyles` 在 `apply.ts`，`switcher.ts` 已经 import 了 `apply` 模块（CLAUDE.md 没明说 import 路径），新加 import：

```ts
// src/features/themes/switcher.ts
import { rebuildDynamicStyles } from '../settings/apply';
```

并在 `applyTheme` 末尾（listener 循环之后）追加：
```ts
// 主题切换后, 重新算 dynamic-styles (--newtab-link-radius 等 per-theme 派生)
rebuildDynamicStyles();
```

#### E. `src/newtab/settings-panel.ts`（**外观 tab 重排 + 折叠区**）

1. `renderAppearanceTab` 改造：
   - 上半部分：4 个全局选项（主题、暗色模式、宽度、水平位置）—— 不动
   - 下半部分：`<details id="sp-theme-overrides" class="sp-theme-overrides">`，`<summary>当前主题外观</summary>`，里面是 10 个 per-theme per-mode 选项
   - `<details>` 的 open/close 状态用 `localStorage.getItem('newtab01.appearance.themeOverrides.open')` 读 / 写（首次默认 open）
   - 10 个 input 的 value 不再 `getSetting('xxx')`，而是读 `themeOverrides[baseTheme][mode]?.xxx ?? getSetting('xxx')`（与 `resolveEffectiveSettings` 同样的解析逻辑，但只读不写）
   - `saveSetting(key)` 改造：当 `key ∈ {10 个 per-theme per-mode}`，且 `key !== 'themeOverrides'`，写的是 `themeOverrides[baseTheme][mode][key] = value` 而不是 `Settings[key]`
   - revert 按钮（↩）：当 `key` 在 per-theme per-mode 范围 且 `themeOverrides[baseTheme][mode]?.[key] !== undefined`，revert = 「清除这个 override」，fall back 到全局值；input 显示回全局值。否则 revert = 「全局回 defaults」（原行为）

2. 抽出 1 个 helper（**新增**）：

```ts
const PER_THEME_KEYS = [
  'font', 'fontSize', 'fontWeight',
  'fontColor', 'backgroundColor', 'highlightColor', 'highlightFontColor', 'shadowColor',
  'shadowBlur', 'highlightRound',
] as const satisfies ReadonlyArray<keyof Settings>;
type PerThemeKey = (typeof PER_THEME_KEYS)[number];

function isPerThemeKey(k: keyof Settings): k is PerThemeKey {
  return (PER_THEME_KEYS as ReadonlyArray<keyof Settings>).includes(k);
}

function currentBaseTheme(): string {
  return String(getSetting('theme') ?? 'default');
}

function currentMode(): 'light' | 'dark' {
  const dm = String(getSetting('darkMode') ?? 'system');
  if (dm === 'dark') return 'dark';
  if (dm === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readPerThemeValue<K extends PerThemeKey>(key: K): Settings[K] {
  const ovr = (getSetting('themeOverrides') ?? {})[currentBaseTheme()]?.[currentMode()] as Partial<Settings> | undefined;
  if (ovr && ovr[key] !== undefined) return ovr[key] as Settings[K];
  return getSetting(key);
}

function writePerThemeValue<K extends PerThemeKey>(key: K, value: Settings[K]): void {
  const t = currentBaseTheme();
  const m = currentMode();
  const all = { ...(getSetting('themeOverrides') ?? {}) } as Record<string, { light?: Partial<Settings>; dark?: Partial<Settings> }>;
  const bucket = { ...(all[t] ?? {}) } as { light?: Partial<Settings>; dark?: Partial<Settings> };
  const modeBucket = { ...(bucket[m] ?? {}) } as Partial<Settings>;
  modeBucket[key] = value;
  bucket[m] = modeBucket;
  all[t] = bucket;
  void updateSettings({ themeOverrides: all });
}

function clearPerThemeValue<K extends PerThemeKey>(key: K): void {
  // 清除当前 theme+mode 下的 key, fallback 到全局
  const t = currentBaseTheme();
  const m = currentMode();
  const all = { ...(getSetting('themeOverrides') ?? {}) } as Record<string, { light?: Partial<Settings>; dark?: Partial<Settings> }>;
  const bucket = all[t];
  if (!bucket) return;
  const modeBucket = { ...(bucket[m] ?? {}) } as Partial<Settings>;
  delete (modeBucket as Record<string, unknown>)[key];
  bucket[m] = modeBucket;
  all[t] = bucket;
  void updateSettings({ themeOverrides: all });
}
```

3. `createNumberInput` / `createTextInput` / `createColorInput` 加 1 个第二参 `scope: 'global' | 'perTheme' = 'global'`：
   - `perTheme`：初始 value 走 `readPerThemeValue(key)`，change 走 `writePerThemeValue(key, ...)`，revert 走 `clearPerThemeValue(key)`
   - `global`：维持原行为

4. `saveSetting(key)` 改造：增加 1 个 `if (isPerThemeKey(key)) { writePerThemeValue(...); return; }` 早返回（在 theme 特殊处理之前）。

5. `renderAppearanceTab` 新代码骨架：

```ts
async function renderAppearanceTab(): Promise<HTMLElement> {
  const container = el('div', 'sp-tab-content');

  // 全局段 (4 项)
  const allThemes = await listAllThemesWithLabels(THEME_LABELS);
  const themeOptions = allThemes.map((t) => ({ value: t.value, label: t.label }));
  container.appendChild(createRow('主题', createSelectInput('theme', themeOptions), 'theme', buildThemeRowDescription()));
  container.appendChild(createRow('暗色模式', createDarkModeSelectInput(), 'darkMode', '决定主题使用浅色还是深色变体。选「跟随系统」会随 macOS / Windows 的外观设置自动切换。'));
  container.appendChild(createRow('宽度', createNumberInput('width'), 'width', '新标签页主体区域的整体宽度（自动缩放时为百分比，否则为像素）。'));
  container.appendChild(createRow('水平位置', createNumberInput('hPos'), 'hPos', '主体区域在窗口内的水平位置比例，0 偏左、1 居中、2 偏右。'));

  // per-theme per-mode 折叠段
  const details = document.createElement('details');
  details.className = 'sp-theme-overrides';
  const isFirstOpen = localStorage.getItem('newtab01.appearance.themeOverrides.open');
  if (isFirstOpen === null) details.open = true; // 首次默认展开
  else details.open = isFirstOpen === 'true';
  details.addEventListener('toggle', () => {
    localStorage.setItem('newtab01.appearance.themeOverrides.open', String(details.open));
  });

  const summary = document.createElement('summary');
  summary.className = 'sp-theme-overrides-summary';
  // 文案: 「当前主题外观 — Codex · 亮」 之类动态
  summary.textContent = `当前主题外观（${resolveThemeLabel(currentBaseTheme(), THEME_LABELS)} · ${currentMode() === 'dark' ? '暗' : '亮'}）`;
  details.appendChild(summary);

  // 10 个 per-theme per-mode 选项
  details.appendChild(createRow('字体', createTextInput('font', 'perTheme'), 'font', '书签链接使用的字体名称。'));
  details.appendChild(createRow('字号', createNumberInput('fontSize', '0.1', 'perTheme'), 'fontSize', '书签链接的字号（px）。'));
  details.appendChild(createRow('字重', createNumberInput('fontWeight', '0.1', 'perTheme'), 'fontWeight', '书签链接的字重。'));
  details.appendChild(createRow('文字颜色', createColorInput('fontColor', 'perTheme'), 'fontColor', '书签链接默认状态下的文字颜色。'));
  details.appendChild(createRow('背景颜色', createColorInput('backgroundColor', 'perTheme'), 'backgroundColor', '新标签页的背景颜色。'));
  details.appendChild(createRow('高亮颜色', createColorInput('highlightColor', 'perTheme'), 'highlightColor', '鼠标悬停或选中书签时的背景高亮颜色。'));
  details.appendChild(createRow('高亮文字颜色', createColorInput('highlightFontColor', 'perTheme'), 'highlightFontColor', '鼠标悬停或选中时书签文字的颜色。'));
  details.appendChild(createRow('阴影颜色', createColorInput('shadowColor', 'perTheme'), 'shadowColor', '高亮时四周光晕颜色，与"高亮颜色"共享 CSS 变量。'));
  details.appendChild(createRow('阴影模糊', createNumberInput('shadowBlur', '0.1', 'perTheme'), 'shadowBlur', '高亮光晕的模糊半径。'));
  // ★ 高亮圆角：默认 = 主题的 calc(var(--radius) - 2px) 的 px 值
  const themeRoundPx = computeThemeRoundedMdPx();
  details.appendChild(createRow('高亮圆角', createNumberInput('highlightRound', '0.1', 'perTheme'), 'highlightRound',
    `书签高亮背景的圆角大小（px）。留 0 或留空 → 使用主题默认的 .rounded-md（当前主题 = ${themeRoundPx}px）。`));

  container.appendChild(details);
  return container;
}

function computeThemeRoundedMdPx(): number {
  // 主题的 --radius (e.g. Codex = 0.375rem = 6px) 减 2px, 再 round 成整数
  if (typeof document === 'undefined') return 4;
  const root = document.documentElement;
  const r = getComputedStyle(root).getPropertyValue('--radius').trim();
  // r 可能是 '0.375rem' / '6px' / '0' 等
  const remMatch = r.match(/^([\d.]+)rem$/);
  if (remMatch) {
    const rem = parseFloat(remMatch[1]);
    // 浏览器默认 16px = 1rem, 不用管根 font-size(我们 emit 的是 px 直接)
    return Math.max(0, Math.round(rem * 16 - 2));
  }
  const pxMatch = r.match(/^([\d.]+)px$/);
  if (pxMatch) return Math.max(0, Math.round(parseFloat(pxMatch[1]) - 2));
  return 4; // fallback
}
```

6. `refreshInputsFromSettings` (`settings-panel.ts:174-201`) 改造：当 panel 重新 render 完，刷新 10 个 per-theme per-mode input 的 value（用 `readPerThemeValue`）。**这步至关重要** —— 因为切换主题/暗色模式时, settings 已更新, 但 panel 是异步 re-render, input 的 value 要重新读 `themeOverrides[新theme][新mode]`。

7. **不在 per-theme per-mode 范围内**的 5 个 color key + `theme` + `darkMode` + `width` + `hPos` 全部维持原行为。

#### F. `src/lib/storage/settings.ts` `coerceNumberSettings` 跳过 themeOverrides

```ts
function coerceNumberSettings(merged: Settings): ... {
  for (const k of Object.keys(defaults) as Array<keyof Settings>) {
    const reference = defaults[k];
    if (typeof reference === 'number') {
      // ... 既有逻辑 ...
    }
  }
  // themeOverrides 是 object, 不在 defaults 里, 不需要 coerce
}
```

> 实际上 `themeOverrides` 不在 `defaults` 字段里，所以 `Object.keys(defaults)` 循环也不会碰到它 —— 不用改。但加一个注释说明意图。

#### G. `src/lib/storage/index.ts` 修一下 `themeOverrides` 写入

`updateSettings` 已经是 `Partial<Settings>`，没限制。无需改。

#### H. `styles/newtab.css`（**CSS 微调**）

不动 `newtab.css:105` 那行（它已经支持 `var(--newtab-link-radius, calc(var(--radius) - 2px))`，正好是想要的 fallback 链）。

新增 1 个类：

```css
/* sp-theme-overrides: 外观 tab 折叠段 */
.sp-theme-overrides {
  margin-top: 16px;
  padding: 8px 0;
  border-top: 1px solid var(--border);
}
.sp-theme-overrides > summary {
  cursor: pointer;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--foreground);
  padding: 6px 0;
  list-style: none;
  user-select: none;
  /* 三角箭头 (跟 sp-nav-item 风格一致) */
}
.sp-theme-overrides > summary::before {
  content: '▸';
  display: inline-block;
  margin-right: 6px;
  transition: transform 0.15s;
  color: var(--muted-foreground);
}
.sp-theme-overrides[open] > summary::before {
  transform: rotate(90deg);
}
.sp-theme-overrides > summary:hover {
  color: var(--primary);
}
.sp-theme-overrides > summary::-webkit-details-marker {
  display: none; /* 隐藏默认箭头, 用 ::before 自绘 */
}
```

#### I. `CLAUDE.md` 更新

- `§ 0.1` 加 `feat/appearance-theme-overrides` 分支条目（状态 = 🗄 冻结，起点 commit = v0.2.97）
- `§ 2.5 主题与样式` 末尾加一段说明「per-theme per-mode 覆盖」机制
- `§ 9.4` 章节加 1 段说明 `Settings.themeOverrides` 的存储 shape 和回退规则
- `§ 9.7` 章节的 16 个 setting 项列表新增 `themeOverrides`（标注为「对象类型，per-theme per-mode 覆盖；UI 在外观 tab 折叠区」）

#### J. `CHANGELOG.md` 顶部

```md
## [0.2.97] - 2026-06-21

### Changed
- **外观 tab 的 10 个选项 per-theme per-mode 化**: 字体 / 字号 / 字重 / 5 颜色 / 阴影模糊 / 高亮圆角 全部支持"当前主题+外观模式"独立覆盖, 不再全局共享. 新增 `Settings.themeOverrides: Record<themeId, { light?: Partial<Settings>; dark?: Partial<Settings> }>` 存储桶.
  - 外观 tab 加 `<details>` 折叠区, 首次进入默认展开, 之后记忆用户开/合状态 (localStorage `newtab01.appearance.themeOverrides.open`).
  - 切换主题 / 暗色模式, 这 10 个 input 的 value 自动从对应桶读 (`themeOverrides[newTheme][newMode]?.key ?? Settings.key`).
  - 10 个 input 的 revert (↩) 按钮改为"清除当前主题+模式的 override", 不会动全局值.
  - 主题 + 暗色模式 + 宽度 + 水平位置 仍然全局, 不在覆盖范围.
- **高亮圆角单位从 em scale 改为 px**: 旧实现是 `#main a { border-radius: ${scale(highlightRound, 0.2, 1.5)}em }` 直接覆盖. 新实现写 `--newtab-link-radius: ${highlightRound}px`, 配合 `newtab.css:105` 的 `var(--newtab-link-radius, calc(var(--radius) - 2px))` fallback. 用户填 0 → 主题 .rounded-md; 填 N → Npx.
  - input 默认值 = 当前主题的 `calc(var(--radius) - 2px)` 算出的 px 值 (Codex = 4px, MX-Brutalist = 0px). 用户能直接看到主题的派生圆角.
- **字号 / 字重 改为 px 直接存** (顺手修不生效调查路径): 旧 `${fontSize / 10}em` 改为 `${fontSize}px`, 旧 62.5% root font-size 技巧下用户看到 devtools 是 1.8em 不直观. 改后 devtools 直接显示 18px, 跟 input 数值一致.

### Notes
- `Settings.themeOverrides` 字段对老用户默认 undefined → 全部 10 项 fall back 到全局值, 行为兼容 v0.2.96.
- `applySettingsToDOM` 内部新增 `resolveEffectiveSettings()` 解析器, storage.onChanged 触发时一并重算, 不需要改 listener 路径.
- `applyTheme` (themes/switcher.ts) 末尾追加 `rebuildDynamicStyles()` 兜底, 防 listener 接走时漏掉 dynamic-styles.
- 13.5px (= 18 × 0.75) 字号的根因未在本 PR 复现; 改 px 单位后, 如果仍出现 13.5, 怀疑点是 Chrome 浏览器缩放 (chrome://settings → Page zoom) 或 `#main` / 祖先有 font-size 75% 覆盖. 排查时 devtools 选中 `<a>` 看 Computed → font-size 是不是 18px, 不是就往上找覆盖源.
```

### 3.3 不改的东西

- `Settings` 既有 32 个字段（除了 `themeOverrides` 增项）不动
- `link.ts` 不动（链接渲染路径不读 highlightRound）
- `folder.ts` / `board.ts` / `drag-drop/*` 不动（这些模块不消费外观设置）
- `applyTheme` 的 5 个 inline color 写路径不动（`applySettingsToDOM` 接管）
- 5 个内置主题 CSS 文件不动（`--radius` 已存在）
- 运行时主题导入（`custom-themes.ts`）不动（导入时不会改 user 已有 themeOverrides）

### 3.4 兼容性

- 老用户（v0.2.96 之前）`Settings` 没有 `themeOverrides` 字段 → `resolveEffectiveSettings` 用 `?? {}` → 所有 10 项 fall back 到全局值 → 行为兼容
- 用户在 v0.2.97 之前手动改过 chrome.storage.sync 里的 `fontSize` 等字段 → 跟 v0.2.55 一样走 `coerceNumberSettings` 兜底（已经存在），不需要新加迁移
- 用户在 v0.2.97 之后切换主题 → 自动从 `themeOverrides[newTheme][newMode]` 读，没就 fall back 到全局 → 符合预期
- 用户删除自定义主题 → 不用动 `themeOverrides`（删除的 id 不会出现在 dropdown 里，但存储桶里仍占位 — 留 1 个 cleanup pass：删除主题时 `removeCustomTheme` 内同步删 `themeOverrides[thatId]`）

### 3.5 边角清理

- `removeCustomTheme` (`custom-themes.ts`) 加 1 行：`if (themeOverrides[deletedId]) delete themeOverrides[deletedId];` 然后写回 storage
- `initSettings` `replaceSettings` 路径（`apply.ts:onChanged` 调）: storage 新值进来后, 旧 settings 被完全覆盖, `themeOverrides` 也跟着进 — OK
- 调试模式 dump (`settings-panel.ts:debug.dump()`): 输出 `themeOverrides` 字段

---

## 4. Assumptions & Decisions

| 决策点 | 选 | 理由 |
|--------|------|------|
| per-theme per-mode 选项集 | 10 项（字体/字号/字重/5 颜色/阴影模糊/高亮圆角）| 用户原话「从字体到高亮圆角」字面对应 |
| 宽度 / 水平位置 | 留在全局 | 用户原话「除了宽度和水平位置」 |
| 主题 + 暗色模式 | 留在全局 | 控制"用哪个桶"的元数据, 本身不能被覆盖 |
| 折叠实现 | 原生 `<details>` + 自定义 summary | 用户选; 零 JS, a11y 免费, 主题样式可改 |
| 折叠默认状态 | 首次展开, 之后记忆 (localStorage) | 用户选 |
| 高亮圆角单位 | px 直接存 | 用户原话「改为 px」 |
| 高亮圆角默认 | 当前主题 `calc(var(--radius) - 2px)` 的 px 值 | 用户选; input 框直接显示主题派生值 |
| 高亮圆角=0 行为 | `--newtab-link-radius: 0px` → fallback 触发 → 主题 .rounded-md | 让 0 = "用主题默认" 的语义自然 |
| 字号单位 | px 直接存（不再 /10 em）| 修不生效调查路径 + 跟 input 数值一致 |
| themeOverrides 存储位置 | `chrome.storage.sync` (跟其他 Settings 一起) | 10 个值叠加可能超 100KB? 单用户最多 4 主题 × 2 mode × 10 key = 80 个 entry, 每 entry ≤ 30 bytes ≈ 2.4KB, 远低于 100KB 配额 |
| 存储 shape | `Record<themeId, { light?: Partial<Settings>; dark?: Partial<Settings> }>` | 嵌套 map, 直观; light/dark 可独立缺省 |
| 切换主题时 input 刷新 | panel re-render 时 read `themeOverrides[newTheme][newMode]?.key` | 单一 source: renderAppearanceTab 入口处统一读 |
| 切换主题的 storage 路径 | saveThemeChange → updateSettings → onChanged → applySettingsToDOM (重算 resolveEffectiveSettings) | 复用现有链路, 最小改动 |
| 主题切换后 dynamic-styles 重算 | `applyTheme` 末尾调 `rebuildDynamicStyles()` | 防止 theme listener 接走时漏算 |
| 自定义主题删除 | 同步删 `themeOverrides[thatId]` | 防 storage 留死桶 |
| `--newtab-link-radius` 写在哪 | `:root { --newtab-link-radius: ${px}px }` | specificity 0,0,0,1; newtab.css 里的 `var(--newtab-link-radius, ...)` 在 `#main a` (0,0,1,0) → 走 fallback 链, 主题切换时自动跟随 `--radius` 变 |
| 13.5px 根因 | 暂未复现, 改 px 后再观察; Plan 里列 3 个怀疑位置 | 用户说"有 CSS 规则覆盖了", 但代码里没找到直接覆盖; Plan 阶段不强行修, 改单位后用户自验 |

---

## 5. Verification

### 5.1 实施后构建 + 静态检查

```bash
pnpm install
pnpm type-check   # tsc --noEmit
pnpm lint         # 既有 lint
pnpm build        # vite build, 生成 dist/
```

预期：0 error。ThemeModeOverrides 类型 + 嵌套 map 写入可能需要若干 `as` 断言（已经计划在 readPerThemeValue / writePerThemeValue 写好）。

### 5.2 UI 验证（**必须实际加载扩展**，build 通过 ≠ UI 正确 — 见 project_memory.md）

加载 `dist/` 到 `chrome://extensions/`，打开新标签页 + 设置面板：

| 验收点 | 预期 |
|--------|------|
| 外观 tab 默认展开折叠区 | 首次打开面板, `<details>` open = true |
| 关闭再开面板 | 折叠区保持上次状态 (localStorage 记忆) |
| 字号输入 18, devtools 选中 `<a>` 看 Computed | font-size = 18px (不是 1.8em, 不是 13.5px) |
| 高亮圆角输入 0, devtools 看 `--newtab-link-radius` | `0px` (inline 写死), 实际 border-radius 走 fallback = `calc(6px - 2px) = 4px` (Codex 默认) |
| 高亮圆角输入 8, devtools 看 border-radius | `8px` |
| 切换主题: Codex → MX-Brutalist | MX-Brutalist 折叠区 input value 自动更新 (字号/字重/颜色等都变) |
| MX-Brutalist 下改字号 24 | 写到 `themeOverrides['mx-brutalist'][currentMode()].fontSize = 24` |
| 切回 Codex | Codex 字号保持原全局值, 不受 MX-Brutalist 改动影响 |
| 切回 MX-Brutalist | 字号 = 24 (override 生效) |
| 在 MX-Brutalist 改暗色模式 (亮 → 暗) | input value 切到 dark 桶 (如果 dark 桶有 override); 没有就 fall back 到全局 |
| 颜色 revert 按钮 ↩ | 清除当前 theme+mode 的 override, input 回到全局值 |
| 宽度 / 水平位置输入 1 | 全局生效, 不写 themeOverrides |
| 切换主题保留 width = 1 | 切回原来主题, width 仍 = 1 (全局值) |
| 删除自定义主题 | themeOverrides 里对应 id 同步删 (devtools 看 storage) |
| 卸载并重装扩展 | themeOverrides 留 (chrome.storage.sync 跨设备同步), 行为不变 |

### 5.3 13.5px 根因排查（如仍出现）

实施后用户**仍**看到 13.5px：

1. 打开 devtools, 选中书签 `<a>` → Computed panel → font-size
2. 如果是 18px：bug 修好了（之前是 1.8em 看起来一样, 但用户看 devtools 误以为没生效）
3. 如果是 13.5px：
   - 看 Cascade panel, 找覆盖源（grep `#main` / `body` / `html` 是否有 `font-size: 75%` 或 `0.75em`）
   - 检 `chrome://settings/appearance` → Page zoom (回 100%)
   - 检 OS 辅助功能 → Display text size
4. 找到覆盖源后, 在 `<details>` 折叠区加 1 段说明"如果有外部 font-size 缩放, 这 10 个设置都用 px 直存, 不会被继承缩放影响"

### 5.4 性能检查

- 8 KB JS 预算内（resolveEffectiveSettings < 1KB, writePerThemeValue < 0.5KB, 其余类型扩展都是 0 运行时代价）
- storage.onChanged 触发 `applySettingsToDOM` → `resolveEffectiveSettings` 一次, < 0.1ms（map lookup）
- `<details>` 折叠动画用 CSS transition, 无 JS 帧成本

### 5.5 主题切换端到端

```bash
# 1. 切到 default 主题, 字号 18, 高亮圆角 0 → 看到 4px 圆角 (Codex .rounded-md)
# 2. 切到 mx-brutalist 主题 → 看到 0px 圆角 (MX-Brutalist --radius = 0)
# 3. 切到 cyberpunk 主题 → 看 cyberpunk 主题的 --radius
# 4. 切换暗色模式 (亮 → 暗), 看每个主题的暗色变体的 --radius 是否不同
```

---

## 6. Files Touched

| File | 改动类型 | 估行数 |
|------|---------|--------|
| `src/features/bookmarks/types.ts` | 增 type + 1 字段 | +12 |
| `src/lib/storage/settings.ts` | 注释 + 不动 defaults | +5 |
| `src/features/settings/apply.ts` | resolveEffectiveSettings + 改造 rebuildDynamicStyles / applySettingsToDOM / applySettingChange | +60 / -15 |
| `src/features/themes/switcher.ts` | 末尾 import + 末尾 rebuildDynamicStyles | +3 |
| `src/newtab/settings-panel.ts` | renderAppearanceTab 大改 + helpers + createInput 第 2/3 参 + refreshInputs | +120 / -25 |
| `src/features/themes/custom-themes.ts` | removeCustomTheme 同步删 themeOverrides | +5 |
| `styles/newtab.css` | .sp-theme-overrides 块 | +25 |
| `CLAUDE.md` | § 0.1 + § 2.5 + § 9.4 + § 9.7 改 | +20 / -5 |
| `CHANGELOG.md` | 顶部加 v0.2.97 段 | +30 |
| `package.json` | version 0.2.96 → 0.2.97 | +1 / -1 |
| **总计** | — | **≈ 280 行** |

---

## 7. Risks

| 风险 | 概率 | 缓解 |
|------|------|------|
| 13.5px 改 px 后仍存在, 找不到覆盖源 | 中 | Plan § 5.3 留排查路径; 不阻塞 PR merge |
| `themeOverrides` 写入竞态 (用户同时改 + 切换主题) | 低 | chrome.storage.sync.set 是原子的; 写之前 `{ ...all }` 浅拷贝保证不会覆盖其他桶 |
| `<details>` 跨浏览器表现不一致 | 低 | Chrome/Edge 全部原生支持; Firefox 也支持; 不支持时降级为 div + JS toggle |
| 老用户从 v0.2.96 升级, themeOverrides undefined | 已处理 | `?? {}` 兜底; 无破坏性 |
| chrome.storage.sync 100KB 配额 | 极低 | 见 § 4 决策表计算 (≤ 2.4KB) |
| 切换主题时 input 闪烁 (panel re-render) | 中 | `<details>` 在 re-render 时保持 open 状态; input value 在 re-render 入口处一次性 read 完; 不闪 |
| `applyTheme` 末尾 `rebuildDynamicStyles` 重复调用 (之前 settings.onChanged 已经调过) | 已存在 | 重复调用是 idempotent, 不影响视觉; 性能开销 < 0.1ms |

---

## 8. Open Questions (待用户最终确认)

1. **存储位置**: `chrome.storage.sync` (跨设备同步) vs `chrome.storage.local` (本地)?
   - 当前 plan: `sync`, 理由: 用户改主题外观应该跟 settings 一起同步到其他设备
   - 反方: 主题外观是设备特定的 (屏幕大小 / DPI 不一样), 跨设备同步可能没意义
   - **倾向**: sync; 用户没明确表态前, 跟其他 Settings 一起

2. **删除主题时清桶**: 是否在删除自定义主题时同步删 `themeOverrides[thatId]`?
   - 当前 plan: 是
   - 反方: 万一用户想保留设置 (可能恢复主题) — 但实际上 reinstall 后桶里的值也生效
   - **倾向**: 同步删, 保持 storage 干净

3. **是否暴露"复制全局 → 当前主题"按钮**?
   - 用户没提, 当前 plan 不加
   - 反方: 用户可能想"以全局为基础, 单独覆盖一个值", 当前实现已经支持
   - **倾向**: 不加, 保持改动最小

如果用户对以上 3 个问题有不同意见, 实施前再调; 不调的话直接进 Phase 4 实施。
