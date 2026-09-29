import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { bic } from '../src/formats/bic';
import { card, schemeOf } from '../src/formats/card';

const codes = (input: string) => card.validate(input).errors.map((e) => e.code);
const warnings = (input: string) => card.validate(input).warnings.map((e) => e.code);

describe('card number', () => {
  it.each([
    ['9112 0000 0000 0006', 'belkart'],
    ['2200000000000004', 'mir'],
    ['4111 1111 1111 1111', 'visa'],
    ['5467929858074128', 'mastercard'],
    ['2221000000000009', 'mastercard'],
    ['6761000000000006', 'maestro'],
    ['378282246310005', 'amex'],
  ])('recognises %s as %s', (input, scheme) => {
    expect(card.validate(input).valid).toBe(true);
    expect(schemeOf(input.replace(/\s/g, ''))?.id).toBe(scheme);
  });

  it('rejects a wrong Luhn digit with the expected one', () => {
    expect(card.validate('4111111111111112').errors).toEqual([
      { code: 'CHECK_DIGIT', message: 'Контрольная цифра 2, по алгоритму Луна ожидается 1', position: 16 },
    ]);
  });

  it('only warns for UnionPay cards failing Luhn', () => {
    const r = card.validate('6200000000000004');
    expect(r.valid).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(['CHECK_DIGIT']);
  });

  it('warns about an unknown scheme and a length the scheme does not issue', () => {
    expect(warnings('1000000000000008')).toEqual(['UNKNOWN_SCHEME']);
    expect(warnings('9112000000000000004')).toEqual(['SCHEME_LENGTH']);
  });

  it('rejects letters and wrong lengths', () => {
    expect(codes('4111 1111 1111 111A')).toEqual(['STRUCTURE']);
    expect(codes('41111111111')).toEqual(['LENGTH']);
  });

  it('names published gateway test cards', () => {
    expect(card.parse('4200 0000 0000 0000')?.at(-1)).toEqual({
      label: 'Известная тестовая карта',
      value: 'тестовая карта bePaid — успешная оплата (docs.bepaid.by)',
    });
  });

  it('generates a Belkart number from a given BIN and refuses a BIN of another scheme', () => {
    const r = card.generate({ scheme: 'belkart', bin: '911288' }, mulberry32(1));
    expect(r.ok && r.value).toMatch(/^911288\d{10}$/);
    expect(card.generate({ scheme: 'visa', bin: '9112' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { bin: 'Такое начало номера не относится к Visa' },
    });
  });
});

describe('BIC', () => {
  it('accepts directory codes with and without the branch', () => {
    for (const input of ['AKBBBY2X', 'akbb by 2x', 'BIC: AKBBBY2XXXX', 'SLANBY22']) {
      expect(bic.validate(input)).toMatchObject({ valid: true, warnings: [] });
    }
  });

  it('warns about a foreign bank, an unknown bank and a location differing from the directory', () => {
    expect(bic.validate('INEARUMM').warnings.map((w) => w.code)).toEqual(['COUNTRY']);
    expect(bic.validate('ABCDBY2X').warnings.map((w) => w.code)).toEqual(['UNKNOWN_BANK']);
    expect(bic.validate('AKBBBY22').warnings).toEqual([
      { code: 'OTHER_LOCATION', message: 'В справочнике НБРБ BIC этого банка — AKBBBY2X', position: 7 },
    ]);
  });

  it('rejects wrong length and digits in the bank part', () => {
    expect(bic.validate('AKBBBY2').errors.map((e) => e.code)).toEqual(['LENGTH']);
    expect(bic.validate('AKB1BY2X').errors).toEqual([{ code: 'STRUCTURE', message: 'Ожидается латинская буква', position: 4 }]);
  });

  it('parses the parts and links the bank code to IBAN', () => {
    expect(bic.parse('PJCBBY2X')).toEqual([
      { label: 'Банк', value: 'PJCB — ОАО «Приорбанк»' },
      { label: 'Страна', value: 'BY — Республика Беларусь' },
      { label: 'Местонахождение', value: '2X' },
      { label: 'Филиал', value: 'не указан — головной офис' },
      { label: 'Для IBAN', value: 'код банка в IBAN — PJCB (позиции 5–8)' },
    ]);
  });
});
