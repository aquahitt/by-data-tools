import { ibanCheckDigits } from '../core/checkDigit';
import { resolveFields } from '../core/fields';
import { normalize } from '../core/normalize';
import { pad, pick, randInt } from '../core/random';
import { IBAN_TEMPLATE, structureIssues } from '../core/structure';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// Account number structure per NBRB Board resolution No. 440 of 27.07.2015 (IBAN since 04.07.2017):
// BY, two check digits (ISO 13616 mod 97), four bank-code characters (first four of the BIC),
// four-digit balance account (chart of accounts, NBRB resolution No. 506), sixteen characters set by the bank.

const COUNTRY = 'BY';
export const DIRECTORY_DATE = '28.09.2026';

// Banks of the NBRB BIC directory (nbrb.by/payment/bic, bic-rb.xlsx) with status "действующий", snapshot of
// DIRECTORY_DATE; exchange, non-bank credit institutions and foreign banks left out. Update here only.
export const BANKS: Record<string, string> = {
  NBRB: 'Национальный банк Республики Беларусь',
  SLAN: 'ЗАО Банк ВТБ (Беларусь)',
  REDJ: 'ЗАО «Банк РРБ»',
  MTBK: 'ЗАО «МТбанк»',
  UNBS: 'ЗАО «БСБ Банк»',
  TECN: 'ОАО «Технобанк»',
  BRRB: 'ОАО «Банк развития Республики Беларусь»',
  BELB: 'ОАО «Банк БелВЭБ»',
  ALFA: 'ЗАО «Альфа-Банк»',
  MMBN: 'ОАО «Банк Дабрабыт»',
  RSHN: 'ЗАО «Банк «Решение»»',
  BBTK: 'ЗАО «ТК Банк»',
  BPSB: 'ОАО «Сбер Банк»',
  AEBK: 'ЗАО «Нео Банк Азия»',
  IRJS: 'ОАО «СтатусБанк»',
  BLBB: 'ОАО «Белинвестбанк»',
  OLMP: 'ОАО «Белгазпромбанк»',
  PJCB: 'ОАО «Приорбанк»',
  BLNB: 'ОАО «БНБ-Банк»',
  POIS: 'ОАО «Паритетбанк»',
  AKBB: 'ОАО «АСБ Беларусбанк»',
  ZEPT: 'ЗАО «Цептер Банк»',
  BAPB: 'ОАО «Белагропромбанк»',
};

// Full BIC of each bank of BANKS, same directory and date (ISO 9362: bank, country, location, optional branch).
export const BICS: Record<string, string> = {
  NBRB: 'NBRBBY2X',
  SLAN: 'SLANBY22',
  REDJ: 'REDJBY22',
  MTBK: 'MTBKBY22',
  UNBS: 'UNBSBY2X',
  TECN: 'TECNBY22',
  BRRB: 'BRRBBY2X',
  BELB: 'BELBBY2X',
  ALFA: 'ALFABY2X',
  MMBN: 'MMBNBY22',
  RSHN: 'RSHNBY2X',
  BBTK: 'BBTKBY2X',
  BPSB: 'BPSBBY2X',
  AEBK: 'AEBKBY2X',
  IRJS: 'IRJSBY22',
  BLBB: 'BLBBBY2X',
  OLMP: 'OLMPBY2X',
  PJCB: 'PJCBBY2X',
  BLNB: 'BLNBBY2X',
  POIS: 'POISBY2X',
  AKBB: 'AKBBBY2X',
  ZEPT: 'ZEPTBY2X',
  BAPB: 'BAPBBY2X',
};

// Common client accounts of the chart of accounts (NBRB resolution No. 506, groups 301, 303, 340, 341).
export const BALANCE_ACCOUNTS: Record<string, string> = {
  '3011': 'Текущие (расчетные) банковские счета небанковских финансовых организаций',
  '3012': 'Текущие (расчетные) банковские счета коммерческих организаций',
  '3013': 'Текущие (расчетные) банковские счета индивидуальных предпринимателей',
  '3014': 'Текущие (расчетные) банковские счета физических лиц',
  '3015': 'Текущие (расчетные) банковские счета некоммерческих организаций',
  '3034': 'Текущие (расчетные) банковские счета физических лиц с базовыми условиями обслуживания',
  '3401': 'Вклады (депозиты) до востребования небанковских финансовых организаций',
  '3402': 'Вклады (депозиты) до востребования коммерческих организаций',
  '3403': 'Вклады (депозиты) до востребования индивидуальных предпринимателей',
  '3404': 'Вклады (депозиты) до востребования физических лиц',
  '3405': 'Вклады (депозиты) до востребования некоммерческих организаций',
  '3411': 'Срочные вклады (депозиты) небанковских финансовых организаций',
  '3412': 'Срочные вклады (депозиты) коммерческих организаций',
  '3413': 'Срочные вклады (депозиты) индивидуальных предпринимателей',
  '3414': 'Срочные вклады (депозиты) физических лиц',
  '3415': 'Срочные вклады (депозиты) некоммерческих организаций',
};

