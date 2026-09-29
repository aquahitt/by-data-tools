import type { FormatId, FormatModule } from '../core/types';
import { el } from './dom';

// @material/web ships segmented buttons only under labs/, so this is a plain ARIA radiogroup.
export function mountFormatSwitch(
  root: HTMLElement,
  formats: FormatModule[],
  initial: FormatId,
  onChange: (id: FormatId) => void,
): { set(id: FormatId): void } {
  root.className = 'segmented';
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', 'Формат номера');
  const buttons = formats.map((f) => {
    const button = el('button', { type: 'button', role: 'radio', 'data-id': f.id }, f.title);
    button.addEventListener('click', () => onChange(f.id));
    return button;
  });
  root.append(...buttons);

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const current = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    const next = (current + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    onChange(formats[next].id);
    buttons[next].focus();
  });

  function set(id: FormatId): void {
    for (const b of buttons) {
      const on = b.dataset.id === id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      // With many formats the switch scrolls sideways on phones: keep the chosen one in view.
      if (on && root.scrollWidth > root.clientWidth) root.scrollLeft = b.offsetLeft - (root.clientWidth - b.offsetWidth) / 2;
    }
  }

  set(initial);
  return { set };
}
