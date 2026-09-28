import type { FormatModule } from '../core/types';
import { IBAN_FORMATS, PASSPORT_FORMATS, PERSONAL_NUMBER_FORMATS, PHONE_FORMATS, UNP_FORMATS } from '../formats';

// The navigation menu: categories and sections, in display order. A section without formats is "скоро".

export type CategoryId = 'documents' | 'organizations' | 'finance' | 'contacts';

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
}

export const CATEGORIES: Category[] = [
  { id: 'documents', title: 'Документы' },
  { id: 'organizations', title: 'Организации' },
  { id: 'finance', title: 'Финансы' },
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
    title: 'Номер паспорта',
    category: 'documents',
    inputLabel: 'Серия и номер паспорта',
    formats: PASSPORT_FORMATS,
  },
  { id: 'unp', title: 'УНП', category: 'organizations', inputLabel: 'УНП', formats: UNP_FORMATS },
  { id: 'iban', title: 'IBAN / номер счёта', category: 'finance', inputLabel: 'IBAN', formats: IBAN_FORMATS },
  { id: 'phone', title: 'Телефон', category: 'contacts', inputLabel: 'Номер телефона', formats: PHONE_FORMATS },
];

export const DEFAULT_TOOL_ID = 'personal-number';

export function isAvailable(tool: Tool): boolean {
  return tool.formats.length > 0;
}

export function findTool(id: string): Tool | undefined {
  return TOOLS.find((t) => t.id === id);
}

export function toolsByCategory(): { category: Category; tools: Tool[] }[] {
  return CATEGORIES.map((category) => ({ category, tools: TOOLS.filter((t) => t.category === category.id) }));
}
