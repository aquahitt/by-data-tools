import { describe, expect, it } from 'vitest';
import { unpIndividual } from '../src/formats/unpIndividual';
import { mulberry32 } from '../src/core/random';

const codes = (input: string) => unpIndividual.validate(input).errors.map((e) => e.code);

describe('unpIndividual.validate', () => {
  // The MNS example prints МА1953681, but its own sum is miscalculated (950, not 936): the formula gives 4.
  it('accepts the MNS example with the check digit the formula yields', () => {
    expect(unpIndividual.validate('MA1953684')).toEqual({ valid: true, normalized: 'MA1953684', errors: [], warnings: [] });
  });

  it('rejects the misprinted check digit of the MNS example', () => {
    expect(unpIndividual.validate('MA1953681').errors).toEqual([
      { code: 'CHECK_DIGIT', message: 'Контрольная цифра 1, ожидается 4', position: 9 },
    ]);
  });

  it('accepts Cyrillic letters with a warning', () => {
    const r = unpIndividual.validate('УНП МА 195-368-4');
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe('MA1953684');
    expect(r.warnings.map((w) => w.code)).toEqual(['CYRILLIC_REPLACED']);
  });

  it('rejects an unknown region letter', () => {
    expect(unpIndividual.validate('DA1953684').errors.find((e) => e.code === 'REGION')?.position).toBe(1);
  });

  it('rejects a second letter outside the table', () => {
    expect(unpIndividual.validate('MD1953684').errors).toEqual([
      { code: 'X2', message: 'Второй знак «D» не из таблицы A B C E H K M O P T', position: 2 },
    ]);
  });

  it('rejects a digit in place of the letters', () => {
    expect(codes('M01953684')).toEqual(['STRUCTURE']);
  });
});

describe('unpIndividual.parse', () => {
  it('decodes the second letter back to its digit', () => {
    expect(unpIndividual.parse('MA1953684')).toEqual([
      { label: 'Тип плательщика', value: 'физическое лицо / ИП' },
      { label: 'Область (налоговые органы)', value: 'M — Могилёвская область' },
      { label: 'Порядковый номер', value: '0195368 (второй знак A = 0)' },
      { label: 'Контрольная цифра', value: '4 — верная' },
    ]);
  });
});

describe('unpIndividual.generate', () => {
  it('builds from region and sequence, encoding the first sequence digit as a letter', () => {
    expect(unpIndividual.generate({ region: 'M', sequence: '0195368' }, mulberry32(1))).toEqual({
      ok: true,
      value: 'MA1953684',
    });
    const r = unpIndividual.generate({ region: 'A', sequence: '9000001' }, mulberry32(1));
    expect(r.ok && r.value.slice(0, 2)).toBe('AT');
  });

  it('rejects the all-zero sequence', () => {
    expect(unpIndividual.generate({ sequence: '0000000' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { sequence: 'Семь цифр, от 0000001 до 9999999' },
    });
  });

  it('draws a random sequence that is issuable in the chosen region', () => {
    const sequence = unpIndividual.fields.find((f) => f.key === 'sequence')!;
    for (let seed = 1; seed <= 300; seed++) {
      const value = sequence.random(mulberry32(seed), { region: 'M' });
      expect(unpIndividual.generate({ region: 'M', sequence: value }, mulberry32(1)).ok).toBe(true);
    }
  });
});
