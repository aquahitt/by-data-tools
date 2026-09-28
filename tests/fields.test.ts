import { describe, expect, it } from 'vitest';
import { resolveFields } from '../src/core/fields';
import { mulberry32 } from '../src/core/random';
import type { FieldSpec } from '../src/core/types';

const digit: FieldSpec = {
  key: 'd',
  label: 'Digit',
  kind: 'text',
  check: (v) => (/^\d$/.test(v) ? null : 'одна цифра'),
  random: () => '5',
};

describe('resolveFields', () => {
  it('keeps a given value (trimmed)', () => {
    expect(resolveFields([digit], { d: ' 3 ' }, mulberry32(1)).values.d).toBe('3');
  });

  it('fills an empty or missing value randomly', () => {
    expect(resolveFields([digit], { d: '' }, mulberry32(1)).values.d).toBe('5');
    expect(resolveFields([digit], {}, mulberry32(1)).values.d).toBe('5');
  });

  it('reports a given invalid value per field', () => {
    expect(resolveFields([digit], { d: 'x' }, mulberry32(1)).fieldErrors).toEqual({ d: 'одна цифра' });
  });
});
