import { describe, expect, it } from 'vitest';
import { CATEGORIES, DEFAULT_TOOL_ID, findTool, isAvailable, TOOLS, toolsByCategory } from '../src/tools';

describe('tool registry', () => {
  it('has unique tool ids that are valid route segments', () => {
    const ids = TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('puts every tool in a declared category', () => {
    const categories = new Set(CATEGORIES.map((c) => c.id));
    for (const tool of TOOLS) expect(categories.has(tool.category)).toBe(true);
  });

  it('keeps format ids unique within each tool', () => {
    for (const tool of TOOLS) {
      const ids = tool.formats.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('has an available default tool', () => {
    const tool = findTool(DEFAULT_TOOL_ID);
    expect(tool && isAvailable(tool)).toBe(true);
  });

  it('matches the agreed menu', () => {
    expect(
      toolsByCategory().map(({ category, tools }) => [
        category.title,
        tools.map((t) => (isAvailable(t) ? t.title : `${t.title} (скоро)`)),
      ]),
    ).toEqual([
      ['Документы', ['Идентификационный номер', 'Паспорт, ID-карта, ВНЖ']],
      ['Люди', ['Тестовая персона', 'ФИО латиницей']],
      ['Организации', ['Тестовая организация', 'УНП', 'ОКПО', 'ОКЭД']],
      ['Финансы', ['IBAN / номер счёта', 'BIC / код банка', 'Банковская карта', 'Сумма прописью']],
      ['Товары и таможня', ['Штрихкод EAN', 'Номер таможенной декларации']],
      ['Транспорт', ['Номерной знак', 'VIN']],
      ['Адреса и недвижимость', ['Почтовый индекс', 'СОАТО', 'Кадастровый номер участка', 'Инвентарный номер', 'Адрес']],
      ['Контакты', ['Телефон', 'Email', 'IMEI']],
    ]);
  });

  it('returns undefined for an unknown id', () => {
    expect(findTool('nope')).toBeUndefined();
  });
});
