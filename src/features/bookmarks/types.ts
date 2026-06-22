// Shared types for the bookmark tree system

/** Represents a node in the bookmark tree (folder or link) */
export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  children?: BookmarkNode[];
  /** Special folder type identifier */
  type?: 'top' | 'apps' | 'recent' | 'closed' | 'devices' | 'empty';
  /** CSS class name for icon styling */
  className?: string;
  /** Custom action handler */
  action?: (event: Event) => boolean | void | Promise<boolean | void>;
  /** Tooltip text */
  tooltip?: string;
  /** App icons (from chrome.management) */
  icons?: Array<{ url: string; size: number }>;
  /** Custom icon URL */
  icon?: string;
}

/** Column layout: columns[x][y] = folder id */
export type Columns = string[][];

/** Coordinate map: id → {x, y} */
export interface CoordMap {
  [id: string]: { x: number; y: number };
}

/**
 * Per-theme per-appearance-mode overrides for the 10 appearance-tab
 * options (font / fontSize / fontWeight / 5 colors / shadowBlur /
 * highlightRound). Other settings (theme, darkMode, width, hPos,
 * align, spacing, columnWidth, ...) are intentionally NOT in this
 * set — they remain global.
 *
 * Stored in `Settings.themeOverrides[themeId][light|dark]` (nested
 * map). Each entry is a `Partial<Settings>` so the user can override
 * a single key (e.g. just `fontSize`) without restating the other
 * 9. Missing keys fall back to the global `Settings[key]`.
 *
 * Resolution order in `resolveEffectiveSettings` (features/settings/apply.ts):
 *   `themeOverrides[baseTheme][mode]?.[key] ?? Settings[key]`
 */
export type ThemeModeOverrides = Partial<Pick<Settings,
  'font' | 'fontSize' | 'fontWeight' |
  'fontColor' | 'backgroundColor' | 'highlightColor' | 'highlightFontColor' | 'shadowColor' |
  'shadowBlur' | 'highlightRound'
>>;

/** Settings configuration with defaults */
export interface Settings {
  font: string;
  fontSize: number;
  fontWeight: number;
  theme: string;
  /**
   * Dark mode preference. Independent from `theme` — the rendered
   * `data-theme` attribute on <html> is `<theme>` for light,
   * `<theme>-dark` for dark (when the theme has a dark variant),
   * or resolved at runtime via `prefers-color-scheme` for 'system'.
   * Default 'system'. See docs/superpowers/specs/2026-06-19-
   * dark-mode-setting-design.md for the full design.
   */
  darkMode: 'system' | 'light' | 'dark';
  fontColor: string;
  backgroundColor: string;
  backgroundImage: string;
  highlightColor: string;
  highlightFontColor: string;
  shadowColor: string;
  shadowBlur: number;
  highlightRound: number;
  spacing: number;
  width: number;
  hPos: number;
  lock: number;
  showTop: number;
  showApps: number;
  showRecent: number;
  showClosed: number;
  showDevices: number;
  showRoot: number;
  newtab: number;
  rememberOpen: number;
  autoClose: number;
  autoScale: number;
  css: string;
  numberTop: number;
  numberClosed: number;
  numberRecent: number;
  lockColumns: number;
  columnWidth: string;
  align: string;
  /** Debug mode — gates console logging in the extension. Default 0 (off). */
  debug: number;
  /**
   * Threshold for the "open all" / "open as group" folder actions. When
   * the direct URL children of a folder exceed this number, the action
   * is gated behind a `window.confirm()` prompt so the user can
   * abort before `numberTop`-many tabs are created. 0 disables the
   * confirm (every action runs without prompting). Default 10.
   */
  folderActionConfirmThreshold: number;
  /**
   * Per-theme per-appearance-mode overrides. Outer key is base theme
   * id (the same value as the `theme` field, without the `-dark`
   * suffix); inner key is `'light' | 'dark'` (resolved from
   * `darkMode` + `prefers-color-scheme`). Each entry is a partial
   * `Settings` covering the 10 appearance options — see
   * `ThemeModeOverrides` above. Missing keys fall back to the
   * global `Settings[key]`; a missing bucket falls back entirely.
   * Undefined (default for new users) = no overrides, all 10 fields
   * use the global values. Not in `defaults` (lib/storage/settings.ts)
   * because `?? {}` is the natural fallback.
   */
  themeOverrides?: Record<string, { light?: ThemeModeOverrides; dark?: ThemeModeOverrides }>;
}

/** Context menu item */
export interface MenuItem {
  label: string;
  /**
   * Click handler. May be sync or async — context-menu layout actions
   * return a Promise so they can `await` the underlying layout mutation
   * before the undo snapshot is pushed.
   */
  action: () => void | Promise<void>;
}

/** Drag state */
export interface DragState {
  ids: string[];
  sourceType: 'column' | 'folder';
}
