import { describe, expect, it } from 'vitest';
import { numberInWords, plural } from '../src/core/numberWords';
import { mulberry32 } from '../src/core/random';
import { ADDRESS_SET, CITIES, randomAddress } from '../src/formats/address';
import { amount } from '../src/formats/amount';
import { customsDeclaration } from '../src/formats/customsDeclaration';
import { EAN_FORMATS, gtinCheckDigit } from '../src/formats/ean';
import { bic } from '../src/formats/bic';
import { ibanBy } from '../src/formats/iban';
import { inventoryNumber } from '../src/formats/inventory';
import { OLD_BANK_CODES, oldAccount, oldBankCode } from '../src/formats/legacyBank';
import { okpo12 } from '../src/formats/okpo';
import { generateOrganization, ORGANIZATION_SET } from '../src/formats/organization';
import { phoneLandline } from '../src/formats/phone';
import { postalCode } from '../src/formats/postal';
import { unpIndividual } from '../src/formats/unpIndividual';
import { unpOrganization } from '../src/formats/unpOrganization';
import { email } from '../src/formats/email';
import { checkLines, bulkCsv } from '../src/ui/bulkPanel';

const codes = (r: { errors: { code: string }[] }) => r.errors.map((e) => e.code);
const [ean13, ean8] = EAN_FORMATS;

describe('number in words', () => {
  it.each([
    [1, 'm', 'один'],
    [2, 'f', 'две'],
    [11, 'm', 'одиннадцать'],
    [21, 'f', 'двадцать одна'],
    [1000, 'm', 'одна тысяча'],
    [2000, 'm', 'две тысячи'],
    [5_021_000, 'm', 'пять миллионов двадцать одна тысяча'],
    [111_111_111_111, 'm', 'сто одиннадцать миллиардов сто одиннадцать миллионов сто одиннадцать тысяч сто одиннадцать'],
  ] as const)('%d (%s) → %s', (n, gender, words) => {
    expect(numberInWords(n, gender)).toBe(words);
  });

  it('agrees the noun with the number', () => {
    expect([1, 2, 5, 11, 12, 21, 22, 25, 111, 101].map((n) => plural(n, ['рубль', 'рубля', 'рублей']))).toEqual([
      'рубль', 'рубля', 'рублей', 'рублей', 'рублей', 'рубль', 'рубля', 'рублей', 'рублей', 'рубль',
    ]);
  });
});

describe('amount in words', () => {
  it('writes an amount the way payment orders do', () => {
    expect(amount.parse('123,45')).toEqual([
      { label: 'Цифрами', value: '123,45 BYN' },
      { label: 'Прописью (копейки цифрами)', value: 'Сто двадцать три белорусских рубля 45 копеек' },
      { label: 'Прописью полностью', value: 'Сто двадцать три белорусских рубля сорок пять копеек' },
    ]);
    expect(amount.parse('1 021 000.01 BYN')?.[1].value).toBe('Один миллион двадцать одна тысяча белорусских рублей 01 копейка');
    expect(amount.parse('1,5')?.[1].value).toBe('Один белорусский рубль 50 копеек');
  });

  it('rejects three decimals, letters and amounts over a trillion', () => {
    expect(codes(amount.validate('1,234'))).toEqual(['FORMAT']);
    expect(codes(amount.validate('12a'))).toEqual(['FORMAT']);
    expect(codes(amount.validate('1000000000000'))).toEqual(['RANGE']);
  });
});

describe('EAN', () => {
  it('accepts Belarusian and foreign codes with the right check digit', () => {
    expect(gtinCheckDigit('481000000001')).toBe(8);
    expect(ean13.validate('4810000000018').valid).toBe(true);
    expect(ean13.parse('4810000000018')?.[0].value).toBe('481 — GS1 Беларусь');
    expect(ean13.parse('9785170000005')?.[0].value).toBe('978 — ISBN — книги');
    expect(ean8.validate('4810 0007').valid).toBe(true);
    expect(ean13.validate('4006381333931').valid).toBe(true); // GS1 textbook example
  });

  it('rejects a wrong check digit and a wrong length', () => {
    expect(ean13.validate('4810000000017').errors).toEqual([{ code: 'CHECK_DIGIT', message: 'Контрольная цифра 7, ожидается 8', position: 13 }]);
    expect(codes(ean13.validate('48100000000'))).toEqual(['LENGTH']);
  });
});

describe('customs declaration number', () => {
  it('accepts the official Belarusian example and reads it', () => {
    expect(customsDeclaration.validate('06532 / 220211 / 0001122')).toEqual({
      valid: true,
      normalized: '06532/220211/0001122',
      errors: [],
      warnings: [],
    });
    expect(customsDeclaration.parse('06532/220211/0001122')).toEqual([
      { label: 'Таможня', value: '06 — Минская региональная таможня' },
      { label: 'Таможенный орган', value: '06532 — таможенный пост (код ЕАЭС 11206532)' },
      { label: 'Дата регистрации', value: '22.02.2011' },
      { label: 'Порядковый номер за год', value: '0001122' },
    ]);
  });

  it('rejects the Russian 8-digit office code, a wrong date and serial 0', () => {
    expect(codes(customsDeclaration.validate('10226010/220211/0003344'))).toEqual(['FORMAT']);
    expect(codes(customsDeclaration.validate('06532/310211/0001122'))).toEqual(['DATE']);
    expect(codes(customsDeclaration.validate('06532/220211/0000000'))).toEqual(['SERIAL']);
    expect(customsDeclaration.validate('50208/220211/0002233').warnings.map((w) => w.code)).toEqual(['UNKNOWN_OFFICE']);
  });
});

