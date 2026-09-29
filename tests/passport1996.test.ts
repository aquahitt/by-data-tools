import { describe, expect, it } from 'vitest';
import { passport1996 } from '../src/formats/passport1996';
import { mulberry32 } from '../src/core/random';

describe('passport1996.validate', () => {
  it.each(['MP1234567', 'AB0000000', 'DP1234567'])('accepts %s', (n) => {
    expect(passport1996.validate(n)).toEqual({ valid: true, normalized: n, errors: [], warnings: [] });
  });

  it('accepts Cyrillic series with separators, with a warning', () => {
    const r = passport1996.validate('МР 123-45-67');
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe('MP1234567');
    expect(r.warnings.map((w) => w.code)).toEqual(['CYRILLIC_REPLACED']);
  });

  it('keeps an unknown series valid with a warning at position 1', () => {
    const r = passport1996.validate('XX1234567');
    expect(r.valid).toBe(true);
    expect(r.warnings).toEqual([
      { code: 'UNKNOWN_SERIES', message: 'Серия «XX» не из известного списка серий паспорта образца 1996 г.', position: 1 },
    ]);
  });

  it('rejects wrong length and structure', () => {
    expect(passport1996.validate('MP123456').errors.map((e) => e.code)).toEqual(['LENGTH']);
    expect(passport1996.validate('M11234567').errors).toEqual([
      { code: 'STRUCTURE', message: 'Ожидается латинская буква', position: 2 },
    ]);
  });
});

describe('passport1996.parse', () => {
  it('decodes series, number and MRZ check digit', () => {
    expect(passport1996.parse('MP1234567')).toEqual([
      { label: 'Серия', value: 'MP — г. Минск' },
      { label: 'Номер', value: '1234567' },
      { label: 'Номер документа в MRZ (с контрольной цифрой)', value: 'MP12345677' },
    ]);
  });

  it('marks an unknown series', () => {
    expect(passport1996.parse('XX1234567')?.[0].value).toBe('XX — неизвестная серия');
  });

  it('returns null when the structure is broken', () => {
    expect(passport1996.parse('MP12')).toBeNull();
  });
});

describe('passport1996.generate', () => {
  it('builds from given fields and reports the MRZ fragment', () => {
    expect(passport1996.generate({ series: 'HB', number: '7654321' }, mulberry32(1))).toEqual({
      ok: true,
      value: 'HB7654321',
      hint: 'Номер документа в MRZ: HB76543218',
    });
  });

  it('reports invalid fields', () => {
    expect(passport1996.generate({ series: 'XX', number: '12' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { series: 'Выберите серию из списка', number: 'Семь цифр, от 0000000 до 9999999' },
    });
  });
});

describe('Cyrillic О and Т in other formats', () => {
  it('turns a Cyrillic ОТ series into Latin OT: unknown series, not an invalid character', () => {
    const r = passport1996.validate('ОТ1234567');
    expect(r.valid).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(['CYRILLIC_REPLACED', 'UNKNOWN_SERIES']);
  });
});

describe('passport number field', () => {
  it('accepts spaces and dashes in the generator, like the validator does', () => {
    const r = passport1996.generate({ series: 'MP', number: '123-45 67' }, mulberry32(1));
    expect(r.ok && r.value).toBe('MP1234567');
  });
});
