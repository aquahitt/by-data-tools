import type { Issue } from './types';

// D = digit, L = Latin letter.
export const PERSONAL_NUMBER_TEMPLATE = 'DDDDDDDLDDDLLD'; // ЦЦЦЦЦЦЦ Б ЦЦЦ ББ Ц
export const PASSPORT_NUMBER_TEMPLATE = 'LLDDDDDDD'; //       ББ ЦЦЦЦЦЦЦ

export function structureIssues(value: string, template: string): Issue[] {
  if (value.length !== template.length) {
    return [{ code: 'LENGTH', message: `Длина ${value.length}, ожидается ${template.length} символов` }];
  }
  const issues: Issue[] = [];
  for (let i = 0; i < template.length; i++) {
    const wantDigit = template[i] === 'D';
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
