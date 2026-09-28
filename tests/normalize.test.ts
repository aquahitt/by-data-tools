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
});
