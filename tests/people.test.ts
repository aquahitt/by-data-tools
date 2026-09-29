import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { transliterate } from '../src/core/translit';
import { suggestOtherFormat } from '../src/formats';
import { card } from '../src/formats/card';
import { email } from '../src/formats/email';
import { ibanBy } from '../src/formats/iban';
import { idCard, residencePermit } from '../src/formats/idDocuments';
import { legacy } from '../src/formats/legacy';
import { passport1996 } from '../src/formats/passport1996';
import { generatePersona, PERSONA_FIELDS, toCsv, toJson } from '../src/formats/persona';
import { phoneMobile } from '../src/formats/phone';
import { postalCode } from '../src/formats/postal';
import { NAME_FORMATS } from '../src/formats/translitName';

const [be, ru] = NAME_FORMATS;

describe('transliteration — MVD instruction No. 288 (MFA table)', () => {
  // Examples published by the MFA; «Лябецкая – Liabetskaja» there contradicts its own rule «Е — IE после
  // согласной», so the rule is followed.
  it.each([
    ['Ева', 'JEVA'],
    ['Васільева', 'VASILJEVA'],
    ['Васілёнак', 'VASILIONAK'],
    ['Ёрш', 'JORSH'],
    ["Вераб'ёў", 'VIERABJOW'],
    ['Салаўёва', 'SALAWJOVA'],
    ['Любоў', 'LIUBOW'],
    ["В'юноў", 'VJUNOW'],
    ['Чарняк', 'CHARNIAK'],
    ["Дар'я", 'DARJA'],
  ])('%s → %s', (name, latin) => {
    expect(transliterate(name, 'be', 'mvd')).toBe(latin);
  });

  it('keeps E IU IA in the Russian form and J after Ъ', () => {
    expect(transliterate('Адъютантов', 'ru', 'mvd')).toBe('ADJUTANTOV');
    expect(transliterate('Юлия Ковалёва', 'ru', 'mvd')).toBe('IULIIA KOVALEVA');
  });
});

describe('transliteration — ICAO 9303', () => {
  it.each([
    ['Сяргей', 'be', 'SIARHEI'],
    ['Аляксандр', 'be', 'ALIAKSANDR'],
    ['Ганна', 'be', 'HANNA'],
    ['Сергей', 'ru', 'SERGEI'],
    ['Юрьевич', 'ru', 'IUREVICH'],
  ] as const)('%s (%s) → %s', (name, language, latin) => {
    expect(transliterate(name, language, 'icao')).toBe(latin);
  });
});

describe('name section', () => {
  it('shows both spellings of a full name', () => {
    expect(be.parse('  Кавалёва   Ганна  ')).toEqual([
      { label: 'Инструкция МВД № 288 (таблица МИД)', value: 'KAVALIOVA GANNA' },
      { label: 'ICAO 9303 (Г → H)', value: 'KAVALEVA HANNA' },
    ]);
  });

  it('points to the Russian form for letters the Belarusian alphabet lacks, and back', () => {
    expect(be.validate('Дмитрий').errors).toEqual([
      { code: 'ALPHABET', message: 'Буквы «И» нет в белорусском алфавите', position: 3 },
      { code: 'ALPHABET', message: 'Буквы «И» нет в белорусском алфавите', position: 6 },
    ]);
    expect(suggestOtherFormat('Дмитрий', 'be', NAME_FORMATS)?.id).toBe('ru');
    expect(suggestOtherFormat('Дзмітрый', 'ru', NAME_FORMATS)?.id).toBe('be');
  });

  it('rejects Latin letters and digits', () => {
    expect(ru.validate('Ivan').errors[0]).toEqual({ code: 'INVALID_CHAR', message: 'Латинская буква «I»: введите имя кириллицей', position: 1 });
    expect(ru.validate('Иван2').valid).toBe(false);
  });

  it('generates one person in Russian, Belarusian and Latin spelling', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = ru.generate({ gender: 'M' }, mulberry32(seed));
      if (!r.ok) throw new Error('generator failed');
      const [ruForm, beForm, icao, mvd] = r.variants!.map((v) => v.value);
      expect(r.variants!.map((v) => v.label)).toEqual(['RU', 'BY', 'EN (ICAO)', 'EN (МВД № 288)']);
      expect(r.value).toBe(ruForm);
      expect(ru.validate(ruForm).valid).toBe(true);
      expect(be.validate(beForm).valid).toBe(true);
      const [last, first] = beForm.split(' ');
      expect(icao).toBe(transliterate(`${last} ${first}`, 'be', 'icao'));
      expect(mvd).toBe(transliterate(`${last} ${first}`, 'be', 'mvd'));
      expect(ruForm.split(' ')[2]).toMatch(/вич$|ич$/);
      expect(beForm.split(' ')[2]).toMatch(/віч$/);
    }
  });

  it('pairs the Russian and Belarusian forms of the same name', () => {
    const r = be.generate({ gender: 'F' }, mulberry32(3));
    if (!r.ok) throw new Error('generator failed');
    const [ruForm, beForm] = r.variants!.map((v) => v.value);
    expect(r.value).toBe(beForm);
    expect(ruForm.split(' ')[2]).toMatch(/вна$|ична$/);
    expect(beForm.split(' ')[2]).toMatch(/ўна$/);
  });

  it('generates names of the chosen sex in the chosen spelling', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = be.generate({ gender: 'F' }, mulberry32(seed));
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(be.validate(r.value).valid).toBe(true);
        expect(r.value.split(' ')[2]).toMatch(/аўна$|еўна$|оўна$/);
      }
    }
  });
});

