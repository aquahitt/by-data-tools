import { resolveFields } from '../core/fields';
import { pad, pick, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { digitsOf, lengthIssue } from './digits';

// ОКЭД — ОКРБ 005-2011 «Виды экономической деятельности» (Gosstandart resolution No. 85 of 05.12.2011, in force
// 01.01.2016; amendment No. 7 in force 01.01.2026): five digits — division (2), group (3), class (4), subclass (5).
// Sections and their division ranges are those of the belstat.gov.by text with amendments 1–5. Belstat publishes
// the classifier as PDF only, so a subclass's existence is not checked.

interface Section {
  letter: string;
  name: string;
  from: number;
  to: number;
}

export const SECTIONS: Section[] = [
  { letter: 'A', name: 'Сельское, лесное и рыбное хозяйство', from: 1, to: 3 },
  { letter: 'B', name: 'Горнодобывающая промышленность', from: 5, to: 9 },
  { letter: 'C', name: 'Обрабатывающая промышленность', from: 10, to: 33 },
  { letter: 'D', name: 'Снабжение электроэнергией, газом, паром, горячей водой и кондиционированным воздухом', from: 35, to: 35 },
  { letter: 'E', name: 'Водоснабжение; сбор, обработка и удаление отходов, деятельность по ликвидации загрязнений', from: 36, to: 39 },
  { letter: 'F', name: 'Строительство', from: 41, to: 43 },
  { letter: 'G', name: 'Оптовая и розничная торговля; ремонт автомобилей и мотоциклов', from: 45, to: 47 },
  { letter: 'H', name: 'Транспортная деятельность, складирование, почтовая и курьерская деятельность', from: 49, to: 53 },
  { letter: 'I', name: 'Услуги по временному проживанию и питанию', from: 55, to: 56 },
  { letter: 'J', name: 'Информация и связь', from: 58, to: 63 },
  { letter: 'K', name: 'Финансовая и страховая деятельность', from: 64, to: 66 },
  { letter: 'L', name: 'Операции с недвижимым имуществом', from: 68, to: 68 },
  { letter: 'M', name: 'Профессиональная, научная и техническая деятельность', from: 69, to: 75 },
  { letter: 'N', name: 'Деятельность в сфере административных и вспомогательных услуг', from: 77, to: 82 },
  { letter: 'O', name: 'Государственное управление', from: 84, to: 84 },
  { letter: 'P', name: 'Образование', from: 85, to: 85 },
  { letter: 'Q', name: 'Здравоохранение и социальные услуги', from: 86, to: 88 },
  { letter: 'R', name: 'Творчество, спорт, развлечения и отдых', from: 90, to: 93 },
  { letter: 'S', name: 'Предоставление прочих видов услуг', from: 94, to: 96 },
  {
    letter: 'T',
    name: 'Деятельность частных домашних хозяйств, нанимающих домашнюю прислугу и производящих товары и услуги для собственного потребления',
    from: 97,
    to: 98,
  },
  { letter: 'U', name: 'Деятельность экстерриториальных организаций и органов', from: 99, to: 99 },
];

export const sectionOf = (division: number) => SECTIONS.find((s) => division >= s.from && division <= s.to) ?? null;

function validate(input: string): ValidationResult {
  const { value: v, errors } = digitsOf(input, /^\s*(оквэд|окэд)[\s:№#]*/i);
  const warnings: Issue[] = [];
  if (errors.length === 0) {
    const length = lengthIssue(v, 5);
    if (length) errors.push(length);
  }
  if (errors.length === 0 && !sectionOf(Number(v.slice(0, 2)))) {
    errors.push({ code: 'DIVISION', message: `Раздела «${v.slice(0, 2)}» в ОКЭД нет`, position: 1 });
  }
  return { valid: errors.length === 0, normalized: v, errors, warnings };
}

function parse(input: string): ParsedField[] | null {
  const { value: v, errors } = digitsOf(input, /^\s*(оквэд|окэд)[\s:№#]*/i);
  if (errors.length > 0 || v.length !== 5) return null;
  const section = sectionOf(Number(v.slice(0, 2)));
  return [
    { label: 'Секция', value: section ? `${section.letter} — ${section.name}` : 'не определена' },
    { label: 'Раздел', value: v.slice(0, 2) },
    { label: 'Группа', value: v.slice(0, 3) },
    { label: 'Класс', value: v.slice(0, 4) },
    { label: 'Подкласс', value: v },
  ];
}

const fields: FieldSpec[] = [
  {
    key: 'section',
    label: 'Секция',
    kind: 'select',
    options: SECTIONS.map((s) => ({ value: s.letter, label: `${s.letter} — ${s.name}` })),
    check: (v) => (SECTIONS.some((s) => s.letter === v) ? null : 'Выберите секцию из списка'),
    random: (rng) => pick(rng, SECTIONS).letter,
  },
];

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const section = SECTIONS.find((s) => s.letter === values.section)!;
  const value = `${pad(randInt(rng, section.from, section.to), 2)}${pad(randInt(rng, 1, 9) * 100 + randInt(rng, 0, 9) * 10, 3)}`;
  return { ok: true, value, hint: `Секция ${section.letter} · раздел верный; существование подкласса не проверяется` };
}

export const oked: FormatModule = {
  id: 'oked',
  title: 'ОКЭД',
  official: true,
  notice:
    'Классификатор ОКЭД опубликован Белстатом только в PDF: проверяются длина и существование раздела (первые две цифры), а не конкретного подкласса.',
  fields,
  validate,
  parse,
  generate,
};