describe('requisites before 2017', () => {
  it('maps every old bank code to a bank of the BIC directory', () => {
    for (const [bank, code] of Object.entries(OLD_BANK_CODES)) {
      expect(oldBankCode.validate(code)).toMatchObject({ valid: true, warnings: [] });
      expect(bic.validate(oldBankCode.parse(code)![2].value)).toMatchObject({ valid: true, warnings: [] });
      expect(oldBankCode.parse(code)![2].value.slice(0, 4)).toBe(bank);
    }
    expect(oldBankCode.parse('153001795')?.[1].value).toBe('ОАО «АСБ Беларусбанк»');
  });

  it('warns about an unknown code and rejects a non-Belarusian one', () => {
    expect(oldBankCode.validate('153001999').warnings.map((w) => w.code)).toEqual(['UNKNOWN_BANK']);
    expect(codes(oldBankCode.validate('044525225'))).toEqual(['FORMAT']);
  });

  it('reads a 13-digit account without checking the key', () => {
    expect(oldAccount.validate('3012 00000077 1')).toMatchObject({ valid: true, warnings: [] });
    expect(oldAccount.parse('3602911010004')?.[0].value).toBe('3602 — нет в списке распространённых');
    expect(oldAccount.validate('3602911010004').warnings.map((w) => w.code)).toEqual(['BALANCE']);
    expect(codes(oldAccount.validate('301200000077'))).toEqual(['LENGTH']);
  });
});

describe('inventory number', () => {
  it.each(['500/C-66910', '500/D-798825872', '340/C-291104', '500 / d - 798825872'])('accepts %s', (input) => {
    expect(inventoryNumber.validate(input).valid).toBe(true);
  });

  it('warns about a Cyrillic kind letter and rejects an unknown kind', () => {
    const r = inventoryNumber.validate('500/С-66910');
    expect(r).toMatchObject({ valid: true, normalized: '500/C-66910' });
    expect(r.warnings.map((w) => w.code)).toEqual(['CYRILLIC']);
    expect(codes(inventoryNumber.validate('500/X-66910'))).toEqual(['KIND']);
    expect(codes(inventoryNumber.validate('500-C-66910'))).toEqual(['FORMAT']);
  });
});

describe('address', () => {
  it('keeps the postal code in the city range and region', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const a = randomAddress(mulberry32(seed));
      expect(postalCode.validate(a.postalCode)).toMatchObject({ valid: true, warnings: [] });
      expect(postalCode.parse(a.postalCode)![0].value).toContain(a.region);
      const city = CITIES[a.region].find((c) => c.name === a.city)!;
      expect(Number(a.postalCode) - city.code).toBeGreaterThanOrEqual(0);
      expect(Number(a.postalCode) - city.code).toBeLessThan(city.spread);
      expect(a.full.startsWith(`${a.postalCode}, ${a.city}`)).toBe(true);
    }
  });

  it('honours the chosen region', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 20; i++) expect(ADDRESS_SET.generate(rng, { region: 'Гродненская область' }).region).toBe('Гродненская область');
  });
});

describe('test organisation', () => {
  const orgs = Array.from({ length: 200 }, (_, i) => generateOrganization(mulberry32(i + 1)));

  it('fills every field with values the sections accept', () => {
    for (const o of orgs) {
      expect(Object.keys(o).sort()).toEqual(ORGANIZATION_SET.fields.map((f) => f.key).sort());
      const unp = o.name.startsWith('ИП') ? unpIndividual : unpOrganization;
      expect(unp.validate(o.unp).valid).toBe(true);
      expect(okpo12.validate(o.okpo).valid).toBe(true);
      expect(ibanBy.validate(o.iban)).toMatchObject({ valid: true, warnings: [] });
      expect(bic.validate(o.bic)).toMatchObject({ valid: true, warnings: [] });
      expect(phoneLandline.validate(o.phone).valid).toBe(true);
      expect(email.validate(o.email).valid).toBe(true);
    }
  });

  it('keeps the region, the bank and the kind of account consistent', () => {
    for (const o of orgs) {
      const unp = o.name.startsWith('ИП') ? unpIndividual : unpOrganization;
      expect(unp.parse(o.unp)!.find((r) => r.label.startsWith('Область'))?.value).toContain(o.region);
      expect(okpo12.parse(o.okpo)![2].value).toContain(o.region);
      expect(postalCode.parse(o.postalCode)![0].value).toContain(o.region);
      expect(o.iban.slice(4, 8)).toBe(o.bic.slice(0, 4));
      expect(o.iban.slice(8, 12)).toBe(o.name.startsWith('ИП') ? '3013' : '3012');
    }
  });

  it('makes a sole proprietor when asked', () => {
    const o = ORGANIZATION_SET.generate(mulberry32(1), { kind: 'ip' });
    expect(o.name).toMatch(/^ИП [А-ЯЁ][а-яё]+ [А-ЯЁ]\. [А-ЯЁ]\.$/);
    expect(unpIndividual.validate(o.unp).valid).toBe(true);
  });
});

describe('check a list', () => {
  it('checks every non-empty line and names the first problem', () => {
    const rows = checkLines('4810000000018\n\n4810000000017\n  48100 \n', ean13);
    expect(rows.map((r) => [r.line, r.status])).toEqual([
      [1, 'ok'],
      [3, 'error'],
      [4, 'error'],
    ]);
    expect(rows[1].message).toBe('Позиция 13: Контрольная цифра 7, ожидается 8');
    expect(bulkCsv(rows).split('\r\n')[2]).toBe('"3";"4810000000017";"невалиден";"Позиция 13: Контрольная цифра 7, ожидается 8"');
  });
});
