import type { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js';
import type { FormatModule } from '../core/types';
import { el } from './dom';
import { mdIcon } from './icons';

export const BULK_MAX = 5000;

export interface BulkRow {
  line: number;
  input: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
}

/** One result per non-empty line; the message is the first error, else the first warning. */
export function checkLines(text: string, format: FormatModule): BulkRow[] {
  return text
    .split(/\r?\n/)
    .map((input, i) => ({ input: input.trim(), line: i + 1 }))
    .filter((r) => r.input !== '')
    .slice(0, BULK_MAX)
    .map(({ input, line }) => {
      const r = format.validate(input);
      const issue = r.errors[0] ?? r.warnings[0];
      const text = issue ? (issue.position ? `Позиция ${issue.position}: ${issue.message}` : issue.message) : '';
      const more = r.errors.length + r.warnings.length > 1 ? ` (и ещё ${r.errors.length + r.warnings.length - 1})` : '';
      return { line, input, status: !r.valid ? 'error' : r.warnings.length ? 'warning' : 'ok', message: `${text}${more}` };
    });
}

const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;

export function bulkCsv(rows: BulkRow[]): string {
  const status = { ok: 'валиден', warning: 'валиден, есть предупреждения', error: 'невалиден' };
  return ['"Строка";"Значение";"Результат";"Комментарий"', ...rows.map((r) => [String(r.line), r.input, status[r.status], r.message].map(csvCell).join(';'))].join('\r\n');
}

export interface BulkPanel {
  setFormat(format: FormatModule): void;
}

/** «Проверка списком»: one value per line, a table of results, copy the invalid ones or all results as CSV. */
export function mountBulkPanel(root: HTMLElement): BulkPanel {
  const field: MdOutlinedTextField = el('md-outlined-text-field', {
    type: 'textarea',
    rows: '6',
    label: 'Значения, по одному в строке',
    'supporting-text': `Можно вставить столбец из Excel; до ${BULK_MAX} строк`,
    autocomplete: 'off',
    spellcheck: 'false',
  });
  field.classList.add('bulk-input');
  const button = el('md-filled-button', {}, 'Проверить список');
  const result = el('div', { class: 'bulk-result', 'aria-live': 'polite' });
  root.append(field, el('div', { class: 'actions' }, button), result);

  let format: FormatModule | null = null;
  let rows: BulkRow[] = [];

  function copyButton(label: string, text: () => string): HTMLElement {
    const b = el('md-outlined-button', {}, label);
    b.prepend(Object.assign(mdIcon('copy'), { slot: 'icon' }));
    b.addEventListener('click', () => void navigator.clipboard?.writeText(text()));
    return b;
  }

  function render(): void {
    result.replaceChildren();
    if (!format || rows.length === 0) return;
    const count = (s: BulkRow['status']) => rows.filter((r) => r.status === s).length;
    const summary = `Проверено ${rows.length}: валидных ${count('ok')}, с предупреждениями ${count('warning')}, невалидных ${count('error')}`;
    const icon = { ok: 'check', warning: 'warning', error: 'error' } as const;
    const body = rows.map((r) =>
      el(
        'tr',
        { class: `bulk-${r.status}` },
        el('td', {}, String(r.line)),
        el('td', { class: 'mono' }, r.input),
        el('td', {}, mdIcon(icon[r.status]), r.message || 'валиден'),
      ),
    );
    result.append(
      el('p', { class: 'bulk-summary' }, summary),
      el(
        'div',
        { class: 'actions' },
        copyButton('Копировать невалидные', () => rows.filter((r) => r.status === 'error').map((r) => r.input).join('\n')),
        copyButton('Копировать результат (CSV)', () => bulkCsv(rows)),
      ),
      el(
        'div',
        { class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': 'Результаты проверки списком' },
        el(
          'table',
          { class: 'persona-table bulk-table' },
          el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, '№'), el('th', { scope: 'col' }, 'Значение'), el('th', { scope: 'col' }, 'Результат'))),
          el('tbody', {}, ...body),
        ),
      ),
    );
  }

  button.addEventListener('click', () => {
    if (!format) return;
    rows = checkLines(field.value, format);
    render();
  });

  return {
    setFormat(f) {
      format = f;
      if (rows.length) {
        rows = checkLines(field.value, f);
        render();
      }
    },
  };
}
