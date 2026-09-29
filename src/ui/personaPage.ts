import type { MdOutlinedSelect } from '@material/web/select/outlined-select.js';
import type { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js';
import { cryptoRng } from '../core/random';
import type { Rng } from '../core/types';
import type { Gender } from '../formats/names';
import { generatePersona, PERSONA_FIELDS, type Persona, toCsv, toJson } from '../formats/persona';
import { el } from './dom';
import { mdIcon } from './icons';

const MAX = 100;

function select(label: string, options: [string, string][]): MdOutlinedSelect {
  const s = el('md-outlined-select', { label });
  s.append(el('md-select-option', { value: '', selected: '' }, el('div', { slot: 'headline' }, 'Случайно')));
  for (const [value, text] of options) s.append(el('md-select-option', { value }, el('div', { slot: 'headline' }, text)));
  return s;
}

/** Generator-only section: a set of consistent test people, shown as a table and copied as JSON or CSV. */
export function mountPersonaPage(root: HTMLElement, rng: Rng = cryptoRng): void {
  const gender = select('Пол', [
    ['M', 'Мужской'],
    ['F', 'Женский'],
  ]);
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
    el('p', { class: 'notice' }, 'Значения согласованы между собой: ФИО по-русски и по-белорусски, латиница — из белорусской формы, как в документах; пол и дата рождения — с идентификационным номером, область — с серией паспорта и индексом. Email — на резервном домене example.com, номера карт банками не выпущены. Только для тестов.'),
    el(
      'section',
      { class: 'card', 'aria-labelledby': 'persona-generate' },
      el('h2', { id: 'persona-generate' }, 'Генерация'),
      el('div', { class: 'fields' }, gender, count),
      el('div', { class: 'actions' }, button),
      output,
    ),
  );

  let personas: Persona[] = [];

  function copyButton(label: string, text: () => string): HTMLElement {
    const b = el('md-outlined-button', {}, label);
    b.prepend(Object.assign(mdIcon('copy'), { slot: 'icon' }));
    b.addEventListener('click', () => void navigator.clipboard?.writeText(text()));
    return b;
  }

  function render(): void {
    const head = el('tr', {}, ...PERSONA_FIELDS.map((f) => el('th', { scope: 'col' }, f.label)));
    const rows = personas.map((p) => el('tr', {}, ...PERSONA_FIELDS.map((f) => el('td', {}, p[f.key] ?? ''))));
    output.replaceChildren(
      el('div', { class: 'actions' }, copyButton('Копировать JSON', () => toJson(personas)), copyButton('Копировать CSV', () => toCsv(personas))),
      el('div', { class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': 'Сгенерированные персоны' }, el('table', { class: 'persona-table' }, el('thead', {}, head), el('tbody', {}, ...rows))),
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
    const options = { gender: (gender.value || undefined) as Gender | undefined };
    personas = Array.from({ length: n }, () => generatePersona(rng, options));
    render();
  }

  button.addEventListener('click', run);
  count.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') run();
  });
}
