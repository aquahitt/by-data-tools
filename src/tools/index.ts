import type { FormatModule } from '../core/types';
import {
  AMOUNT_FORMATS,
  BIC_FORMATS,
  CADASTRAL_FORMATS,
  CARD_FORMATS,
  CUSTOMS_FORMATS,
  EAN_FORMATS,
  EMAIL_FORMATS,
  IBAN_FORMATS,
  IMEI_FORMATS,
  INVENTORY_FORMATS,
  NAME_FORMATS,
  OKED_FORMATS,
  OKPO_FORMATS,
  PASSPORT_FORMATS,
  PERSONAL_NUMBER_FORMATS,
  PHONE_FORMATS,
  PLATE_FORMATS,
  POSTAL_FORMATS,
  SOATO_FORMATS,
  UNP_FORMATS,
  VIN_FORMATS,
} from '../formats';

// The navigation menu: categories and sections, in display order. A section without formats or a page is "скоро".

export type CategoryId =
  | 'documents'
  | 'people'
  | 'organizations'
  | 'finance'
  | 'goods'
  | 'transport'
  | 'addresses'
  | 'contacts';

export interface Category {
  id: CategoryId;
  title: string;
}

export interface Tool {
  id: string;
  title: string;
  category: CategoryId;
  inputLabel: string;
  formats: FormatModule[];
  /** A section with its own page instead of the validate / generate cards. */
  page?: 'persona' | 'organization' | 'address';
  texts?: ToolTexts;
}

export interface ToolTexts {
  /** Status lines: valid, valid with warnings, invalid. Default: «Номер валиден» and so on. */
  status?: [string, string, string];
  /** Under the input field. Default: «Пробелы, дефисы и регистр не важны». */
  inputHint?: string;
  /** Above the generator fields. Default mentions the check digit. */
  generateHelp?: string;
}

const masculine = (noun: string): [string, string, string] => [`${noun} валиден`, `${noun} валиден, есть предупреждения`, `${noun} невалиден`];
const RANDOM_ONLY = 'Пустые поля заполняются случайно.';
const CODE: ToolTexts = { status: masculine('Код'), generateHelp: RANDOM_ONLY };

export const CATEGORIES: Category[] = [
  { id: 'documents', title: 'Документы' },
  { id: 'people', title: 'Люди' },
  { id: 'organizations', title: 'Организации' },
  { id: 'finance', title: 'Финансы' },
  { id: 'goods', title: 'Товары и таможня' },
  { id: 'transport', title: 'Транспорт' },
  { id: 'addresses', title: 'Адреса и недвижимость' },
  { id: 'contacts', title: 'Контакты' },
];

