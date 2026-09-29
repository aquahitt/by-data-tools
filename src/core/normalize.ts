import type { Issue } from './types';

// Latin letters used by the formats that have a Cyrillic twin users paste by accident.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', О: 'O', Р: 'P', Т: 'T', У: 'Y',
};

// Separators people paste from documents: whitespace (incl. BOM), hyphen-minus, soft hyphen,
// zero-width space/non-joiner/joiner, the U+2010-U+2015 dash block, word joiner, minus sign.
const NOISE = /[\s\-\u00AD\u200B-\u200D\u2010-\u2015\u2060\u2212]/g;

// Format, control and separator characters render as nothing, so quote them by code point.
const INVISIBLE = /^[\p{C}\p{Z}]$/u;

function describeChar(ch: string): string {
  if (!INVISIBLE.test(ch)) return `Недопустимый символ «${ch}»`;
  const code = ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
  return `Недопустимый невидимый символ U+${code}`;
}

export interface Normalized {
  value: string;
  errors: Issue[];
  warnings: Issue[];
}

export function normalize(input: string): Normalized {
  const replaced: number[] = [];
  const errors: Issue[] = [];
  // Uppercase per character: 'ß'.toUpperCase() is 'SS', which would shift every later position.
  const value = [...input.replace(NOISE, '')]
    .map((raw) => {
      const upper = raw.toUpperCase();
      return upper.length === 1 ? upper : raw;
    })
    .map((ch, i) => {
      const latin = CYRILLIC_TO_LATIN[ch];
      if (latin) {
        replaced.push(i + 1);
        return latin;
      }
      if (!/^[A-Z0-9]$/.test(ch)) {
        errors.push({ code: 'INVALID_CHAR', message: describeChar(ch), position: i + 1 });
      }
      return ch;
    })
    .join('');
  const warnings: Issue[] = replaced.length
    ? [{
        code: 'CYRILLIC_REPLACED',
        message: `Кириллические буквы заменены на латинские в позициях ${replaced.join(', ')}`,
      }]
    : [];
  return { value, errors, warnings };
}
