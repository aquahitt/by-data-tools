import type { MdOutlinedSelect } from '@material/web/select/outlined-select.js';
import type { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js';
import { cryptoRng } from '../core/random';
import type { FieldSpec, FormatModule, Rng } from '../core/types';
import { el } from './dom';
import { mdIcon } from './icons';

type Control = MdOutlinedTextField | MdOutlinedSelect;

const LIST_MAX = 1000;
const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;

export interface GeneratePanel {
  setFormat(format: FormatModule): void;
}

export function mountGeneratePanel(
  root: HTMLElement,
  onCheck: (value: string) => void,
  help = 'Пустые поля заполняются случайно. Контрольная цифра считается автоматически.',
  rng: Rng = cryptoRng,
): GeneratePanel {
  const fieldsBox = el('div', { class: 'fields' });
  const generateButton = el('md-filled-button', {}, 'Сгенерировать');
  const randomButton = el('md-outlined-button', {}, 'Всё случайно');
  const count: MdOutlinedTextField = el('md-outlined-text-field', {
    label: 'Сколько',
    value: '1',
    type: 'number',
    min: '1',
    max: String(LIST_MAX),
    autocomplete: 'off',
  });
  count.classList.add('count-field');
  const output = el('div', { class: 'output', 'aria-live': 'polite' });
  root.append(
    el('p', { class: 'help' }, help),
    fieldsBox,
    el('div', { class: 'actions' }, generateButton, randomButton, count),
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

  function copyButton(label: string, text: () => string): HTMLElement {
    const b = el('md-outlined-button', {}, label);
    b.prepend(Object.assign(mdIcon('copy'), { slot: 'icon' }));
    b.addEventListener('click', () => void navigator.clipboard?.writeText(text()));
    return b;
  }

  /** Several values at once: one per line, or a table of spellings when the format gives variants. */
  function runList(partial: Record<string, string>, n: number): void {
    const results = Array.from({ length: n }, () => format!.generate(partial, rng));
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showErrors(failed.fieldErrors);
      return;
    }
    const ok = results.flatMap((r) => (r.ok ? [r] : []));
    const labels = ok[0].variants?.map((v) => v.label);
    const list = ok.map((r) => r.value).join('\n');
    const actions = el('div', { class: 'actions' }, copyButton('Копировать списком', () => list));
    if (labels) {
      const csv = [labels.map(csvCell).join(';'), ...ok.map((r) => (r.variants ?? []).map((v) => csvCell(v.value)).join(';'))].join('\r\n');
      actions.append(copyButton('Копировать все варианты (CSV)', () => csv));
      const head = el('tr', {}, ...labels.map((l) => el('th', { scope: 'col' }, l)));
      const body = ok.map((r) => el('tr', {}, ...(r.variants ?? []).map((v) => el('td', {}, v.value))));
      output.append(
        actions,
        el('div', { class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': 'Сгенерированные значения' }, el('table', { class: 'persona-table' }, el('thead', {}, head), el('tbody', {}, ...body))),
      );
    } else {
      output.append(actions, el('pre', { class: 'generated-list', tabindex: '0' }, list));
    }
  }

  function showErrors(fieldErrors: Record<string, string>): void {
    for (const [key, message] of Object.entries(fieldErrors)) {
      const control = controls.get(key);
      if (control) {
        control.error = true;
        control.errorText = message;
      }
    }
  }

  function run(partial: Record<string, string>): void {
    if (!format) return;
    controls.forEach(clearError);
    output.replaceChildren();
    const n = Number(count.value);
    if (!Number.isInteger(n) || n < 1 || n > LIST_MAX) {
      count.error = true;
      count.errorText = `От 1 до ${LIST_MAX}`;
      return;
    }
    count.error = false;
    count.errorText = '';
    if (n > 1) {
      runList(partial, n);
      return;
    }
    const r = format.generate(partial, rng);
    if (!r.ok) {
      showErrors(r.fieldErrors);
      return;
    }
    const value = r.value;
    const copy = el('md-icon-button', { 'aria-label': 'Копировать' }, mdIcon('copy'));
    copy.addEventListener('click', () => void navigator.clipboard?.writeText(value));
    const check = el('md-text-button', {}, 'Проверить');
    check.addEventListener('click', () => onCheck(value));
    output.append(el('output', { class: 'generated' }, value), copy, check);
    if (r.hint) output.append(el('span', { class: 'gen-hint' }, r.hint));
    if (r.variants?.length) {
      const rows = r.variants.map((v) => {
        const copyVariant = el('md-icon-button', { 'aria-label': `Копировать: ${v.label}` }, mdIcon('copy'));
        copyVariant.addEventListener('click', () => void navigator.clipboard?.writeText(v.value));
        return el('tr', {}, el('th', { scope: 'row' }, v.label), el('td', {}, v.value), el('td', { class: 'variant-copy' }, copyVariant));
      });
      output.append(el('table', { class: 'parsed variants' }, el('tbody', {}, ...rows)));
    }
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