export const TOOLS: Tool[] = [
  {
    id: 'personal-number',
    title: 'Идентификационный номер',
    category: 'documents',
    inputLabel: 'Идентификационный номер',
    formats: PERSONAL_NUMBER_FORMATS,
  },
  {
    id: 'passport-number',
    title: 'Паспорт, ID-карта, ВНЖ',
    category: 'documents',
    inputLabel: 'Серия и номер документа',
    formats: PASSPORT_FORMATS,
    texts: { generateHelp: `${RANDOM_ONLY} Контрольная цифра номера в MRZ считается автоматически.` },
  },
  { id: 'persona', title: 'Тестовая персона', category: 'people', inputLabel: '', formats: [], page: 'persona' },
  { id: 'name', title: 'ФИО латиницей', category: 'people', inputLabel: 'Фамилия, имя, отчество кириллицей', formats: NAME_FORMATS,
    texts: {
      status: ['Написание верное', 'Написание верное, есть предупреждения', 'Написание с ошибками'],
      inputHint: 'Кириллицей; лишние пробелы не важны',
      generateHelp: RANDOM_ONLY,
    },
  },
  { id: 'organization', title: 'Тестовая организация', category: 'organizations', inputLabel: '', formats: [], page: 'organization' },
  { id: 'unp', title: 'УНП', category: 'organizations', inputLabel: 'УНП', formats: UNP_FORMATS },
  { id: 'okpo', title: 'ОКПО', category: 'organizations', inputLabel: 'Код ОКПО', formats: OKPO_FORMATS, texts: { status: masculine('Код') } },
  { id: 'oked', title: 'ОКЭД', category: 'organizations', inputLabel: 'Код ОКЭД', formats: OKED_FORMATS, texts: CODE },
  {
    id: 'iban',
    title: 'IBAN / номер счёта',
    category: 'finance',
    inputLabel: 'IBAN или номер счёта',
    formats: IBAN_FORMATS,
    texts: { status: masculine('Счёт') },
  },
  { id: 'bic', title: 'BIC / код банка', category: 'finance', inputLabel: 'BIC', formats: BIC_FORMATS, texts: CODE },
  { id: 'card', title: 'Банковская карта', category: 'finance', inputLabel: 'Номер карты', formats: CARD_FORMATS },
  {
    id: 'amount',
    title: 'Сумма прописью',
    category: 'finance',
    inputLabel: 'Сумма цифрами',
    formats: AMOUNT_FORMATS,
    texts: {
      status: ['Сумма верная', 'Сумма верная, есть предупреждения', 'Сумма с ошибкой'],
      inputHint: 'Например 1 234,56 или 1234.56; «BYN» и «руб.» можно не удалять',
      generateHelp: RANDOM_ONLY,
    },
  },
  { id: 'ean', title: 'Штрихкод EAN', category: 'goods', inputLabel: 'EAN-13 или EAN-8', formats: EAN_FORMATS },
  {
    id: 'customs-declaration',
    title: 'Номер таможенной декларации',
    category: 'goods',
    inputLabel: 'Регистрационный номер ДТ',
    formats: CUSTOMS_FORMATS,
    texts: { inputHint: 'Вид 06532/220211/0001122; пробелы не важны', generateHelp: RANDOM_ONLY },
  },
  { id: 'plate', title: 'Номерной знак', category: 'transport', inputLabel: 'Регистрационный знак', formats: PLATE_FORMATS,
    texts: { inputHint: 'Кириллицей или латиницей; пробелы, дефисы и регистр не важны', generateHelp: RANDOM_ONLY },
  },
  { id: 'vin', title: 'VIN', category: 'transport', inputLabel: 'VIN', formats: VIN_FORMATS },
  { id: 'postal', title: 'Почтовый индекс', category: 'addresses', inputLabel: 'Почтовый индекс', formats: POSTAL_FORMATS,
    texts: { status: masculine('Индекс'), generateHelp: RANDOM_ONLY },
  },
  { id: 'soato', title: 'СОАТО', category: 'addresses', inputLabel: 'Код СОАТО', formats: SOATO_FORMATS, texts: CODE },
  {
    id: 'cadastral',
    title: 'Кадастровый номер участка',
    category: 'addresses',
    inputLabel: 'Кадастровый номер',
    formats: CADASTRAL_FORMATS,
    texts: { generateHelp: RANDOM_ONLY },
  },
  {
    id: 'inventory',
    title: 'Инвентарный номер',
    category: 'addresses',
    inputLabel: 'Инвентарный номер строения или помещения',
    formats: INVENTORY_FORMATS,
    texts: { inputHint: 'Вид 500/C-66910; регистр и пробелы не важны', generateHelp: RANDOM_ONLY },
  },
  { id: 'address', title: 'Адрес', category: 'addresses', inputLabel: '', formats: [], page: 'address' },
  { id: 'phone', title: 'Телефон', category: 'contacts', inputLabel: 'Номер телефона', formats: PHONE_FORMATS, texts: { generateHelp: RANDOM_ONLY } },
  { id: 'email', title: 'Email', category: 'contacts', inputLabel: 'Адрес электронной почты', formats: EMAIL_FORMATS,
    texts: { status: masculine('Адрес'), inputHint: 'Пробелы по краям не важны', generateHelp: RANDOM_ONLY },
  },
  { id: 'imei', title: 'IMEI', category: 'contacts', inputLabel: 'IMEI', formats: IMEI_FORMATS },
];

export const DEFAULT_TOOL_ID = 'personal-number';

export function isAvailable(tool: Tool): boolean {
  return tool.formats.length > 0 || tool.page !== undefined;
}

export function findTool(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function toolsByCategory(): { category: Category; tools: Tool[] }[] {
  return CATEGORIES.map((category) => ({ category, tools: TOOLS.filter((t) => t.category === category.id) }));
}
