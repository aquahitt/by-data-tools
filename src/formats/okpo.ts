import { resolveFields } from '../core/fields';
import { pad, pick, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { digitsOf } from './digits';
import { SOATO_REGIONS } from './soato';

// ОКПО — registration number in Belstat's statistical register. No official description is published; the
// 8th digit follows the same mod-11 rule as the Russian ОКПО (weights 1…7, then 3…9, 10 → 0), which holds for
// every real Belarusian code checked (34 of 34). The 12-digit form seen in requisites: the 8-digit code, the
// oblast digit (as in СОАТО) and three more digits, 000 for the head organisation.

export function okpoCheckDigit(first7: string): number {
  const sum = (offset: number) => [...first7].reduce((s, d, i) => s + Number(d) * (i + offset), 0) % 11;
  const r = sum(1);
  if (r < 10) return r;
  const r2 = sum(3);
  return r2 < 10 ? r2 : 0;
}

function baseIssues(v: string): Issue[] {
  const expected = okpoCheckDigit(v.slice(0, 7));
  return Number(v[7]) === expected ? [] : [{ code: 'CHECK_DIGIT', message: `Контрольная цифра ${v[7]}, ожидается ${expected}`, position: 8 }];
}

function makeValidate(length: 8 | 12) {
  return (input: string): ValidationResult => {
    const { value: v, errors } = digitsOf(input, /^\s*(окпо|okpo)[\s:№#]*/i);
    if (errors.length === 0 && v.length !== length) {
      errors.push({ code: 'LENGTH', message: `Длина ${v.length}, ожидается ${length} цифр` });
    }
    if (errors.length === 0) errors.push(...baseIssues(v));
    if (errors.length === 0 && length === 12 && !Object.hasOwn(SOATO_REGIONS, v[8])) {
      errors.push({ code: 'REGION', message: `Девятая цифра «${v[8]}» — не код области: 1–7`, position: 9 });
    }
    return { valid: errors.length === 0, normalized: v, errors, warnings: [] };
  };
}

function makeParse(length: 8 | 12) {
  return (input: string): ParsedField[] | null => {
    const { value: v, errors } = digitsOf(input, /^\s*(окпо|okpo)[\s:№#]*/i);
    if (errors.length > 0 || v.length !== length) return null;
    const expected = okpoCheckDigit(v.slice(0, 7));
    const rows: ParsedField[] = [
      { label: 'Номер в регистре', value: v.slice(0, 7) },
      { label: 'Контрольная цифра', value: Number(v[7]) === expected ? `${expected} — верная` : `${v[7]} — ожидается ${expected}` },
    ];
    if (length === 12) {
      rows.push(
        { label: 'Код области', value: `${v[8]} — ${SOATO_REGIONS[v[8]] ?? 'неизвестный код'}` },
        { label: 'Обособленное подразделение', value: v.slice(9) === '000' ? '000 — головная организация' : v.slice(9) },
      );
    }
    return rows;
  };
}

const randomBase = (rng: Rng) => {
  const first7 = pad(randInt(rng, 0, 9_999_999), 7);
  return `${first7}${okpoCheckDigit(first7)}`;
};

const regionField: FieldSpec = {
  key: 'region',
  label: 'Область',
  kind: 'select',
  options: Object.entries(SOATO_REGIONS).map(([value, label]) => ({ value, label: `${value} — ${label}` })),
  check: (v) => (Object.hasOwn(SOATO_REGIONS, v) ? null : 'Выберите область из списка'),
  random: (rng) => pick(rng, Object.keys(SOATO_REGIONS)),
};

const NOTICE =
  'Официального описания ОКПО нет: контрольная цифра считается по правилу российского ОКПО (mod 11), которому соответствуют все проверенные реальные белорусские коды.';

export const okpo8: FormatModule = {
  id: 'okpo8',
  title: '8 цифр',
  official: false,
  notice: NOTICE,
  fields: [],
  validate: makeValidate(8),
  parse: makeParse(8),
  generate: (_partial, rng) => ({ ok: true, value: randomBase(rng) }),
};

export const okpo12: FormatModule = {
  id: 'okpo12',
  title: '12 цифр',
  official: false,
  notice: `${NOTICE} В 12-значной записи девятая цифра — код области, последние три — подразделение (000 — головная организация); значение этих позиций выведено из реальных реквизитов.`,
  fields: [regionField],
  validate: makeValidate(12),
  parse: makeParse(12),
  generate: (partial, rng): GenerateResult => {
    const { values, fieldErrors } = resolveFields([regionField], partial, rng);
    if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
    return { ok: true, value: `${randomBase(rng)}${values.region}000` };
  },
};
