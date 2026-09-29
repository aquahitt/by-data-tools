import { resolveFields } from '../core/fields';
import { describeChar } from '../core/normalize';
import { pick } from '../core/random';
import { type NameLanguage, type TranslitScheme, transliterate } from '../core/translit';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { randomNameForms } from './names';

// Name in Cyrillic → its Latin spelling in documents, by both schemes (see core/translit.ts). The language is read
// from the letters: І, Ў and the apostrophe exist only in Belarusian, И, Щ and Ъ only in Russian. A name with none
// of them (Павел Жук) could be either, so both readings are shown when their Latin spellings differ.

const COMMON = 'АБВГДЕЁЖЗЙКЛМНОПРСТУФХЦЧШЫЬЭЮЯ';
const BELARUSIAN_ONLY = "ІЎ'’ʼ";
const RUSSIAN_ONLY = 'ИЩЪ';

const tidy = (input: string) => input.trim().replace(/\s+/g, ' ');

/** 'be' or 'ru' when the letters tell, null when they do not, 'mixed' when they contradict each other. */
export function detectLanguage(text: string): NameLanguage | null | 'mixed' {
  const upper = text.toUpperCase();
  const be = [...upper].some((ch) => BELARUSIAN_ONLY.includes(ch));
  const ru = [...upper].some((ch) => RUSSIAN_ONLY.includes(ch));
  if (be && ru) return 'mixed';
  return be ? 'be' : ru ? 'ru' : null;
}

function check(input: string): Issue[] {
  const text = tidy(input);
  if (text === '') return [{ code: 'EMPTY', message: 'Введите фамилию, имя или ФИО' }];
  const issues: Issue[] = [];
  const chars = [...text];
  chars.forEach((raw, i) => {
    const ch = raw.toUpperCase();
    if (COMMON.includes(ch) || BELARUSIAN_ONLY.includes(ch) || RUSSIAN_ONLY.includes(ch) || ch === ' ' || ch === '-') return;
    issues.push({
      code: 'INVALID_CHAR',
      message: /[A-Za-z]/.test(ch) ? `Латинская буква «${raw}»: введите имя кириллицей` : describeChar(raw),
      position: i + 1,
    });
  });
  if (issues.length === 0 && detectLanguage(text) === 'mixed') {
    // Point at the Russian-only letters: in a Belarusian name they are the usual slip, and vice versa is rarer.
    chars.forEach((raw, i) => {
      const ch = raw.toUpperCase();
      if (RUSSIAN_ONLY.includes(ch)) {
        issues.push({
          code: 'MIXED',
          message: `Буква «${ch}» — из русского алфавита, а в тексте есть белорусские І, Ў или апостроф`,
          position: i + 1,
        });
      }
    });
  }
  return issues;
}

const SCHEMES: [TranslitScheme, string][] = [
  ['icao', 'ICAO 9303'],
  ['mvd', 'Инструкция МВД № 288'],
];

function parse(input: string): ParsedField[] | null {
  if (check(input).length > 0) return null;
  const text = tidy(input);
  const language = detectLanguage(text) as NameLanguage | null;
  if (language) {
    return [
      { label: 'Написание', value: language === 'be' ? 'белорусское (есть І, Ў или апостроф)' : 'русское (есть И, Щ или Ъ)' },
      ...SCHEMES.map(([scheme, label]) => ({ label, value: transliterate(text, language, scheme) })),
    ];
  }
  const rows: ParsedField[] = [{ label: 'Написание', value: 'не определяется — нет букв І, Ў, И, Щ, Ъ' }];
  for (const [scheme, label] of SCHEMES) {
    const be = transliterate(text, 'be', scheme);
    const ru = transliterate(text, 'ru', scheme);
    if (be === ru) rows.push({ label, value: be });
    else rows.push({ label: `${label}, если белорусское`, value: be }, { label: `${label}, если русское`, value: ru });
  }
  return rows;
}

const fields: FieldSpec[] = [
  {
    key: 'gender',
    label: 'Пол',
    kind: 'select',
    options: [
      { value: 'M', label: 'Мужской' },
      { value: 'F', label: 'Женский' },
    ],
    check: (v) => (v === 'M' || v === 'F' ? null : 'Выберите пол'),
    random: (rng: Rng) => pick(rng, ['M', 'F']),
  },
];

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const forms = randomNameForms(rng, values.gender as 'M' | 'F');
  const [last, first] = forms.be;
  return {
    ok: true,
    value: forms.ru.join(' '),
    // Documents take the Latin spelling from the Belarusian form; the patronymic is not written in Latin.
    variants: [
      { label: 'RU', value: forms.ru.join(' ') },
      { label: 'BY', value: forms.be.join(' ') },
      { label: 'EN (ICAO)', value: transliterate(`${last} ${first}`, 'be', 'icao') },
      { label: 'EN (МВД № 288)', value: transliterate(`${last} ${first}`, 'be', 'mvd') },
    ],
  };
}

export const nameFormat: FormatModule = {
  id: 'name',
  title: 'ФИО',
  official: true,
  notice:
    'Язык определяется по буквам: І, Ў и апостроф — белорусское написание, И, Щ, Ъ — русское; без них показываются оба прочтения. Источники расходятся в том, какая схема латиницы применяется по умолчанию: МИД ссылается на Инструкцию МВД № 288 (Г → G, Й → J, Ў → W), а в выданных паспортах встречается написание по ICAO 9303 (Сяргей → SIARHEI). Показаны обе.',
  fields,
  validate: (input): ValidationResult => {
    const errors = check(input);
    return { valid: errors.length === 0, normalized: tidy(input), errors, warnings: [] };
  },
  parse,
  generate,
};

export const NAME_FORMATS: FormatModule[] = [nameFormat];
