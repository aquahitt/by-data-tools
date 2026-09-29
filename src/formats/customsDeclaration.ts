import { resolveFields } from '../core/fields';
import { pad, pick, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// Registration number of a goods declaration (ДТ, box «A»), Instruction on filling in the ДТ, Decision of the
// Customs Union Commission No. 257 of 20.05.2010 (section XI, item 43; as amended by EEC Board Decision No. 82 of
// 20.06.2023): customs office code / date DDMMYY / serial number of seven digits, restarting every year. Belarus
// writes the office code in five digits (official example 06532/220211/0001122) — the last five digits of the
// EAEU code 112YYYYY (EEC Board Decision No. 145 of 02.09.2019). Customs houses per tws.by (medium confidence).

export const CUSTOMS_HOUSES: Record<string, string> = {
  '01': 'ГТК (подразделения центрального аппарата)',
  '02': 'Минская центральная таможня',
  '06': 'Минская региональная таможня',
  '07': 'Витебская таможня',
  '09': 'Брестская таможня',
  '14': 'Гомельская таможня',
  '16': 'Гродненская региональная таможня',
  '20': 'Могилёвская таможня',
};

const SHAPE = /^(\d{5})\/(\d{2})(\d{2})(\d{2})\/(\d{7})$/;

function tidy(input: string): string {
  return input.trim().replace(/\s*[/\\|]\s*/g, '/').replace(/\s+/g, '');
}

/** Today's calendar date in the user's time zone, as a UTC midnight timestamp. */
function todayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function isDate(dd: number, mm: number, yy: number): boolean {
  const year = 2000 + yy;
  const t = new Date(Date.UTC(year, mm - 1, dd));
  return t.getUTCFullYear() === year && t.getUTCMonth() === mm - 1 && t.getUTCDate() === dd;
}

function validate(input: string): ValidationResult {
  const v = tidy(input);
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const m = SHAPE.exec(v);
  if (v === '') errors.push({ code: 'EMPTY', message: 'Номер пустой' });
  else if (!m) {
    errors.push({ code: 'FORMAT', message: 'Ожидается «код таможни (5 цифр)/ДДММГГ/номер (7 цифр)», например 06532/220211/0001122' });
  } else {
    const [, office, dd, mm, yy, serial] = m;
    if (!isDate(Number(dd), Number(mm), Number(yy))) {
      errors.push({ code: 'DATE', message: `Несуществующая дата ${dd}.${mm}.20${yy}`, position: 7 });
    } else if (Date.UTC(2000 + Number(yy), Number(mm) - 1, Number(dd)) > todayUtc()) {
      errors.push({ code: 'FUTURE_DATE', message: `Дата регистрации ${dd}.${mm}.20${yy} в будущем`, position: 7 });
    }
    if (serial === '0000000') errors.push({ code: 'SERIAL', message: 'Порядковый номер 0000000, нумерация начинается с 0000001', position: 14 });
    if (!Object.hasOwn(CUSTOMS_HOUSES, office.slice(0, 2))) {
      warnings.push({ code: 'UNKNOWN_OFFICE', message: `Таможня с кодом «${office.slice(0, 2)}» не из известного списка белорусских таможен`, position: 1 });
    }
  }
  return { valid: errors.length === 0, normalized: v, errors, warnings };
}

function parse(input: string): ParsedField[] | null {
  const m = SHAPE.exec(tidy(input));
  if (!m) return null;
  const [, office, dd, mm, yy, serial] = m;
  return [
    { label: 'Таможня', value: `${office.slice(0, 2)} — ${CUSTOMS_HOUSES[office.slice(0, 2)] ?? 'неизвестная'}` },
    {
      label: 'Таможенный орган',
      value: office.endsWith('000') ? `${office} — сама таможня` : `${office} — таможенный пост (код ЕАЭС 112${office})`,
    },
    { label: 'Дата регистрации', value: `${dd}.${mm}.20${yy}` },
    { label: 'Порядковый номер за год', value: serial },
  ];
}

const fields: FieldSpec[] = [
  {
    key: 'house',
    label: 'Таможня',
    kind: 'select',
    options: Object.entries(CUSTOMS_HOUSES).filter(([k]) => k !== '01').map(([value, label]) => ({ value, label: `${value} — ${label}` })),
    check: (v) => (Object.hasOwn(CUSTOMS_HOUSES, v) ? null : 'Выберите таможню из списка'),
    random: (rng) => pick(rng, ['02', '06', '07', '09', '14', '16', '20']),
  },
];

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const now = new Date();
  const days = randInt(rng, 0, 730);
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - days * 86_400_000);
  const date = `${pad(d.getUTCDate(), 2)}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCFullYear() % 100, 2)}`;
  const post = pad(randInt(rng, 501, 699), 3);
  const value = `${values.house}${post}/${date}/${pad(randInt(rng, 1, 99_999), 7)}`;
  return { ok: true, value, hint: `${CUSTOMS_HOUSES[values.house]}, пост ${values.house}${post}: код поста выбран случайно и может не существовать` };
}

export const customsDeclaration: FormatModule = {
  id: 'dt',
  title: 'Номер ДТ',
  official: true,
  notice:
    'Коды таможен — по справочнику tws.by (средняя уверенность); код поста не сверяется со справочником ГТК. Проверяются вид номера, дата и код таможни.',
  fields,
  validate,
  parse,
  generate,
};
