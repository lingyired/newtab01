// Unified rendering entry point
// Re-exports the main render functions

export { renderColumns, initBoard } from './board';
export { renderColumn } from './column';
export { renderFolder } from './folder';
export { renderLink } from './link';
export { createFavicon } from './favicon';
export { renderMenu, closeMenu, getFolderMenuItems, getColumnMenuItems } from './context-menu';
