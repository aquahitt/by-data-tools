import { describe, expect, it } from 'vitest';
import { IBAN_TEMPLATE, PASSPORT_NUMBER_TEMPLATE, PERSONAL_NUMBER_TEMPLATE, structureIssues } from '../src/core/structure';

describe('structureIssues — personal number', () => {
  it('accepts the 7-digit, letter, 3-digit, 2-letter, digit template', () => {
    expect(structureIssues('7000000A000PB1', PERSONAL_NUMBER_TEMPLATE)).toEqual([]);
  });

  it('reports wrong length only', () => {
    expect(structureIssues('7000000A000PB', PERSONAL_NUMBER_TEMPLATE)).toEqual([
      { code: 'LENGTH', message: 'Длина 13, ожидается 14 символов' },
    ]);
  });

  it('reports each misplaced character with its position', () => {
    expect(structureIssues('70000A0A000P11', PERSONAL_NUMBER_TEMPLATE)).toEqual([
      { code: 'STRUCTURE', message: 'Ожидается цифра', position: 6 },
      { code: 'STRUCTURE', message: 'Ожидается латинская буква', position: 13 },
    ]);
  });
});

describe('structureIssues — passport number', () => {
  it('accepts two letters and seven digits', () => {
    expect(structureIssues('MP1234567', PASSPORT_NUMBER_TEMPLATE)).toEqual([]);
  });

  it('reports wrong length', () => {
    expect(structureIssues('MP123456', PASSPORT_NUMBER_TEMPLATE)).toEqual([
      { code: 'LENGTH', message: 'Длина 8, ожидается 9 символов' },
    ]);
  });

  it('reports a digit in the series', () => {
    expect(structureIssues('M11234567', PASSPORT_NUMBER_TEMPLATE)).toEqual([
      { code: 'STRUCTURE', message: 'Ожидается латинская буква', position: 2 },
    ]);
  });
});

describe('structureIssues — IBAN', () => {
  it('accepts letters or digits in C positions', () => {
    expect(structureIssues('BY30NBRB32000079500190000000', IBAN_TEMPLATE)).toEqual([]);
    expect(structureIssues('BY30NBRB3200ABCDEFGHIJKLMNOP', IBAN_TEMPLATE)).toEqual([]);
  });

  it('reports a letter in the check digits and in the balance account', () => {
    expect(structureIssues('BY3XNBRB32A00079500190000000', IBAN_TEMPLATE)).toEqual([
      { code: 'STRUCTURE', message: 'Ожидается цифра', position: 4 },
      { code: 'STRUCTURE', message: 'Ожидается цифра', position: 11 },
    ]);
  });
});
