import { pick } from '../core/random';
import type { FieldSpec, FormatModule } from '../core/types';
import { generatePassport, NUMBER_FIELD, parsePassport, validatePassport } from './passportCommon';

// Series of the 1996-model passport by issuing authority. No single official list is published;
// taken from ru.wikipedia.org and ru.migrapedia.org (see spec). Change them here and nowhere else.
export const SERIES_1996: Record<string, string> = {
  AB: 'Брестская область',
  BM: 'Витебская область',
  HB: 'Гомельская область',
  KH: 'Гродненская область',
  MP: 'г. Минск',
  MC: 'Минская область',
  KB: 'Могилёвская область',
  PP: 'МИД (гражданам, проживающим за границей)',
  SP: 'служебный паспорт',
  DP: 'дипломатический паспорт',
};

const fields: FieldSpec[] = [
  {
    key: 'series',
    label: 'Серия',
    kind: 'select',
    options: Object.entries(SERIES_1996).map(([value, label]) => ({ value, label: `${value} — ${label}` })),
    check: (v) => (Object.hasOwn(SERIES_1996, v) ? null : 'Выберите серию из списка'),
    random: (rng) => pick(rng, Object.keys(SERIES_1996)),
  },
  NUMBER_FIELD,
];

export const passport1996: FormatModule = {
  id: '1996',
  title: 'Образца 1996 г.',
  official: false,
  fields,
  validate: (input) =>
    validatePassport(input, (series) =>
      Object.hasOwn(SERIES_1996, series)
        ? null
        : { code: 'UNKNOWN_SERIES', message: `Серия «${series}» не из известного списка серий паспорта образца 1996 г.`, position: 1 },
    ),
  parse: (input) => parsePassport(input, (series) => SERIES_1996[series] ?? 'неизвестная серия'),
  generate: (partial, rng) => generatePassport(fields, partial, rng),
};
