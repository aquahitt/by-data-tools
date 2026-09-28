import type { Issue } from './types';

// Every Latin letter the two formats use has a Cyrillic twin that users paste by accident.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', Р: 'P',
};

// Whitespace, hyphen-minus, hyphen, non-breaking hyphen, en dash, em dash.
const NOISE = /[\s\-\u2010\u2011\u2013\u2014]/g;

export interface Normalized {
  value: string;
  errors: Issue[];
  warnings: Issue[];
}

export function normalize(input: string): Normalized {
  const replaced: number[] = [];
  const errors: Issue[] = [];
  const value = [...input.replace(NOISE, '').toUpperCase()]
    .map((ch, i) => {
      const latin = CYRILLIC_TO_LATIN[ch];
      if (latin) {
        replaced.push(i + 1);
        return latin;
      }
      if (!/^[A-Z0-9]$/.test(ch)) {
        errors.push({ code: 'INVALID_CHAR', message: `Недопустимый символ «${ch}»`, position: i + 1 });
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
