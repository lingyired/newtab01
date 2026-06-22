// Layout picker for Popup split screen
import type { SplitMode } from '../features/split/types';
import { t, type MessageKey } from '../lib/i18n';

const LAYOUTS: { mode: SplitMode; labelKey: MessageKey; grid: string; areas: string[] }[] = [
  { mode: '2h', labelKey: 'popup.layout.2h', grid: '"a b" / 1fr 1fr', areas: ['a', 'b'] },
  { mode: '2v', labelKey: 'popup.layout.2v', grid: '"a" "b" / 1fr', areas: ['a', 'b'] },
  { mode: '3H', labelKey: 'popup.layout.3H', grid: '"a b c" / 1fr 1fr 1fr', areas: ['a', 'b', 'c'] },
  { mode: '4grid', labelKey: 'popup.layout.4grid', grid: '"a b" "c d" / 1fr 1fr', areas: ['a', 'b', 'c', 'd'] },
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
      label.textContent = t(layout.labelKey);

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
