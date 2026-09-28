import { describe, expect, it } from 'vitest';
import { modern } from '../src/formats/modern';
import { mulberry32 } from '../src/core/random';

const codes = (input: string) => modern.validate(input).errors.map((e) => e.code);

describe('modern.validate', () => {
  it.each(['7000000A000PB1', '7123456A789PB6', '7654321A042PB4'])('accepts %s', (n) => {
    expect(modern.validate(n)).toEqual({ valid: true, normalized: n, errors: [], warnings: [] });
  });

  it('accepts a Cyrillic-typed number with a warning', () => {
    const r = modern.validate('7000000А000РВ1');
    expect(r.valid).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(['CYRILLIC_REPLACED']);
  });

  it('rejects a first digit other than 7', () => {
    expect(codes('6000000A000PB1')).toContain('FIRST_DIGIT');
  });

  it('rejects group 2 other than A', () => {
    const r = modern.validate('7000000B000PB1');
    expect(r.errors.find((e) => e.code === 'GROUP2')?.position).toBe(8);
  });

  it('rejects a signature other than PB', () => {
    const r = modern.validate('7000000A000BA1');
    expect(r.errors.find((e) => e.code === 'SIGNATURE')?.position).toBe(12);
  });

  it('rejects a wrong check digit and names the expected one', () => {
    const r = modern.validate('7000000A000PB2');
    const e = r.errors.find((x) => x.code === 'CHECK_DIGIT');
    expect(e?.position).toBe(14);
    expect(e?.message).toBe('Контрольная цифра 2, ожидается 1');
  });

  it('stops at structural errors', () => {
    expect(codes('7000000A000PB')).toEqual(['LENGTH']);
    expect(codes('7000000Ж000PB1')).toEqual(['INVALID_CHAR']);
  });
});

describe('modern.parse', () => {
  it('splits into the five groups', () => {
    expect(modern.parse('7123456A789PB6')).toEqual([
      { label: 'Группа 1 — случайное число', value: '7123456' },
      { label: 'Группа 2 — символ', value: 'A' },
      { label: 'Группа 3 — номер последовательности', value: '789' },
      { label: 'Группа 4 — сигнатура', value: 'PB' },
      { label: 'Группа 5 — контрольная цифра', value: '6 — верная' },
    ]);
  });

  it('shows the expected check digit when it differs', () => {
    expect(modern.parse('7123456A789PB0')?.[4].value).toBe('0 — ожидается 6');
  });

  it('returns null when the structure is broken', () => {
    expect(modern.parse('7123')).toBeNull();
  });
});

describe('modern.generate', () => {
  it('builds from given fields', () => {
    expect(modern.generate({ number: '7654321', sequence: '042' }, mulberry32(1))).toEqual({
      ok: true,
      value: '7654321A042PB4',
    });
  });

  it('reports invalid fields instead of generating', () => {
    expect(modern.generate({ number: '6123456', sequence: '12' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: {
        number: 'Семь цифр, от 7000000 до 7999999',
        sequence: 'Три цифры, от 000 до 999',
      },
    });
  });

  it('fills missing fields randomly and stays valid', () => {
    const r = modern.generate({ sequence: '001' }, mulberry32(3));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.slice(8, 11)).toBe('001');
      expect(modern.validate(r.value).valid).toBe(true);
    }
  });
});
