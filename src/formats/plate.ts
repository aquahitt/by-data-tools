import { resolveFields } from '../core/fields';
import { describeChar } from '../core/normalize';
import { pad, pick, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// Registration plates per STB 914-99 with amendments 1–8 (No. 8 in force since 01.01.2017): only the twelve letters
// that look the same in Cyrillic and Latin; region code 1–7 (0 — armed forces, border and internal troops).
// Code 8 — reserve code of Minsk, issued since March 2025 (auto.onliner.by, 28.02.2025; no legal act cited).
// Electric vehicles: change to STB 914-99 (Gosstandart resolution No. 70 of 12.12.2019, in force 01.07.2020),
// pattern E000 AA-1 per secondary sources. Region-0 plates may use other Cyrillic letters except Д Ё Й Ц Щ.

export const LETTERS = 'ABEIKMHOPCTX';
const CYRILLIC_TWINS: Record<string, string> = {
  А: 'A', В: 'B', Е: 'E', І: 'I', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', Х: 'X',
};
// Region 0 (STB 914-99): all Cyrillic letters except Д Ё Й Ц Щ, besides the twelve twins.
const REGION0_EXTRA = /^[БГЖЗИЛПУФЧШЪЫЬЭЮЯЎ]$/;

export const PLATE_REGIONS: Record<string, string> = {
  '1': 'Брестская область',
  '2': 'Витебская область',
  '3': 'Гомельская область',
  '4': 'Гродненская область',
  '5': 'Минская область',
  '6': 'Могилёвская область',
  '7': 'г. Минск',
  '8': 'г. Минск (резервный код, выдаётся с марта 2025)',
  '0': 'Вооружённые силы, Госпогранкомитет, внутренние войска',
};

const SEPARATORS = /[\s\-­​-‍‐-―⁠−]/g;

/** Uppercase, Cyrillic twins to Latin, separators removed; other characters kept for the checks. */
function compact(input: string): string {
  return [...input.replace(SEPARATORS, '')]
    .map((ch) => {
      const up = ch.toUpperCase();
      const one = up.length === 1 ? up : ch;
      return CYRILLIC_TWINS[one] ?? one;
    })
    .join('');
}

/** D digit, L letter, R region digit; any other character is literal. */
interface PlateLayout {
  id: string;
  title: string;
  template: string;
  /** How the compact value is written on the plate. */
  display: (v: string) => string;
  pattern: string;
  notice?: string;
}

function checkShape(v: string, layout: PlateLayout): Issue[] {
  if (v.length === 0) return [{ code: 'EMPTY', message: 'Номер не содержит ни одной буквы или цифры' }];
  if (v.length !== layout.template.length) {
    return [{ code: 'FORMAT', message: `Длина ${v.length}, ожидается ${layout.template.length} знаков: ${layout.pattern}` }];
  }
  const issues: Issue[] = [];
  [...layout.template].forEach((t, i) => {
    const ch = v[i];
    const position = i + 1;
    if (t === 'D' || t === 'R') {
      if (!/\d/.test(ch)) issues.push({ code: 'STRUCTURE', message: 'Ожидается цифра', position });
    } else if (t === 'L') {
      if (/\d/.test(ch)) issues.push({ code: 'STRUCTURE', message: 'Ожидается буква', position });
    } else if (ch !== t) {
      issues.push({ code: 'STRUCTURE', message: `Ожидается «${t}»`, position });
    }
  });
  return issues;
}

function checkLetters(v: string, layout: PlateLayout): Issue[] {
  const region = v[layout.template.indexOf('R')];
  const issues: Issue[] = [];
  [...layout.template].forEach((t, i) => {
    if (t !== 'L' || LETTERS.includes(v[i])) return;
    if (region === '0' && REGION0_EXTRA.test(v[i])) return;
    issues.push({
      code: 'LETTER',
      message: /\p{L}/u.test(v[i])
        ? `Буква «${v[i]}» не используется: допустимы А В Е І К М Н О Р С Т Х`
        : describeChar(v[i]),
      position: i + 1,
    });
  });
  return issues;
}

function validateWith(input: string, layout: PlateLayout): ValidationResult {
  const v = compact(input);
  const errors = checkShape(v, layout);
  if (errors.length === 0) errors.push(...checkLetters(v, layout));
  if (errors.length === 0) {
    const i = layout.template.indexOf('R');
    if (!Object.hasOwn(PLATE_REGIONS, v[i])) {
      errors.push({ code: 'REGION', message: `Код региона «${v[i]}» не используется: 1–8, 0`, position: i + 1 });
    }
  }
  return { valid: errors.length === 0, normalized: errors.length === 0 ? layout.display(v) : v, errors, warnings: [] };
}

function parseWith(input: string, layout: PlateLayout): ParsedField[] | null {
  const v = compact(input);
  if (checkShape(v, layout).length > 0) return null;
  const pick = (t: string) => [...layout.template].map((c, i) => (c === t ? v[i] : '')).join('');
  const region = pick('R');
  const rows: ParsedField[] = [
    { label: 'Тип', value: layout.title },
    { label: 'Цифры', value: pick('D') },
  ];
  const letters = pick('L');
  if (letters) rows.push({ label: 'Серия', value: letters });
  rows.push(
    { label: 'Код региона', value: `${region} — ${PLATE_REGIONS[region] ?? 'не используется'}` },
    { label: 'Запись на знаке', value: layout.display(v) },
  );
  return rows;
}

const randomLetters = (rng: Rng, n: number) => Array.from({ length: n }, () => pick(rng, [...LETTERS])).join('');

const regionField: FieldSpec = {
  key: 'region',
  label: 'Код региона',
  kind: 'select',
  options: Object.entries(PLATE_REGIONS).map(([value, label]) => ({ value, label: `${value} — ${label}` })),
  check: (v) => (Object.hasOwn(PLATE_REGIONS, v) ? null : 'Выберите код региона из списка'),
  // Civil regions only: region-0 plates are not what a test usually needs.
  random: (rng) => String(randInt(rng, 1, 8)),
};

const lettersField = (count: number, key = 'letters', label = `Буквы (${count})`): FieldSpec => ({
  key,
  label,
  kind: 'text',
  placeholder: 'AB'.slice(0, count),
  normalize: compact,
  check: (v) =>
    v.length === count && [...v].every((ch) => LETTERS.includes(ch))
      ? null
      : `${count === 1 ? 'Одна буква' : 'Две буквы'} из А В Е І К М Н О Р С Т Х`,
  random: (rng) => randomLetters(rng, count),
});

const digitsField = (count: number): FieldSpec => ({
  key: 'digits',
  label: `Цифры (${count})`,
  kind: 'text',
  placeholder: '1234'.slice(0, count),
  normalize: (v) => v.replace(SEPARATORS, ''),
  check: (v) => (new RegExp(`^\\d{${count}}$`).test(v) ? null : `${count} цифры`),
  // 0000 / 000 are left out: whether they are issued is not documented.
  random: (rng) => pad(randInt(rng, 1, 10 ** count - 1), count),
});

function makeFormat(
  layout: PlateLayout,
  fields: FieldSpec[],
  build: (values: Record<string, string>) => string,
): FormatModule {
  return {
    id: layout.id,
    title: layout.title,
    official: true,
    notice: layout.notice,
    fields,
    validate: (input) => validateWith(input, layout),
    parse: (input) => parseWith(input, layout),
    generate: (partial, rng): GenerateResult => {
      const { values, fieldErrors } = resolveFields(fields, partial, rng);
      if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
      const v = build(values);
      return { ok: true, value: layout.display(v), hint: `Код региона ${values.region} — ${PLATE_REGIONS[values.region]}` };
    },
  };
}

const car = makeFormat(
  {
    id: 'car',
    title: 'Легковой (тип 1)',
    template: 'DDDDLLR',
    pattern: '1234 AB-7',
    display: (v) => `${v.slice(0, 4)} ${v.slice(4, 6)}-${v[6]}`,
    notice: 'Та же запись — на двухстрочных знаках мотоциклов и прицепов (типы 4, 6): «1234» над «AB-7».',
  },
  [digitsField(4), lettersField(2), regionField],
  (x) => `${x.digits}${x.letters}${x.region}`,
);

const truck = makeFormat(
  {
    id: 'truck',
    title: 'Грузовой, автобус (тип 2)',
    template: 'LLDDDDR',
    pattern: 'AB 1234-7',
    display: (v) => `${v.slice(0, 2)} ${v.slice(2, 6)}-${v[6]}`,
    notice: 'Та же запись — на двухстрочных знаках грузовиков и тракторов (типы 3, 7): «AB-7» над «1234».',
  },
  [lettersField(2), digitsField(4), regionField],
  (x) => `${x.letters}${x.digits}${x.region}`,
);

const trailer = makeFormat(
  {
    id: 'trailer',
    title: 'Прицеп (тип 5)',
    template: 'LDDDDLR',
    pattern: 'A 1234 B-7',
    display: (v) => `${v[0]} ${v.slice(1, 5)} ${v[5]}-${v[6]}`,
  },
  [lettersField(1, 'first', 'Первая буква'), digitsField(4), lettersField(1, 'second', 'Вторая буква'), regionField],
  (x) => `${x.first}${x.digits}${x.second}${x.region}`,
);

const electric = makeFormat(
  {
    id: 'electric',
    title: 'Электромобиль',
    template: 'EDDDLLR',
    pattern: 'E123 AB-7',
    display: (v) => `${v.slice(0, 4)} ${v.slice(4, 6)}-${v[6]}`,
    notice:
      'Зелёные знаки электромобилей введены с 01.07.2020 (изменение к СТБ 914-99). Запись E123 AB-7 — по вторичным источникам; для электрогрузовиков и мотоциклов не подтверждена.',
  },
  [digitsField(3), lettersField(2), regionField],
  (x) => `E${x.digits}${x.letters}${x.region}`,
);

const transit = makeFormat(
  {
    id: 'transit',
    title: 'Транзитный (тип 12)',
    template: 'RLLTDDDD',
    pattern: '7 AB T 1234',
    display: (v) => `${v[0]} ${v.slice(1, 3)} T ${v.slice(4)}`,
  },
  [regionField, lettersField(2), digitsField(4)],
  (x) => `${x.region}${x.letters}T${x.digits}`,
);

const taxi = makeFormat(
  {
    id: 'taxi',
    title: 'Такси (тип 13)',
    template: 'RTAXDDDD',
    pattern: '7 TAX 1234',
    display: (v) => `${v[0]} TAX ${v.slice(4)}`,
    notice: 'Жёлтые знаки такси и маршрутных пассажирских ТС. Запись «7 TAX 1234» — по тексту СТБ 914-99 в пересказе, средняя уверенность.',
  },
  [regionField, digitsField(4)],
  (x) => `${x.region}TAX${x.digits}`,
);

export const PLATE_FORMATS: FormatModule[] = [car, truck, trailer, electric, transit, taxi];
