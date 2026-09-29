import { describe, expect, it } from 'vitest';
import { luhnCheckDigit, luhnValid } from '../src/core/luhn';

describe('Luhn', () => {
  it.each(['4111111111111111', '5467929858074128', '79927398713', '490154203237518'])('accepts %s', (n) => {
    expect(luhnValid(n)).toBe(true);
  });

  it('rejects a changed digit and computes the check digit', () => {
    expect(luhnValid('4111111111111112')).toBe(false);
    expect(luhnCheckDigit('7992739871')).toBe(3);
  });
});