describe('ID card and residence permit', () => {
  it('accept two letters and seven digits', () => {
    expect(idCard.validate('AB 1234567').valid).toBe(true);
    expect(residencePermit.validate('ВМ1234567').normalized).toBe('BM1234567');
    expect(idCard.validate('AB123456').errors.map((e) => e.code)).toEqual(['LENGTH']);
  });
});

describe('persona', () => {
  const people = Array.from({ length: 200 }, (_, i) => generatePersona(mulberry32(i + 1)));

  it('fills every field with values the sections accept', () => {
    for (const p of people) {
      expect(Object.keys(p).sort()).toEqual(PERSONA_FIELDS.map((f) => f.key).sort());
      expect(legacy.validate(p.personalNumber).valid).toBe(true);
      expect(passport1996.validate(p.passport)).toMatchObject({ valid: true, warnings: [] });
      expect(phoneMobile.validate(p.phone).valid).toBe(true);
      expect(email.validate(p.email).valid).toBe(true);
      expect(postalCode.validate(p.postalCode)).toMatchObject({ valid: true, warnings: [] });
      expect(ibanBy.validate(p.iban)).toMatchObject({ valid: true, warnings: [] });
      expect(card.validate(p.card)).toMatchObject({ valid: true, warnings: [] });
    }
  });

  it('keeps sex, birth date and region consistent across documents', () => {
    for (const p of people) {
      const rows = Object.fromEntries(legacy.parse(p.personalNumber)!.map((r) => [r.label, r.value]));
      expect(rows['Пол']).toBe(p.gender);
      expect(rows['Дата рождения']).toBe(p.birthDate);
      expect(rows['Регион']).toContain(p.region);
      expect(passport1996.parse(p.passport)![0].value).toContain(p.region);
      expect(postalCode.parse(p.postalCode)![0].value).toContain(p.region);
      expect(p.email).toMatch(/@example\.com$/);
    }
  });

  it('honours the chosen sex and spelling', () => {
    const p = generatePersona(mulberry32(5), { gender: 'F', language: 'be' });
    expect(p.gender).toBe('женский');
    expect(be.validate(`${p.lastName} ${p.firstName} ${p.middleName}`).valid).toBe(true);
  });

  it('exports JSON and semicolon CSV with a header row', () => {
    const two = people.slice(0, 2);
    expect(JSON.parse(toJson(two))).toEqual(two);
    const lines = toCsv(two).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0].split(';')[0]).toBe('"Фамилия"');
    expect(lines[1].split(';')[0]).toBe(`"${two[0].lastName}"`);
  });
});
