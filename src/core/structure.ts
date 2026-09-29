import type { Issue } from './types';

// D = digit, L = Latin letter, C = either.
export const PERSONAL_NUMBER_TEMPLATE = 'DDDDDDDLDDDLLD'; // ЦЦЦЦЦЦЦ Б ЦЦЦ ББ Ц
export const PASSPORT_NUMBER_TEMPLATE = 'LLDDDDDDD'; //       ББ ЦЦЦЦЦЦЦ
export const UNP_ORGANIZATION_TEMPLATE = 'DDDDDDDDD'; //  ЦЦЦЦЦЦЦЦ К
export const UNP_INDIVIDUAL_TEMPLATE = 'LLDDDDDDD'; //    ББ ЦЦЦЦЦЦ К
export const IBAN_TEMPLATE = 'LLDDCCCCDDDDCCCCCCCCCCCCCCCC'; // BY KK банк балансовый счёт номер

export function structureIssues(value: string, template: string): Issue[] {
  if (value.length === 0) return [{ code: 'EMPTY', message: 'Номер не содержит ни одной буквы или цифры' }];
  if (value.length !== template.length) {
    return [{ code: 'LENGTH', message: `Длина ${value.length}, ожидается ${template.length} символов` }];
  }
  const issues: Issue[] = [];
  for (let i = 0; i < template.length; i++) {
    const kind = template[i];
    const ok = (kind === 'D' ? /^[0-9]$/ : kind === 'L' ? /^[A-Z]$/ : /^[A-Z0-9]$/).test(value[i]);
    if (!ok) {
      issues.push({
        code: 'STRUCTURE',
        message: kind === 'D' ? 'Ожидается цифра' : kind === 'L' ? 'Ожидается латинская буква' : 'Ожидается латинская буква или цифра',
        position: i + 1,
      });
    }
  }
  return issues;
}
