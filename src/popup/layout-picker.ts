// Layout picker for Popup split screen
import type { SplitMode } from '../features/split/types';

const LAYOUTS: { mode: SplitMode; label: string; grid: string; areas: string[] }[] = [
  { mode: '2h', label: '2 Horizontal', grid: '"a b" / 1fr 1fr', areas: ['a', 'b'] },
  { mode: '2v', label: '2 Vertical', grid: '"a" "b" / 1fr', areas: ['a', 'b'] },
  { mode: '3H', label: '3 Horizontal', grid: '"a b c" / 1fr 1fr 1fr', areas: ['a', 'b', 'c'] },
  { mode: '4grid', label: '4 Grid', grid: '"a b" "c d" / 1fr 1fr', areas: ['a', 'b', 'c', 'd'] },
];

export class LayoutPicker {
  private selected: SplitMode = '2h';
  private container: HTMLElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'layout-picker';
  }

  render(): HTMLElement {
    this.container.textContent = '';

    for (const layout of LAYOUTS) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'layout-option';
      if (layout.mode === this.selected) {
        option.classList.add('layout-option--active');
      }

      const preview = document.createElement('div');
      preview.className = 'layout-preview';
      preview.style.grid = layout.grid;

      const count = layout.mode === '2h' || layout.mode === '2v' ? 2 : layout.mode === '3H' ? 3 : 4;
      for (let i = 0; i < count; i++) {
        const cell = document.createElement('div');
        cell.className = 'layout-cell';
        cell.style.gridArea = layout.areas[i]!;
        preview.appendChild(cell);
      }

      const label = document.createElement('span');
      label.className = 'layout-label';
      label.textContent = layout.label;

      option.appendChild(preview);
      option.appendChild(label);

      option.addEventListener('click', () => {
        this.selected = layout.mode;
        this.render();
      });

      this.container.appendChild(option);
    }

    return this.container;
  }

  getSelected(): SplitMode {
    return this.selected;
  }
}
