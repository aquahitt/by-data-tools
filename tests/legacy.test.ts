import { afterEach, describe, expect, it, vi } from 'vitest';
import { legacy } from '../src/formats/legacy';
import { checkDigit731 } from '../src/core/checkDigit';
import { mulberry32 } from '../src/core/random';

const withCheck = (body: string) => `${body}${checkDigit731(body)}`;
const codes = (input: string) => legacy.validate(input).errors.map((e) => e.code);

describe('legacy.validate', () => {
  it('accepts a number whose check digit matches 7-3-1', () => {
    expect(legacy.validate('3271182A001PB1')).toEqual({
      valid: true,
      normalized: '3271182A001PB1',
      errors: [],
      warnings: [],
    });
  });

  it('keeps a 7-3-1 mismatch as a warning, not an error', () => {
    const r = legacy.validate('3271182A001PB5');
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toEqual(['CHECK_DIGIT_UNCONFIRMED']);
    expect(r.warnings[0].message).toContain('ожидается 1');
  });

  it.each(['0', '7', '9'])('rejects first digit %s', (d) => {
    expect(codes(withCheck(`${d}271182A001PB`))).toContain('FIRST_DIGIT');
  });

  it.each([
    ['3290200A001PB', false], // 29.02.1900: not leap
    ['4290204A001PB', true], //  29.02.1904: leap
    ['5290200A001PB', true], //  29.02.2000: leap
    ['1290200A001PB', false], // 29.02.1800: not leap
    ['3310485A001PB', false], // 31.04.1985
    ['3001385A001PB', false], // month 13
  ])('date check for %s -> valid=%s', (body, ok) => {
    expect(codes(withCheck(body)).includes('DATE')).toBe(!ok);
  });

  it('rejects a birth date in the future', () => {
    expect(codes(withCheck('5010199A001PB'))).toContain('FUTURE_DATE');
  });

  it('rejects an unknown region at position 8', () => {
    const r = legacy.validate(withCheck('3271182D001PB'));
    expect(r.errors.find((e) => e.code === 'REGION')?.position).toBe(8);
  });

  it('rejects an unknown status at position 12', () => {
    const r = legacy.validate(withCheck('3271182A001XX'));
    expect(r.errors.find((e) => e.code === 'STATUS')?.position).toBe(12);
  });
});

describe('legacy.parse', () => {
  it('decodes every field', () => {
    expect(legacy.parse('4140385H007BI6')).toEqual([
      { label: 'Пол', value: 'женский' },
      { label: 'Век рождения', value: 'XX' },
      { label: 'Дата рождения', value: '14.03.1985' },
      { label: 'Регион', value: 'H — Гомельская область' },
      { label: 'Порядковый номер', value: '007' },
      { label: 'Статус', value: 'BI — иностранный гражданин' },
      { label: 'Контрольная цифра', value: '6 — совпадает с 7-3-1' },
    ]);
  });

  it('marks unknown codes instead of failing', () => {
    const fields = legacy.parse('9271182D001XX0');
    expect(fields?.[0].value).toBe('неизвестно (цифра 9)');
    expect(fields?.[3].value).toBe('D — неизвестный код');
    expect(fields?.[5].value).toBe('XX — неизвестный код');
  });

  it('returns null when the structure is broken', () => {
    expect(legacy.parse('3271182')).toBeNull();
  });
});

describe('legacy.generate', () => {
  it('builds from given fields', () => {
    expect(
      legacy.generate(
        { gender: 'F', birthDate: '14.03.1985', region: 'H', sequence: '007', status: 'BI' },
        mulberry32(1),
      ),
    ).toEqual({ ok: true, value: '4140385H007BI6' });
  });

  it('encodes century and gender in digit 1', () => {
    const r = legacy.generate({ gender: 'M', birthDate: '01.01.2005' }, mulberry32(2));
    expect(r.ok && r.value[0]).toBe('5');
  });

  it.each([
    ['31.02.1985', 'Дата в формате ДД.ММ.ГГГГ, должна существовать'],
    ['1985-02-01', 'Дата в формате ДД.ММ.ГГГГ, должна существовать'],
    ['01.01.1799', 'Год от 1800 до 2099'],
    ['01.01.2099', 'Дата рождения не может быть в будущем'],
  ])('rejects birth date %s', (birthDate, message) => {
    expect(legacy.generate({ birthDate }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { birthDate: message },
    });
  });

  it('rejects an unknown region', () => {
    const r = legacy.generate({ region: 'D' }, mulberry32(1));
    expect(r).toEqual({ ok: false, fieldErrors: { region: 'Выберите регион из списка' } });
  });
});

// Minsk is UTC+3: between 00:00 and 03:00 local time the UTC date is still yesterday.
describe('today in local time', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    vi.useRealTimers();
    process.env.TZ = originalTz;
  });

  it('accepts today as a birth date right after local midnight', () => {
    process.env.TZ = 'Europe/Minsk';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T22:30:00Z')); // 29.09.2026 01:30 in Minsk
    expect(legacy.generate({ birthDate: '29.09.2026' }, mulberry32(1)).ok).toBe(true);
    expect(codes(withCheck('5290926A001PB'))).not.toContain('FUTURE_DATE');
  });

  it('still rejects tomorrow in local time', () => {
    process.env.TZ = 'Europe/Minsk';
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T22:30:00Z'));
    expect(codes(withCheck('5300926A001PB'))).toContain('FUTURE_DATE');
  });
});
