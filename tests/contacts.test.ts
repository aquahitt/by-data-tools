import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { email } from '../src/formats/email';
import { imei, imeisv } from '../src/formats/imei';

const codes = (r: { errors: { code: string }[] }) => r.errors.map((e) => e.code);

describe('email', () => {
  it.each(['ivan.ivanov@example.com', 'a+tag@mail.by', "o'brien@gmail.com", 'test@пример.бел', ' user@sub.domain.by '])('accepts %s', (input) => {
    expect(email.validate(input).valid).toBe(true);
  });

  it.each([
    ['ivan.example.com', 'FORMAT'],
    ['a@b@example.com', 'FORMAT'],
    ['.ivan@example.com', 'DOT'],
    ['iv..an@example.com', 'DOT'],
    ['ivan@localhost', 'DOMAIN'],
    ['ivan@-example.com', 'DOMAIN'],
    ['ivan@example.c1', 'TLD'],
    ['иван@example.com', 'INVALID_CHAR'],
  ])('rejects %s (%s)', (input, code) => {
    expect(codes(email.validate(input))).toContain(code);
  });

  it('marks .by, .бел and reserved domains', () => {
    expect(email.parse('a@mail.by')?.[2].value).toBe('by — Беларусь');
    expect(email.parse('a@пример.бел')?.[2].value).toBe('бел — Беларусь (кириллическая зона)');
    expect(email.parse('a@example.com')?.at(-1)?.label).toBe('Резервный домен');
  });

  it('generates addresses on reserved domains unless a real one is chosen', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = email.generate({}, mulberry32(seed));
      expect(r.ok && r.value).toMatch(/@(example\.com|example\.org|mail\.test)$/);
    }
    const real = email.generate({ domain: 'gmail.com' }, mulberry32(1));
    expect(real.ok && real.hint).toContain('может принадлежать живому человеку');
  });
});

describe('IMEI', () => {
  it('accepts the 3GPP example and rejects a changed digit', () => {
    expect(imei.validate('49-015420-323751-8').valid).toBe(true);
    expect(imei.validate('490154203237517').errors).toEqual([
      { code: 'CHECK_DIGIT', message: 'Контрольная цифра 7, по алгоритму Луна ожидается 8', position: 15 },
    ]);
  });

  it('reads IMEISV without a check digit', () => {
    expect(imeisv.validate('IMEISV 4901542032375101').valid).toBe(true);
    expect(imeisv.parse('4901542032375101')?.[2]).toEqual({ label: 'Версия ПО', value: '01' });
    expect(codes(imeisv.validate('490154203237518'))).toEqual(['LENGTH']);
  });
});
