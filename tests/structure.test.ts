import { describe, expect, it } from 'vitest';
import { structureIssues } from '../src/core/structure';

describe('structureIssues', () => {
  it('accepts the 7-digit, letter, 3-digit, 2-letter, digit template', () => {
    expect(structureIssues('7000000A000PB1')).toEqual([]);
  });

  it('reports wrong length only', () => {
    expect(structureIssues('7000000A000PB')).toEqual([
      { code: 'LENGTH', message: 'Длина 13, ожидается 14 символов' },
    ]);
  });

  it('reports each misplaced character with its position', () => {
    expect(structureIssues('70000A0A000P11')).toEqual([
      { code: 'STRUCTURE', message: 'Ожидается цифра', position: 6 },
      { code: 'STRUCTURE', message: 'Ожидается латинская буква', position: 13 },
    ]);
  });
});
