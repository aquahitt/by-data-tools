import { describe, expect, it } from 'vitest';
import { ibanCheckDigits } from '../src/core/checkDigit';
import { mulberry32 } from '../src/core/random';
import { ibanBy } from '../src/formats/iban';

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
