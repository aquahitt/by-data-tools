import { describe, expect, it } from 'vitest';
import { cadastral } from '../src/formats/cadastral';
import { oked } from '../src/formats/oked';
import { okpo12, okpo8, okpoCheckDigit } from '../src/formats/okpo';
import { postalCode } from '../src/formats/postal';
import { soato } from '../src/formats/soato';

const codes = (r: { errors: { code: string }[] }) => r.errors.map((e) => e.code);

describe('postal code', () => {
  it.each([
    ['220030', 'г. Минск'],
    ['223710', 'Минская область'],
    ['224000', 'Брестская область'],
    ['246000', 'Гомельская область'],
  ])('reads the region of %s', (input, region) => {
    expect(postalCode.validate(input)).toEqual({ valid: true, normalized: input, errors: [], warnings: [] });
    expect(postalCode.parse(input)?.[0].value).toBe(`${input.slice(0, 3)} — ${region}`);
  });

  it('warns about an unassigned block and rejects codes of other countries', () => {
    expect(postalCode.validate('221000').warnings.map((w) => w.code)).toEqual(['UNKNOWN_PREFIX']);
    expect(codes(postalCode.validate('101000'))).toEqual(['COUNTRY']);
    expect(codes(postalCode.validate('22003'))).toEqual(['LENGTH']);
  });
});

describe('SOATO', () => {
  it.each([
    ['5000000000', 'г. Минск'],
    ['6000000000', 'область'],
    ['1401000000', 'город областного подчинения'],
    ['2240000000', 'район'],
    ['3208501000', 'город районного подчинения или посёлок'],
    ['6250813000', 'сельсовет'],
    ['6250813001', 'населённый пункт'],
  ])('reads %s as %s', (input, level) => {
    expect(soato.validate(input)).toEqual({ valid: true, normalized: input, errors: [], warnings: [] });
    expect(soato.parse(input)?.[0].value).toBe(level);
  });

  it('rejects an unknown oblast and warns about a broken hierarchy', () => {
    expect(codes(soato.validate('8000000000'))).toEqual(['REGION']);
    expect(soato.validate('6000813001').warnings.map((w) => w.code)).toEqual(['HIERARCHY']);
  });
});

describe('cadastral number', () => {
  it('splits into СОАТО, block and plot', () => {
    expect(cadastral.validate('625081300101000123').valid).toBe(true);
    const rows = cadastral.parse('625081300101000123')!;
    expect(rows[0].value).toBe('6250813001');
    expect(rows.slice(-2).map((r) => r.value)).toEqual(['01', '000123']);
  });

  it('rejects block 00, plot 000000 and a wrong length', () => {
    expect(codes(cadastral.validate('625081300100000123'))).toEqual(['BLOCK']);
    expect(codes(cadastral.validate('625081300101000000'))).toEqual(['PLOT']);
    expect(codes(cadastral.validate('6250813001010001'))).toEqual(['LENGTH']);
  });
});

describe('ОКПО', () => {
  // Real codes from published requisites of state bodies and universities.
  it.each(['02071814', '02148014', '29293371', '00493801', '37454753', '28659864', '02232192'])('accepts %s', (input) => {
    expect(okpo8.validate(input).valid).toBe(true);
  });

  it.each(['034949945000', '020717253000', '034948992000'])('accepts the 12-digit form %s', (input) => {
    expect(okpo12.validate(input).valid).toBe(true);
  });

  it('uses weights 3…9 when weights 1…7 give 10, and 0 when both do', () => {
    expect(okpoCheckDigit('0000009')).toBe(8); // 9·7 = 63, mod 11 = 8
    expect(okpoCheckDigit('0000200')).toBe(3); // 2·5 = 10 → 2·7 = 14, mod 11 = 3
    expect(okpoCheckDigit('0000281')).toBe(0); // 10 with both weight sets
  });

  it('rejects a wrong check digit and an unknown oblast digit', () => {
    expect(okpo8.validate('02071815').errors).toEqual([{ code: 'CHECK_DIGIT', message: 'Контрольная цифра 5, ожидается 4', position: 8 }]);
    expect(codes(okpo12.validate('020718149000'))).toEqual(['REGION']);
  });
});

describe('ОКЭД', () => {
  it.each([
    ['62010', 'J — Информация и связь'],
    ['01300', 'A — Сельское, лесное и рыбное хозяйство'],
    ['99000', 'U — Деятельность экстерриториальных организаций и органов'],
  ])('reads the section of %s', (input, section) => {
    expect(oked.validate(input).valid).toBe(true);
    expect(oked.parse(input)?.[0].value).toBe(section);
  });

  it.each(['04000', '34000', '40000', '00000'])('rejects division %s that does not exist', (input) => {
    expect(codes(oked.validate(input))).toEqual(['DIVISION']);
  });
});
