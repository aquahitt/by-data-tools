import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { phoneLandline, phoneMobile } from '../src/formats/phone';

const codes = (input: string) => phoneMobile.validate(input).errors.map((e) => e.code);

describe('phoneMobile.validate', () => {
  it.each([
    '+375 (29) 123-45-67',
    '375291234567',
    '00375291234567',
    '80291234567',
    '8 029 123 45 67',
    '0291234567',
    '291234567',
  ])('accepts %j as +375291234567', (input) => {
    expect(phoneMobile.validate(input)).toEqual({ valid: true, normalized: '+375291234567', errors: [], warnings: [] });
  });

  it('rejects a landline code', () => {
    expect(phoneMobile.validate('+375 17 234-56-78').errors).toEqual([
      { code: 'CODE', message: 'Код мобильной сети «17» — ожидается 25, 29, 33 или 44' },
    ]);
  });

  it('rejects a wrong length or prefix', () => {
    expect(codes('+37529123456')).toEqual(['FORMAT']);
    expect(codes('7 029 1234567')).toEqual(['FORMAT']);
  });

  it('rejects letters with their position', () => {
    expect(phoneMobile.validate('+375 29 123-45-6X').errors).toEqual([
      { code: 'INVALID_CHAR', message: 'Недопустимый символ «X»', position: 17 },
    ]);
  });
});

describe('phoneMobile.parse', () => {
  it('shows operator and every notation', () => {
    expect(phoneMobile.parse('+375291234567')).toEqual([
      { label: 'Тип', value: 'мобильный' },
      { label: 'Оператор', value: '29 — A1' },
      { label: 'E.164', value: '+375291234567' },
      { label: 'Международный формат', value: '+375 29 123-45-67' },
      { label: 'Внутри страны', value: '8 029 123-45-67' },
    ]);
  });

  it.each([
    ['+375292345678', '29 — МТС'],
    ['+375294345678', '29 — оператор не определён'],
    ['+375251234567', '25 — life:)'],
    ['+375331234567', '33 — МТС'],
    ['+375441234567', '44 — A1'],
  ])('names the operator of %s', (number, operator) => {
    expect(phoneMobile.parse(number)?.[1].value).toBe(operator);
  });
});

describe('phoneMobile.generate', () => {
  it('builds from operator and subscriber number', () => {
    expect(phoneMobile.generate({ operator: '29-MTS', subscriber: '234-56-78' }, mulberry32(1))).toEqual({
      ok: true,
      value: '+375292345678',
      hint: 'Международный: +375 29 234-56-78 · внутри страны: 8 029 234-56-78',
    });
  });

  it('refuses a subscriber number of the other operator on code 29', () => {
    expect(phoneMobile.generate({ operator: '29-A1', subscriber: '2345678' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { subscriber: 'Для 29 A1 первая цифра — 1, 3, 6 или 9' },
    });
  });

  it('draws a subscriber number that belongs to the chosen operator', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = phoneMobile.generate({ operator: '29-A1' }, mulberry32(seed));
      expect(r.ok && phoneMobile.parse(r.value)?.[1].value).toBe('29 — A1');
    }
  });
});

describe('phoneLandline.validate', () => {
  it.each(['+375 17 234-56-78', '8 0152 12-34-56', '+375 (232) 12-34-56'])('accepts %j', (input) => {
    expect(phoneLandline.validate(input).valid).toBe(true);
  });

  it('rejects a mobile code', () => {
    expect(phoneLandline.validate('+375 29 123-45-67').errors).toEqual([
      { code: 'ZONE', message: 'Код зоны «29» не относится к стационарной сети (15, 16, 17, 21, 22, 23)' },
    ]);
  });
});

describe('phoneLandline.parse', () => {
  it('decodes a Minsk number', () => {
    expect(phoneLandline.parse('+375172345678')).toEqual([
      { label: 'Тип', value: 'стационарный' },
      { label: 'Область', value: '17 — г. Минск и Минская область' },
      { label: 'Город', value: 'г. Минск' },
      { label: 'E.164', value: '+375172345678' },
      { label: 'Международный формат', value: '+375 17 234-56-78' },
      { label: 'Внутри страны', value: '8 017 234-56-78' },
    ]);
  });

  it('decodes a regional centre with a three-digit code', () => {
    const fields = phoneLandline.parse('+375152123456');
    expect(fields?.[2].value).toBe('Гродно');
    expect(fields?.[4].value).toBe('+375 152 12-34-56');
    expect(fields?.[5].value).toBe('8 0152 12-34-56');
  });

  it('marks district codes', () => {
    expect(phoneLandline.parse('+375177123456')?.[2].value).toBe('Минская область (районный код)');
    expect(phoneLandline.parse('+375163123456')?.[2].value).toBe('районный код');
  });
});

