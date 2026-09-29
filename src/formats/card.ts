import { resolveFields } from '../core/fields';
import { luhnCheckDigit, luhnValid } from '../core/luhn';
import { pad, pick, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { digitsOf } from './digits';

// Payment card number (PAN), ISO/IEC 7812: issuer identification number (first 6–8 digits), account number,
// Luhn check digit. Scheme ranges: en.wikipedia.org "Payment card number"; БЕЛКАРТ 9112, 16 digits — belveb.by
// ("9 — Белкарт", example 9112 88…), ixbt.com. No Belkart test number is published by BY gateways.

interface Scheme {
  id: string;
  name: string;
  /** Inclusive prefix ranges, compared on as many leading digits as the bounds have. */
  ranges: [string, string][];
  lengths: number[];
  /** UnionPay issues some cards that fail Luhn. */
  luhnOptional?: boolean;
}

export const SCHEMES: Scheme[] = [
  { id: 'belkart', name: 'БЕЛКАРТ', ranges: [['9112', '9112']], lengths: [16] },
  { id: 'mir', name: 'Мир', ranges: [['2200', '2204']], lengths: [16, 17, 18, 19] },
  { id: 'visa', name: 'Visa', ranges: [['4', '4']], lengths: [13, 16, 19] },
  { id: 'mastercard', name: 'Mastercard', ranges: [['51', '55'], ['2221', '2720']], lengths: [16] },
  {
    id: 'maestro',
    name: 'Maestro',
    ranges: ['5018', '5020', '5038', '5893', '6304', '6759', '6761', '6762', '6763'].map((p) => [p, p]),
    lengths: [12, 13, 14, 15, 16, 17, 18, 19],
  },
  { id: 'unionpay', name: 'UnionPay', ranges: [['62', '62']], lengths: [16, 17, 18, 19], luhnOptional: true },
  { id: 'amex', name: 'American Express', ranges: [['34', '34'], ['37', '37']], lengths: [15] },
  { id: 'jcb', name: 'JCB', ranges: [['3528', '3589']], lengths: [16, 17, 18, 19] },
  { id: 'diners', name: 'Diners Club', ranges: [['30', '30'], ['36', '36'], ['38', '39']], lengths: [14, 15, 16, 17, 18, 19] },
  { id: 'discover', name: 'Discover', ranges: [['6011', '6011'], ['644', '649'], ['65', '65']], lengths: [16, 17, 18, 19] },
];

// Published sandbox cards of payment gateways working in Belarus. They are Luhn-valid on purpose.
export const TEST_CARDS: Record<string, string> = {
  '4200000000000000': 'тестовая карта bePaid — успешная оплата (docs.bepaid.by)',
  '4005550000000019': 'тестовая карта bePaid — отказ (docs.bepaid.by)',
  '4111111111111111': 'тестовая карта Assist Belarus — успешная оплата (docs.belassist.by)',
  '5467929858074128': 'тестовая карта Assist Belarus — успешная оплата (docs.belassist.by)',
};

const inRange = (digits: string, [low, high]: [string, string]) => {
  const head = Number(digits.slice(0, low.length));
  return digits.length >= low.length && head >= Number(low) && head <= Number(high);
};

export function schemeOf(digits: string): Scheme | null {
  // Most specific first: the longest matching bound wins (e.g. Maestro 6759 over nothing, Mir 2200 over Mastercard).
  let best: { scheme: Scheme; width: number } | null = null;
  for (const scheme of SCHEMES) {
    for (const range of scheme.ranges) {
      if (inRange(digits, range) && (!best || range[0].length > best.width)) best = { scheme, width: range[0].length };
    }
  }
  return best?.scheme ?? null;
}

const MIN = 12;
const MAX = 19;

const grouped = (v: string) => (v.length === 15 && /^3[47]/.test(v) ? `${v.slice(0, 4)} ${v.slice(4, 10)} ${v.slice(10)}` : v.replace(/(\d{4})(?=\d)/g, '$1 '));

function validate(input: string): ValidationResult {
  const { value: v, errors } = digitsOf(input);
  const warnings: Issue[] = [];
  if (errors.length === 0 && (v.length < MIN || v.length > MAX)) {
    errors.push({ code: 'LENGTH', message: `Длина ${v.length}, ожидается от ${MIN} до ${MAX} цифр` });
  }
  if (errors.length === 0) {
    const scheme = schemeOf(v);
    if (!luhnValid(v)) {
      const expected = luhnCheckDigit(v.slice(0, -1));
      const issue = { code: 'CHECK_DIGIT', message: `Контрольная цифра ${v[v.length - 1]}, по алгоритму Луна ожидается ${expected}`, position: v.length };
      if (scheme?.luhnOptional) warnings.push({ ...issue, message: `${issue.message}. У части карт UnionPay проверка Луна не выполняется` });
      else errors.push(issue);
    }
    if (!scheme) {
      warnings.push({ code: 'UNKNOWN_SCHEME', message: `Платёжная система по первым цифрам ${v.slice(0, 4)} не определена` });
    } else if (!scheme.lengths.includes(v.length)) {
      warnings.push({
        code: 'SCHEME_LENGTH',
        message: `У карт ${scheme.name} длина номера ${scheme.lengths.join(', ')}, здесь ${v.length}`,
      });
    }
  }
  return { valid: errors.length === 0, normalized: v, errors, warnings };
}

function parse(input: string): ParsedField[] | null {
  const { value: v, errors } = digitsOf(input);
  if (errors.length > 0 || v.length < MIN || v.length > MAX) return null;
  const scheme = schemeOf(v);
  const expected = luhnCheckDigit(v.slice(0, -1));
  const rows: ParsedField[] = [
    { label: 'Платёжная система', value: scheme?.name ?? 'не определена' },
    { label: 'Номер эмитента (BIN, первые 6 цифр)', value: v.slice(0, 6) },
    { label: 'Номер счёта карты', value: v.slice(6, -1) },
    {
      label: 'Контрольная цифра (Луна)',
      value: Number(v[v.length - 1]) === expected ? `${expected} — верная` : `${v[v.length - 1]} — ожидается ${expected}`,
    },
    { label: 'Запись группами', value: grouped(v) },
  ];
  if (Object.hasOwn(TEST_CARDS, v)) rows.push({ label: 'Известная тестовая карта', value: TEST_CARDS[v] });
  return rows;
}

// Schemes a Belarusian test usually needs; the rest are recognised by the validator.
const GENERATED: Record<string, { name: string; prefixes: (rng: Rng) => string }> = {
  belkart: { name: 'БЕЛКАРТ (9112)', prefixes: () => '9112' },
  visa: { name: 'Visa (4)', prefixes: () => '4' },
  mastercard: { name: 'Mastercard (51–55)', prefixes: (rng) => String(randInt(rng, 51, 55)) },
  mir: { name: 'Мир (2200–2204)', prefixes: (rng) => String(randInt(rng, 2200, 2204)) },
};

const LENGTH = 16;

const fields: FieldSpec[] = [
  {
    key: 'scheme',
    label: 'Платёжная система',
    kind: 'select',
    options: Object.entries(GENERATED).map(([value, s]) => ({ value, label: s.name })),
    check: (v) => (Object.hasOwn(GENERATED, v) ? null : 'Выберите платёжную систему из списка'),
    random: (rng) => pick(rng, Object.keys(GENERATED)),
  },
  {
    key: 'bin',
    label: 'Начало номера (BIN), необязательно',
    kind: 'text',
    placeholder: '911288',
    normalize: (v) => v.replace(/[\s-]/g, ''),
    check: (v) => (/^\d{1,8}$/.test(v) ? null : 'От 1 до 8 цифр'),
    random: (rng, context) => (GENERATED[context?.scheme ?? ''] ?? GENERATED.visa).prefixes(rng),
  },
];

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  if (schemeOf(values.bin.padEnd(8, '0'))?.id !== values.scheme) {
    const name = SCHEMES.find((s) => s.id === values.scheme)?.name ?? '';
    return { ok: false, fieldErrors: { bin: `Такое начало номера не относится к ${name}` } };
  }
  let body = values.bin;
  while (body.length < LENGTH - 1) body += pad(randInt(rng, 0, 9), 1);
  const value = `${body}${luhnCheckDigit(body)}`;
  return {
    ok: true,
    value,
    hint: `${grouped(value)} · проходит проверку Луна, но банком не выпущен — только для тестов`,
  };
}

export const card: FormatModule = {
  id: 'card',
  title: 'Банковская карта',
  official: false,
  notice:
    'Номер карты проверяется по алгоритму Луна и диапазонам платёжных систем. Сгенерированные номера не выпущены банками: для оплат в тестовой среде используйте тестовые карты вашего платёжного шлюза.',
  fields,
  validate,
  parse,
  generate,
};
