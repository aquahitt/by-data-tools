import { resolveFields } from '../core/fields';
import { pad, randInt } from '../core/random';
import type { FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { digitsOf, lengthIssue } from './digits';
import { randomSoato, soatoFields, soatoIssues, soatoRows } from './soato';

// Land plot cadastral number, resolution of the Committee on land resources No. 14 of 08.04.2004: 18 digits —
// 1–10 the code of the administrative-territorial unit (СОАТО), 11–12 the cadastral block (01–99),
// 13–18 the plot within the block (000001–999999). No check digit.

function validate(input: string): ValidationResult {
  const { value: v, errors } = digitsOf(input);
  const warnings: Issue[] = [];
  if (errors.length === 0) {
    const length = lengthIssue(v, 18);
    if (length) errors.push(length);
  }
  if (errors.length === 0) {
    const s = soatoIssues(v.slice(0, 10));
    errors.push(...s.errors);
    warnings.push(...s.warnings);
    if (v.slice(10, 12) === '00') errors.push({ code: 'BLOCK', message: 'Номер кадастрового квартала 00, ожидается 01–99', position: 11 });
    if (v.slice(12) === '000000') errors.push({ code: 'PLOT', message: 'Номер участка 000000, ожидается от 000001', position: 13 });
  }
  return { valid: errors.length === 0, normalized: v, errors, warnings };
}

function parse(input: string): ParsedField[] | null {
  const { value: v, errors } = digitsOf(input);
  if (errors.length > 0 || v.length !== 18) return null;
  return [
    { label: 'СОАТО (позиции 1–10)', value: v.slice(0, 10) },
    ...soatoRows(v.slice(0, 10)),
    { label: 'Кадастровый квартал (11–12)', value: v.slice(10, 12) },
    { label: 'Участок в квартале (13–18)', value: v.slice(12) },
  ];
}

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(soatoFields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const value = `${randomSoato(rng, values.region, values.level)}${pad(randInt(rng, 1, 99), 2)}${pad(randInt(rng, 1, 999_999), 6)}`;
  return { ok: true, value, hint: 'Структура по постановлению № 14 от 08.04.2004; существование участка не проверяется' };
}

export const cadastral: FormatModule = {
  id: 'cadastral',
  title: 'Кадастровый номер участка',
  official: true,
  fields: soatoFields,
  validate,
  parse,
  generate,
};