const PREFIX = /^\s*iban[\s:№#]*/i;
const normalizeIban = (input: string) => normalize(input.replace(PREFIX, ''));

const grouped = (iban: string) => iban.replace(/(.{4})(?=.)/g, '$1 ');

const options = (table: Record<string, string>) =>
  Object.entries(table).map(([value, label]) => ({ value, label: `${value} — ${label}` }));

const fields: FieldSpec[] = [
  {
    key: 'bank',
    label: 'Банк',
    kind: 'select',
    options: options(BANKS),
    check: (v) => (Object.hasOwn(BANKS, v) ? null : 'Выберите банк из списка'),
    random: (rng) => pick(rng, Object.keys(BANKS)),
  },
  {
    key: 'balance',
    label: 'Балансовый счёт',
    kind: 'select',
    options: options(BALANCE_ACCOUNTS),
    check: (v) => (Object.hasOwn(BALANCE_ACCOUNTS, v) ? null : 'Выберите балансовый счёт из списка'),
    random: (rng) => pick(rng, Object.keys(BALANCE_ACCOUNTS)),
  },
  {
    key: 'account',
    label: 'Номер счёта в банке (16 знаков)',
    kind: 'text',
    placeholder: '0000000000000000',
    normalize: (v) => normalize(v).value,
    check: (v) => (/^[A-Z0-9]{16}$/.test(v) ? null : 'Шестнадцать латинских букв или цифр'),
    random: (rng: Rng) => `${pad(randInt(rng, 0, 99_999_999), 8)}${pad(randInt(rng, 0, 99_999_999), 8)}`,
  },
];

// A foreign IBAN: its own country code, check digits and a BBAN of that country's length (ISO 13616: up to 30).
const FOREIGN = /^(?!BY)[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/;

function validate(input: string): ValidationResult {
  const n = normalizeIban(input);
  const errors: Issue[] = [...n.errors];
  const warnings: Issue[] = [...n.warnings];
  if (errors.length === 0 && FOREIGN.test(n.value)) {
    const foreign = n.value.slice(0, 2);
    // The Belarusian length, layout and bank directory do not apply to another country's IBAN: say only that.
    errors.push({ code: 'COUNTRY', message: `Код страны «${foreign}» — IBAN не Беларуси, ожидается «BY»`, position: 1 });
    return { valid: false, normalized: n.value, errors, warnings };
  }
  if (errors.length === 0) errors.push(...structureIssues(n.value, IBAN_TEMPLATE));
  if (errors.length === 0) {
    // Fits the template and is not FOREIGN, so the country is BY.
    const v = n.value;
    const expected = ibanCheckDigits(COUNTRY, v.slice(4));
    if (v.slice(2, 4) !== expected) {
      // Compare with the computed digits, not "mod 97 = 1": that also admits 00, 01 and 99 (ISO 13616: 02..98).
      errors.push({ code: 'CHECK_DIGITS', message: `Контрольные цифры ${v.slice(2, 4)}, должны быть ${expected}`, position: 3 });
    }
    const bank = v.slice(4, 8);
    if (!Object.hasOwn(BANKS, bank)) {
      warnings.push({
        code: 'UNKNOWN_BANK',
        message: `Код банка «${bank}» не найден в справочнике НБРБ (на ${DIRECTORY_DATE})`,
        position: 5,
      });
    }
  }
  return { valid: errors.length === 0, normalized: n.value, errors, warnings };
}

function parse(input: string): ParsedField[] | null {
  const n = normalizeIban(input);
  if (n.errors.length > 0) return null;
  const v = n.value;
  const country = v.slice(0, 2);
  const checkDigits = (expected: string) => ({
    label: 'Контрольные цифры',
    value: v.slice(2, 4) === expected ? `${expected} — верные` : `${v.slice(2, 4)} — должны быть ${expected}`,
  });
  if (FOREIGN.test(v)) {
    // Positions 5.. of a foreign IBAN follow that country's layout and length, not the Belarusian one.
    return [
      { label: 'Страна', value: `${country} — не Беларусь` },
      checkDigits(ibanCheckDigits(country, v.slice(4))),
      { label: 'Запись группами', value: grouped(v) },
    ];
  }
  if (structureIssues(v, IBAN_TEMPLATE).length > 0 || country !== COUNTRY) return null;
  const bank = v.slice(4, 8);
  const balance = v.slice(8, 12);
  return [
    { label: 'Страна', value: 'BY — Республика Беларусь' },
    checkDigits(ibanCheckDigits(COUNTRY, v.slice(4))),
    { label: 'Банк', value: `${bank} — ${BANKS[bank] ?? 'нет в справочнике'}` },
    { label: 'Балансовый счёт', value: `${balance} — ${BALANCE_ACCOUNTS[balance] ?? 'нет в списке распространённых'}` },
    { label: 'Номер счёта в банке', value: v.slice(12) },
    { label: 'Запись группами', value: grouped(v) },
  ];
}

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const bban = `${values.bank}${values.balance}${values.account}`;
  const value = `${COUNTRY}${ibanCheckDigits(COUNTRY, bban)}${bban}`;
  const replaced = partial.account?.trim() ? normalize(partial.account).warnings.length > 0 : false;
  const note = replaced ? ' · кириллические буквы в номере счёта заменены на латинские' : '';
  return { ok: true, value, hint: `В документах: ${grouped(value)}${note}` };
}

export const ibanBy: FormatModule = {
  id: 'by',
  title: 'IBAN Беларуси',
  official: true,
  fields,
  validate,
  parse,
  generate,
};
