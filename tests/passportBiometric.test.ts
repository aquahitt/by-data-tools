import { describe, expect, it } from 'vitest';
import { passportBiometric } from '../src/formats/passportBiometric';
import { mulberry32 } from '../src/core/random';

describe('passportBiometric.validate', () => {
  it.each(['XY1234567', 'AB0000000', 'DP1234567'])('accepts %s without warnings', (n) => {
    expect(passportBiometric.validate(n)).toEqual({ valid: true, normalized: n, errors: [], warnings: [] });
  });

  it('rejects a broken structure', () => {
    expect(passportBiometric.validate('1P1234567').errors.map((e) => e.code)).toEqual(['STRUCTURE']);
  });
});

describe('passportBiometric.parse', () => {
  it('names DP as diplomatic', () => {
    expect(passportBiometric.parse('DP1234567')).toEqual([
      { label: 'Серия', value: 'DP — дипломатический паспорт' },
      { label: 'Номер', value: '1234567' },
      { label: 'Номер документа в MRZ (с контрольной цифрой)', value: 'DP12345674' },
    ]);
  });

  it('describes other series as unpublished', () => {
    expect(passportBiometric.parse('AB0000000')?.[0].value).toBe('AB — серия бланка (официально не опубликована)');
    expect(passportBiometric.parse('AB0000000')?.[2].value).toBe('AB00000003');
  });
});

describe('passportBiometric.generate', () => {
  it('accepts a Cyrillic series typed into the field', () => {
    expect(passportBiometric.generate({ series: 'мр', number: '1234567' }, mulberry32(1))).toEqual({
      ok: true,
      value: 'MP1234567',
      hint: 'Номер документа в MRZ: MP12345677',
    });
  });

  it('rejects a series that is not two letters', () => {
    expect(passportBiometric.generate({ series: 'M1' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { series: 'Две латинские буквы' },
    });
  });

  it('draws two random letters when the series is empty', () => {
    const r = passportBiometric.generate({ number: '0000001' }, mulberry32(9));
    expect(r.ok && /^[A-Z]{2}0000001$/.test(r.value)).toBe(true);
  });
});
