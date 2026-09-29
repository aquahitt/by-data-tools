import { resolveFields } from '../core/fields';
import { numberInWords, plural } from '../core/numberWords';
import { randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// Amount in Belarusian roubles (BYN, since the 2016 redenomination: рубль = 100 копеек) written in figures and in
// words, as in payment orders and contracts: «Сто двадцать три белорусских рубля 45 копеек». Words follow the
// Russian agreement rules (рубль — masculine, копейка and тысяча — feminine).

const RUB: [string, string, string] = ['белорусский рубль', 'белорусских рубля', 'белорусских рублей'];
const KOP: [string, string, string] = ['копейка', 'копейки', 'копеек'];
const MAX = 999_999_999_999.99;

const SHAPE = /^(\d+)(?:[.,](\d{1,2}))?$/;

function tidy(input: string): string {
  return input.trim().replace(/\s*(byn|br|руб\.?|бел\.?\s*руб\.?|р\.)$/i, '').replace(/[\s  ']/g, '');
}

/** Amount in kopecks, or an error. */
function read(input: string): { kopecks: number } | { error: Issue } {
  const v = tidy(input);
  if (v === '') return { error: { code: 'EMPTY', message: 'Введите сумму' } };
  const m = SHAPE.exec(v);
  if (!m) return { error: { code: 'FORMAT', message: 'Ожидается сумма цифрами: 1234,56 или 1 234.56, до двух знаков после запятой' } };
  const rubles = Number(m[1]);
  const kop = Number((m[2] ?? '0').padEnd(2, '0'));
  if (rubles + kop / 100 > MAX) return { error: { code: 'RANGE', message: 'Сумма больше 999 999 999 999,99' } };
  return { kopecks: rubles * 100 + kop };
}

const figures = (rubles: number, kop: number) =>
  `${rubles.toLocaleString('ru-RU').replace(/\s/g, ' ')},${String(kop).padStart(2, '0')}`;
const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

export function amountInWords(kopecks: number): { words: string; wordsFull: string; figures: string } {
  const rubles = Math.floor(kopecks / 100);
  const kop = kopecks % 100;
  const rub = `${numberInWords(rubles, 'm')} ${plural(rubles, RUB)}`;
  const k = String(kop).padStart(2, '0');
  return {
    words: capital(`${rub} ${k} ${plural(kop, KOP)}`),
    wordsFull: capital(`${rub} ${numberInWords(kop, 'f')} ${plural(kop, KOP)}`),
    figures: `${figures(rubles, kop)} BYN`,
  };
}

function validate(input: string): ValidationResult {
  const r = read(input);
  if ('error' in r) return { valid: false, normalized: tidy(input), errors: [r.error], warnings: [] };
  return { valid: true, normalized: amountInWords(r.kopecks).figures, errors: [], warnings: [] };
}

function parse(input: string): ParsedField[] | null {
  const r = read(input);
  if ('error' in r) return null;
  const a = amountInWords(r.kopecks);
  return [
    { label: 'Цифрами', value: a.figures },
    { label: 'Прописью (копейки цифрами)', value: a.words },
    { label: 'Прописью полностью', value: a.wordsFull },
  ];
}

const fields: FieldSpec[] = [
  {
    key: 'max',
    label: 'Не больше, рублей',
    kind: 'text',
    placeholder: '100000',
    normalize: (v) => v.replace(/\s/g, ''),
    check: (v) => (/^\d{1,12}$/.test(v) && Number(v) >= 1 ? null : 'Целое число от 1 до 999 999 999 999'),
    random: () => '100000',
  },
];

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  // Log-uniform so that 12,50 and 48 300,00 are equally likely to come up.
  const max = Number(values.max);
  const rubles = Math.min(max, Math.floor(Math.exp(rng() * Math.log(max + 1))));
  const a = amountInWords(rubles * 100 + randInt(rng, 0, 99));
  return {
    ok: true,
    value: a.figures,
    variants: [
      { label: 'Цифрами', value: a.figures },
      { label: 'Прописью', value: a.words },
      { label: 'Прописью полностью', value: a.wordsFull },
    ],
  };
}

export const amount: FormatModule = {
  id: 'byn',
  title: 'Белорусские рубли',
  official: false,
  fields,
  validate,
  parse,
  generate,
};
