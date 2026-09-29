import { pick, randInt } from '../core/random';
import { transliterate } from '../core/translit';
import type { GenerateResult, Rng } from '../core/types';
import { randomAddress } from './address';
import { BANKS, BICS, ibanBy } from './iban';
import { randomNameForms } from './names';
import { oked, sectionOf } from './oked';
import { okpo12 } from './okpo';
import { phoneLandline } from './phone';
import type { RecordSet } from './records';
import { SOATO_REGIONS } from './soato';
import { UNP_REGIONS } from './unpCommon';
import { unpIndividual } from './unpIndividual';
import { unpOrganization } from './unpOrganization';

// A consistent test organisation or sole proprietor: the region is the same in the UNP, ОКПО, address, postal code
// and phone code; the IBAN (3012 — commercial organisation, 3013 — sole proprietor) is in the bank of the BIC.
// Company names are made up from word parts; any match with a real company is a coincidence.

const FIRST = ['Бел', 'Мега', 'Альфа', 'Нео', 'Техно', 'Эко', 'Гранит', 'Вектор', 'Прайм', 'Норд', 'Вест', 'Дельта', 'Сигма', 'Орион', 'Лидер', 'Смарт', 'Грин', 'Инфо'];
const SECOND = ['Строй', 'Торг', 'Сервис', 'Логистик', 'Агро', 'Софт', 'Трейд', 'Маркет', 'Пром', 'Инвест', 'Транс', 'Мед', 'Лайн', 'Систем', 'Групп', 'Плюс'];
const FORMS: [string, string][] = [
  ['ООО', 'Общество с ограниченной ответственностью'],
  ['ОДО', 'Общество с дополнительной ответственностью'],
  ['ЗАО', 'Закрытое акционерное общество'],
  ['ОАО', 'Открытое акционерное общество'],
  ['ЧУП', 'Частное унитарное предприятие'],
];

// Landline code of each region's centre (Minsk oblast dials through 17).
const PHONE_CODES: Record<string, string> = {
  'г. Минск': '17',
  'Минская область': '17',
  'Брестская область': '162',
  'Витебская область': '212',
  'Гомельская область': '232',
  'Гродненская область': '152',
  'Могилёвская область': '222',
};

function value(r: GenerateResult): string {
  if (!r.ok) throw new Error(`generator failed: ${JSON.stringify(r.fieldErrors)}`);
  return r.value;
}

const soatoDigit = (region: string) => Object.keys(SOATO_REGIONS).find((k) => SOATO_REGIONS[k] === region)!;

export function generateOrganization(rng: Rng, options: { kind?: 'org' | 'ip' } = {}): Record<string, string> {
  const kind = options.kind ?? (rng() < 0.7 ? 'org' : 'ip');
  const unpRegion = pick(rng, UNP_REGIONS);
  const region = unpRegion.name;
  const address = randomAddress(rng, region, { flat: rng() < 0.4 });
  const bank = pick(rng, Object.keys(BANKS));
  const okedCode = value(oked.generate({}, rng));
  const section = sectionOf(Number(okedCode.slice(0, 2)))!;
  const person = randomNameForms(rng, rng() < 0.5 ? 'M' : 'F').ru;
  let form: string;
  let formFull: string;
  let name: string;
  let slug: string;
  if (kind === 'org') {
    [form, formFull] = pick(rng, FORMS);
    const brand = `${pick(rng, FIRST)}${pick(rng, SECOND)}`;
    name = `${form} «${brand}»`;
    slug = transliterate(brand, 'ru', 'icao').toLowerCase();
  } else {
    form = 'ИП';
    formFull = 'Индивидуальный предприниматель';
    name = `ИП ${person[0]} ${person[1][0]}. ${person[2][0]}.`;
    slug = transliterate(person[0], 'ru', 'icao').toLowerCase();
  }
  return {
    name,
    form: `${form} — ${formFull}`,
    unp: kind === 'org' ? value(unpOrganization.generate({ region: unpRegion.digit }, rng)) : value(unpIndividual.generate({ region: unpRegion.letter }, rng)),
    okpo: value(okpo12.generate({ region: soatoDigit(region) }, rng)),
    oked: `${okedCode} (секция ${section.letter} — ${section.name})`,
    head: kind === 'org' ? `Директор ${person.join(' ')}` : person.join(' '),
    region,
    address: address.full,
    postalCode: address.postalCode,
    phone: value(phoneLandline.generate({ city: PHONE_CODES[region] }, rng)),
    email: `${pick(rng, ['info', 'office', 'mail', 'sales'])}@${slug}${randInt(rng, 1, 99)}.example`,
    bank: BANKS[bank],
    bic: BICS[bank],
    iban: value(ibanBy.generate({ bank, balance: kind === 'org' ? '3012' : '3013' }, rng)),
  };
}

export const ORGANIZATION_SET: RecordSet = {
  notice:
    'Реквизиты согласованы между собой: область — в УНП, ОКПО, адресе, индексе и коде телефона; IBAN открыт в банке с указанным BIC (счёт 3012 — организация, 3013 — ИП). Названия вымышленные, совпадения с реальными компаниями случайны. Код ОКЭД — с верным разделом, но существование подкласса не проверяется. Email — на резервной зоне .example. Только для тестов.',
  filters: [
    {
      key: 'kind',
      label: 'Кто',
      options: [
        ['org', 'Организация'],
        ['ip', 'Индивидуальный предприниматель'],
      ],
    },
  ],
  fields: [
    { key: 'name', label: 'Наименование' },
    { key: 'form', label: 'Форма' },
    { key: 'unp', label: 'УНП' },
    { key: 'okpo', label: 'ОКПО' },
    { key: 'oked', label: 'ОКЭД' },
    { key: 'head', label: 'Руководитель' },
    { key: 'region', label: 'Область' },
    { key: 'address', label: 'Юридический адрес' },
    { key: 'postalCode', label: 'Индекс' },
    { key: 'phone', label: 'Телефон' },
    { key: 'email', label: 'Email' },
    { key: 'bank', label: 'Банк' },
    { key: 'bic', label: 'BIC' },
    { key: 'iban', label: 'IBAN' },
  ],
  generate: (rng, filters) => generateOrganization(rng, { kind: (filters.kind || undefined) as 'org' | 'ip' | undefined }),
};
