import { describe, expect, it } from 'vitest';
import { FORMAT_LIST, FORMATS, suggestOtherFormat } from '../src/formats';
import { mulberry32 } from '../src/core/random';

describe('generated numbers', () => {
  for (const format of FORMAT_LIST) {
    it(`${format.id}: 300 random numbers validate cleanly and parse back`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const r = format.generate({}, mulberry32(seed));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(format.validate(r.value)).toEqual({ valid: true, normalized: r.value, errors: [], warnings: [] });
        expect(format.parse(r.value)).not.toBeNull();
      }
    });
  }

  it('a number of one format never validates in the other', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const m = FORMATS.modern.generate({}, mulberry32(seed));
      const l = FORMATS.legacy.generate({}, mulberry32(seed));
      if (m.ok) expect(FORMATS.legacy.validate(m.value).valid).toBe(false);
      if (l.ok) expect(FORMATS.modern.validate(l.value).valid).toBe(false);
    }
  });
});

describe('suggestOtherFormat', () => {
  it('suggests legacy for a legacy number checked as modern', () => {
    expect(suggestOtherFormat('3271182A001PB1', 'modern')?.id).toBe('legacy');
  });

  it('suggests modern for a modern number checked as legacy', () => {
    expect(suggestOtherFormat('7000000A000PB1', 'legacy')?.id).toBe('modern');
  });

  it('suggests nothing when the current format accepts the number', () => {
    expect(suggestOtherFormat('7000000A000PB1', 'modern')).toBeNull();
  });

  it('suggests nothing when no format accepts it', () => {
    expect(suggestOtherFormat('garbage', 'modern')).toBeNull();
  });
});