describe('phoneLandline.generate', () => {
  it('builds Minsk and regional-centre numbers', () => {
    expect(phoneLandline.generate({ city: '17', subscriber: '2345678' }, mulberry32(1))).toEqual({
      ok: true,
      value: '+375172345678',
      hint: 'Международный: +375 17 234-56-78 · внутри страны: 8 017 234-56-78',
    });
    const r = phoneLandline.generate({ city: '152', subscriber: '12-34-56' }, mulberry32(1));
    expect(r.ok && r.value).toBe('+375152123456');
  });

  it('checks the subscriber length against the city', () => {
    expect(phoneLandline.generate({ city: '152', subscriber: '1234567' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { subscriber: 'Для Гродно — 6 цифр' },
    });
  });
});

describe('phone review fixes', () => {
  it.each(['+375 (029) 123-45-67', '+375 0 29 1234567', '3750291234567'])('accepts the trunk zero after +375 in %j', (input) => {
    expect(phoneMobile.validate(input).normalized).toBe('+375291234567');
    expect(phoneMobile.validate(input).valid).toBe(true);
  });

  it.each([
    ['17', '234567', 'Для Минска — 7 цифр'],
    ['162', '1234567', 'Для Бреста — 6 цифр'],
    ['212', '1234567', 'Для Витебска — 6 цифр'],
    ['222', '1234567', 'Для Могилёва — 6 цифр'],
    ['232', '1234567', 'Для Гомеля — 6 цифр'],
    ['152', '1234567', 'Для Гродно — 6 цифр'],
  ])('names city %s in the genitive', (city, subscriber, message) => {
    expect(phoneLandline.generate({ city, subscriber }, mulberry32(1))).toEqual({ ok: false, fieldErrors: { subscriber: message } });
  });

  it('refuses a Minsk subscriber number that parse would call a district code', () => {
    expect(phoneLandline.generate({ city: '17', subscriber: '1234567' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { subscriber: 'Для Минска первая цифра — 2 или 3' },
    });
  });
});

describe('phone input follow-ups', () => {
  it.each(['+29 123 45 67', '+80291234567'])('rejects a + that is not followed by 375 in %j', (input) => {
    expect(phoneMobile.validate(input).errors).toEqual([
      { code: 'FORMAT', message: 'После «+» ожидается код страны 375' },
    ]);
  });

  it('rejects a + in the middle with its position', () => {
    expect(phoneMobile.validate('29+1234567').errors).toEqual([
      { code: 'INVALID_CHAR', message: 'Недопустимый символ «+»', position: 3 },
    ]);
  });

  it('reports every bad character at its position in the typed text', () => {
    expect(phoneMobile.validate('+375 29 1x3 4y 67').errors).toEqual([
      { code: 'INVALID_CHAR', message: 'Недопустимый символ «x»', position: 10 },
      { code: 'INVALID_CHAR', message: 'Недопустимый символ «y»', position: 14 },
    ]);
  });

  it('ignores zero-width separators and names other invisible characters by code point', () => {
    expect(phoneMobile.validate('+375 29 123\u200b45\u00ad67').valid).toBe(true);
    expect(phoneMobile.validate('+375 29 123\u206345 67').errors).toEqual([
      { code: 'INVALID_CHAR', message: 'Недопустимый невидимый символ U+2063', position: 12 },
    ]);
  });

  it('accepts 00375 for landline numbers', () => {
    expect(phoneLandline.validate('00375 17 234-56-78').normalized).toBe('+375172345678');
  });

  it('does not split district numbers at a guessed code boundary', () => {
    const lida = phoneLandline.parse('+375154123456');
    expect(lida?.[4].value).toBe('+375 154123456');
    expect(lida?.[5].value).toBe('8 0154123456');
    expect(phoneLandline.parse('+375177123456')?.[4].value).toBe('+375 177123456');
  });

  it('generates landline numbers that parse back to a regional centre', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = phoneLandline.generate({}, mulberry32(seed));
      expect(r.ok).toBe(true);
      if (r.ok) expect(phoneLandline.parse(r.value)?.[2].value).not.toContain('код');
    }
  });
});

describe('phone paste follow-ups', () => {
  it.each([
    ['bidi embedding', '\u202a+375 29 123-45-67\u202c'],
    ['left-to-right mark', '\u200e+375291234567'],
    ['plus inside a bracket', '(+375 29) 123-45-67'],
  ])('accepts a number with %s', (_name, input) => {
    expect(phoneMobile.validate(input)).toEqual({ valid: true, normalized: '+375291234567', errors: [], warnings: [] });
  });

  it('counts positions in the text as typed, leading spaces included', () => {
    expect(phoneMobile.validate('  +375 29 12x 45 67').errors).toEqual([
      { code: 'INVALID_CHAR', message: 'Недопустимый символ «x»', position: 13 },
    ]);
  });
});

