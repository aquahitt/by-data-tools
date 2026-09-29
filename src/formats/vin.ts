import { resolveFields } from '../core/fields';
import { normalize } from '../core/normalize';
import { pad, pick, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// Vehicle identification number, ISO 3779 / ТР ТС 018/2011 annex 7: 17 characters, digits and Latin letters
// except I, O, Q; WMI (1–3), VDS (4–9), VIS (10–17). Position 10 (model year) and 11 (plant) are optional under
// ТР ТС. The check digit in position 9 is mandatory only in the USA and Canada, so a mismatch is a warning.
// WMIs in Belarus are assigned by BelGISS; Y3–Y5 is the Belarusian range (ISO 3780, en.wikibooks WMI list).

const VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const ALPHABET = '0123456789ABCDEFGHJKLMNPRSTUVWXYZ';

const charValue = (ch: string) => (/\d/.test(ch) ? Number(ch) : VALUES[ch]);

/** Check digit for position 9 ('X' for 10). */
export function vinCheckDigit(vin: string): string {
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += charValue(vin[i]) * WEIGHTS[i];
  const r = sum % 11;
  return r === 10 ? 'X' : String(r);
}

// Model-year code, 30-year cycle: A = 1980/2010 … Y = 2000/2030, 1 = 2001/2031 … 9 = 2009/2039.
const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';
export const yearsOf = (code: string): number[] => {
  const i = YEAR_CODES.indexOf(code);
  return i < 0 ? [] : [1980 + i, 2010 + i];
};

export const BELARUS_WMI: Record<string, string> = {
  Y3M: 'МАЗ',
  Y3J: 'Белкоммунмаш',
  Y4F: 'Форд Юнион (СП 1990-х)',
  Y4K: 'БелДжи (Geely)',
};

function regionOf(wmi: string): string {
  if (/^Y[3-5]/.test(wmi)) return 'Беларусь';
  const c = wmi[0];
  if (/[A-H]/.test(c)) return 'Африка';
  if (/[J-R]/.test(c)) return 'Азия';
  if (/[S-Z]/.test(c)) return 'Европа';
  if (/[1-5]/.test(c)) return 'Северная Америка';
  if (/[67]/.test(c)) return 'Океания';
  return 'Южная Америка';
}

function check(input: string): { value: string; errors: Issue[]; warnings: Issue[] } {
  const n = normalize(input.replace(/^\s*vin[\s:№#]*/i, ''));
  const errors: Issue[] = [...n.errors];
  if (errors.length === 0 && n.value.length === 0) errors.push({ code: 'EMPTY', message: 'Номер не содержит ни одной буквы или цифры' });
  if (errors.length === 0 && n.value.length !== 17) {
    errors.push({ code: 'LENGTH', message: `Длина ${n.value.length}, ожидается 17 символов` });
  }
  if (errors.length === 0) {
    [...n.value].forEach((ch, i) => {
      if (!ALPHABET.includes(ch)) {
        errors.push({ code: 'INVALID_CHAR', message: `Буква «${ch}» в VIN не используется (нет I, O, Q)`, position: i + 1 });
      }
    });
  }
  return { value: n.value, errors, warnings: n.warnings };
}

function validate(input: string): ValidationResult {
  const { value: v, errors, warnings } = check(input);
  if (errors.length === 0) {
    const expected = vinCheckDigit(v);
    if (v[8] !== expected) {
      warnings.push({
        code: 'CHECK_DIGIT',
        message: `Контрольный знак ${v[8]}, по ISO 3779 ожидается ${expected}. Обязателен только для США и Канады, поэтому номер не отклонён`,
        position: 9,
      });
    }
  }
  return { valid: errors.length === 0, normalized: v, errors, warnings };
}

function parse(input: string): ParsedField[] | null {
  const { value: v, errors } = check(input);
  if (errors.length > 0) return null;
  const wmi = v.slice(0, 3);
  const expected = vinCheckDigit(v);
  const years = yearsOf(v[9]);
  return [
    { label: 'WMI — изготовитель', value: `${wmi} — ${BELARUS_WMI[wmi] ?? 'нет в списке'}, регион: ${regionOf(wmi)}` },
    { label: 'VDS — описание ТС (позиции 4–8)', value: v.slice(3, 8) },
    {
      label: 'Контрольный знак (позиция 9)',
      value: v[8] === expected ? `${expected} — совпадает` : `${v[8]} — по ISO 3779 ожидается ${expected}`,
    },
    {
      label: 'Модельный год (позиция 10)',
      value: years.length ? `${v[9]} — ${years.join(' или ')}` : `${v[9]} — не код года (у изготовителей ЕАЭС необязателен)`,
    },
    { label: 'Сборочный завод (позиция 11)', value: v[10] },
    { label: 'Порядковый номер (12–17)', value: v.slice(11) },
  ];
}

const currentYear = () => new Date().getFullYear();

const fields: FieldSpec[] = [
  {
    key: 'wmi',
    label: 'Изготовитель (WMI)',
    kind: 'select',
    options: Object.entries(BELARUS_WMI).map(([value, label]) => ({ value, label: `${value} — ${label}` })),
    check: (v) => (/^[A-HJ-NPR-Z0-9]{3}$/.test(v) ? null : 'Выберите изготовителя из списка'),
    random: (rng) => pick(rng, Object.keys(BELARUS_WMI)),
  },
  {
    key: 'year',
    label: 'Модельный год',
    kind: 'text',
    placeholder: String(currentYear()),
    check: (v) => (/^\d{4}$/.test(v) && Number(v) >= 1980 && Number(v) <= currentYear() + 1 ? null : `Год от 1980 до ${currentYear() + 1}`),
    random: (rng) => String(randInt(rng, 2001, currentYear())),
  },
];

const randomChars = (rng: Rng, n: number, alphabet = ALPHABET) => Array.from({ length: n }, () => pick(rng, [...alphabet])).join('');

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const year = Number(values.year);
  const yearCode = YEAR_CODES[(year - 1980) % 30];
  const draft = `${values.wmi}${randomChars(rng, 5)}0${yearCode}${randomChars(rng, 1)}${pad(randInt(rng, 0, 999_999), 6)}`;
  const value = `${draft.slice(0, 8)}${vinCheckDigit(draft)}${draft.slice(9)}`;
  return { ok: true, value, hint: `Контрольный знак ${value[8]} посчитан по ISO 3779; модельный год ${year} — код ${yearCode}` };
}

export const vin: FormatModule = {
  id: 'vin',
  title: 'VIN',
  official: true,
  fields,
  validate,
  parse,
  generate,
};
