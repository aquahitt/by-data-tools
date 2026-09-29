import { pad, pick, randInt } from '../core/random';
import { transliterate } from '../core/translit';
import type { Rng } from '../core/types';
import { randomAddress } from './address';
import { card } from './card';
import { randomMailbox } from './email';
import { ibanBy } from './iban';
import { legacy } from './legacy';
import { type Gender, randomNameForms } from './names';
import { passport1996 } from './passport1996';
import { phoneMobile } from './phone';
import type { RecordSet } from './records';

// A consistent test person: name in Russian and Belarusian spelling; sex and birth date match the identification
// number, the region letter of that number matches the passport series, the address and the postal code.
// Emails are on a reserved domain; card numbers are unissued.

// Region letter of the pre-2012 identification number → 1996-model passport series and region name.
const REGION_LINKS: Record<string, { series: string; region: string }> = {
  A: { series: 'MP', region: 'г. Минск' },
  B: { series: 'MC', region: 'Минская область' },
  C: { series: 'AB', region: 'Брестская область' },
  E: { series: 'BM', region: 'Витебская область' },
  H: { series: 'HB', region: 'Гомельская область' },
  K: { series: 'KH', region: 'Гродненская область' },
  M: { series: 'KB', region: 'Могилёвская область' },
};

export const PERSONA_FIELDS = [
  { key: 'lastName', label: 'Фамилия (RU)' },
  { key: 'firstName', label: 'Имя (RU)' },
  { key: 'middleName', label: 'Отчество (RU)' },
  { key: 'lastNameBy', label: 'Фамилия (BY)' },
  { key: 'firstNameBy', label: 'Имя (BY)' },
  { key: 'middleNameBy', label: 'Отчество (BY)' },
  { key: 'latinName', label: 'Латиницей (ICAO)' },
  { key: 'gender', label: 'Пол' },
  { key: 'birthDate', label: 'Дата рождения' },
  { key: 'personalNumber', label: 'Идентификационный номер' },
  { key: 'passport', label: 'Паспорт' },
  { key: 'phone', label: 'Телефон' },
  { key: 'email', label: 'Email' },
  { key: 'region', label: 'Область' },
  { key: 'postalCode', label: 'Почтовый индекс' },
  { key: 'address', label: 'Адрес' },
  { key: 'iban', label: 'IBAN' },
  { key: 'card', label: 'Банковская карта' },
];

export type Persona = Record<string, string>;

const DAY_MS = 86_400_000;

/** Birth date of someone aged 18–75 today, as ДД.ММ.ГГГГ. */
function randomAdultBirthDate(rng: Rng): string {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const oldest = Date.UTC(now.getFullYear() - 75, now.getMonth(), now.getDate());
  const youngest = Date.UTC(now.getFullYear() - 18, now.getMonth(), now.getDate());
  const t = new Date(oldest + randInt(rng, 0, Math.floor((Math.min(youngest, today) - oldest) / DAY_MS)) * DAY_MS);
  return `${pad(t.getUTCDate(), 2)}.${pad(t.getUTCMonth() + 1, 2)}.${t.getUTCFullYear()}`;
}

function value(r: ReturnType<typeof legacy.generate>): string {
  if (!r.ok) throw new Error(`generator failed: ${JSON.stringify(r.fieldErrors)}`);
  return r.value;
}

export function generatePersona(rng: Rng, options: { gender?: Gender } = {}): Persona {
  const gender = options.gender ?? pick(rng, ['M', 'F'] as const);
  const { ru, be } = randomNameForms(rng, gender);
  // Documents take the Latin spelling from the Belarusian form (ICAO, as in issued passports).
  const latinLast = transliterate(be[0], 'be', 'icao');
  const latinFirst = transliterate(be[1], 'be', 'icao');
  const birthDate = randomAdultBirthDate(rng);
  const regionLetter = pick(rng, Object.keys(REGION_LINKS));
  const link = REGION_LINKS[regionLetter];
  const address = randomAddress(rng, link.region, { flat: true });
  return {
    lastName: ru[0],
    firstName: ru[1],
    middleName: ru[2],
    lastNameBy: be[0],
    firstNameBy: be[1],
    middleNameBy: be[2],
    latinName: `${latinLast} ${latinFirst}`,
    gender: gender === 'M' ? 'мужской' : 'женский',
    birthDate,
    personalNumber: value(legacy.generate({ gender, birthDate, region: regionLetter, status: 'PB' }, rng)),
    passport: value(passport1996.generate({ series: link.series }, rng)),
    phone: value(phoneMobile.generate({}, rng)),
    email: `${randomMailbox(rng, latinFirst, latinLast)}@example.com`,
    region: link.region,
    postalCode: address.postalCode,
    address: address.full,
    iban: value(ibanBy.generate({ balance: '3014' }, rng)),
    card: value(card.generate({ scheme: pick(rng, ['belkart', 'visa', 'mastercard']) }, rng)),
  };
}

export const PERSONA_SET: RecordSet = {
  notice:
    'Значения согласованы между собой: ФИО по-русски и по-белорусски, латиница — из белорусской формы, как в документах; пол и дата рождения — с идентификационным номером; область — с серией паспорта, адресом и индексом. Email — на резервном домене example.com, номера карт банками не выпущены. Только для тестов.',
  filters: [
    {
      key: 'gender',
      label: 'Пол',
      options: [
        ['M', 'Мужской'],
        ['F', 'Женский'],
      ],
    },
  ],
  fields: PERSONA_FIELDS,
  generate: (rng, filters) => generatePersona(rng, { gender: (filters.gender || undefined) as Gender | undefined }),
};
