import { luhnCheckDigit, luhnValid } from '../core/luhn';
import { pad, randInt } from '../core/random';
import type { FormatModule, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { digitsOf } from './digits';

// IMEI (3GPP TS 23.003, 6.2): 15 digits — TAC (8), serial number (6), Luhn check digit. IMEISV: 16 digits —
// TAC, serial number and a two-digit software version, without a check digit.

const PREFIX = /^\s*(imei(sv)?)[\s:№#/]*/i;

function makeValidate(length: 15 | 16) {
  return (input: string): ValidationResult => {
    const { value: v, errors } = digitsOf(input, PREFIX);
    const warnings: Issue[] = [];
    if (errors.length === 0 && v.length !== length) {
      errors.push({ code: 'LENGTH', message: `Длина ${v.length}, ожидается ${length} цифр` });
    }
    if (errors.length === 0 && length === 15 && !luhnValid(v)) {
      errors.push({ code: 'CHECK_DIGIT', message: `Контрольная цифра ${v[14]}, по алгоритму Луна ожидается ${luhnCheckDigit(v.slice(0, 14))}`, position: 15 });
    }
    return { valid: errors.length === 0, normalized: v, errors, warnings };
  };
}

function makeParse(length: 15 | 16) {
  return (input: string): ParsedField[] | null => {
    const { value: v, errors } = digitsOf(input, PREFIX);
    if (errors.length > 0 || v.length !== length) return null;
    const rows: ParsedField[] = [
      { label: 'TAC — модель устройства', value: v.slice(0, 8) },
      { label: 'Серийный номер', value: v.slice(8, 14) },
    ];
    if (length === 15) {
      const expected = luhnCheckDigit(v.slice(0, 14));
      rows.push({ label: 'Контрольная цифра (Луна)', value: Number(v[14]) === expected ? `${expected} — верная` : `${v[14]} — ожидается ${expected}` });
    } else {
      rows.push({ label: 'Версия ПО', value: v.slice(14) });
    }
    return rows;
  };
}

// TACs start with the reporting body identifier; 35 (BABT) is the most common one.
const randomBody = (rng: Rng) => `35${pad(randInt(rng, 0, 999_999), 6)}${pad(randInt(rng, 0, 999_999), 6)}`;

export const imei: FormatModule = {
  id: 'imei',
  title: 'IMEI (15 цифр)',
  official: true,
  fields: [],
  validate: makeValidate(15),
  parse: makeParse(15),
  generate: (_p, rng) => {
    const body = randomBody(rng);
    return { ok: true, value: `${body}${luhnCheckDigit(body)}`, hint: 'TAC случайный: устройство с таким кодом может не существовать' };
  },
};

export const imeisv: FormatModule = {
  id: 'imeisv',
  title: 'IMEISV (16 цифр)',
  official: true,
  fields: [],
  validate: makeValidate(16),
  parse: makeParse(16),
  generate: (_p, rng) => ({ ok: true, value: `${randomBody(rng)}${pad(randInt(rng, 0, 99), 2)}` }),
};
