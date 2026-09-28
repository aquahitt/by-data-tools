import type { Issue } from './types';

export const NUMBER_LENGTH = 14;

// D = digit, L = Latin letter: ЦЦЦЦЦЦЦ Б ЦЦЦ ББ Ц
const TEMPLATE = 'DDDDDDDLDDDLLD';

export function structureIssues(value: string): Issue[] {
  if (value.length !== NUMBER_LENGTH) {
    return [{ code: 'LENGTH', message: `Длина ${value.length}, ожидается ${NUMBER_LENGTH} символов` }];
  }
  const issues: Issue[] = [];
  for (let i = 0; i < NUMBER_LENGTH; i++) {
    const wantDigit = TEMPLATE[i] === 'D';
    const ok = wantDigit ? /^[0-9]$/.test(value[i]) : /^[A-Z]$/.test(value[i]);
    if (!ok) {
      issues.push({
        code: 'STRUCTURE',
        message: wantDigit ? 'Ожидается цифра' : 'Ожидается латинская буква',
        position: i + 1,
      });
    }
  }
  return issues;
}
