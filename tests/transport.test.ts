import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { suggestOtherFormat } from '../src/formats';
import { PLATE_FORMATS } from '../src/formats/plate';
import { vin, vinCheckDigit } from '../src/formats/vin';

const [car, truck, trailer, electric, transit, taxi] = PLATE_FORMATS;

describe('registration plates', () => {
  it('accepts a passenger plate typed with Cyrillic letters and writes it the standard way', () => {
    expect(car.validate('1234 ав-7')).toEqual({ valid: true, normalized: '1234 AB-7', errors: [], warnings: [] });
    expect(car.validate('1234АВ7').normalized).toBe('1234 AB-7');
  });

  it('allows the Belarusian І and region 8', () => {
    expect(car.validate('0001 ІХ-8').valid).toBe(true);
    expect(car.parse('0001 IX-8')?.[3]).toEqual({ label: 'Код региона', value: '8 — г. Минск (резервный код, выдаётся с марта 2025)' });
  });

  it('rejects letters without a Latin twin and an unused region', () => {
    expect(car.validate('1234 AD-7').errors).toEqual([
      { code: 'LETTER', message: 'Буква «D» не используется: допустимы А В Е І К М Н О Р С Т Х', position: 6 },
    ]);
    expect(car.validate('1234 AB-9').errors.map((e) => e.code)).toEqual(['REGION']);
  });

  it('accepts other Cyrillic letters on region-0 plates, except Д Ё Й Ц Щ', () => {
    expect(car.validate('1234 БЖ-0').valid).toBe(true);
    expect(car.validate('1234 БЦ-0').errors.map((e) => e.code)).toEqual(['LETTER']);
    expect(car.validate('1234 БЖ-7').valid).toBe(false);
  });

  it.each([
    [truck, 'AB 1234-7'],
    [trailer, 'A 1234 B-7'],
    [electric, 'E123 AB-7'],
    [transit, '7 AB T 1234'],
    [taxi, '7 TAX 1234'],
  ])('accepts %# %s', (format, input) => {
    expect(format.validate(input)).toEqual({ valid: true, normalized: input, errors: [], warnings: [] });
  });

  it('points to the passenger format for a car plate checked as a truck plate', () => {
    expect(suggestOtherFormat('1234 AB-7', 'truck', PLATE_FORMATS)?.id).toBe('car');
    expect(suggestOtherFormat('E123 AB-7', 'car', PLATE_FORMATS)?.id).toBe('electric');
  });

  it('says what length and layout it expects', () => {
    expect(car.validate('123 AB-7').errors).toEqual([
      { code: 'FORMAT', message: 'Длина 6, ожидается 7 знаков: 1234 AB-7' },
    ]);
  });
});

describe('VIN', () => {
  it('accepts the ISO 3779 example with check digit X', () => {
    expect(vinCheckDigit('1M8GDM9AXKP042788')).toBe('X');
    expect(vin.validate('1M8GDM9AXKP042788')).toEqual({ valid: true, normalized: '1M8GDM9AXKP042788', errors: [], warnings: [] });
  });

  it('only warns about a wrong check digit (not required outside North America)', () => {
    const r = vin.validate('1M8GDM9A1KP042788');
    expect(r.valid).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(['CHECK_DIGIT']);
  });

  it('rejects I, O, Q and a wrong length', () => {
    expect(vin.validate('1M8GDM9AXKP04278O').errors).toEqual([
      { code: 'INVALID_CHAR', message: 'Буква «O» в VIN не используется (нет I, O, Q)', position: 17 },
    ]);
    expect(vin.validate('1M8GDM9AXKP04278').errors.map((e) => e.code)).toEqual(['LENGTH']);
  });

  it('decodes a Belarusian WMI and both years of the cycle', () => {
    const rows = vin.parse('Y3M5440A0T0012345');
    expect(rows?.[0].value).toBe('Y3M — МАЗ, регион: Беларусь');
    expect(rows?.[3].value).toBe('T — 1996 или 2026');
  });

  it('generates the chosen maker and model year', () => {
    const r = vin.generate({ wmi: 'Y4K', year: '2024' }, mulberry32(7));
    expect(r.ok && r.value.slice(0, 3)).toBe('Y4K');
    expect(r.ok && r.value[9]).toBe('R');
  });
});
