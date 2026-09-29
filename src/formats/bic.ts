import { resolveFields } from '../core/fields';
import { normalize } from '../core/normalize';
import { pick } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { BANKS, BICS, DIRECTORY_DATE } from './iban';

// Bank identification code, ISO 9362 (NBRB Board resolution No. 472 of 07.08.2015; used since 04.07.2017):
// four characters of the bank, country code, two of location, optionally three of the branch (XXX = head office).
// NBRB also assigns codes of the same shape to non-SWIFT participants; the directory also lists a foreign bank.

const SHAPE = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const PREFIX = /^\s*(bic|swift|бик)[\s:№#]*/i;

const describeShape = (v: string): Issue[] => {
  if (v.length !== 8 && v.length !== 11) {
    return [{ code: 'LENGTH', message: `Длина ${v.length}, ожидается 8 или 11 символов` }];
  }
  const issues: Issue[] = [];
  [...v].forEach((ch, i) => {
    if (i < 6 && !/[A-Z]/.test(ch)) issues.push({ code: 'STRUCTURE', message: 'Ожидается латинская буква', position: i + 1 });
    if (i >= 6 && !/[A-Z0-9]/.test(ch)) issues.push({ code: 'STRUCTURE', message: 'Ожидается латинская буква или цифра', position: i + 1 });
  });
  return issues;
};

function validate(input: string): ValidationResult {
  const n = normalize(input.replace(PREFIX, ''));
  const errors: Issue[] = [...n.errors];
  const warnings: Issue[] = [...n.warnings];
  if (errors.length === 0 && n.value.length === 0) errors.push({ code: 'EMPTY', message: 'Код не содержит ни одной буквы или цифры' });
  if (errors.length === 0) errors.push(...describeShape(n.value));
  if (errors.length === 0 && SHAPE.test(n.value)) {
    const v = n.value;
    const bank = v.slice(0, 4);
    if (v.slice(4, 6) !== 'BY') {
      warnings.push({ code: 'COUNTRY', message: `Код страны «${v.slice(4, 6)}» — банк не белорусский`, position: 5 });
    } else if (!Object.hasOwn(BANKS, bank)) {
      warnings.push({ code: 'UNKNOWN_BANK', message: `Банк «${bank}» не найден в справочнике НБРБ (на ${DIRECTORY_DATE})`, position: 1 });
    } else if (v.slice(0, 8) !== BICS[bank]) {
      warnings.push({ code: 'OTHER_LOCATION', message: `В справочнике НБРБ BIC этого банка — ${BICS[bank]}`, position: 7 });
    }
  }
  return { valid: errors.length === 0, normalized: n.value, errors, warnings };
}

function parse(input: string): ParsedField[] | null {
  const n = normalize(input.replace(PREFIX, ''));
  if (n.errors.length > 0 || !SHAPE.test(n.value)) return null;
  const v = n.value;
  const bank = v.slice(0, 4);
  const belarusian = v.slice(4, 6) === 'BY';
  const branch = v.slice(8);
  return [
    { label: 'Банк', value: `${bank} — ${belarusian ? (BANKS[bank] ?? 'нет в справочнике НБРБ') : 'иностранный банк'}` },
    { label: 'Страна', value: belarusian ? 'BY — Республика Беларусь' : v.slice(4, 6) },
    { label: 'Местонахождение', value: v.slice(6, 8) },
    { label: 'Филиал', value: branch === '' ? 'не указан — головной офис' : branch === 'XXX' ? 'XXX — головной офис' : branch },
    { label: 'Для IBAN', value: belarusian ? `код банка в IBAN — ${bank} (позиции 5–8)` : 'не белорусский банк' },
  ];
}

const fields: FieldSpec[] = [
  {
    key: 'bank',
    label: 'Банк',
    kind: 'select',
    options: Object.entries(BANKS).map(([value, label]) => ({ value, label: `${value} — ${label}` })),
    check: (v) => (Object.hasOwn(BANKS, v) ? null : 'Выберите банк из списка'),
    random: (rng) => pick(rng, Object.keys(BANKS)),
  },
];

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, value: BICS[values.bank], hint: `${BANKS[values.bank]} · из справочника НБРБ на ${DIRECTORY_DATE}` };
}

export const bic: FormatModule = {
  id: 'bic',
  title: 'BIC банка',
  official: true,
  fields,
  validate,
  parse,
  generate,
};
