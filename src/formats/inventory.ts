import { resolveFields } from '../core/fields';
import { pad, pick, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { SOATO_REGIONS } from './soato';

// Inventory number of a capital structure, isolated premises or parking space (Law No. 133-З of 22.07.2002,
// art. 1: a number that never repeats in Belarus and stays with the object). Shape seen on real documents and in
// the NCA manual — «код организации / вид объекта - номер»: 500/C-66910, 500/D-798825872, 340/C-291104. Letters:
// C — capital structure, U — unfinished conserved structure, D — isolated premises or parking space. The official
// instruction was not available, so the length of the number and the meaning of the prefix are not checked strictly:
// the first digit of the prefix matched the СОАТО oblast code on every example (5 — Minsk, 3 — Gomel oblast).

export const KINDS: Record<string, string> = {
  C: 'капитальное строение (здание, сооружение)',
  U: 'незавершённое законсервированное строение',
  D: 'изолированное помещение или машино-место',
};

const CYRILLIC: Record<string, string> = { С: 'C', Д: 'D', У: 'U' };
const SHAPE = /^(\d{3})\/([A-ZА-Я])-(\d{1,10})$/;

const tidy = (input: string) =>
  input
    .trim()
    .replace(/^\s*(инв\.?|инвентарный)\s*(№|номер)?\s*/i, '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .replace(/[–—]/g, '-');

function read(input: string): { prefix: string; kind: string; number: string; cyrillic: boolean } | null {
  const m = SHAPE.exec(tidy(input));
  if (!m) return null;
  const letter = m[2];
  return { prefix: m[1], kind: CYRILLIC[letter] ?? letter, number: m[3], cyrillic: Object.hasOwn(CYRILLIC, letter) };
}

function validate(input: string): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const r = read(input);
  if (tidy(input) === '') errors.push({ code: 'EMPTY', message: 'Номер пустой' });
  else if (!r) errors.push({ code: 'FORMAT', message: 'Ожидается «код/вид-номер», например 500/C-66910' });
  else {
    if (!Object.hasOwn(KINDS, r.kind)) errors.push({ code: 'KIND', message: `Вид объекта «${r.kind}» неизвестен: C, U или D`, position: 5 });
    if (r.cyrillic) warnings.push({ code: 'CYRILLIC', message: 'Буква вида объекта кириллическая; в регистре пишется латинская', position: 5 });
    if (!Object.hasOwn(SOATO_REGIONS, r.prefix[0])) {
      warnings.push({ code: 'PREFIX', message: `Код организации начинается с «${r.prefix[0]}» — на известных номерах это код области 1–7`, position: 1 });
    }
  }
  const normalized = r ? `${r.prefix}/${r.kind}-${r.number}` : tidy(input);
  return { valid: errors.length === 0, normalized, errors, warnings };
}

function parse(input: string): ParsedField[] | null {
  const r = read(input);
  if (!r) return null;
  return [
    { label: 'Код организации по госрегистрации', value: `${r.prefix}${SOATO_REGIONS[r.prefix[0]] ? ` — предположительно ${SOATO_REGIONS[r.prefix[0]]}` : ''}` },
    { label: 'Вид объекта', value: `${r.kind} — ${KINDS[r.kind] ?? 'неизвестный вид'}` },
    { label: 'Номер', value: r.number },
  ];
}

const fields: FieldSpec[] = [
  {
    key: 'region',
    label: 'Область (первая цифра кода)',
    kind: 'select',
    options: Object.entries(SOATO_REGIONS).map(([value, label]) => ({ value, label: `${value} — ${label}` })),
    check: (v) => (Object.hasOwn(SOATO_REGIONS, v) ? null : 'Выберите область из списка'),
    random: (rng) => pick(rng, Object.keys(SOATO_REGIONS)),
  },
  {
    key: 'kind',
    label: 'Вид объекта',
    kind: 'select',
    options: Object.entries(KINDS).map(([value, label]) => ({ value, label: `${value} — ${label}` })),
    check: (v) => (Object.hasOwn(KINDS, v) ? null : 'Выберите вид из списка'),
    random: (rng) => pick(rng, ['C', 'C', 'D', 'D', 'U']),
  },
];

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const prefix = values.region === '5' ? '500' : `${values.region}${pad(randInt(rng, 0, 9) * 10, 2)}`;
  const number = values.kind === 'D' ? String(randInt(rng, 700_000_000, 799_999_999)) : String(randInt(rng, 10_000, 399_999));
  return { ok: true, value: `${prefix}/${values.kind}-${number}`, hint: 'Код организации и длина номера — по образцам реальных документов' };
}

export const inventoryNumber: FormatModule = {
  id: 'inventory',
  title: 'Инвентарный номер',
  official: false,
  notice:
    'Официальная инструкция о структуре инвентарного номера в открытом доступе не найдена: вид «код/вид-номер» и буквы C, U, D — по руководству НКА и реальным документам. Длина номера и код организации строго не проверяются.',
  fields,
  validate,
  parse,
  generate,
};
