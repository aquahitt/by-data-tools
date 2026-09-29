import { pad, pick, randInt } from '../core/random';
import type { Rng } from '../core/types';
import { POSTAL_REGIONS } from './postal';
import type { RecordSet } from './records';

// A plausible postal address: region, city, street, house, flat and a postal code of that city. Codes of district
// towns come from the city lists of b-info.by and belarus-inform.by (Orsha 211030, Soligorsk 223710 …); regional
// centres draw from the first codes of their range. Street names are common ones found in most Belarusian towns
// (plus a few real Minsk avenues); whether a street or a house exists in the chosen city is not checked.

interface City {
  name: string;
  /** Base postal code and how many consecutive codes to draw from. */
  code: number;
  spread: number;
}

export const CITIES: Record<string, City[]> = {
  'г. Минск': [{ name: 'г. Минск', code: 220002, spread: 139 }],
  'Минская область': [
    { name: 'г. Борисов', code: 222120, spread: 10 },
    { name: 'г. Молодечно', code: 222310, spread: 10 },
    { name: 'г. Солигорск', code: 223710, spread: 10 },
    { name: 'г. Слуцк', code: 223610, spread: 10 },
    { name: 'г. Жодино', code: 222160, spread: 3 },
  ],
  'Брестская область': [
    { name: 'г. Брест', code: 224000, spread: 30 },
    { name: 'г. Барановичи', code: 225409, spread: 10 },
    { name: 'г. Пинск', code: 225710, spread: 10 },
  ],
  'Витебская область': [
    { name: 'г. Витебск', code: 210001, spread: 40 },
    { name: 'г. Орша', code: 211030, spread: 10 },
    { name: 'г. Полоцк', code: 211400, spread: 10 },
    { name: 'г. Новополоцк', code: 211440, spread: 10 },
  ],
  'Гомельская область': [
    { name: 'г. Гомель', code: 246000, spread: 50 },
    { name: 'г. Мозырь', code: 247760, spread: 10 },
    { name: 'г. Жлобин', code: 247210, spread: 5 },
    { name: 'г. Речица', code: 247500, spread: 5 },
  ],
  'Гродненская область': [
    { name: 'г. Гродно', code: 230000, spread: 30 },
    { name: 'г. Лида', code: 231300, spread: 5 },
    { name: 'г. Слоним', code: 231800, spread: 5 },
  ],
  'Могилёвская область': [
    { name: 'г. Могилёв', code: 212000, spread: 40 },
    { name: 'г. Бобруйск', code: 213800, spread: 30 },
    { name: 'г. Осиповичи', code: 213760, spread: 3 },
  ],
};

const STREETS = [
  'ул. Ленина', 'ул. Советская', 'ул. Пушкина', 'ул. Гагарина', 'ул. Мира', 'ул. Первомайская', 'ул. Октябрьская',
  'ул. Кирова', 'ул. Комсомольская', 'ул. Садовая', 'ул. Молодёжная', 'ул. Школьная', 'ул. Интернациональная',
  'ул. Пролетарская', 'ул. Горького', 'ул. Чапаева', 'ул. Суворова', 'ул. Лесная', 'ул. Строителей', 'ул. Янки Купалы',
  'ул. Якуба Коласа', 'ул. Максима Богдановича', 'ул. Франциска Скорины', 'ул. Космонавтов',
];
const MINSK_STREETS = ['пр. Независимости', 'пр. Победителей', 'пр. Дзержинского', 'ул. Немига', 'ул. Сурганова', 'ул. Притыцкого'];

export interface Address {
  region: string;
  city: string;
  street: string;
  house: string;
  flat: string;
  postalCode: string;
  full: string;
}

export function randomAddress(rng: Rng, region = pick(rng, POSTAL_REGIONS), options: { flat?: boolean } = {}): Address {
  const city = pick(rng, CITIES[region]);
  const street = pick(rng, city.name === 'г. Минск' ? [...STREETS, ...MINSK_STREETS] : STREETS);
  const house = `${randInt(rng, 1, 150)}${rng() < 0.15 ? `, корп. ${randInt(rng, 1, 4)}` : ''}`;
  const flat = (options.flat ?? rng() < 0.8) ? String(randInt(rng, 1, 300)) : '';
  const postalCode = pad(city.code + randInt(rng, 0, city.spread - 1), 6);
  const place = region === 'г. Минск' ? city.name : `${city.name}, ${region}`;
  const full = `${postalCode}, ${place}, ${street}, д. ${house}${flat ? `, кв. ${flat}` : ''}`;
  return { region, city: city.name, street, house, flat, postalCode, full };
}

export const ADDRESS_SET: RecordSet = {
  notice:
    'Индекс согласован с городом и областью. Названия улиц — распространённые в городах Беларуси; существование улицы, дома и отделения связи в выбранном городе не проверяется. Только для тестов.',
  filters: [{ key: 'region', label: 'Область', options: POSTAL_REGIONS.map((r) => [r, r]) }],
  fields: [
    { key: 'full', label: 'Адрес' },
    { key: 'postalCode', label: 'Индекс' },
    { key: 'region', label: 'Область' },
    { key: 'city', label: 'Город' },
    { key: 'street', label: 'Улица' },
    { key: 'house', label: 'Дом' },
    { key: 'flat', label: 'Квартира' },
  ],
  generate: (rng, filters) => ({ ...randomAddress(rng, filters.region || undefined) }),
};
