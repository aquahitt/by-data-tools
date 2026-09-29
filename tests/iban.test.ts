import { describe, expect, it } from 'vitest';
import { ibanCheckDigits } from '../src/core/checkDigit';
import { mulberry32, pad } from '../src/core/random';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BANKS, ibanBy } from '../src/formats/iban';

const codes = (input: string) => ibanBy.validate(input).errors.map((e) => e.code);
const withCheck = (bban: string) => `BY${ibanCheckDigits('BY', bban)}${bban}`;

describe('ibanBy.validate', () => {
  // Correspondent accounts from the NBRB BIC directory, plus a generated one.
  it.each([
    'BY30NBRB32000079500190000000',
    'BY28NBRB32000027000170000000',
    'BY09NBRB46000004200150000000',
    'BY75AKBB30120000000000000000',
  ])('accepts %s', (iban) => {
    expect(ibanBy.validate(iban)).toEqual({ valid: true, normalized: iban, errors: [], warnings: [] });
  });

  it('accepts the grouped, lowercase form', () => {
    expect(ibanBy.validate('by30 nbrb 3200 0079 5001 9000 0000').valid).toBe(true);
  });

  it('rejects wrong check digits and names the right ones', () => {
    expect(ibanBy.validate('BY31NBRB32000079500190000000').errors).toEqual([
      { code: 'CHECK_DIGITS', message: 'Контрольные цифры 31, должны быть 30', position: 3 },
    ]);
  });

  it('rejects a foreign IBAN', () => {
    expect(codes('DE30NBRB32000079500190000000')).toEqual(['COUNTRY']);
  });

  it('rejects wrong length and structure', () => {
    expect(codes('BY30NBRB')).toEqual(['LENGTH']);
    expect(codes('BY30NBRB32A00079500190000000')).toEqual(['STRUCTURE']);
  });

  it('keeps an unknown bank code valid with a warning', () => {
    const r = ibanBy.validate(withCheck('ABCD30120000000000000001'));
    expect(r.valid).toBe(true);
    expect(r.warnings).toEqual([
      { code: 'UNKNOWN_BANK', message: 'Код банка «ABCD» не найден в справочнике НБРБ (на 28.09.2026)', position: 5 },
    ]);
  });
});

describe('ibanBy.parse', () => {
  it('decodes every part', () => {
    expect(ibanBy.parse('BY30NBRB32000079500190000000')).toEqual([
      { label: 'Страна', value: 'BY — Республика Беларусь' },
      { label: 'Контрольные цифры', value: '30 — верные' },
      { label: 'Банк', value: 'NBRB — Национальный банк Республики Беларусь' },
      { label: 'Балансовый счёт', value: '3200 — нет в списке распространённых' },
      { label: 'Номер счёта в банке', value: '0079500190000000' },
      { label: 'Запись группами', value: 'BY30 NBRB 3200 0079 5001 9000 0000' },
    ]);
  });

  it('describes a common balance account and wrong check digits', () => {
    const fields = ibanBy.parse('BY76AKBB30120000000000000000');
    expect(fields?.[1].value).toBe('76 — должны быть 75');
    expect(fields?.[2].value).toBe('AKBB — ОАО «АСБ Беларусбанк»');
    expect(fields?.[3].value).toBe('3012 — Текущие (расчетные) банковские счета коммерческих организаций');
  });
});

describe('ibanBy.generate', () => {
  it('builds from given fields and shows the grouped form', () => {
    expect(ibanBy.generate({ bank: 'AKBB', balance: '3012', account: '0000 0000 0000 0000' }, mulberry32(1))).toEqual({
      ok: true,
      value: 'BY75AKBB30120000000000000000',
      hint: 'В документах: BY75 AKBB 3012 0000 0000 0000 0000',
    });
  });

  it('reports invalid fields', () => {
    expect(ibanBy.generate({ bank: 'XXXX', balance: '9999', account: '12' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: {
        bank: 'Выберите банк из списка',
        balance: 'Выберите балансовый счёт из списка',
        account: 'Шестнадцать латинских букв или цифр',
      },
    });
  });
});

describe('ibanBy check digits outside 02..98', () => {
  // ISO 13616 digits are 98 - (n mod 97), i.e. 02..98; 00, 01 and 99 pass "mod 97 = 1" for some BBANs but are invalid.
  const bbanWith = (digits: string) => {
    for (let i = 0; ; i++) {
      const bban = `AKBB3012${pad(i, 16)}`;
      if (ibanCheckDigits('BY', bban) === digits) return bban;
    }
  };

  it.each([
    ['00', '97'],
    ['01', '98'],
    ['99', '02'],
  ])('rejects %s where %s is correct', (given, correct) => {
    const r = ibanBy.validate(`BY${given}${bbanWith(correct)}`);
    expect(r.valid).toBe(false);
    expect(r.errors.map((e) => e.code)).toEqual(['CHECK_DIGITS']);
  });
});

describe('ibanBy Cyrillic country code', () => {
  it('replaces a Cyrillic ВУ with BY and warns', () => {
    const r = ibanBy.validate('ВУ30 NBRB 3200 0079 5001 9000 0000');
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe('BY30NBRB32000079500190000000');
    expect(r.warnings.map((w) => w.code)).toEqual(['CYRILLIC_REPLACED']);
  });
});

describe('ibanBy review follow-ups', () => {
  it('parses a foreign IBAN without Belarusian bank and balance tables', () => {
    expect(ibanBy.parse('DE30NBRB32000079500190000000')).toEqual([
      { label: 'Страна', value: 'DE — не Беларусь' },
      { label: 'Контрольные цифры', value: '30 — должны быть 72' },
      { label: 'Запись группами', value: 'DE30 NBRB 3200 0079 5001 9000 0000' },
    ]);
  });

  it('adds no bank warning to a foreign IBAN', () => {
    expect(ibanBy.validate('DE30ABCD32000079500190000000').warnings).toEqual([]);
  });

  it('strips an IBAN prefix', () => {
    expect(ibanBy.validate('IBAN BY30NBRB32000079500190000000').valid).toBe(true);
    expect(ibanBy.validate('iban: BY30 NBRB 3200 0079 5001 9000 0000').valid).toBe(true);
  });

  it('describes the deposit accounts of non-bank financial and non-commercial organizations', () => {
    const bban = 'AKBB34010000000000000000';
    expect(ibanBy.parse(`BY${ibanCheckDigits('BY', bban)}${bban}`)?.[3].value).toBe(
      '3401 — Вклады (депозиты) до востребования небанковских финансовых организаций',
    );
  });

  it('says when Cyrillic letters of the account number were replaced', () => {
    const r = ibanBy.generate({ bank: 'AKBB', balance: '3012', account: 'АВСЕ000000000000' }, mulberry32(1));
    expect(r.ok && r.value.slice(12)).toBe('ABCE000000000000');
    expect(r.ok && r.hint).toContain('кириллические буквы в номере счёта заменены на латинские');
  });

  it('closes the quotes of «Банк «Решение»»', () => {
    expect(BANKS.RSHN).toBe('ЗАО «Банк «Решение»»');
  });

  it('matches the NBRB BIC directory snapshot, minus the currency exchange', () => {
    const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'nbrb-bic-2026-09-28.json'), 'utf8'));
    const codes = fixture.banks.map((b: { code: string }) => b.code).filter((c: string) => c !== 'BCSX');
    expect(Object.keys(BANKS).sort()).toEqual(codes.sort());
  });
});

