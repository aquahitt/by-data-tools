import { checkDigit731 } from '../core/checkDigit';
import { resolveFields } from '../core/fields';
import { normalize } from '../core/normalize';
import { pad, pick, randInt } from '../core/random';
import { structureIssues } from '../core/structure';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// Pre-2012 format is not published officially. Tables below follow the media sources cited in the
// spec (aif.by, forum.onliner.by), which agree with each other. Change them here and nowhere else.
export const REGIONS: Record<string, string> = {
  A: 'г. Минск',
  B: 'Минская область',
  C: 'Брестская область',
  E: 'Витебская область',
  H: 'Гомельская область',
  K: 'Гродненская область',
  M: 'Могилёвская область',
};

export const STATUSES: Record<string, string> = {
  PB: 'гражданин Республики Беларусь',
  BA: 'лицо без гражданства',
  BI: 'иностранный гражданин',
};

const CENTURIES = ['XIX', 'XX', 'XXI'];
const MIN_YEAR = 1800;
const MAX_YEAR = 2099;
const DAY_MS = 86_400_000;

function isValidDate(year: number, month: number, day: number): boolean {
  const t = new Date(Date.UTC(year, month - 1, day));
  return t.getUTCFullYear() === year && t.getUTCMonth() === month - 1 && t.getUTCDate() === day;
}

/** Today's calendar date in the user's time zone, as a UTC midnight timestamp. */
function todayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function isFuture(year: number, month: number, day: number): boolean {
  return Date.UTC(year, month - 1, day) > todayUtc();
}

/** Digit 1: odd = male, even = female; 1-2 XIX, 3-4 XX, 5-6 XXI century. */
function decodeFirstDigit(ch: string): { gender: 'M' | 'F'; centuryIndex: number } | null {
  const d = Number(ch);
  if (!(d >= 1 && d <= 6)) return null;
  return { gender: d % 2 === 1 ? 'M' : 'F', centuryIndex: Math.floor((d - 1) / 2) };
}

function parseRuDate(v: string): { day: number; month: number; year: number } | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v);
  return m ? { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) } : null;
}

function checkBirthDate(v: string): string | null {
  const d = parseRuDate(v);
  if (!d || !isValidDate(d.year, d.month, d.day)) return 'Дата в формате ДД.ММ.ГГГГ, должна существовать';
  if (d.year < MIN_YEAR || d.year > MAX_YEAR) return 'Год от 1800 до 2099';
  if (isFuture(d.year, d.month, d.day)) return 'Дата рождения не может быть в будущем';
  return null;
}

function randomBirthDate(rng: Rng): string {
  const start = Date.UTC(1900, 0, 1);
  const days = Math.floor((todayUtc() - start) / DAY_MS);
  const t = new Date(start + randInt(rng, 0, days) * DAY_MS);
  return `${pad(t.getUTCDate(), 2)}.${pad(t.getUTCMonth() + 1, 2)}.${t.getUTCFullYear()}`;
}

const options = (table: Record<string, string>) =>
  Object.entries(table).map(([value, label]) => ({ value, label: `${value} — ${label}` }));

const fields: FieldSpec[] = [
  {
    key: 'gender',
    label: 'Пол',
    kind: 'select',
    options: [{ value: 'M', label: 'Мужской' }, { value: 'F', label: 'Женский' }],
    check: (v) => (v === 'M' || v === 'F' ? null : 'Выберите пол'),
    random: (rng) => pick(rng, ['M', 'F']),
  },
  {
    key: 'birthDate',
    label: 'Дата рождения',
    kind: 'text',
    placeholder: 'ДД.ММ.ГГГГ',
    check: checkBirthDate,
    random: randomBirthDate,
  },
  {
    key: 'region',
    label: 'Регион',
    kind: 'select',
    options: options(REGIONS),
    check: (v) => (Object.hasOwn(REGIONS, v) ? null : 'Выберите регион из списка'),
    random: (rng) => pick(rng, Object.keys(REGIONS)),
  },
  {
    key: 'sequence',
    label: 'Порядковый номер (000–999)',
    kind: 'text',
    placeholder: '001',
    check: (v) => (/^\d{3}$/.test(v) ? null : 'Три цифры, от 000 до 999'),
    random: (rng) => pad(randInt(rng, 0, 999), 3),
  },
  {
    key: 'status',
    label: 'Статус',
    kind: 'select',
    options: options(STATUSES),
    check: (v) => (Object.hasOwn(STATUSES, v) ? null : 'Выберите статус из списка'),
    random: (rng) => pick(rng, Object.keys(STATUSES)),
  },
];

