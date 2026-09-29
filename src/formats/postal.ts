import { resolveFields } from '../core/fields';
import { pad, pick, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { digitsOf, lengthIssue } from './digits';

// Six digits; every Belarusian code starts with 2. First three digits by region — 1001pochta.ru table, matching the
// city lists of b-info.by and belarus-inform.by (220 — Minsk). Belpost publishes no downloadable directory, so the
// existence of a code is not checked; the first three digits give the region, not the district.

export const POSTAL_PREFIXES: Record<string, string> = {
  '210': 'Витебская область',
  '211': 'Витебская область',
  '212': 'Могилёвская область',
  '213': 'Могилёвская область',
  '220': 'г. Минск',
  '222': 'Минская область',
  '223': 'Минская область',
  '224': 'Брестская область',
  '225': 'Брестская область',
  '230': 'Гродненская область',
  '231': 'Гродненская область',
  '246': 'Гомельская область',
  '247': 'Гомельская область',
};

export const POSTAL_REGIONS = [...new Set(Object.values(POSTAL_PREFIXES))];

function validate(input: string): ValidationResult {
  const { value: v, errors } = digitsOf(input);
  const warnings: Issue[] = [];
  if (errors.length === 0) {
    const length = lengthIssue(v, 6);
    if (length) errors.push(length);
  }
  if (errors.length === 0 && v[0] !== '2') {
    errors.push({ code: 'COUNTRY', message: 'Почтовые индексы Беларуси начинаются с 2', position: 1 });
  }
  if (errors.length === 0 && !Object.hasOwn(POSTAL_PREFIXES, v.slice(0, 3))) {
    warnings.push({ code: 'UNKNOWN_PREFIX', message: `Начало «${v.slice(0, 3)}» не относится ни к одной области`, position: 1 });
  }
  return { valid: errors.length === 0, normalized: v, errors, warnings };
}

function parse(input: string): ParsedField[] | null {
  const { value: v, errors } = digitsOf(input);
  if (errors.length > 0 || v.length !== 6) return null;
  return [
    { label: 'Регион (первые три цифры)', value: `${v.slice(0, 3)} — ${POSTAL_PREFIXES[v.slice(0, 3)] ?? 'не определён'}` },
    { label: 'Отделение связи', value: v.slice(3) },
  ];
}

/** A code of the region: Minsk 220002–220141 (belarus-inform.by), elsewhere any three digits after the prefix. */
export function randomPostalCode(rng: Rng, region: string): string {
  if (region === 'г. Минск') return `220${pad(randInt(rng, 2, 141), 3)}`;
  const prefixes = Object.keys(POSTAL_PREFIXES).filter((p) => POSTAL_PREFIXES[p] === region);
  return `${pick(rng, prefixes)}${pad(randInt(rng, 0, 999), 3)}`;
}

const fields: FieldSpec[] = [
  {
    key: 'region',
    label: 'Регион',
    kind: 'select',
    options: POSTAL_REGIONS.map((r) => ({ value: r, label: r })),
    check: (v) => (POSTAL_REGIONS.includes(v) ? null : 'Выберите регион из списка'),
    random: (rng) => pick(rng, POSTAL_REGIONS),
  },
];

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, value: randomPostalCode(rng, values.region), hint: `${values.region} · существование отделения не проверяется` };
}

export const postalCode: FormatModule = {
  id: 'postal',
  title: 'Почтовый индекс',
  official: false,
  notice:
    'Диапазоны по областям — по сводкам индексов (1001pochta.ru, b-info.by): официальный справочник Белпочты в открытом виде не опубликован. Существование конкретного индекса не проверяется.',
  fields,
  validate,
  parse,
  generate,
};
