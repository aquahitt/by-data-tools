import { describe, expect, it } from 'vitest';
import {
  IBAN_FORMATS,
  PASSPORT_FORMATS,
  PERSONAL_NUMBER_FORMATS,
  PHONE_FORMATS,
  suggestOtherFormat,
  UNP_FORMATS,
} from '../src/formats';
import { mulberry32 } from '../src/core/random';
import { TOOLS } from '../src/tools';

// Every format of every section.
const ALL = TOOLS.flatMap((t) => t.formats.map((f) => ({ ...f, id: `${t.id}/${f.id}` })));

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

  it('suggests the individual UNP format for an individual number checked as organization', () => {
    expect(suggestOtherFormat('MA1953684', 'organization', UNP_FORMATS)?.id).toBe('individual');
    expect(suggestOtherFormat('200988541', 'individual', UNP_FORMATS)?.id).toBe('organization');
  });

  it('suggests the landline format for a Minsk number checked as mobile', () => {
    expect(suggestOtherFormat('+375 17 234-56-78', 'mobile', PHONE_FORMATS)?.id).toBe('landline');
    expect(suggestOtherFormat('+375 29 123-45-67', 'landline', PHONE_FORMATS)?.id).toBe('mobile');
  });
});

describe('suggestOtherFormat by shape', () => {
  it('points to the individual format when only its shape fits, even with a wrong check digit', () => {
    expect(suggestOtherFormat('MA1953681', 'organization', UNP_FORMATS)?.id).toBe('individual');
  });

  it('does not point anywhere when the current format already fits the shape', () => {
    expect(suggestOtherFormat('200988542', 'organization', UNP_FORMATS)).toBeNull();
  });

  it('does not point to a format that rejects the number for more than its check digit', () => {
    // Organization shape, but region 9 does not exist.
    expect(suggestOtherFormat('900000000', 'individual', UNP_FORMATS)).toBeNull();
    // Organization shape with a known region and a wrong check digit: a typo, worth the hint.
    expect(suggestOtherFormat('200988542', 'individual', UNP_FORMATS)?.id).toBe('organization');
  });
});