function validate(input: string): ValidationResult {
  const n = normalize(input);
  const errors: Issue[] = [...n.errors];
  const warnings: Issue[] = [...n.warnings];
  if (errors.length === 0) errors.push(...structureIssues(n.value));
  if (errors.length === 0) {
    const v = n.value;
    const first = decodeFirstDigit(v[0]);
    if (!first) {
      errors.push({ code: 'FIRST_DIGIT', message: 'Первая цифра должна быть от 1 до 6 (пол и век рождения)', position: 1 });
    } else {
      const day = Number(v.slice(1, 3));
      const month = Number(v.slice(3, 5));
      const year = MIN_YEAR + first.centuryIndex * 100 + Number(v.slice(5, 7));
      const shown = `${v.slice(1, 3)}.${v.slice(3, 5)}.${year}`;
      if (!isValidDate(year, month, day)) {
        errors.push({ code: 'DATE', message: `Несуществующая дата рождения ${shown}`, position: 2 });
      } else if (isFuture(year, month, day)) {
        errors.push({ code: 'FUTURE_DATE', message: `Дата рождения ${shown} в будущем`, position: 2 });
      }
    }
    if (!Object.hasOwn(REGIONS, v[7])) {
      errors.push({ code: 'REGION', message: `Неизвестный код региона «${v[7]}»`, position: 8 });
    }
    const status = v.slice(11, 13);
    if (!Object.hasOwn(STATUSES, status)) {
      errors.push({ code: 'STATUS', message: `Неизвестный код статуса «${status}»`, position: 12 });
    }
    const expected = checkDigit731(v.slice(0, 13));
    if (Number(v[13]) !== expected) {
      warnings.push({
        code: 'CHECK_DIGIT_UNCONFIRMED',
        message: `Контрольная цифра ${v[13]}, по формуле 7-3-1 ожидается ${expected}. Алгоритм для номеров до 2012 года официально не подтверждён, поэтому номер не отклонён`,
        position: 14,
      });
    }
  }
  return { valid: errors.length === 0, normalized: n.value, errors, warnings };
}

function parse(input: string): ParsedField[] | null {
  const n = normalize(input);
  if (n.errors.length > 0 || structureIssues(n.value).length > 0) return null;
  const v = n.value;
  const first = decodeFirstDigit(v[0]);
  const date = `${v.slice(1, 3)}.${v.slice(3, 5)}`;
  const expected = checkDigit731(v.slice(0, 13));
  const status = v.slice(11, 13);
  return [
    { label: 'Пол', value: first ? (first.gender === 'M' ? 'мужской' : 'женский') : `неизвестно (цифра ${v[0]})` },
    { label: 'Век рождения', value: first ? CENTURIES[first.centuryIndex] : '—' },
    {
      label: 'Дата рождения',
      value: first ? `${date}.${MIN_YEAR + first.centuryIndex * 100 + Number(v.slice(5, 7))}` : `${date}.${v.slice(5, 7)}`,
    },
    { label: 'Регион', value: `${v[7]} — ${REGIONS[v[7]] ?? 'неизвестный код'}` },
    { label: 'Порядковый номер', value: v.slice(8, 11) },
    { label: 'Статус', value: `${status} — ${STATUSES[status] ?? 'неизвестный код'}` },
    {
      label: 'Контрольная цифра',
      value: Number(v[13]) === expected ? `${v[13]} — совпадает с 7-3-1` : `${v[13]} — по 7-3-1 ожидается ${expected}`,
    },
  ];
}

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const d = parseRuDate(values.birthDate)!;
  const centuryIndex = Math.floor((d.year - MIN_YEAR) / 100);
  const first = centuryIndex * 2 + (values.gender === 'M' ? 1 : 2);
  const body = `${first}${pad(d.day, 2)}${pad(d.month, 2)}${pad(d.year % 100, 2)}${values.region}${values.sequence}${values.status}`;
  return { ok: true, value: `${body}${checkDigit731(body)}` };
}

export const legacy: FormatModule = {
  id: 'legacy',
  title: 'До 2012',
  official: false,
  notice:
    'Структура и алгоритм контрольной цифры для номеров до 2012 года официально не опубликованы. Коды регионов и статусов — по данным СМИ (АиФ, onliner.by).',
  fields,
  validate,
  parse,
  generate,
};
