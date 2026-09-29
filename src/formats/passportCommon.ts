import { icaoCheckDigit } from '../core/checkDigit';
import { resolveFields } from '../core/fields';
import { normalize } from '../core/normalize';
import { pad, randInt } from '../core/random';
import { PASSPORT_NUMBER_TEMPLATE, structureIssues } from '../core/structure';
import type { FieldSpec, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// Series (two Latin letters) + seven digits. The number has no check digit of its own;
// the machine-readable zone adds one per ICAO 9303.

export const NUMBER_FIELD: FieldSpec = {
  key: 'number',
  label: 'Номер (7 цифр)',
  kind: 'text',
  placeholder: '1234567',
  normalize: (v) => normalize(v).value,
  check: (v) => (/^\d{7}$/.test(v) ? null : 'Семь цифр, от 0000000 до 9999999'),
  random: (rng) => pad(randInt(rng, 0, 9_999_999), 7),
};

export const mrzNumber = (value: string): string => `${value}${icaoCheckDigit(value)}`;

export function validatePassport(input: string, seriesWarning: (series: string) => Issue | null): ValidationResult {
  const n = normalize(input);
  const errors: Issue[] = [...n.errors];
  const warnings: Issue[] = [...n.warnings];
  if (errors.length === 0) errors.push(...structureIssues(n.value, PASSPORT_NUMBER_TEMPLATE));
  if (errors.length === 0) {
    const warning = seriesWarning(n.value.slice(0, 2));
    if (warning) warnings.push(warning);
  }
  return { valid: errors.length === 0, normalized: n.value, errors, warnings };
}

export function parsePassport(input: string, describeSeries: (series: string) => string): ParsedField[] | null {
  const n = normalize(input);
  if (n.errors.length > 0 || structureIssues(n.value, PASSPORT_NUMBER_TEMPLATE).length > 0) return null;
  const v = n.value;
  return [
    { label: 'Серия', value: `${v.slice(0, 2)} — ${describeSeries(v.slice(0, 2))}` },
    { label: 'Номер', value: v.slice(2) },
    { label: 'Номер документа в MRZ (с контрольной цифрой)', value: mrzNumber(v) },
  ];
}

export function generatePassport(fields: FieldSpec[], partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const value = `${values.series}${values.number}`;
  return { ok: true, value, hint: `Номер документа в MRZ: ${mrzNumber(value)}` };
}
