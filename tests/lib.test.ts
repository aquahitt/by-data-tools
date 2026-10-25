import { describe, expect, it } from 'vitest';
import {
  formatsOf,
  generate,
  generateMany,
  generateRecords,
  isValid,
  parse,
  recordsToCsv,
  sections,
  validate,
} from '../src/lib';

describe('package API', () => {
  it('lists the sections with formats, not the record pages', () => {
    expect(sections()).toContain('personal-number');
    expect(sections()).toContain('unp');
    expect(sections()).not.toContain('persona');
  });

  it('generates a valid value for every format of every section', () => {
    for (const section of sections()) {
      for (const format of formatsOf(section)) {
        const value = generate(section, { format: format.id, seed: 1 });
        expect(validate(section, value, { format: format.id }).valid, `${section}/${format.id}: ${value}`).toBe(true);
      }
    }
  });

  it('repeats values for the same seed', () => {
    expect(generateMany('iban', 5, { seed: 42 })).toEqual(generateMany('iban', 5, { seed: 42 }));
    expect(generateMany('iban', 5, { seed: 42 })).not.toEqual(generateMany('iban', 5, { seed: 43 }));
  });

  it('keeps given fields', () => {
    const iban = generate('iban', { fields: { balance: '3012' }, seed: 7 });
    expect(iban.slice(8, 12)).toBe('3012');
  });

  it('throws on an invalid field, unknown section or format', () => {
    expect(() => generate('iban', { fields: { balance: 'x' } })).toThrow(/balance/);
    expect(() => generate('nope')).toThrow(/Unknown section "nope"/);
    expect(() => generate('unp', { format: 'nope' })).toThrow(/organization, individual/);
  });

  it('picks the accepting format when none is given', () => {
    const individual = generate('unp', { format: 'individual', seed: 3 });
    expect(validate('unp', individual)).toMatchObject({ valid: true, format: 'individual' });
    expect(validate('unp', individual, { format: 'organization' }).valid).toBe(false);
  });

  it('returns the default format errors when no format accepts the value', () => {
    const result = validate('personal-number', '7616637A246PB3');
    expect(result.valid).toBe(false);
    expect(result.format).toBe('modern');
    expect(result.errors[0]).toMatchObject({ code: 'CHECK_DIGIT', position: 14 });
    expect(isValid('personal-number', '7616637A246PB0')).toBe(true);
  });

  it('parses by the picked format', () => {
    const rows = parse('iban', 'BY15BLBB30137753158928775643');
    expect(rows?.find((r) => r.label === 'Банк')?.value).toContain('Белинвестбанк');
  });

  it('generates consistent records with filters and CSV', () => {
    const people = generateRecords('persona', { count: 3, seed: 5, filters: { gender: 'F' } });
    expect(people).toHaveLength(3);
    for (const p of people) {
      expect(p.gender).toBe('женский');
      expect(isValid('personal-number', p.personalNumber, { format: 'legacy' })).toBe(true);
    }
    expect(recordsToCsv('persona', people).split('\r\n')).toHaveLength(4);
    expect(() => generateRecords('persona', { filters: { gender: 'X' } })).toThrow(/M, F/);
    expect(() => generateRecords('organization', { filters: { size: 'big' } })).toThrow(/kind/);
  });
});
