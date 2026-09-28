import { resolveFields } from '../core/fields';
import { pad, pick, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// Numbering plan of the public telecom network (Council of Ministers resolution No. 787 of 22.06.2006),
// as summarised by ru.wikipedia.org "Телефонный план нумерации Беларуси" and the A1 dialling rules:
// +375 and a nine-digit national number. No check digit — only the shape and the codes are verified.

const SEPARATORS = /[\s\-\u2010-\u2015\u2212().+/]/g;

// Code 29 is shared; the operator follows the first subscriber digit.
const MOBILE_CODES: Record<string, string> = { '25': 'life:)', '29': '', '33': 'МТС', '44': 'A1' };
const CODE_29_OPERATORS: Record<string, string> = {
  '1': 'A1', '3': 'A1', '6': 'A1', '9': 'A1',
  '2': 'МТС', '5': 'МТС', '7': 'МТС', '8': 'МТС',
};

const ZONES: Record<string, string> = {
  '15': 'Гродненская область',
  '16': 'Брестская область',
  '17': 'г. Минск и Минская область',
  '21': 'Витебская область',
  '22': 'Могилёвская область',
  '23': 'Гомельская область',
};

interface Centre {
  code: string;
  city: string;
  /** Genitive, for "Для Бреста — 6 цифр". */
  cityOf: string;
  /** First subscriber digits used by the generator (not enforced by validation). */
  firstDigits: string;
}

// Minsk: code 17 + seven digits starting with 2 or 3 (per the numbering-plan summary); regional centres:
// three-digit code + six digits. First digits 2..9 for the centres are this tool's choice, not a published rule.
const CENTRES: Centre[] = [
  { code: '17', city: 'г. Минск', cityOf: 'Минска', firstDigits: '23' },
  { code: '152', city: 'Гродно', cityOf: 'Гродно', firstDigits: '23456789' },
  { code: '162', city: 'Брест', cityOf: 'Бреста', firstDigits: '23456789' },
  { code: '212', city: 'Витебск', cityOf: 'Витебска', firstDigits: '23456789' },
  { code: '222', city: 'Могилёв', cityOf: 'Могилёва', firstDigits: '23456789' },
  { code: '232', city: 'Гомель', cityOf: 'Гомеля', firstDigits: '23456789' },
];

type National = { national: string; errors: [] } | { national: null; errors: Issue[] };

/** Accepts +375 / 375 / 00375 (optionally with the trunk 0, as in "+375 (029)"), 8 0XX, 0XX or nine bare digits. */
function toNational(input: string): National {
  const cleaned = input.trim().replace(SEPARATORS, '');
  const bad = [...cleaned].findIndex((ch) => !/\d/.test(ch));
  if (bad >= 0) {
    return { national: null, errors: [{ code: 'INVALID_CHAR', message: `Недопустимый символ «${cleaned[bad]}»`, position: bad + 1 }] };
  }
  const m = /^(?:(?:00)?3750?|80|0)?(\d{9})$/.exec(cleaned);
  if (!m || (cleaned.length === 9 && cleaned.startsWith('0'))) {
    return {
      national: null,
      errors: [{ code: 'FORMAT', message: 'Ожидается +375 XX XXX-XX-XX, 8 0XX XXX-XX-XX или 9 цифр национального номера' }],
    };
  }
  return { national: m[1], errors: [] };
}

const groupSubscriber = (s: string) => (s.length === 7 ? `${s.slice(0, 3)}-${s.slice(3, 5)}-${s.slice(5)}` : `${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4)}`);

function notations(national: string, codeLength: number): ParsedField[] {
  const code = national.slice(0, codeLength);
  const subscriber = groupSubscriber(national.slice(codeLength));
  return [
    { label: 'E.164', value: `+375${national}` },
    { label: 'Международный формат', value: `+375 ${code} ${subscriber}` },
    { label: 'Внутри страны', value: `8 0${code} ${subscriber}` },
  ];
}

const hintFor = (national: string, codeLength: number) => {
  const [, international, domestic] = notations(national, codeLength);
  return `Международный: ${international.value} · внутри страны: ${domestic.value}`;
};

function mobileOperator(national: string): string {
  const code = national.slice(0, 2);
  if (code !== '29') return MOBILE_CODES[code];
  return CODE_29_OPERATORS[national[2]] ?? 'оператор не определён';
}

const centreOf = (national: string) => CENTRES.find((c) => national.startsWith(c.code));

function validateWith(input: string, codeIssue: (national: string) => Issue | null): ValidationResult {
  const n = toNational(input);
  if (n.national === null) return { valid: false, normalized: input.trim(), errors: n.errors, warnings: [] };
  const issue = codeIssue(n.national);
  return { valid: !issue, normalized: `+375${n.national}`, errors: issue ? [issue] : [], warnings: [] };
}

const subscriberNormalize = (v: string) => v.replace(SEPARATORS, '');
const randomDigits = (rng: Rng, first: string, length: number) =>
  `${pick(rng, [...first])}${pad(randInt(rng, 0, 10 ** (length - 1) - 1), length - 1)}`;

// ---------- mobile ----------

interface MobileOption {
  code: string;
  name: string;
  firstDigits: string;
}

/** "1, 3, 6 или 9" */
const listDigits = (digits: string) => [...digits].join(', ').replace(/, (\d)$/, ' или $1');

const MOBILE_OPTIONS: Record<string, MobileOption> = {
  '25': { code: '25', name: 'life:)', firstDigits: '123456789' },
  '29-A1': { code: '29', name: 'A1', firstDigits: '1369' },
  '29-MTS': { code: '29', name: 'МТС', firstDigits: '2578' },
  '33': { code: '33', name: 'МТС', firstDigits: '123456789' },
  '44': { code: '44', name: 'A1', firstDigits: '123456789' },
};

const mobileFields: FieldSpec[] = [
  {
    key: 'operator',
    label: 'Код / оператор',
    kind: 'select',
    options: Object.entries(MOBILE_OPTIONS).map(([value, o]) => ({ value, label: `${o.code} — ${o.name}` })),
    check: (v) => (Object.hasOwn(MOBILE_OPTIONS, v) ? null : 'Выберите код из списка'),
    random: (rng) => pick(rng, Object.keys(MOBILE_OPTIONS)),
  },
  {
    key: 'subscriber',
    label: 'Абонентский номер (7 цифр)',
    kind: 'text',
    placeholder: '1234567',
    normalize: subscriberNormalize,
    check: (v) => (/^\d{7}$/.test(v) ? null : 'Семь цифр'),
    random: (rng, context) => randomDigits(rng, MOBILE_OPTIONS[context?.operator ?? '']?.firstDigits ?? '123456789', 7),
  },
];

function generateMobile(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(mobileFields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const option = MOBILE_OPTIONS[values.operator];
  if (!option.firstDigits.includes(values.subscriber[0])) {
    return {
      ok: false,
      fieldErrors: { subscriber: `Для ${option.code} ${option.name} первая цифра — ${listDigits(option.firstDigits)}` },
    };
  }
  const national = `${option.code}${values.subscriber}`;
  return { ok: true, value: `+375${national}`, hint: hintFor(national, 2) };
}

export const phoneMobile: FormatModule = {
  id: 'mobile',
  title: 'Мобильный',
  official: false,
  fields: mobileFields,
  validate: (input) =>
    validateWith(input, (national) =>
      Object.hasOwn(MOBILE_CODES, national.slice(0, 2))
        ? null
        : { code: 'CODE', message: `Код мобильной сети «${national.slice(0, 2)}» — ожидается 25, 29, 33 или 44` },
    ),
  parse: (input) => {
    const n = toNational(input);
    if (n.national === null || !Object.hasOwn(MOBILE_CODES, n.national.slice(0, 2))) return null;
    return [
      { label: 'Тип', value: 'мобильный' },
      { label: 'Оператор', value: `${n.national.slice(0, 2)} — ${mobileOperator(n.national)}` },
      ...notations(n.national, 2),
    ];
  },
  generate: generateMobile,
};

// ---------- landline ----------

const landlineFields: FieldSpec[] = [
  {
    key: 'city',
    label: 'Город',
    kind: 'select',
    options: CENTRES.map((c) => ({ value: c.code, label: `${c.code} — ${c.city}` })),
    check: (v) => (CENTRES.some((c) => c.code === v) ? null : 'Выберите город из списка'),
    random: (rng) => pick(rng, CENTRES).code,
  },
  {
    key: 'subscriber',
    label: 'Абонентский номер (7 цифр для Минска, 6 для областных центров)',
    kind: 'text',
    placeholder: '2345678',
    normalize: subscriberNormalize,
    check: (v) => (/^\d{6,7}$/.test(v) ? null : 'Шесть или семь цифр'),
    random: (rng, context) => {
      const centre = CENTRES.find((c) => c.code === context?.city) ?? CENTRES[1];
      return randomDigits(rng, centre.firstDigits, 9 - centre.code.length);
    },
  },
];

function generateLandline(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(landlineFields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const centre = CENTRES.find((c) => c.code === values.city)!;
  const length = 9 - centre.code.length;
  if (values.subscriber.length !== length) {
    return { ok: false, fieldErrors: { subscriber: `Для ${centre.cityOf} — ${length} цифр` } };
  }
  // Only for Minsk does the first digit change what parse reports (city vs Minsk-region district code).
  if (centre.code === '17' && !centre.firstDigits.includes(values.subscriber[0])) {
    return { ok: false, fieldErrors: { subscriber: 'Для Минска первая цифра — 2 или 3' } };
  }
  const national = `${centre.code}${values.subscriber}`;
  return { ok: true, value: `+375${national}`, hint: hintFor(national, centre.code.length) };
}

function landlineCity(national: string): string {
  const centre = centreOf(national);
  if (centre && (centre.code !== '17' || '23'.includes(national[2]))) return centre.city;
  return national.startsWith('17') ? 'Минская область (районный код)' : 'районный код';
}

export const phoneLandline: FormatModule = {
  id: 'landline',
  title: 'Стационарный',
  official: false,
  fields: landlineFields,
  validate: (input) =>
    validateWith(input, (national) =>
      Object.hasOwn(ZONES, national.slice(0, 2))
        ? null
        : { code: 'ZONE', message: `Код зоны «${national.slice(0, 2)}» не относится к стационарной сети (15, 16, 17, 21, 22, 23)` },
    ),
  parse: (input) => {
    const n = toNational(input);
    if (n.national === null || !Object.hasOwn(ZONES, n.national.slice(0, 2))) return null;
    const zone = n.national.slice(0, 2);
    // Regional centres have three-digit codes; Minsk and unknown district codes are shown after the zone.
    const codeLength = centreOf(n.national)?.code.length === 3 ? 3 : 2;
    return [
      { label: 'Тип', value: 'стационарный' },
      { label: 'Область', value: `${zone} — ${ZONES[zone]}` },
      { label: 'Город', value: landlineCity(n.national) },
      ...notations(n.national, codeLength),
    ];
  },
  generate: generateLandline,
};
