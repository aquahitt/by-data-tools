import { resolveFields } from '../core/fields';
import { pad, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { digitsOf } from './digits';

// GTIN-13 (EAN-13) and GTIN-8 (EAN-8), GS1 General Specifications: the last digit is a mod-10 check digit with
// weights 3 and 1 alternating from the right. The first three digits are the GS1 prefix of the issuing member
// organisation — 481 is GS1 Belarus (gs1.org company-prefix table, ids.by). The prefix tells who issued the
// company prefix, not where the product was made.

export function gtinCheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += Number(body[body.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

// [from, to, meaning] for three-digit prefixes (gs1.org/standards/id-keys/company-prefix).
const PREFIXES: [number, number, string][] = [
  [1, 19, 'GS1 США'],
  [20, 29, 'номера для внутреннего обращения (в пределах региона)'],
  [30, 39, 'GS1 США'],
  [40, 49, 'номера для внутреннего обращения (в пределах компании)'],
  [50, 59, 'GS1 США (резерв)'],
  [60, 139, 'GS1 США'],
  [200, 299, 'номера для внутреннего обращения (весовой товар, магазинные коды)'],
  [300, 379, 'GS1 Франция'],
  [400, 440, 'GS1 Германия'],
  [450, 459, 'GS1 Япония'],
  [460, 469, 'GS1 Россия'],
  [470, 470, 'GS1 Кыргызстан'],
  [474, 474, 'GS1 Эстония'],
  [475, 475, 'GS1 Латвия'],
  [476, 476, 'GS1 Азербайджан'],
  [477, 477, 'GS1 Литва'],
  [478, 478, 'GS1 Узбекистан'],
  [481, 481, 'GS1 Беларусь'],
  [482, 482, 'GS1 Украина'],
  [484, 484, 'GS1 Молдова'],
  [485, 485, 'GS1 Армения'],
  [486, 486, 'GS1 Грузия'],
  [487, 487, 'GS1 Казахстан'],
  [490, 499, 'GS1 Япония'],
  [590, 590, 'GS1 Польша'],
  [690, 699, 'GS1 Китай'],
  [977, 977, 'ISSN — периодические издания'],
  [978, 979, 'ISBN — книги'],
];

export function prefixOf(code: string): string {
  const p = Number(code.slice(0, 3));
  if (code.startsWith('000')) return 'короткий номер, дополненный нулями';
  return PREFIXES.find(([from, to]) => p >= from && p <= to)?.[2] ?? 'другая организация GS1';
}

function makeFormat(length: 8 | 13): FormatModule {
  const check = (input: string) => {
    const { value: v, errors } = digitsOf(input, /^\s*(ean|gtin)[\s:№#-]*(8|13)?[\s:]*/i);
    if (errors.length === 0 && v.length !== length) errors.push({ code: 'LENGTH', message: `Длина ${v.length}, ожидается ${length} цифр` });
    return { v, errors };
  };
  const fields: FieldSpec[] = [
    {
      key: 'prefix',
      label: 'Префикс GS1 (3 цифры)',
      kind: 'text',
      placeholder: '481',
      normalize: (x) => x.replace(/\s/g, ''),
      check: (x) => (/^\d{3}$/.test(x) ? null : 'Три цифры'),
      random: () => '481',
    },
  ];
  return {
    id: `ean${length}`,
    title: `EAN-${length}`,
    official: true,
    fields,
    validate: (input): ValidationResult => {
      const { v, errors } = check(input);
      if (errors.length === 0) {
        const expected = gtinCheckDigit(v.slice(0, -1));
        if (Number(v[length - 1]) !== expected) {
          errors.push({ code: 'CHECK_DIGIT', message: `Контрольная цифра ${v[length - 1]}, ожидается ${expected}`, position: length });
        }
      }
      return { valid: errors.length === 0, normalized: v, errors, warnings: [] as Issue[] };
    },
    parse: (input): ParsedField[] | null => {
      const { v, errors } = check(input);
      if (errors.length > 0) return null;
      const expected = gtinCheckDigit(v.slice(0, -1));
      return [
        { label: 'Префикс GS1', value: `${v.slice(0, 3)} — ${prefixOf(v)}` },
        { label: length === 13 ? 'Номер предприятия и товара' : 'Номер товара', value: v.slice(3, -1) },
        { label: 'Контрольная цифра', value: Number(v[length - 1]) === expected ? `${expected} — верная` : `${v[length - 1]} — ожидается ${expected}` },
      ];
    },
    generate: (partial, rng: Rng): GenerateResult => {
      const { values, fieldErrors } = resolveFields(fields, partial, rng);
      if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
      const body = `${values.prefix}${pad(randInt(rng, 0, 10 ** (length - 4) - 1), length - 4)}`;
      return {
        ok: true,
        value: `${body}${gtinCheckDigit(body)}`,
        hint: `${prefixOf(body)} · номер не выдан GS1: может совпасть с кодом реального товара`,
      };
    },
  };
}

export const EAN_FORMATS: FormatModule[] = [makeFormat(13), makeFormat(8)];
