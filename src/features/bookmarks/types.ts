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

/** Settings configuration with defaults */
export interface Settings {
  font: string;
  fontSize: number;
  fontWeight: number;
  theme: string;
  fontColor: string;
  backgroundColor: string;
  backgroundImage: string;
  highlightColor: string;
  highlightFontColor: string;
  shadowColor: string;
  shadowBlur: number;
  highlightRound: number;
  fade: number;
  spacing: number;
  width: number;
  hPos: number;
  vMargin: number;
  slide: number;
  hideOptions: number;
  lock: number;
  showTop: number;
  showApps: number;
  showRecent: number;
  showClosed: number;
  showDevices: number;
  showRoot: number;
  showSearch: number;
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
}

/** Context menu item */
export interface MenuItem {
  label: string;
  action: () => void;
}

/** Drag state */
export interface DragState {
  ids: string[];
  sourceType: 'column' | 'folder';
}
