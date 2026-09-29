import { resolveFields } from '../core/fields';
import { pad, pick, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { digitsOf } from './digits';
import { BALANCE_ACCOUNTS, BANKS, BICS } from './iban';

// Bank requisites used until the switch to IBAN on 04.07.2017, still found in old contracts and archives.
// Bank code: nine digits 153001XXX (NBRB — 153005042), XXX — the participant number; codes per the NBRB BIC
// directory column «до 04.07.2017» (bii.by/docs/158336). Account: 13 digits — balance account (4), number assigned
// by the bank (8), control key (1) — item 40 of NBRB instruction No. 728 of 12.12.2013 (via gb.by). The key
// algorithm is not published openly, so the key is not checked.

export const OLD_BANK_CODES: Record<string, string> = {
  NBRB: '153005042',
  SLAN: '153001108',
  REDJ: '153001110',
  MTBK: '153001117',
  UNBS: '153001175',
  TECN: '153001182',
  BRRB: '153001222',
  BELB: '153001226',
  ALFA: '153001270',
  MMBN: '153001272',
  RSHN: '153001288',
  BBTK: '153001333',
  BPSB: '153001369',
  AEBK: '153001704',
  IRJS: '153001735',
  BLBB: '153001739',
  OLMP: '153001742',
  PJCB: '153001749',
  BLNB: '153001765',
  POIS: '153001782',
  AKBB: '153001795',
  ZEPT: '153001820',
  BAPB: '153001964',
};

const bankByOldCode = (code: string) => Object.keys(OLD_BANK_CODES).find((b) => OLD_BANK_CODES[b] === code) ?? null;

const PREFIX = /^\s*(код банка|мфо|бик|код)[\s:№#]*/i;

export const oldBankCode: FormatModule = {
  id: 'old-code',
  title: 'Код банка до 2017',
  official: true,
  notice: 'Девятизначный код банка действовал до перехода на BIC 04.07.2017. Коды — по справочнику НБРБ (графа «до 04.07.2017»).',
  fields: [
    {
      key: 'bank',
      label: 'Банк',
      kind: 'select',
      options: Object.keys(OLD_BANK_CODES).map((b) => ({ value: b, label: `${OLD_BANK_CODES[b]} — ${BANKS[b]}` })),
      check: (v) => (Object.hasOwn(OLD_BANK_CODES, v) ? null : 'Выберите банк из списка'),
      random: (rng) => pick(rng, Object.keys(OLD_BANK_CODES)),
    },
  ],
  validate: (input): ValidationResult => {
    const { value: v, errors } = digitsOf(input, PREFIX);
    const warnings: Issue[] = [];
    if (errors.length === 0 && v.length !== 9) errors.push({ code: 'LENGTH', message: `Длина ${v.length}, ожидается 9 цифр` });
    if (errors.length === 0 && !v.startsWith('153')) errors.push({ code: 'FORMAT', message: 'Коды банков Беларуси начинались с 153', position: 1 });
    if (errors.length === 0 && !bankByOldCode(v)) {
      warnings.push({ code: 'UNKNOWN_BANK', message: 'Кода нет среди действующих банков: филиал, ликвидированный банк или опечатка', position: 7 });
    }
    return { valid: errors.length === 0, normalized: v, errors, warnings };
  },
  parse: (input): ParsedField[] | null => {
    const { value: v, errors } = digitsOf(input, PREFIX);
    if (errors.length > 0 || v.length !== 9) return null;
    const bank = bankByOldCode(v);
    return [
      { label: 'Номер участника расчётов', value: v.slice(6) },
      { label: 'Банк', value: bank ? BANKS[bank] : 'нет среди действующих банков' },
      { label: 'BIC с 04.07.2017', value: bank ? BICS[bank] : '—' },
    ];
  },
  generate: (partial, rng): GenerateResult => {
    const fields = oldBankCode.fields;
    const { values, fieldErrors } = resolveFields(fields, partial, rng);
    if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
    return { ok: true, value: OLD_BANK_CODES[values.bank], hint: `${BANKS[values.bank]} · сейчас BIC ${BICS[values.bank]}` };
  },
};

const accountFields: FieldSpec[] = [
  {
    key: 'balance',
    label: 'Балансовый счёт',
    kind: 'select',
    options: Object.entries(BALANCE_ACCOUNTS).map(([value, label]) => ({ value, label: `${value} — ${label}` })),
    check: (v) => (/^\d{4}$/.test(v) ? null : 'Выберите балансовый счёт из списка'),
    random: (rng) => pick(rng, Object.keys(BALANCE_ACCOUNTS)),
  },
];

export const oldAccount: FormatModule = {
  id: 'old-account',
  title: 'Счёт до 2017 (13 цифр)',
  official: true,
  notice:
    'Номер счёта до 04.07.2017: балансовый счёт (4 цифры), номер в банке (8 цифр) и контрольный ключ. Алгоритм ключа в открытом доступе не опубликован, поэтому ключ не проверяется, а при генерации случаен. Перевод в IBAN у каждого банка свой.',
  fields: accountFields,
  validate: (input): ValidationResult => {
    const { value: v, errors } = digitsOf(input, /^\s*(р\/?с|счёт|счет)[\s:№#]*/i);
    const warnings: Issue[] = [];
    if (errors.length === 0 && v.length !== 13) errors.push({ code: 'LENGTH', message: `Длина ${v.length}, ожидается 13 цифр` });
    if (errors.length === 0 && !Object.hasOwn(BALANCE_ACCOUNTS, v.slice(0, 4))) {
      warnings.push({ code: 'BALANCE', message: `Балансовый счёт «${v.slice(0, 4)}» не из списка распространённых счетов клиентов`, position: 1 });
    }
    return { valid: errors.length === 0, normalized: v, errors, warnings };
  },
  parse: (input): ParsedField[] | null => {
    const { value: v, errors } = digitsOf(input, /^\s*(р\/?с|счёт|счет)[\s:№#]*/i);
    if (errors.length > 0 || v.length !== 13) return null;
    return [
      { label: 'Балансовый счёт', value: `${v.slice(0, 4)} — ${BALANCE_ACCOUNTS[v.slice(0, 4)] ?? 'нет в списке распространённых'}` },
      { label: 'Номер в банке', value: v.slice(4, 12) },
      { label: 'Контрольный ключ', value: `${v[12]} — не проверяется (алгоритм не опубликован)` },
    ];
  },
  generate: (partial, rng: Rng): GenerateResult => {
    const { values, fieldErrors } = resolveFields(accountFields, partial, rng);
    if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
    return { ok: true, value: `${values.balance}${pad(randInt(rng, 0, 99_999_999), 8)}${randInt(rng, 0, 9)}` };
  },
};
