import { resolveFields } from '../core/fields';
import { describeChar } from '../core/normalize';
import { pick } from '../core/random';
import { type NameLanguage, transliterate } from '../core/translit';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { fullName, randomPerson } from './names';

// Name in Cyrillic → its Latin spelling in documents, by both schemes (see core/translit.ts).

const ALPHABETS: Record<NameLanguage, string> = {
  be: 'АБВГДЕЁЖЗІЙКЛМНОПРСТУЎФХЦЧШЫЬЭЮЯ',
  ru: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
};
const OTHER: Record<NameLanguage, string> = { be: 'ИЩЪ', ru: 'ІЎ' };
const APOSTROPHES = "'’ʼ";

const tidy = (input: string) => input.trim().replace(/\s+/g, ' ');

function check(input: string, language: NameLanguage): Issue[] {
  const text = tidy(input);
  if (text === '') return [{ code: 'EMPTY', message: 'Введите фамилию, имя или ФИО' }];
  const issues: Issue[] = [];
  [...text].forEach((raw, i) => {
    const ch = raw.toUpperCase();
    const position = i + 1;
    if (ALPHABETS[language].includes(ch) || ch === ' ' || ch === '-') return;
    if (APOSTROPHES.includes(ch)) {
      if (language === 'ru') issues.push({ code: 'ALPHABET', message: 'Апостроф — в белорусском написании; в русском пишется Ь или Ъ', position });
      return;
    }
    if (OTHER[language].includes(ch)) {
      issues.push({
        code: 'ALPHABET',
        message: `Буквы «${ch}» нет в ${language === 'be' ? 'белорусском' : 'русском'} алфавите`,
        position,
      });
    } else {
      issues.push({ code: 'INVALID_CHAR', message: /[A-Za-z]/.test(ch) ? `Латинская буква «${raw}»: введите имя кириллицей` : describeChar(raw), position });
    }
  });
  return issues;
}

function makeFormat(language: NameLanguage): FormatModule {
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
  return {
    id: language,
    title: language === 'be' ? 'Белорусское написание' : 'Русское написание',
    official: true,
    notice:
      'Источники расходятся в том, какая схема применяется по умолчанию: МИД ссылается на Инструкцию МВД № 288 (Г → G, Й → J, Ў → W), а в выданных паспортах встречается написание по ICAO 9303 (Сяргей → SIARHEI). Показаны оба; гражданин вправе один раз выбрать написание.',
    fields,
    validate: (input): ValidationResult => {
      const errors = check(input, language);
      return { valid: errors.length === 0, normalized: tidy(input), errors, warnings: [] };
    },
    parse: (input): ParsedField[] | null => {
      if (check(input, language).length > 0) return null;
      const text = tidy(input);
      return [
        { label: 'Инструкция МВД № 288 (таблица МИД)', value: transliterate(text, language, 'mvd') },
        { label: `ICAO 9303${language === 'be' ? ' (Г → H)' : ''}`, value: transliterate(text, language, 'icao') },
      ];
    },
    generate: (partial, rng): GenerateResult => {
      const { values, fieldErrors } = resolveFields(fields, partial, rng);
      if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
      const person = randomPerson(rng, { gender: values.gender as 'M' | 'F', language });
      const name = fullName(person);
      return { ok: true, value: name, hint: `${transliterate(`${person.last} ${person.first}`, language, 'icao')} (ICAO)` };
    },
  };
}

export const NAME_FORMATS: FormatModule[] = [makeFormat('be'), makeFormat('ru')];
