import { describe, expect, it } from 'vitest';
import { cryptoRng, mulberry32, pad, pick, randInt } from '../src/core/random';

describe('random helpers', () => {
  it('mulberry32 is deterministic per seed and in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('randInt covers both inclusive bounds', () => {
    const rng = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(randInt(rng, 0, 3));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('pick returns an element of the list', () => {
    expect(['M', 'F']).toContain(pick(mulberry32(1), ['M', 'F']));
  });

  it('pad left-pads with zeros', () => {
    expect(pad(7, 3)).toBe('007');
    expect(pad(123, 3)).toBe('123');
  });

  it('cryptoRng returns values in [0,1)', () => {
    const x = cryptoRng();
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  });
});
