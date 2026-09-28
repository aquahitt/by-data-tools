import { UNP_ORGANIZATION_TEMPLATE } from '../core/structure';
import type { FormatModule } from '../core/types';
import { generateUnp, parseUnp, UNP_REGIONS, type UnpScheme, unpFields, validateUnp } from './unpCommon';

// Organizations: nine digits. The 2004 range table caps X2 at 8, but numbers with X2 = 9 are in use (19…, 79…),
// so X2 is not restricted.
const scheme: UnpScheme = {
  template: UNP_ORGANIZATION_TEMPLATE,
  typeLabel: 'организация',
  regionOf: (x1) => UNP_REGIONS.find((r) => r.digit === x1),
  regionCode: (r) => r.digit,
  minSequence: 0,
  values: (first8) => [...first8].map(Number),
  encodeSequence: (sequence) => sequence,
  describeSequence: (x2to8) => x2to8,
};

const fields = unpFields(scheme);

export const unpOrganization: FormatModule = {
  id: 'organization',
  title: 'Организация',
  official: true,
  fields,
  validate: (input) => validateUnp(input, scheme),
  parse: (input) => parseUnp(input, scheme),
  generate: (partial, rng) => generateUnp(scheme, fields, partial, rng),
};
