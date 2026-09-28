import { describe, expect, it } from 'vitest';
import { unpOrganization } from '../src/formats/unpOrganization';
import { mulberry32 } from '../src/core/random';

const codes = (input: string) => unpOrganization.validate(input).errors.map((e) => e.code);

describe('unpOrganization.validate', () => {
  // 200988541 is the worked example of MNS resolution No. 127; the rest are real numbers published online.
  it.each(['200988541', '100325912', '100217336', '190658169', '290380347', '591705582', '791022114'])('accepts %s', (n) => {
    expect(unpOrganization.validate(n)).toEqual({ valid: true, normalized: n, errors: [], warnings: [] });
  });

  it('strips a УНП / UNP prefix and separators', () => {
    expect(unpOrganization.validate('УНП 100 325 912').valid).toBe(true);
    expect(unpOrganization.validate('unp: 100-325-912').normalized).toBe('100325912');
  });

  it('rejects an unknown region at position 1', () => {
    expect(unpOrganization.validate('991705588').errors.find((e) => e.code === 'REGION')?.position).toBe(1);
    expect(codes('091705588')).toContain('REGION');
  });

  it('rejects a wrong check digit and names the expected one', () => {
    expect(unpOrganization.validate('200988542').errors).toEqual([
      { code: 'CHECK_DIGIT', message: 'Контрольная цифра 2, ожидается 1', position: 9 },
    ]);
  });

  it('rejects numbers whose control number is 10 as never issued', () => {
    expect(unpOrganization.validate('711953681').errors).toEqual([
      { code: 'NOT_ISSUED', message: 'Контрольное число равно 10 — такой УНП не выдаётся', position: 9 },
    ]);
  });

  it('rejects letters and wrong length', () => {
    expect(codes('MA1953684')).toEqual(['STRUCTURE', 'STRUCTURE']);
    expect(codes('20098854')).toEqual(['LENGTH']);
  });
});

describe('unpOrganization.parse', () => {
  it('decodes every part', () => {
    expect(unpOrganization.parse('200988541')).toEqual([
      { label: 'Тип плательщика', value: 'организация' },
      { label: 'Область (налоговые органы)', value: '2 — Брестская область' },
      { label: 'Порядковый номер', value: '0098854' },
      { label: 'Контрольная цифра', value: '1 — верная' },
    ]);
  });

  it('explains a never-issued control number', () => {
    expect(unpOrganization.parse('711953681')?.[3].value).toBe('1 — контрольное число 10, такой УНП не выдаётся');
  });
});

describe('unpOrganization.generate', () => {
  it('builds the MNS worked example from its fields', () => {
    expect(unpOrganization.generate({ region: '2', sequence: '0098854' }, mulberry32(1))).toEqual({
      ok: true,
      value: '200988541',
    });
  });

  it('accepts separators in the sequence field', () => {
    const r = unpOrganization.generate({ region: '2', sequence: '009 88 54' }, mulberry32(1));
    expect(r.ok && r.value).toBe('200988541');
  });

  it('refuses a given sequence whose control number is 10 and suggests the nearest one', () => {
    expect(unpOrganization.generate({ region: '7', sequence: '1195368' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { sequence: 'Такой УНП не выдаётся (контрольное число 10). Ближайший подходящий номер — 1195369' },
    });
  });

  it('reports invalid fields', () => {
    expect(unpOrganization.generate({ region: '9', sequence: '12' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { region: 'Выберите область из списка', sequence: 'Семь цифр, от 0000000 до 9999999' },
    });
  });

  it('redraws a random region instead of failing a given sequence', () => {
    // 1195368 gives control number 10 only in region 7.
    for (let seed = 1; seed <= 60; seed++) {
      const r = unpOrganization.generate({ sequence: '1195368' }, mulberry32(seed));
      expect(r.ok).toBe(true);
    }
  });

  it('draws a random sequence that is issuable in the chosen region', () => {
    const sequence = unpOrganization.fields.find((f) => f.key === 'sequence')!;
    for (let seed = 1; seed <= 300; seed++) {
      const value = sequence.random(mulberry32(seed), { region: '7' });
      expect(unpOrganization.generate({ region: '7', sequence: value }, mulberry32(1)).ok).toBe(true);
    }
  });
});
