import { describe, expect, it } from 'vitest';
import { normalize } from '../src/core/normalize';

describe('normalize', () => {
  it('strips whitespace and every dash kind, uppercases', () => {
    const r = normalize(' 7000000-a000 pb\u20111\t');
    expect(r.value).toBe('7000000A000PB1');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('strips en and em dashes', () => {
    expect(normalize('7000000\u2013A000\u2014PB1').value).toBe('7000000A000PB1');
  });

  it('replaces Cyrillic lookalikes and reports their positions', () => {
    const r = normalize('7000000А000РВ1');
    expect(r.value).toBe('7000000A000PB1');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].code).toBe('CYRILLIC_REPLACED');
    expect(r.warnings[0].message).toContain('8, 12, 13');
  });

  it('replaces lowercase Cyrillic lookalikes too', () => {
    expect(normalize('7000000а000рв1').value).toBe('7000000A000PB1');
  });

  it('reports a non-lookalike character with its position', () => {
    const r = normalize('7000000Ж000PB1');
    expect(r.errors).toEqual([
      { code: 'INVALID_CHAR', message: 'Недопустимый символ «Ж»', position: 8 },
    ]);
  });

  it.each([
    ['soft hyphen', '\u00AD'],
    ['zero-width space', '\u200B'],
    ['zero-width joiner', '\u200D'],
    ['word joiner', '\u2060'],
    ['BOM', '\uFEFF'],
    ['minus sign', '\u2212'],
    ['figure dash', '\u2012'],
  ])('strips %s pasted from documents', (_name, ch) => {
    const r = normalize(`\uFEFF7000000${ch}A000${ch}PB1`);
    expect(r.value).toBe('7000000A000PB1');
    expect(r.errors).toEqual([]);
  });

  it('names an invisible rejected character by its code point', () => {
    const r = normalize('7000000\u2063A000PB1');
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toBe('Недопустимый невидимый символ U+2063');
    expect(r.errors[0].position).toBe(8);
  });

  it('replaces Cyrillic О and Т used in the second sign of an individual UNP', () => {
    const r = normalize('МО1953684');
    expect(r.value).toBe('MO1953684');
    expect(normalize('МТ0000001').value).toBe('MT0000001');
  });
});
