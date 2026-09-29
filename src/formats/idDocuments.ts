import { normalize } from '../core/normalize';
import { randInt } from '../core/random';
import type { FieldSpec, FormatModule, Rng } from '../core/types';
import { generatePassport, NUMBER_FIELD, parsePassport, validatePassport } from './passportCommon';

// ID card (since 01.09.2021, Council of Ministers resolution No. 297 of 31.05.2021; TD1 card, ICAO 9303 part 5)
// and residence permit. Old residence permit booklet (resolution No. 1740 of 18.11.2008): "семизначный номер
// вида на жительство с серией из двух букв". The ID-card number shape (two letters + seven digits) comes from
// secondary sources only; series letters of both documents are not published.

const letter = (rng: Rng) => String.fromCharCode(65 + randInt(rng, 0, 25));

const seriesField: FieldSpec = {
  key: 'series',
  label: 'Серия (2 латинские буквы)',
  kind: 'text',
  placeholder: 'AB',
  normalize: (v) => normalize(v).value,
  check: (v) => (/^[A-Z]{2}$/.test(v) ? null : 'Две латинские буквы'),
  random: (rng) => `${letter(rng)}${letter(rng)}`,
};

const fields = [seriesField, NUMBER_FIELD];

export const idCard: FormatModule = {
  id: 'id-card',
  title: 'ID-карта (с 2021)',
  official: false,
  notice:
    'Номер ID-карты — две латинские буквы и семь цифр по вторичным источникам; серии официально не опубликованы. Идентификационный номер владельца проверяется в разделе «Идентификационный номер».',
  fields,
  validate: (input) => validatePassport(input, () => null),
  parse: (input) => parsePassport(input, () => 'серия бланка (официально не опубликована)'),
  generate: (partial, rng) => generatePassport(fields, partial, rng),
};

export const residencePermit: FormatModule = {
  id: 'residence-permit',
  title: 'Вид на жительство',
  official: false,
  notice:
    'Номер вида на жительство образца 2008 г. — серия из двух букв и семизначный номер (постановление Совмина № 1740). Для биометрического вида на жительство формат номера официально не опубликован.',
  fields,
  validate: (input) => validatePassport(input, () => null),
  parse: (input) => parsePassport(input, () => 'серия бланка (официально не опубликована)'),
  generate: (partial, rng) => generatePassport(fields, partial, rng),
};
