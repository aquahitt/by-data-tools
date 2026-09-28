import { normalize } from '../core/normalize';
import { randInt } from '../core/random';
import type { FieldSpec, FormatModule, Rng } from '../core/types';
import { generatePassport, NUMBER_FIELD, parsePassport, validatePassport } from './passportCommon';

// Council of Ministers resolution No. 297 of 31.05.2021 fixes only the shape of the blank's serial number
// (two Latin letters + seven digits) and names DP for diplomatic passports; other series are unpublished.

const letter = (rng: Rng) => String.fromCharCode(65 + randInt(rng, 0, 25));

const fields: FieldSpec[] = [
  {
    key: 'series',
    label: 'Серия (2 латинские буквы)',
    kind: 'text',
    placeholder: 'AB',
    normalize: (v) => normalize(v).value,
    check: (v) => (/^[A-Z]{2}$/.test(v) ? null : 'Две латинские буквы'),
    random: (rng) => `${letter(rng)}${letter(rng)}`,
  },
  NUMBER_FIELD,
];

export const passportBiometric: FormatModule = {
  id: 'biometric',
  title: 'Биометрический (с 2021)',
  official: true,
  notice:
    'Серии бланков биометрических паспортов официально не опубликованы: постановление Совмина № 297 определяет только формат — две латинские буквы и семь цифр.',
  fields,
  validate: (input) => validatePassport(input, () => null),
  parse: (input) =>
    parsePassport(input, (series) =>
      series === 'DP' ? 'дипломатический паспорт' : 'серия бланка (официально не опубликована)',
    ),
  generate: (partial, rng) => generatePassport(fields, partial, rng),
};
