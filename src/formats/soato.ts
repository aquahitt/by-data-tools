import { resolveFields } from '../core/fields';
import { pad, pick, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { digitsOf, lengthIssue } from './digits';

// СОАТО — ОКРБ 003-2017 (Gosstandart resolution No. 17 of 06.03.2017, in force 01.04.2017): ten digits,
// no check digit known. The classifier is supplied by NCA on request only, so a code's existence is not checked.
// Position meanings are inferred from real codes (ethnoby.org): 1 — oblast / Minsk, 2 — kind of the 2nd-level unit
// (2 district, 4 city of oblast subordination), 3–4 its number, 5–7 the 3rd level (5xx towns and urban
// settlements, 8xx village councils), 8–10 a settlement. Trailing zeros mark a higher-level object.

export const SOATO_REGIONS: Record<string, string> = {
  '1': 'Брестская область',
  '2': 'Витебская область',
  '3': 'Гомельская область',
  '4': 'Гродненская область',
  '5': 'г. Минск',
  '6': 'Минская область',
  '7': 'Могилёвская область',
};

const SECOND_LEVEL: Record<string, string> = { '2': 'район', '4': 'город областного подчинения' };
const THIRD_LEVEL: Record<string, string> = { '5': 'город районного подчинения или посёлок', '8': 'сельсовет' };

export function soatoIssues(v: string): { errors: Issue[]; warnings: Issue[] } {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  if (!Object.hasOwn(SOATO_REGIONS, v[0])) {
    errors.push({ code: 'REGION', message: `Первая цифра «${v[0]}» — не код области: 1–7`, position: 1 });
  } else if (/^0+$/.test(v.slice(1, 4)) && !/^0+$/.test(v.slice(4, 10))) {
    warnings.push({ code: 'HIERARCHY', message: 'Нижние уровни заполнены при нулевом коде района или города (позиции 2–4)', position: 2 });
  } else if (/^0+$/.test(v.slice(4, 7)) && !/^0+$/.test(v.slice(7, 10))) {
    warnings.push({ code: 'HIERARCHY', message: 'Код населённого пункта при нулевом коде сельсовета или посёлка (позиции 5–7)', position: 5 });
  }
  return { errors, warnings };
}

/** What object the code names, by its trailing zeros. */
function levelOf(v: string): string {
  if (/^0{9}$/.test(v.slice(1))) return v[0] === '5' ? 'г. Минск' : 'область';
  if (/^0{6}$/.test(v.slice(4))) return SECOND_LEVEL[v[1]] ?? 'административно-территориальная единица 2-го уровня';
  if (/^0{3}$/.test(v.slice(7))) return THIRD_LEVEL[v[4]] ?? 'единица 3-го уровня';
  return 'населённый пункт';
}

export function soatoRows(v: string): ParsedField[] {
  return [
    { label: 'Объект', value: levelOf(v) },
    { label: 'Область (позиция 1)', value: `${v[0]} — ${SOATO_REGIONS[v[0]] ?? 'неизвестный код'}` },
    { label: '2-й уровень (позиции 2–4)', value: `${v.slice(1, 4)}${SECOND_LEVEL[v[1]] ? ` — ${SECOND_LEVEL[v[1]]}` : ''}` },
    { label: '3-й уровень (позиции 5–7)', value: `${v.slice(4, 7)}${THIRD_LEVEL[v[4]] ? ` — ${THIRD_LEVEL[v[4]]}` : ''}` },
    { label: 'Населённый пункт (позиции 8–10)', value: v.slice(7, 10) },
  ];
}

function validate(input: string): ValidationResult {
  const { value: v, errors } = digitsOf(input);
  const warnings: Issue[] = [];
  if (errors.length === 0) {
    const length = lengthIssue(v, 10);
    if (length) errors.push(length);
  }
  if (errors.length === 0) {
    const r = soatoIssues(v);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
  return { valid: errors.length === 0, normalized: v, errors, warnings };
}

function parse(input: string): ParsedField[] | null {
  const { value: v, errors } = digitsOf(input);
  return errors.length > 0 || v.length !== 10 ? null : soatoRows(v);
}

export const SOATO_LEVELS: Record<string, string> = {
  district: 'Район',
  city: 'Город областного подчинения',
  town: 'Город районного подчинения, посёлок',
  council: 'Сельсовет',
  settlement: 'Населённый пункт',
};

export function randomSoato(rng: Rng, region: string, level: string): string {
  if (region === '5') {
    // Minsk has no districts in the sense of the oblasts' layout; the city itself is the safe code.
    return '5000000000';
  }
  const second = `${level === 'city' ? '4' : '2'}${pad(randInt(rng, 1, 40), 2)}`;
  if (level === 'district' || level === 'city') return `${region}${second}000000`;
  const third = level === 'town' ? `5${pad(randInt(rng, 1, 60), 2)}` : `8${pad(randInt(rng, 1, 60), 2)}`;
  if (level !== 'settlement') return `${region}${second}${third}000`;
  return `${region}${second}${third}${pad(randInt(rng, 1, 120), 3)}`;
}

export const soatoFields: FieldSpec[] = [
  {
    key: 'region',
    label: 'Область',
    kind: 'select',
    options: Object.entries(SOATO_REGIONS).map(([value, label]) => ({ value, label: `${value} — ${label}` })),
    check: (v) => (Object.hasOwn(SOATO_REGIONS, v) ? null : 'Выберите область из списка'),
    random: (rng) => pick(rng, ['1', '2', '3', '4', '6', '7']),
  },
  {
    key: 'level',
    label: 'Уровень объекта',
    kind: 'select',
    options: Object.entries(SOATO_LEVELS).map(([value, label]) => ({ value, label })),
    check: (v) => (Object.hasOwn(SOATO_LEVELS, v) ? null : 'Выберите уровень из списка'),
    random: (rng) => pick(rng, Object.keys(SOATO_LEVELS)),
  },
];

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(soatoFields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const value = randomSoato(rng, values.region, values.level);
  return { ok: true, value, hint: 'Код собран по структуре СОАТО; существование объекта не проверяется' };
}

export const soato: FormatModule = {
  id: 'soato',
  title: 'СОАТО',
  official: false,
  notice:
    'Классификатор СОАТО (ОКРБ 003-2017) в открытом доступе не опубликован: проверяются длина, код области и порядок уровней, а не существование объекта. Значение позиций 2 и 5 — по реальным кодам, не по тексту классификатора.',
  fields: soatoFields,
  validate,
  parse,
  generate,
};
