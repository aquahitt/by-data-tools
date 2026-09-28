import { resolveFields } from '../core/fields';
import { normalize } from '../core/normalize';
import { pick, randInt, pad } from '../core/random';
import { structureIssues } from '../core/structure';
import type { FieldSpec, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// UNP per MNS resolution No. 127 of 31.12.2003 (Instruction on taxpayer registration, ch. 3, appendices 2-3):
// X1 region, X2..X8 sequence number, K check digit.

export interface UnpRegion {
  digit: string; // X1 of an organization
  letter: string; // X1 of an individual
  name: string;
}

export const UNP_REGIONS: UnpRegion[] = [
  { digit: '1', letter: 'A', name: 'г. Минск' },
  { digit: '2', letter: 'B', name: 'Брестская область' },
  { digit: '3', letter: 'C', name: 'Витебская область' },
  { digit: '4', letter: 'E', name: 'Гомельская область' },
  { digit: '5', letter: 'H', name: 'Гродненская область' },
  { digit: '6', letter: 'K', name: 'Минская область' },
  { digit: '7', letter: 'M', name: 'Могилёвская область' },
];

const WEIGHTS = [29, 23, 19, 17, 13, 7, 5, 3];

/** Weighted sum of the first eight values mod 11 (item 19). 10 means such a UNP is never issued. */
export function unpControlNumber(values: number[]): number {
  return values.reduce((sum, v, i) => sum + v * WEIGHTS[i], 0) % 11;
}

/** What differs between organization and individual UNPs. */
export interface UnpScheme {
  template: string;
  typeLabel: string;
  regionOf(x1: string): UnpRegion | undefined;
  regionCode(region: UnpRegion): string;
  minSequence: number;
  /** Numeric values of X1..X8, or null when X2 is not a valid code. */
  values(first8: string): number[] | null;
  /** X2..X8 for a 7-digit sequence number. */
  encodeSequence(sequence: string): string;
  /** Human reading of X2..X8, or null when X2 is not a valid code. */
  describeSequence(x2to8: string): string | null;
}

const PREFIX = /^\s*(унп|unp)[\s:№#]*/i;

function normalizeUnp(input: string) {
  return normalize(input.replace(PREFIX, ''));
}

export function validateUnp(input: string, scheme: UnpScheme): ValidationResult {
  const n = normalizeUnp(input);
  const errors: Issue[] = [...n.errors];
  if (errors.length === 0) errors.push(...structureIssues(n.value, scheme.template));
  if (errors.length === 0) {
    const v = n.value;
    if (!scheme.regionOf(v[0])) {
      errors.push({ code: 'REGION', message: `Неизвестный код области «${v[0]}»`, position: 1 });
    }
    const values = scheme.values(v.slice(0, 8));
    if (!values) {
      errors.push({ code: 'X2', message: `Второй знак «${v[1]}» не из таблицы A B C E H K M O P T`, position: 2 });
    } else {
      const control = unpControlNumber(values);
      if (control === 10) {
        errors.push({ code: 'NOT_ISSUED', message: 'Контрольное число равно 10 — такой УНП не выдаётся', position: 9 });
      } else if (Number(v[8]) !== control) {
        errors.push({ code: 'CHECK_DIGIT', message: `Контрольная цифра ${v[8]}, ожидается ${control}`, position: 9 });
      }
    }
  }
  return { valid: errors.length === 0, normalized: n.value, errors, warnings: n.warnings };
}

export function parseUnp(input: string, scheme: UnpScheme): ParsedField[] | null {
  const n = normalizeUnp(input);
  if (n.errors.length > 0 || structureIssues(n.value, scheme.template).length > 0) return null;
  const v = n.value;
  const region = scheme.regionOf(v[0]);
  const values = scheme.values(v.slice(0, 8));
  const control = values ? unpControlNumber(values) : null;
  let check: string;
  if (control === null) check = `${v[8]} — не вычисляется: второй знак не из таблицы`;
  else if (control === 10) check = `${v[8]} — контрольное число 10, такой УНП не выдаётся`;
  else check = Number(v[8]) === control ? `${v[8]} — верная` : `${v[8]} — ожидается ${control}`;
  return [
    { label: 'Тип плательщика', value: scheme.typeLabel },
    { label: 'Область (налоговые органы)', value: `${v[0]} — ${region?.name ?? 'неизвестный код'}` },
    { label: 'Порядковый номер', value: scheme.describeSequence(v.slice(1, 8)) ?? `${v.slice(1, 8)} (второй знак не из таблицы)` },
    { label: 'Контрольная цифра', value: check },
  ];
}

export function unpFields(scheme: UnpScheme): FieldSpec[] {
  const min = pad(scheme.minSequence, 7);
  return [
    {
      key: 'region',
      label: 'Область',
      kind: 'select',
      options: UNP_REGIONS.map((r) => ({ value: scheme.regionCode(r), label: `${scheme.regionCode(r)} — ${r.name}` })),
      check: (v) => (scheme.regionOf(v) ? null : 'Выберите область из списка'),
      random: (rng) => scheme.regionCode(pick(rng, UNP_REGIONS)),
    },
    {
      key: 'sequence',
      label: 'Порядковый номер (7 цифр)',
      kind: 'text',
      placeholder: '0098854',
      normalize: (v) => normalize(v).value,
      check: (v) => (/^\d{7}$/.test(v) && Number(v) >= scheme.minSequence ? null : `Семь цифр, от ${min} до 9999999`),
      random: (rng: Rng) => pad(randInt(rng, scheme.minSequence, 9_999_999), 7),
    },
  ];
}

function controlFor(scheme: UnpScheme, region: string, sequence: string): number {
  return unpControlNumber(scheme.values(`${region}${scheme.encodeSequence(sequence)}`)!);
}

/** Next sequence number (upwards, then downwards) that MNS would actually issue. */
function nearestIssuable(scheme: UnpScheme, region: string, sequence: number): string | null {
  for (let s = sequence + 1; s <= 9_999_999; s++) if (controlFor(scheme, region, pad(s, 7)) < 10) return pad(s, 7);
  for (let s = sequence - 1; s >= scheme.minSequence; s--) if (controlFor(scheme, region, pad(s, 7)) < 10) return pad(s, 7);
  return null;
}

export function generateUnp(
  scheme: UnpScheme,
  fields: FieldSpec[],
  partial: Record<string, string>,
  rng: Rng,
): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const { region } = values;
  let { sequence } = values;
  let control = controlFor(scheme, region, sequence);
  if (control === 10) {
    if (partial.sequence?.trim()) {
      const nearest = nearestIssuable(scheme, region, Number(sequence));
      return {
        ok: false,
        fieldErrors: {
          sequence: `Такой УНП не выдаётся (контрольное число 10). Ближайший подходящий номер — ${nearest}`,
        },
      };
    }
    const sequenceField = fields.find((f) => f.key === 'sequence')!;
    while (control === 10) {
      sequence = sequenceField.random(rng);
      control = controlFor(scheme, region, sequence);
    }
  }
  return { ok: true, value: `${region}${scheme.encodeSequence(sequence)}${control}` };
}
