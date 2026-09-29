import { normalize } from '../core/normalize';
import type { Issue } from '../core/types';

/** Digits of a code typed with spaces or hyphens; any other character is an error at its position. */
export function digitsOf(input: string, prefix?: RegExp): { value: string; errors: Issue[] } {
  const n = normalize(prefix ? input.replace(prefix, '') : input);
  const errors: Issue[] = [...n.errors];
  [...n.value].forEach((ch, i) => {
    if (!/\d/.test(ch) && !errors.some((e) => e.position === i + 1)) {
      errors.push({ code: 'STRUCTURE', message: 'Ожидается цифра', position: i + 1 });
    }
  });
  if (errors.length === 0 && n.value.length === 0) errors.push({ code: 'EMPTY', message: 'Код не содержит ни одной цифры' });
  return { value: n.value, errors };
}

/** Length error in the common wording, or null. */
export function lengthIssue(value: string, expected: number): Issue | null {
  return value.length === expected ? null : { code: 'LENGTH', message: `Длина ${value.length}, ожидается ${expected} цифр` };
}
