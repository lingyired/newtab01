import type { SplitMode } from './types';

const containerStyles = `
  width: 100%;
  height: 100%;
  overflow: hidden;
`;

const layoutConfigs: Record<SplitMode, { gridTemplate: string; areas: string[] }> = {
  '2h': {
    gridTemplate: 'grid-template-columns: 1fr 1fr; grid-template-rows: 1fr;',
    areas: ['left', 'right'],
  },
  '2v': {
    gridTemplate: 'grid-template-columns: 1fr; grid-template-rows: 1fr 1fr;',
    areas: ['top', 'bottom'],
  },
  '3grid': {
    gridTemplate: 'grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;',
    areas: ['main', 'side-top', 'side-bottom'],
  },
  '4grid': {
    gridTemplate: 'grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;',
    areas: ['tl', 'tr', 'bl', 'br'],
  },
};

export function createLayoutContainer(mode: SplitMode): HTMLElement {
  const config = layoutConfigs[mode];
  const container = document.createElement('div');
  container.className = 'split-layout';
  container.style.cssText = `
    ${containerStyles}
    display: grid;
    ${config.gridTemplate}
    gap: 2px;
    background: var(--border);
  `;
  return container;
}

export function createFrameSlot(index: number, mode: SplitMode): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'split-frame-slot';
  slot.dataset.slotIndex = String(index);

  // For 3grid, first item spans 2 rows
  if (mode === '3grid' && index === 0) {
    slot.style.cssText = `
      grid-row: span 2;
      background: var(--background);
      position: relative;
      overflow: hidden;
    `;
  } else {
    slot.style.cssText = `
      background: var(--background);
      position: relative;
      overflow: hidden;
    `;
  }

  return slot;
}
