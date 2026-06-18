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
  '3H': {
    gridTemplate: 'grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr;',
    areas: ['left', 'center', 'right'],
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

export function createFrameSlot(index: number): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'split-frame-slot';
  slot.dataset.slotIndex = String(index);
  slot.style.cssText = `
    background: var(--background);
    position: relative;
    overflow: hidden;
  `;

  return slot;
}
