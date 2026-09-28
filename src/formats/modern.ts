import { checkDigit731 } from '../core/checkDigit';
import { resolveFields } from '../core/fields';
import { normalize } from '../core/normalize';
import { pad, randInt } from '../core/random';
import { structureIssues } from '../core/structure';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// MVD resolution No. 345 of 18.10.2011: 7xxxxxx A NNN PB C, every rule mandatory.

const fields: FieldSpec[] = [
  {
    key: 'number',
    label: 'Группа 1 (7000000–7999999)',
    kind: 'text',
    placeholder: '7000000',
    check: (v) => (/^7\d{6}$/.test(v) ? null : 'Семь цифр, от 7000000 до 7999999'),
    random: (rng) => String(randInt(rng, 7000000, 7999999)),
  },
  {
    key: 'sequence',
    label: 'Номер последовательности (000–999)',
    kind: 'text',
    placeholder: '000',
    check: (v) => (/^\d{3}$/.test(v) ? null : 'Три цифры, от 000 до 999'),
    random: (rng) => pad(randInt(rng, 0, 999), 3),
  },
];

function validate(input: string): ValidationResult {
  const n = normalize(input);
  const errors: Issue[] = [...n.errors];
  if (errors.length === 0) errors.push(...structureIssues(n.value));
  if (errors.length === 0) {
    const v = n.value;
    if (v[0] !== '7') {
      errors.push({ code: 'FIRST_DIGIT', message: 'Группа 1 должна быть в диапазоне 7000000–7999999', position: 1 });
    }
    if (v[7] !== 'A') {
      errors.push({ code: 'GROUP2', message: `Группа 2 должна быть «A», получено «${v[7]}»`, position: 8 });
    }
    const signature = v.slice(11, 13);
    if (signature !== 'PB') {
      errors.push({ code: 'SIGNATURE', message: `Сигнатура должна быть «PB», получено «${signature}»`, position: 12 });
    }
    const expected = checkDigit731(v.slice(0, 13));
    if (Number(v[13]) !== expected) {
      errors.push({ code: 'CHECK_DIGIT', message: `Контрольная цифра ${v[13]}, ожидается ${expected}`, position: 14 });
    }
  }
  return { valid: errors.length === 0, normalized: n.value, errors, warnings: n.warnings };
}

function parse(input: string): ParsedField[] | null {
  const n = normalize(input);
  if (n.errors.length > 0 || structureIssues(n.value).length > 0) return null;
  const v = n.value;
  const expected = checkDigit731(v.slice(0, 13));
  return [
    { label: 'Группа 1 — случайное число', value: v.slice(0, 7) },
    { label: 'Группа 2 — символ', value: v[7] },
    { label: 'Группа 3 — номер последовательности', value: v.slice(8, 11) },
    { label: 'Группа 4 — сигнатура', value: v.slice(11, 13) },
    {
      label: 'Группа 5 — контрольная цифра',
      value: Number(v[13]) === expected ? `${v[13]} — верная` : `${v[13]} — ожидается ${expected}`,
    },
  ];
}

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const body = `${values.number}A${values.sequence}PB`;
  return { ok: true, value: `${body}${checkDigit731(body)}` };
}

export const modern: FormatModule = {
  id: 'modern',
  title: '2012+ (МВД № 345)',
  official: true,
  fields,
  validate,
  parse,
  generate,
};
