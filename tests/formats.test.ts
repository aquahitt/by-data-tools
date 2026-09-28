import { describe, expect, it } from 'vitest';
import { PASSPORT_FORMATS, PERSONAL_NUMBER_FORMATS, suggestOtherFormat } from '../src/formats';
import { mulberry32 } from '../src/core/random';

const ALL = [...PERSONAL_NUMBER_FORMATS, ...PASSPORT_FORMATS];

describe('generated numbers', () => {
  for (const format of ALL) {
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

  it('personal-number formats never accept each other', () => {
    const [modern, legacy] = PERSONAL_NUMBER_FORMATS;
    for (let seed = 1; seed <= 100; seed++) {
      const m = modern.generate({}, mulberry32(seed));
      const l = legacy.generate({}, mulberry32(seed));
      if (m.ok) expect(legacy.validate(m.value).valid).toBe(false);
      if (l.ok) expect(modern.validate(l.value).valid).toBe(false);
    }
  });
});

describe('suggestOtherFormat', () => {
  it('suggests legacy for a legacy number checked as modern', () => {
    expect(suggestOtherFormat('3271182A001PB1', 'modern', PERSONAL_NUMBER_FORMATS)?.id).toBe('legacy');
  });

  it('suggests modern for a modern number checked as legacy', () => {
    expect(suggestOtherFormat('7000000A000PB1', 'legacy', PERSONAL_NUMBER_FORMATS)?.id).toBe('modern');
  });

  it('suggests nothing when the current format accepts the number', () => {
    expect(suggestOtherFormat('7000000A000PB1', 'modern', PERSONAL_NUMBER_FORMATS)).toBeNull();
  });

  it('suggests nothing when no format accepts it', () => {
    expect(suggestOtherFormat('garbage', 'modern', PERSONAL_NUMBER_FORMATS)).toBeNull();
  });

  it('never suggests a format from another section', () => {
    expect(suggestOtherFormat('MP1234567', 'modern', PERSONAL_NUMBER_FORMATS)).toBeNull();
  });

  it('suggests nothing for an unknown current format', () => {
    expect(suggestOtherFormat('7000000A000PB1', 'nope', PERSONAL_NUMBER_FORMATS)).toBeNull();
  });
});
