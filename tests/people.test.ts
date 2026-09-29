import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/random';
import { transliterate } from '../src/core/translit';
import { card } from '../src/formats/card';
import { email } from '../src/formats/email';
import { ibanBy } from '../src/formats/iban';
import { idCard, residencePermit } from '../src/formats/idDocuments';
import { legacy } from '../src/formats/legacy';
import { passport1996 } from '../src/formats/passport1996';
import { generatePersona, PERSONA_FIELDS } from '../src/formats/persona';
import { toCsv, toJson } from '../src/formats/records';
import { phoneMobile } from '../src/formats/phone';
import { postalCode } from '../src/formats/postal';
import { nameFormat } from '../src/formats/translitName';


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
  it('reads a Belarusian name by І, Ў or the apostrophe and shows both schemes', () => {
    expect(nameFormat.parse('  Кавалёва   Ганна  Іванаўна')).toEqual([
      { label: 'Написание', value: 'белорусское (есть І, Ў или апостроф)' },
      { label: 'RU', value: 'Ковалёва Анна Ивановна' },
      { label: 'BY', value: 'Кавалёва Ганна Іванаўна' },
      { label: 'ICAO 9303', value: 'KAVALEVA HANNA IVANAUNA' },
      { label: 'Инструкция МВД № 288', value: 'KAVALIOVA GANNA IVANAWNA' },
    ]);
  });

  it('reads a Russian name by И, Щ or Ъ and gives its Belarusian form and passport spelling', () => {
    expect(nameFormat.parse('Иванов Сергей Петрович')).toEqual([
      { label: 'Написание', value: 'русское (есть И, Щ или Ъ)' },
      { label: 'RU', value: 'Иванов Сергей Петрович' },
      { label: 'BY', value: 'Іваноў Сяргей Пятровіч' },
      { label: 'Латиница из белорусской формы (ICAO, как в паспорте)', value: 'IVANOU SIARHEI' },
      { label: 'ICAO 9303', value: 'IVANOV SERGEI PETROVICH' },
      { label: 'Инструкция МВД № 288', value: 'IVANOV SERGEJ PETROVICH' },
    ]);
  });

  it('keeps the case of the input and converts double surnames part by part', () => {
    expect(nameFormat.parse('ПЕТРОВА ЕЛЕНА ВИКТОРОВНА')?.[2]).toEqual({ label: 'BY', value: 'ПЯТРОВА АЛЕНА ВІКТАРАЎНА' });
    expect(nameFormat.parse('Смирнова-Петрова Анна')?.[2]).toEqual({ label: 'BY', value: 'Смірнова-Пятрова Ганна' });
  });

  it('tells the surname from the patronymic by position (Богданович)', () => {
    expect(nameFormat.parse('Богданович Анна Богдановна')?.[2]).toEqual({ label: 'BY', value: 'Багдановіч Ганна Багданаўна' });
  });

  it('names the words it cannot translate and gives no passport spelling then', () => {
    const rows = nameFormat.parse('Сидорчук Иван')!;
    expect(rows.slice(1, 4)).toEqual([
      { label: 'RU', value: 'Сидорчук Иван' },
      { label: 'BY', value: 'Сидорчук Іван' },
      { label: 'Нет в словаре — оставлено как есть', value: 'Сидорчук' },
    ]);
    expect(rows.some((r) => r.label.startsWith('Латиница из белорусской'))).toBe(false);
  });

  it('translates every generated name both ways', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = nameFormat.generate({}, mulberry32(seed));
      if (!r.ok) throw new Error('generator failed');
      const [ruForm, beForm] = r.variants!.map((v) => v.value);
      const fromRu = nameFormat.parse(ruForm)!;
      const fromBe = nameFormat.parse(beForm)!;
      const value = (rows: typeof fromRu, label: string) => rows.find((x) => x.label === label || x.label === 'RU и BY')?.value;
      expect(value(fromRu, 'BY')).toBe(beForm);
      expect(value(fromBe, 'RU')).toBe(ruForm);
    }
  });

  it('shows both readings when the letters do not tell and the Latin differs', () => {
    expect(nameFormat.parse('Гук Ева')).toEqual([
      { label: 'Написание', value: 'не определяется — нет букв І, Ў, И, Щ, Ъ' },
      { label: 'RU и BY', value: 'Гук Ева' },
      { label: 'Нет в словаре — оставлено как есть', value: 'Гук, Ева' },
      { label: 'ICAO 9303, если белорусское', value: 'HUK EVA' },
      { label: 'ICAO 9303, если русское', value: 'GUK EVA' },
      { label: 'Инструкция МВД № 288, если белорусское', value: 'GUK JEVA' },
      { label: 'Инструкция МВД № 288, если русское', value: 'GUK EVA' },
    ]);
    // Same Latin in both readings collapses into one row.
    expect(nameFormat.parse('Павел Жук')?.slice(2)).toEqual([
      { label: 'ICAO 9303', value: 'PAVEL ZHUK' },
      { label: 'Инструкция МВД № 288, если белорусское', value: 'PAVIEL ZHUK' },
      { label: 'Инструкция МВД № 288, если русское', value: 'PAVEL ZHUK' },
    ]);
  });

  it('rejects mixed alphabets at the Russian letters', () => {
    expect(nameFormat.validate('Дзмітрий').errors).toEqual([
      { code: 'MIXED', message: 'Буква «И» — из русского алфавита, а в тексте есть белорусские І, Ў или апостроф', position: 7 },
    ]);
  });

  it('rejects Latin letters and digits', () => {
    expect(nameFormat.validate('Ivan').errors[0]).toEqual({ code: 'INVALID_CHAR', message: 'Латинская буква «I»: введите имя кириллицей', position: 1 });
    expect(nameFormat.validate('Иван2').valid).toBe(false);
  });

  it('generates one person in Russian, Belarusian and Latin spelling', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const r = nameFormat.generate({ gender: seed % 2 ? 'M' : 'F' }, mulberry32(seed));
      if (!r.ok) throw new Error('generator failed');
      const [ruForm, beForm, icao, mvd] = r.variants!.map((v) => v.value);
      expect(r.variants!.map((v) => v.label)).toEqual(['RU', 'BY', 'EN (ICAO)', 'EN (МВД № 288)']);
      expect(r.value).toBe(ruForm);
      expect(nameFormat.validate(ruForm).valid).toBe(true);
      expect(nameFormat.validate(beForm).valid).toBe(true);
      const [last, first] = beForm.split(' ');
      expect(icao).toBe(transliterate(`${last} ${first}`, 'be', 'icao'));
      expect(mvd).toBe(transliterate(`${last} ${first}`, 'be', 'mvd'));
      if (seed % 2) {
        expect(ruForm.split(' ')[2]).toMatch(/ич$/);
        expect(beForm.split(' ')[2]).toMatch(/іч$/);
      } else {
        expect(ruForm.split(' ')[2]).toMatch(/вна$|ична$/);
        expect(beForm.split(' ')[2]).toMatch(/ўна$|ічна$/);
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
      expect(p.address.startsWith(`${p.postalCode}, `)).toBe(true);
      expect(p.email).toMatch(/@example\.com$/);
    }
  });

  it('gives the name in both spellings of the same person, Latin from the Belarusian form', () => {
    const p = generatePersona(mulberry32(5), { gender: 'F' });
    expect(p.gender).toBe('женский');
    for (const q of [p, ...people]) {
      expect(nameFormat.parse(`${q.lastName} ${q.firstName} ${q.middleName}`)).not.toBeNull();
      expect(nameFormat.validate(`${q.lastNameBy} ${q.firstNameBy} ${q.middleNameBy}`).valid).toBe(true);
      expect(q.latinName).toBe(transliterate(`${q.lastNameBy} ${q.firstNameBy}`, 'be', 'icao'));
    }
  });

  it('exports JSON and semicolon CSV with a header row', () => {
    const two = people.slice(0, 2);
    expect(JSON.parse(toJson(two))).toEqual(two);
    const lines = toCsv(PERSONA_FIELDS, two).split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0].split(';')[0]).toBe('"Фамилия (RU)"');
    expect(lines[1].split(';')[0]).toBe(`"${two[0].lastName}"`);
  });
});
