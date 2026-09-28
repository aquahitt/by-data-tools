import { charValue } from '../core/checkDigit';
import { UNP_INDIVIDUAL_TEMPLATE } from '../core/structure';
import type { FormatModule } from '../core/types';
import { generateUnp, parseUnp, UNP_REGIONS, type UnpScheme, unpFields, validateUnp } from './unpCommon';

// Individuals, incl. sole proprietors (item 20): X1 is the region letter (A = 10 … M = 22 in the sum);
// the first sequence digit is written as a letter, 0→A 1→B 2→C 3→E 4→H 5→K 6→M 7→O 8→P 9→T.
// Its worked example prints МА1953681, but miscalculates its own sum (950, not 936): the formula gives МА1953684.
const X2_LETTERS = 'ABCEHKMOPT';

const scheme: UnpScheme = {
  template: UNP_INDIVIDUAL_TEMPLATE,
  typeLabel: 'физическое лицо / ИП',
  regionOf: (x1) => UNP_REGIONS.find((r) => r.letter === x1),
  regionCode: (r) => r.letter,
  minSequence: 1,
  values: (first8) => {
    const x2 = X2_LETTERS.indexOf(first8[1]);
    return x2 < 0 ? null : [charValue(first8[0]), x2, ...[...first8.slice(2)].map(Number)];
  },
  encodeSequence: (sequence) => `${X2_LETTERS[Number(sequence[0])]}${sequence.slice(1)}`,
  describeSequence: (x2to8) => {
    const digit = X2_LETTERS.indexOf(x2to8[0]);
    return digit < 0 ? null : `${digit}${x2to8.slice(1)} (второй знак ${x2to8[0]} = ${digit})`;
  },
};

const fields = unpFields(scheme);

export const unpIndividual: FormatModule = {
  id: 'individual',
  title: 'Физлицо / ИП',
  official: true,
  fields,
  validate: (input) => validateUnp(input, scheme),
  parse: (input) => parseUnp(input, scheme),
  generate: (partial, rng) => generateUnp(scheme, fields, partial, rng),
};
