import type { MdOutlinedSelect } from '@material/web/select/outlined-select.js';
import type { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js';
import { cryptoRng } from '../core/random';
import type { FieldSpec, FormatModule, Rng } from '../core/types';
import { el } from './dom';
import { mdIcon } from './icons';

type Control = MdOutlinedTextField | MdOutlinedSelect;

export interface GeneratePanel {
  setFormat(format: FormatModule): void;
}

export function mountGeneratePanel(
  root: HTMLElement,
  onCheck: (value: string) => void,
  rng: Rng = cryptoRng,
): GeneratePanel {
  const fieldsBox = el('div', { class: 'fields' });
  const generateButton = el('md-filled-button', {}, 'Сгенерировать');
  const randomButton = el('md-outlined-button', {}, 'Всё случайно');
  const output = el('div', { class: 'output', 'aria-live': 'polite' });
  root.append(
    el('p', { class: 'help' }, 'Пустые поля заполняются случайно. Контрольная цифра считается автоматически.'),
    fieldsBox,
    el('div', { class: 'actions' }, generateButton, randomButton),
    output,
  );

  let format: FormatModule | null = null;
  let controls = new Map<string, Control>();

  function buildControl(spec: FieldSpec): Control {
    if (spec.kind === 'select') {
      const select = el('md-outlined-select', { label: spec.label });
      select.append(el('md-select-option', { value: '' }, el('div', { slot: 'headline' }, 'Случайно')));
      for (const o of spec.options ?? []) {
        select.append(el('md-select-option', { value: o.value }, el('div', { slot: 'headline' }, o.label)));
      }
      return select;
    }
    return el('md-outlined-text-field', {
      label: spec.label,
      placeholder: spec.placeholder ?? '',
      autocomplete: 'off',
      // Inherited by the shadow <input>; keeps typed data away from cloud spell-check.
      spellcheck: 'false',
    });
  }

  function clearError(control: Control): void {
    control.error = false;
    control.errorText = '';
  }

  function setFormat(f: FormatModule): void {
    // Fields both formats share (same key) keep what the user typed or picked.
    const previous = new Map([...controls].map(([key, control]) => [key, control.value]));
    format = f;
    controls = new Map();
    fieldsBox.replaceChildren();
    output.replaceChildren();
    for (const spec of f.fields) {
      const control = buildControl(spec);
      const dice = el('md-icon-button', { 'aria-label': `Случайное значение: ${spec.label}` }, mdIcon('dice'));
      dice.addEventListener('click', () => {
        const context = Object.fromEntries([...controls].map(([key, c]) => [key, c.value]));
        control.value = spec.random(rng, context);
        clearError(control);
      });
      controls.set(spec.key, control);
      fieldsBox.append(el('div', { class: 'field-row' }, control, dice));
      const kept = previous.get(spec.key);
      const allowed = spec.kind !== 'select' || spec.options?.some((o) => o.value === kept);
      if (kept && allowed) void control.updateComplete.then(() => (control.value = kept));
    }
  }

  function run(partial: Record<string, string>): void {
    if (!format) return;
    controls.forEach(clearError);
    output.replaceChildren();
    const r = format.generate(partial, rng);
    if (!r.ok) {
      for (const [key, message] of Object.entries(r.fieldErrors)) {
        const control = controls.get(key);
        if (control) {
          control.error = true;
          control.errorText = message;
        }
      }
      return;
    }
    const value = r.value;
    const copy = el('md-icon-button', { 'aria-label': 'Копировать' }, mdIcon('copy'));
    copy.addEventListener('click', () => void navigator.clipboard?.writeText(value));
    const check = el('md-text-button', {}, 'Проверить');
    check.addEventListener('click', () => onCheck(value));
    output.append(el('output', { class: 'generated' }, value), copy, check);
    if (r.hint) output.append(el('span', { class: 'gen-hint' }, r.hint));
  }

  generateButton.addEventListener('click', () =>
    run(Object.fromEntries([...controls].map(([key, control]) => [key, control.value]))),
  );
  randomButton.addEventListener('click', () => {
    controls.forEach((control) => (control.value = ''));
    run({});
  });

  return { setFormat };
}
