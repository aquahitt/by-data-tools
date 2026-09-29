import type { FormatId, FormatModule, Issue, ValidationResult } from '../core/types';
import { suggestOtherFormat } from '../formats';
import { el } from './dom';
import { mdIcon } from './icons';

export interface ValidatePanel {
  setFormat(format: FormatModule): void;
  check(value: string): void;
}

export interface ValidatePanelOptions {
  formats: FormatModule[];
  inputLabel: string;
  inputHint?: string;
  status?: [string, string, string];
  onSwitchFormat: (id: FormatId) => void;
}

export function mountValidatePanel(root: HTMLElement, options: ValidatePanelOptions): ValidatePanel {
  const { formats, inputLabel, onSwitchFormat } = options;
  const [okText, warnText, badText] = options.status ?? ['Номер валиден', 'Номер валиден, есть предупреждения', 'Номер невалиден'];
  const field = el('md-outlined-text-field', {
    label: inputLabel,
    'supporting-text': options.inputHint ?? 'Пробелы, дефисы и регистр не важны',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const button = el('md-filled-button', {}, 'Проверить');
  const result = el('div', { class: 'result', 'aria-live': 'polite' });
  root.append(el('div', { class: 'input-row' }, field, button), result);

  let format: FormatModule | null = null;
  let timer: number | undefined;
  const run = () => {
    // Enter or the button would otherwise be followed by the pending debounced run.
    window.clearTimeout(timer);
    render(field.value);
  };
  field.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 300);
  });
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') run();
  });
  button.addEventListener('click', run);

  function issueList(issues: Issue[], kind: 'error' | 'warning'): HTMLElement {
    return el(
      'ul',
      { class: `issues ${kind}` },
      ...issues.map((i) => el('li', {}, mdIcon(kind), i.position ? `Позиция ${i.position}: ${i.message}` : i.message)),
    );
  }

  function statusLine(r: ValidationResult): HTMLElement {
    if (!r.valid) return el('p', { class: 'status error' }, mdIcon('error'), badText);
    if (r.warnings.length) return el('p', { class: 'status warning' }, mdIcon('warning'), warnText);
    return el('p', { class: 'status ok' }, mdIcon('check'), okText);
  }

  function render(input: string): void {
    result.replaceChildren();
    if (!format || input.trim() === '') return;
    const r = format.validate(input);
    result.append(statusLine(r));
    if (r.errors.length) result.append(issueList(r.errors, 'error'));
    if (r.warnings.length) result.append(issueList(r.warnings, 'warning'));
    const other = suggestOtherFormat(input, format.id, formats);
    if (other) {
      const switchButton = el('md-text-button', {}, 'Переключить');
      switchButton.addEventListener('click', () => onSwitchFormat(other.id));
      const text = other.validate(input).valid
        ? `Похоже на формат «${other.title}».`
        : `По виду это формат «${other.title}», но и там не сходится контрольная цифра — возможно, опечатка.`;
      result.append(el('p', { class: 'hint' }, text, switchButton));
    }
    const parsed = format.parse(input);
    if (parsed) {
      const rows = parsed.map((f) => el('tr', {}, el('th', { scope: 'row' }, f.label), el('td', {}, f.value)));
      result.append(el('table', { class: 'parsed' }, el('tbody', {}, ...rows)));
    }
  }

  return {
    setFormat(f) {
      format = f;
      render(field.value);
    },
    check(value) {
      field.value = value;
      render(value);
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  };
}
