import { describe, expect, it } from 'vitest';
import { charValue, checkDigit731, icaoCheckDigit } from '../src/core/checkDigit';

describe('checkDigit731', () => {
  // Hand-computed vectors (spec, "Контрольная цифра").
  it.each([
    ['7000000A000PB', 1],
    ['7123456A789PB', 6],
    ['7654321A042PB', 4],
    ['4140385H007BI', 6],
    ['3271182A001PB', 1],
  ])('%s -> %i', (body, expected) => {
    expect(checkDigit731(body)).toBe(expected);
  });

  it('maps digits to themselves and A..Z to 10..35', () => {
    expect(charValue('0')).toBe(0);
    expect(charValue('9')).toBe(9);
    expect(charValue('A')).toBe(10);
    expect(charValue('P')).toBe(25);
    expect(charValue('Z')).toBe(35);
  });

  it('rejects a body that is not 13 characters', () => {
    expect(() => checkDigit731('123')).toThrow(RangeError);
  });

  it('rejects characters outside [0-9A-Z]', () => {
    expect(() => charValue('а')).toThrow(RangeError);
    expect(() => charValue('a')).toThrow(RangeError);
  });
});

describe('icaoCheckDigit', () => {
  it.each([
    ['L898902C3', 6], // ICAO 9303 specimen passport
    ['MP1234567', 7],
    ['AB0000000', 3],
    ['DP1234567', 4],
    ['HB7654321', 8],
  ])('%s -> %i', (value, expected) => {
    expect(icaoCheckDigit(value)).toBe(expected);
  });

  it('treats the < filler as 0', () => {
    expect(charValue('<')).toBe(0);
    expect(icaoCheckDigit('L898902C<')).toBe(3);
  });
});
