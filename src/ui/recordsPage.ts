import type { MdOutlinedSelect } from '@material/web/select/outlined-select.js';
import type { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js';
import { cryptoRng } from '../core/random';
import type { Rng } from '../core/types';
import { type DataRecord, type RecordSet, toCsv, toJson } from '../formats/records';
import { el } from './dom';
import { mdIcon } from './icons';

const MAX = 100;

function select(label: string, options: [string, string][]): MdOutlinedSelect {
  const s = el('md-outlined-select', { label });
  s.append(el('md-select-option', { value: '', selected: '' }, el('div', { slot: 'headline' }, 'Случайно')));
  for (const [value, text] of options) s.append(el('md-select-option', { value }, el('div', { slot: 'headline' }, text)));
  return s;
}

/** Generator-only section: a set of consistent records, shown as a table and copied as JSON or CSV. */
export function mountRecordsPage(root: HTMLElement, set: RecordSet, id: string, rng: Rng = cryptoRng): void {
  const filters = set.filters.map((f) => ({ key: f.key, control: select(f.label, f.options) }));
  const count: MdOutlinedTextField = el('md-outlined-text-field', {
    label: `Количество (1–${MAX})`,
    value: '1',
    type: 'number',
    min: '1',
    max: String(MAX),
    autocomplete: 'off',
  });
  const button = el('md-filled-button', {}, 'Сгенерировать');
  const output = el('div', { class: 'persona-output', 'aria-live': 'polite' });

  root.append(
    el('p', { class: 'notice' }, set.notice),
    el(
      'section',
      { class: 'card', 'aria-labelledby': `${id}-generate` },
      el('h2', { id: `${id}-generate` }, 'Генерация'),
      el('div', { class: 'fields' }, ...filters.map((f) => f.control), count),
      el('div', { class: 'actions' }, button),
      output,
    ),
  );

  let rows: DataRecord[] = [];

  function copyButton(label: string, text: () => string): HTMLElement {
    const b = el('md-outlined-button', {}, label);
    b.prepend(Object.assign(mdIcon('copy'), { slot: 'icon' }));
    b.addEventListener('click', () => void navigator.clipboard?.writeText(text()));
    return b;
  }

  function render(): void {
    const head = el('tr', {}, ...set.fields.map((f) => el('th', { scope: 'col' }, f.label)));
    const body = rows.map((r) => el('tr', {}, ...set.fields.map((f) => el('td', {}, r[f.key] ?? ''))));
    output.replaceChildren(
      el(
        'div',
        { class: 'actions' },
        copyButton('Копировать JSON', () => toJson(rows)),
        copyButton('Копировать CSV', () => toCsv(set.fields, rows)),
      ),
      el(
        'div',
        { class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': 'Сгенерированные записи' },
        el('table', { class: 'persona-table' }, el('thead', {}, head), el('tbody', {}, ...body)),
      ),
    );
  }

  function run(): void {
    const n = Number(count.value);
    if (!Number.isInteger(n) || n < 1 || n > MAX) {
      count.error = true;
      count.errorText = `Целое число от 1 до ${MAX}`;
      return;
    }
    count.error = false;
    count.errorText = '';
    const chosen = Object.fromEntries(filters.map((f) => [f.key, f.control.value]));
    rows = Array.from({ length: n }, () => set.generate(rng, chosen));
    render();
  }

  button.addEventListener('click', run);
  count.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') run();
  });
}
