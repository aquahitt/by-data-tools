# Sidebar Navigation and Passport Number Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-page tool into a set of sections behind a categorized left navigation drawer, and add a "Номер паспорта" section (1996-model and biometric formats) with validation, parsing, generation and the MRZ check digit.

**Architecture:** A tool registry (`src/tools`) lists categories and sections; each section owns a list of `FormatModule`s. Pure hash-route functions (`src/ui/router.ts`) pick the section; `src/ui/formatState.ts` stays the only module writing the URL or `localStorage`, now keyed per section. A tool page is assembled from the existing format switch and validate/generate cards. Two new format modules share one passport helper built on a generalized ICAO check digit and a template-driven structure check.

**Tech Stack:** Vite 8, TypeScript 5.9, Vitest 4, `@material/web` 2.5 — unchanged.

**Spec:** `docs/superpowers/specs/2026-09-28-sidebar-passport-number-design.md` (builds on `docs/superpowers/specs/2026-09-28-by-personal-number-design.md`).

**Project root:** `/Users/aramanouski/Work/repositories/qa/tools/by-data-tools`, branch `feat/sidebar-passport`. Git identity is set locally to the GitHub noreply address — never change it.

## Global Constraints

- Routes: `#/personal-number`, `#/passport-number`; format as hash param `#/<tool>?format=<id>`. Empty, unknown and "скоро" routes → `#/personal-number` via `history.replaceState`.
- First-version links `?format=legacy` (query outside the hash) open `#/personal-number?format=legacy`; the outside `format` param is removed.
- Storage key per tool: `by-data-tools:format:<tool-id>`; first-version key `by-data-tools:format` is read for `personal-number` only.
- The number never goes to the URL or `localStorage`. Only `src/ui/formatState.ts` may write URL/history/storage.
- Menu: **Документы** — Идентификационный номер, Номер паспорта; **Организации** — УНП (скоро); **Финансы** — IBAN / номер счёта (скоро); **Контакты** — Телефон (скоро).
- Drawer: persistent ≥ 840px (280px wide), modal < 840px with ☰, scrim, `Escape`, focus moves in on open and back to ☰ on close.
- Passport number: `LLDDDDDDD`. 1996 unknown series → warning. Biometric: any two Latin letters, no series warning; `DP` → «дипломатический паспорт».
- MRZ check digit: ICAO 9303 7-3-1, `A=10…Z=35`, `<`=0, shown as `<number><digit>`.
- Format ids: personal number `modern`, `legacy`; passport `1996`, `biometric`.
- UI language Russian; code, comments, commits English.

Rulings baked into this plan (deviations from the spec's letter):
- `Tool` gets an `inputLabel` field — the validate field label was hardcoded «Идентификационный номер»; the passport section needs «Серия и номер паспорта».
- `GenerateResult` ok-variant gets an optional `hint` — the spec asks the generator to show the MRZ fragment; the hint carries it.
- `FieldSpec` gets an optional `normalize` — the biometric series text field must accept Cyrillic lookalikes (spec, "Генерация").

## Review Focus

1. **Passport pasted with Cyrillic series and separators** (`МР 123-45-67`) — expected: valid `MP1234567` with the Cyrillic warning. Pinned in Task 2.
2. **Old bookmark `…/by-data-tools/?format=legacy`** — expected: personal number in pre-2012 format, URL rewritten to the hash form. Pinned in Task 4 (`resolveRoute`) and Task 5 smoke.
3. **A pasted or typed URL for a "скоро" or unknown section** (`#/unp`, `#/foo`) — expected: default section, no blank page. Pinned in Task 4.
4. **A stored or linked format that belongs to another section** (`#/passport-number?format=legacy`) — expected: the section's first format, never a crash. Pinned in Task 5 (`resolveFormatId`).
5. **Phone-width navigation** — expected: drawer hidden, ☰ opens it, `Escape`/scrim/item close it, focus returns to ☰, off-screen drawer not tabbable. Pinned in Task 5 smoke.

---

## Files

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/core/types.ts` | `FormatId = string`, `FieldSpec.normalize`, `GenerateResult.hint` |
| Modify | `src/core/checkDigit.ts` | `icaoCheckDigit`, `<` = 0 |
| Modify | `src/core/structure.ts` | template-driven structure check |
| Modify | `src/core/fields.ts` | apply `normalize` before `check` |
| Modify | `src/formats/modern.ts`, `src/formats/legacy.ts` | pass their template |
| Create | `src/formats/passportCommon.ts` | shared passport validate/parse/generate + number field |
| Create | `src/formats/passport1996.ts` | 1996 series table and format |
| Create | `src/formats/passportBiometric.ts` | biometric format |
| Modify | `src/formats/index.ts` | per-tool format lists, `suggestOtherFormat(input, current, formats)` |
| Create | `src/tools/index.ts` | categories, tools, lookups |
| Create | `src/ui/router.ts` | pure hash-route functions |
| Modify | `src/ui/formatState.ts` | per-tool keys, first-version key, hash URL |
| Create | `src/ui/sidebar.ts` | navigation drawer |
| Create | `src/ui/toolPage.ts` | one section page |
| Modify | `src/ui/validatePanel.ts` | options object: formats, label |
| Modify | `src/ui/generatePanel.ts` | render `hint` |
| Modify | `src/ui/icons.ts` | `menu` icon |
| Modify | `src/ui/theme.css` | drawer layout |
| Modify | `src/main.ts`, `index.html` | app shell and routing |
| Modify/Create | `tests/*.test.ts` | per module |
| Modify | `README.md` | new section, navigation |

---

### Task 1: Core generalization

**Files:**
- Modify: `src/core/types.ts`, `src/core/checkDigit.ts`, `src/core/structure.ts`, `src/core/fields.ts`, `src/formats/modern.ts`, `src/formats/legacy.ts`
- Test: `tests/checkDigit.test.ts`, `tests/structure.test.ts`, `tests/fields.test.ts`

**Interfaces:**
- Produces:
  - `type FormatId = string`
  - `FieldSpec.normalize?(value: string): string`
  - `GenerateResult = { ok: true; value: string; hint?: string } | { ok: false; fieldErrors: Record<string, string> }`
  - `charValue('<') === 0`, `icaoCheckDigit(s: string): number` (any length), `checkDigit731(body13)` unchanged contract
  - `PERSONAL_NUMBER_TEMPLATE = 'DDDDDDDLDDDLLD'`, `PASSPORT_NUMBER_TEMPLATE = 'LLDDDDDDD'`, `structureIssues(value: string, template: string): Issue[]` (`NUMBER_LENGTH` removed)

- [ ] **Step 1: Write failing tests**

Append to `tests/checkDigit.test.ts` (and change its import to `import { charValue, checkDigit731, icaoCheckDigit } from '../src/core/checkDigit';`):
```ts
describe('icaoCheckDigit', () => {
  it.each([
    ['L898902C3', 6], // ICAO 9303 specimen passport
    ['MP1234567', 7],
    ['AB0000000', 3],
    ['DP1234567', 4],
    ['HB7654321', 8],
  ])('%s -> %i', (value, expected) => {
    expect(icaoCheckDigit(value)).toBe(expected);
  });

  it('treats the < filler as 0', () => {
    expect(charValue('<')).toBe(0);
    expect(icaoCheckDigit('L898902C<')).toBe(3);
  });
});
```

Replace `tests/structure.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { PASSPORT_NUMBER_TEMPLATE, PERSONAL_NUMBER_TEMPLATE, structureIssues } from '../src/core/structure';

describe('structureIssues — personal number', () => {
  it('accepts the 7-digit, letter, 3-digit, 2-letter, digit template', () => {
    expect(structureIssues('7000000A000PB1', PERSONAL_NUMBER_TEMPLATE)).toEqual([]);
  });

  it('reports wrong length only', () => {
    expect(structureIssues('7000000A000PB', PERSONAL_NUMBER_TEMPLATE)).toEqual([
      { code: 'LENGTH', message: 'Длина 13, ожидается 14 символов' },
    ]);
  });

  it('reports each misplaced character with its position', () => {
    expect(structureIssues('70000A0A000P11', PERSONAL_NUMBER_TEMPLATE)).toEqual([
      { code: 'STRUCTURE', message: 'Ожидается цифра', position: 6 },
      { code: 'STRUCTURE', message: 'Ожидается латинская буква', position: 13 },
    ]);
  });
});

describe('structureIssues — passport number', () => {
  it('accepts two letters and seven digits', () => {
    expect(structureIssues('MP1234567', PASSPORT_NUMBER_TEMPLATE)).toEqual([]);
  });

  it('reports wrong length', () => {
    expect(structureIssues('MP123456', PASSPORT_NUMBER_TEMPLATE)).toEqual([
      { code: 'LENGTH', message: 'Длина 8, ожидается 9 символов' },
    ]);
  });

  it('reports a digit in the series', () => {
    expect(structureIssues('M11234567', PASSPORT_NUMBER_TEMPLATE)).toEqual([
      { code: 'STRUCTURE', message: 'Ожидается латинская буква', position: 2 },
    ]);
  });
});
```

Append inside the `describe('resolveFields', …)` block of `tests/fields.test.ts`:
```ts
  it('normalizes a given value before checking it', () => {
    const upper: FieldSpec = {
      key: 'u',
      label: 'Upper',
      kind: 'text',
      normalize: (v) => v.toUpperCase(),
      check: (v) => (v === 'AB' ? null : 'bad'),
      random: () => 'AB',
    };
    expect(resolveFields([upper], { u: 'ab' }, mulberry32(1))).toEqual({ values: { u: 'AB' }, fieldErrors: {} });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `icaoCheckDigit is not a function`; `PASSPORT_NUMBER_TEMPLATE` undefined so passport structure tests fail; the normalize test fails with `fieldErrors: { u: 'bad' }`.

- [ ] **Step 3: Implement**

`src/core/types.ts` — three edits:
```ts
export interface FieldSpec {
  key: string;
  label: string;
  kind: 'text' | 'select';
  options?: FieldOption[];
  placeholder?: string;
  /** Applied to a user-given value before `check` (e.g. Cyrillic lookalikes → Latin). */
  normalize?(value: string): string;
  check(value: string): string | null;
  random(rng: Rng): string;
}

export type GenerateResult =
  | { ok: true; value: string; hint?: string }
  | { ok: false; fieldErrors: Record<string, string> };

export type FormatId = string;
```

`src/core/checkDigit.ts` — full content:
```ts
const WEIGHTS = [7, 3, 1] as const;

/** Character value per MVD No. 345 item 1.3 and ICAO 9303: 0-9 as is, A..Z = 10..35, filler '<' = 0. */
export function charValue(ch: string): number {
  if (ch === '<') return 0;
  const code = ch.charCodeAt(0);
  if (ch.length === 1 && code >= 48 && code <= 57) return code - 48;
  if (ch.length === 1 && code >= 65 && code <= 90) return code - 55;
  throw new RangeError(`Invalid character: ${ch}`);
}

/** Mod-10 check digit with repeating 7-3-1 weights (ICAO 9303 part 3, 4.9). */
export function icaoCheckDigit(value: string): number {
  let sum = 0;
  for (let i = 0; i < value.length; i++) sum += charValue(value[i]) * WEIGHTS[i % 3];
  return sum % 10;
}

/** Personal-number check digit over its first 13 characters (MVD No. 345 item 1.2). */
export function checkDigit731(body: string): number {
  if (body.length !== 13) throw new RangeError(`Expected 13 characters, got ${body.length}`);
  return icaoCheckDigit(body);
}
```

`src/core/structure.ts` — full content:
```ts
import type { Issue } from './types';

// D = digit, L = Latin letter.
export const PERSONAL_NUMBER_TEMPLATE = 'DDDDDDDLDDDLLD'; // ЦЦЦЦЦЦЦ Б ЦЦЦ ББ Ц
export const PASSPORT_NUMBER_TEMPLATE = 'LLDDDDDDD'; //       ББ ЦЦЦЦЦЦЦ

export function structureIssues(value: string, template: string): Issue[] {
  if (value.length !== template.length) {
    return [{ code: 'LENGTH', message: `Длина ${value.length}, ожидается ${template.length} символов` }];
  }
  const issues: Issue[] = [];
  for (let i = 0; i < template.length; i++) {
    const wantDigit = template[i] === 'D';
    const ok = wantDigit ? /^[0-9]$/.test(value[i]) : /^[A-Z]$/.test(value[i]);
    if (!ok) {
      issues.push({
        code: 'STRUCTURE',
        message: wantDigit ? 'Ожидается цифра' : 'Ожидается латинская буква',
        position: i + 1,
      });
    }
  }
  return issues;
}
```

`src/core/fields.ts` — replace the line `const value = given ? given : field.random(rng);` with:
```ts
    const value = given ? (field.normalize ? field.normalize(given) : given) : field.random(rng);
```

`src/formats/modern.ts` and `src/formats/legacy.ts` — in each file:
```bash
sed -i '' "s/import { structureIssues } from '..\/core\/structure';/import { PERSONAL_NUMBER_TEMPLATE, structureIssues } from '..\/core\/structure';/; s/structureIssues(n.value)/structureIssues(n.value, PERSONAL_NUMBER_TEMPLATE)/g" src/formats/modern.ts src/formats/legacy.ts
grep -c "PERSONAL_NUMBER_TEMPLATE" src/formats/modern.ts src/formats/legacy.ts
```
Expected: each file prints `3` (import + two calls).

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: all tests PASS (87 previous + new); no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/core src/formats/modern.ts src/formats/legacy.ts tests/checkDigit.test.ts tests/structure.test.ts tests/fields.test.ts
git commit -m "refactor(core): ICAO check digit, template structure check, field normalization"
```

---

### Task 2: Passport number formats

**Files:**
- Create: `src/formats/passportCommon.ts`, `src/formats/passport1996.ts`, `src/formats/passportBiometric.ts`
- Test: `tests/passport1996.test.ts`, `tests/passportBiometric.test.ts`

**Interfaces:**
- Consumes: Task 1 (`icaoCheckDigit`, `PASSPORT_NUMBER_TEMPLATE`, `structureIssues`, `FieldSpec.normalize`, `GenerateResult.hint`), `normalize`, `resolveFields`, `pad`, `pick`, `randInt`.
- Produces: `passport1996: FormatModule` (`id: '1996'`, `title: 'Образца 1996 г.'`), `SERIES_1996: Record<string, string>`, `passportBiometric: FormatModule` (`id: 'biometric'`, `title: 'Биометрический (с 2021)'`, `notice` set). Field keys: `series`, `number`.

- [ ] **Step 1: Write failing tests**

`tests/passport1996.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { passport1996 } from '../src/formats/passport1996';
import { mulberry32 } from '../src/core/random';

describe('passport1996.validate', () => {
  it.each(['MP1234567', 'AB0000000', 'DP1234567'])('accepts %s', (n) => {
    expect(passport1996.validate(n)).toEqual({ valid: true, normalized: n, errors: [], warnings: [] });
  });

  it('accepts Cyrillic series with separators, with a warning', () => {
    const r = passport1996.validate('МР 123-45-67');
    expect(r.valid).toBe(true);
    expect(r.normalized).toBe('MP1234567');
    expect(r.warnings.map((w) => w.code)).toEqual(['CYRILLIC_REPLACED']);
  });

  it('keeps an unknown series valid with a warning at position 1', () => {
    const r = passport1996.validate('XX1234567');
    expect(r.valid).toBe(true);
    expect(r.warnings).toEqual([
      { code: 'UNKNOWN_SERIES', message: 'Серия «XX» не из известного списка серий паспорта образца 1996 г.', position: 1 },
    ]);
  });

  it('rejects wrong length and structure', () => {
    expect(passport1996.validate('MP123456').errors.map((e) => e.code)).toEqual(['LENGTH']);
    expect(passport1996.validate('M11234567').errors).toEqual([
      { code: 'STRUCTURE', message: 'Ожидается латинская буква', position: 2 },
    ]);
  });
});

describe('passport1996.parse', () => {
  it('decodes series, number and MRZ check digit', () => {
    expect(passport1996.parse('MP1234567')).toEqual([
      { label: 'Серия', value: 'MP — г. Минск' },
      { label: 'Номер', value: '1234567' },
      { label: 'Номер документа в MRZ (с контрольной цифрой)', value: 'MP12345677' },
    ]);
  });

  it('marks an unknown series', () => {
    expect(passport1996.parse('XX1234567')?.[0].value).toBe('XX — неизвестная серия');
  });

  it('returns null when the structure is broken', () => {
    expect(passport1996.parse('MP12')).toBeNull();
  });
});

describe('passport1996.generate', () => {
  it('builds from given fields and reports the MRZ fragment', () => {
    expect(passport1996.generate({ series: 'HB', number: '7654321' }, mulberry32(1))).toEqual({
      ok: true,
      value: 'HB7654321',
      hint: 'Номер документа в MRZ: HB76543218',
    });
  });

  it('reports invalid fields', () => {
    expect(passport1996.generate({ series: 'XX', number: '12' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { series: 'Выберите серию из списка', number: 'Семь цифр, от 0000000 до 9999999' },
    });
  });
});
```

`tests/passportBiometric.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { passportBiometric } from '../src/formats/passportBiometric';
import { mulberry32 } from '../src/core/random';

describe('passportBiometric.validate', () => {
  it.each(['XY1234567', 'AB0000000', 'DP1234567'])('accepts %s without warnings', (n) => {
    expect(passportBiometric.validate(n)).toEqual({ valid: true, normalized: n, errors: [], warnings: [] });
  });

  it('rejects a broken structure', () => {
    expect(passportBiometric.validate('1P1234567').errors.map((e) => e.code)).toEqual(['STRUCTURE']);
  });
});

describe('passportBiometric.parse', () => {
  it('names DP as diplomatic', () => {
    expect(passportBiometric.parse('DP1234567')).toEqual([
      { label: 'Серия', value: 'DP — дипломатический паспорт' },
      { label: 'Номер', value: '1234567' },
      { label: 'Номер документа в MRZ (с контрольной цифрой)', value: 'DP12345674' },
    ]);
  });

  it('describes other series as unpublished', () => {
    expect(passportBiometric.parse('AB0000000')?.[0].value).toBe('AB — серия бланка (официально не опубликована)');
    expect(passportBiometric.parse('AB0000000')?.[2].value).toBe('AB00000003');
  });
});

describe('passportBiometric.generate', () => {
  it('accepts a Cyrillic series typed into the field', () => {
    expect(passportBiometric.generate({ series: 'мр', number: '1234567' }, mulberry32(1))).toEqual({
      ok: true,
      value: 'MP1234567',
      hint: 'Номер документа в MRZ: MP12345677',
    });
  });

  it('rejects a series that is not two letters', () => {
    expect(passportBiometric.generate({ series: 'M1' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { series: 'Две латинские буквы' },
    });
  });

  it('draws two random letters when the series is empty', () => {
    const r = passportBiometric.generate({ number: '0000001' }, mulberry32(9));
    expect(r.ok && /^[A-Z]{2}0000001$/.test(r.value)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/passport1996.test.ts tests/passportBiometric.test.ts`
Expected: FAIL — `Cannot find module '../src/formats/passport1996'` and `'../src/formats/passportBiometric'`.

- [ ] **Step 3: Implement**

`src/formats/passportCommon.ts`:
```ts
import { icaoCheckDigit } from '../core/checkDigit';
import { resolveFields } from '../core/fields';
import { normalize } from '../core/normalize';
import { pad, randInt } from '../core/random';
import { PASSPORT_NUMBER_TEMPLATE, structureIssues } from '../core/structure';
import type { FieldSpec, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// Series (two Latin letters) + seven digits. The number has no check digit of its own;
// the machine-readable zone adds one per ICAO 9303.

export const NUMBER_FIELD: FieldSpec = {
  key: 'number',
  label: 'Номер (7 цифр)',
  kind: 'text',
  placeholder: '1234567',
  check: (v) => (/^\d{7}$/.test(v) ? null : 'Семь цифр, от 0000000 до 9999999'),
  random: (rng) => pad(randInt(rng, 0, 9_999_999), 7),
};

export const mrzNumber = (value: string): string => `${value}${icaoCheckDigit(value)}`;

export function validatePassport(input: string, seriesWarning: (series: string) => Issue | null): ValidationResult {
  const n = normalize(input);
  const errors: Issue[] = [...n.errors];
  const warnings: Issue[] = [...n.warnings];
  if (errors.length === 0) errors.push(...structureIssues(n.value, PASSPORT_NUMBER_TEMPLATE));
  if (errors.length === 0) {
    const warning = seriesWarning(n.value.slice(0, 2));
    if (warning) warnings.push(warning);
  }
  return { valid: errors.length === 0, normalized: n.value, errors, warnings };
}

export function parsePassport(input: string, describeSeries: (series: string) => string): ParsedField[] | null {
  const n = normalize(input);
  if (n.errors.length > 0 || structureIssues(n.value, PASSPORT_NUMBER_TEMPLATE).length > 0) return null;
  const v = n.value;
  return [
    { label: 'Серия', value: `${v.slice(0, 2)} — ${describeSeries(v.slice(0, 2))}` },
    { label: 'Номер', value: v.slice(2) },
    { label: 'Номер документа в MRZ (с контрольной цифрой)', value: mrzNumber(v) },
  ];
}

export function generatePassport(fields: FieldSpec[], partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const value = `${values.series}${values.number}`;
  return { ok: true, value, hint: `Номер документа в MRZ: ${mrzNumber(value)}` };
}
```

`src/formats/passport1996.ts`:
```ts
import { pick } from '../core/random';
import type { FieldSpec, FormatModule } from '../core/types';
import { generatePassport, NUMBER_FIELD, parsePassport, validatePassport } from './passportCommon';

// Series of the 1996-model passport by issuing authority. No single official list is published;
// taken from ru.wikipedia.org and ru.migrapedia.org (see spec). Change them here and nowhere else.
export const SERIES_1996: Record<string, string> = {
  AB: 'Брестская область',
  BM: 'Витебская область',
  HB: 'Гомельская область',
  KH: 'Гродненская область',
  MP: 'г. Минск',
  MC: 'Минская область',
  KB: 'Могилёвская область',
  PP: 'МИД (гражданам, проживающим за границей)',
  SP: 'служебный паспорт',
  DP: 'дипломатический паспорт',
};

const fields: FieldSpec[] = [
  {
    key: 'series',
    label: 'Серия',
    kind: 'select',
    options: Object.entries(SERIES_1996).map(([value, label]) => ({ value, label: `${value} — ${label}` })),
    check: (v) => (Object.hasOwn(SERIES_1996, v) ? null : 'Выберите серию из списка'),
    random: (rng) => pick(rng, Object.keys(SERIES_1996)),
  },
  NUMBER_FIELD,
];

export const passport1996: FormatModule = {
  id: '1996',
  title: 'Образца 1996 г.',
  official: false,
  fields,
  validate: (input) =>
    validatePassport(input, (series) =>
      Object.hasOwn(SERIES_1996, series)
        ? null
        : { code: 'UNKNOWN_SERIES', message: `Серия «${series}» не из известного списка серий паспорта образца 1996 г.`, position: 1 },
    ),
  parse: (input) => parsePassport(input, (series) => SERIES_1996[series] ?? 'неизвестная серия'),
  generate: (partial, rng) => generatePassport(fields, partial, rng),
};
```

`src/formats/passportBiometric.ts`:
```ts
import { normalize } from '../core/normalize';
import { randInt } from '../core/random';
import type { FieldSpec, FormatModule, Rng } from '../core/types';
import { generatePassport, NUMBER_FIELD, parsePassport, validatePassport } from './passportCommon';

// Council of Ministers resolution No. 297 of 31.05.2021 fixes only the shape of the blank's serial number
// (two Latin letters + seven digits) and names DP for diplomatic passports; other series are unpublished.

const letter = (rng: Rng) => String.fromCharCode(65 + randInt(rng, 0, 25));

const fields: FieldSpec[] = [
  {
    key: 'series',
    label: 'Серия (2 латинские буквы)',
    kind: 'text',
    placeholder: 'AB',
    normalize: (v) => normalize(v).value,
    check: (v) => (/^[A-Z]{2}$/.test(v) ? null : 'Две латинские буквы'),
    random: (rng) => `${letter(rng)}${letter(rng)}`,
  },
  NUMBER_FIELD,
];

export const passportBiometric: FormatModule = {
  id: 'biometric',
  title: 'Биометрический (с 2021)',
  official: true,
  notice:
    'Серии бланков биометрических паспортов официально не опубликованы: постановление Совмина № 297 определяет только формат — две латинские буквы и семь цифр.',
  fields,
  validate: (input) => validatePassport(input, () => null),
  parse: (input) =>
    parsePassport(input, (series) =>
      series === 'DP' ? 'дипломатический паспорт' : 'серия бланка (официально не опубликована)',
    ),
  generate: (partial, rng) => generatePassport(fields, partial, rng),
};
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/formats/passportCommon.ts src/formats/passport1996.ts src/formats/passportBiometric.ts tests/passport1996.test.ts tests/passportBiometric.test.ts
git commit -m "feat(formats): passport number, 1996 model and biometric, with MRZ check digit"
```

---

### Task 3: Format groups and tool registry

**Files:**
- Modify: `src/formats/index.ts`, `src/ui/validatePanel.ts`, `src/main.ts`
- Create: `src/tools/index.ts`
- Test: `tests/formats.test.ts` (rewrite), `tests/tools.test.ts`

**Interfaces:**
- Consumes: `modern`, `legacy`, `passport1996`, `passportBiometric`.
- Produces:
  - `PERSONAL_NUMBER_FORMATS: FormatModule[]` (`[modern, legacy]`), `PASSPORT_FORMATS: FormatModule[]` (`[passport1996, passportBiometric]`), `suggestOtherFormat(input: string, current: FormatId, formats: FormatModule[]): FormatModule | null`. `FORMATS`/`FORMAT_LIST` removed.
  - `type CategoryId = 'documents' | 'organizations' | 'finance' | 'contacts'`, `interface Category { id: CategoryId; title: string }`, `interface Tool { id: string; title: string; category: CategoryId; inputLabel: string; formats: FormatModule[] }`, `CATEGORIES: Category[]`, `TOOLS: Tool[]`, `DEFAULT_TOOL_ID = 'personal-number'`, `isAvailable(tool): boolean`, `findTool(id): Tool | undefined`, `toolsByCategory(): { category: Category; tools: Tool[] }[]`.
  - `mountValidatePanel(root, { formats, inputLabel, onSwitchFormat })`.

- [ ] **Step 1: Write failing tests**

Replace `tests/formats.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { PASSPORT_FORMATS, PERSONAL_NUMBER_FORMATS, suggestOtherFormat } from '../src/formats';
import { mulberry32 } from '../src/core/random';

const ALL = [...PERSONAL_NUMBER_FORMATS, ...PASSPORT_FORMATS];

describe('generated numbers', () => {
  for (const format of ALL) {
    it(`${format.id}: 300 random numbers validate cleanly and parse back`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const r = format.generate({}, mulberry32(seed));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(format.validate(r.value)).toEqual({ valid: true, normalized: r.value, errors: [], warnings: [] });
        expect(format.parse(r.value)).not.toBeNull();
      }
    });
  }

  it('personal-number formats never accept each other', () => {
    const [modern, legacy] = PERSONAL_NUMBER_FORMATS;
    for (let seed = 1; seed <= 100; seed++) {
      const m = modern.generate({}, mulberry32(seed));
      const l = legacy.generate({}, mulberry32(seed));
      if (m.ok) expect(legacy.validate(m.value).valid).toBe(false);
      if (l.ok) expect(modern.validate(l.value).valid).toBe(false);
    }
  });
});

describe('suggestOtherFormat', () => {
  it('suggests legacy for a legacy number checked as modern', () => {
    expect(suggestOtherFormat('3271182A001PB1', 'modern', PERSONAL_NUMBER_FORMATS)?.id).toBe('legacy');
  });

  it('suggests modern for a modern number checked as legacy', () => {
    expect(suggestOtherFormat('7000000A000PB1', 'legacy', PERSONAL_NUMBER_FORMATS)?.id).toBe('modern');
  });

  it('suggests nothing when the current format accepts the number', () => {
    expect(suggestOtherFormat('7000000A000PB1', 'modern', PERSONAL_NUMBER_FORMATS)).toBeNull();
  });

  it('suggests nothing when no format accepts it', () => {
    expect(suggestOtherFormat('garbage', 'modern', PERSONAL_NUMBER_FORMATS)).toBeNull();
  });

  it('never suggests a format from another section', () => {
    expect(suggestOtherFormat('MP1234567', 'modern', PERSONAL_NUMBER_FORMATS)).toBeNull();
  });

  it('suggests nothing for an unknown current format', () => {
    expect(suggestOtherFormat('7000000A000PB1', 'nope', PERSONAL_NUMBER_FORMATS)).toBeNull();
  });
});
```

`tests/tools.test.ts`:
```ts
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
      ['Документы', ['Идентификационный номер', 'Номер паспорта']],
      ['Организации', ['УНП (скоро)']],
      ['Финансы', ['IBAN / номер счёта (скоро)']],
      ['Контакты', ['Телефон (скоро)']],
    ]);
  });

  it('returns undefined for an unknown id', () => {
    expect(findTool('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/formats.test.ts tests/tools.test.ts`
Expected: FAIL — `PERSONAL_NUMBER_FORMATS` is undefined (`ALL` spread throws `not iterable`); `Cannot find module '../src/tools'`.

- [ ] **Step 3: Implement**

`src/formats/index.ts` — full content:
```ts
import type { FormatId, FormatModule } from '../core/types';
import { legacy } from './legacy';
import { modern } from './modern';
import { passport1996 } from './passport1996';
import { passportBiometric } from './passportBiometric';

export const PERSONAL_NUMBER_FORMATS: FormatModule[] = [modern, legacy];

export const PASSPORT_FORMATS: FormatModule[] = [passport1996, passportBiometric];

/** Another format of the same section that accepts the input, when the current one rejects it. */
export function suggestOtherFormat(input: string, current: FormatId, formats: FormatModule[]): FormatModule | null {
  const active = formats.find((f) => f.id === current);
  if (!active || active.validate(input).valid) return null;
  return formats.find((f) => f.id !== current && f.validate(input).valid) ?? null;
}
```

`src/tools/index.ts`:
```ts
import type { FormatModule } from '../core/types';
import { PASSPORT_FORMATS, PERSONAL_NUMBER_FORMATS } from '../formats';

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
  { id: 'unp', title: 'УНП', category: 'organizations', inputLabel: 'УНП', formats: [] },
  { id: 'iban', title: 'IBAN / номер счёта', category: 'finance', inputLabel: 'IBAN', formats: [] },
  { id: 'phone', title: 'Телефон', category: 'contacts', inputLabel: 'Номер телефона', formats: [] },
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
```

`src/ui/validatePanel.ts` — change the signature and the two dependent lines:
```ts
export interface ValidatePanelOptions {
  formats: FormatModule[];
  inputLabel: string;
  onSwitchFormat: (id: FormatId) => void;
}

export function mountValidatePanel(root: HTMLElement, options: ValidatePanelOptions): ValidatePanel {
  const { formats, inputLabel, onSwitchFormat } = options;
  const field = el('md-outlined-text-field', {
    label: inputLabel,
```
(the rest of the attribute object unchanged) and in `render`:
```ts
    const other = suggestOtherFormat(input, format.id, formats);
```

`src/main.ts` — keep it compiling until Task 5 replaces it:
```bash
python3 - <<'EOF'
p = 'src/main.ts'
s = open(p, encoding='utf-8').read()
for a, b in [
    ("import { FORMAT_LIST, FORMATS } from './formats';", "import { PERSONAL_NUMBER_FORMATS } from './formats';"),
    ("mountValidatePanel(byId('validate'), (id) => setFormat(id))",
     "mountValidatePanel(byId('validate'), {\n  formats: PERSONAL_NUMBER_FORMATS,\n  inputLabel: 'Идентификационный номер',\n  onSwitchFormat: (id) => setFormat(id),\n})"),
    ("FORMAT_LIST, initial", "PERSONAL_NUMBER_FORMATS, initial"),
    ("const format = FORMATS[id];", "const format = PERSONAL_NUMBER_FORMATS.find((f) => f.id === id)!;"),
]:
    assert s.count(a) == 1, a
    s = s.replace(a, b)
open(p, 'w', encoding='utf-8').write(s)
EOF
```
`src/ui/formatState.ts` still declares `resolveInitialFormat(...): FormatId`; with `FormatId = string` it compiles unchanged.

- [ ] **Step 4: Run tests, typecheck, build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all PASS; no type errors; build succeeds (the page still shows only the personal number — routing arrives in Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/formats/index.ts src/tools src/ui/validatePanel.ts src/main.ts tests/formats.test.ts tests/tools.test.ts
git commit -m "feat(tools): section registry with categories; per-section format lists"
```

---

### Task 4: Hash router

**Files:**
- Create: `src/ui/router.ts`
- Test: `tests/router.test.ts`

**Interfaces:**
- Consumes: `Tool`, `TOOLS`, `DEFAULT_TOOL_ID` (Task 3).
- Produces: `interface Route { toolId: string; format: string | null }`, `parseHash(hash: string): Route | null`, `buildHash(route: Route): string`, `resolveRoute(hash: string, search: string, tools: Tool[], defaultToolId: string): Route`.

- [ ] **Step 1: Write the failing test**

`tests/router.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_TOOL_ID, TOOLS } from '../src/tools';
import { buildHash, parseHash, resolveRoute } from '../src/ui/router';

const resolve = (hash: string, search = '') => resolveRoute(hash, search, TOOLS, DEFAULT_TOOL_ID);

describe('parseHash', () => {
  it('reads tool and format', () => {
    expect(parseHash('#/passport-number?format=biometric')).toEqual({ toolId: 'passport-number', format: 'biometric' });
  });

  it('reads a tool without a format', () => {
    expect(parseHash('#/passport-number')).toEqual({ toolId: 'passport-number', format: null });
  });

  it.each(['', '#', '#foo', '#/', '#/Passport'])('rejects %j', (hash) => {
    expect(parseHash(hash)).toBeNull();
  });
});

describe('buildHash', () => {
  it('round-trips with parseHash', () => {
    const route = { toolId: 'passport-number', format: 'biometric' };
    expect(parseHash(buildHash(route))).toEqual(route);
  });

  it('omits an empty format', () => {
    expect(buildHash({ toolId: 'personal-number', format: null })).toBe('#/personal-number');
  });
});

describe('resolveRoute', () => {
  it('opens an available section with its format', () => {
    expect(resolve('#/passport-number?format=biometric')).toEqual({ toolId: 'passport-number', format: 'biometric' });
  });

  it.each(['', '#/unknown', '#/unp', '#/iban', '#/phone'])('falls back to the default section for %j', (hash) => {
    expect(resolve(hash)).toEqual({ toolId: 'personal-number', format: null });
  });

  it('maps a first-version ?format= link to the personal number', () => {
    expect(resolve('', '?format=legacy')).toEqual({ toolId: 'personal-number', format: 'legacy' });
  });

  it('prefers the hash over a first-version query', () => {
    expect(resolve('#/passport-number', '?format=legacy')).toEqual({ toolId: 'passport-number', format: null });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/router.test.ts`
Expected: FAIL — `Cannot find module '../src/ui/router'`.

- [ ] **Step 3: Implement `src/ui/router.ts`**

```ts
import type { Tool } from '../tools';

// Pure functions only: reading and building routes. Writing the URL belongs to formatState.ts.

export interface Route {
  toolId: string;
  format: string | null;
}

const HASH = /^#\/([a-z0-9-]+)(?:\?(.*))?$/;

export function parseHash(hash: string): Route | null {
  const m = HASH.exec(hash);
  if (!m) return null;
  return { toolId: m[1], format: new URLSearchParams(m[2] ?? '').get('format') || null };
}

export function buildHash(route: Route): string {
  return route.format ? `#/${route.toolId}?format=${encodeURIComponent(route.format)}` : `#/${route.toolId}`;
}

/** An available section named by the hash, else the default one; honours first-version `?format=` links. */
export function resolveRoute(hash: string, search: string, tools: Tool[], defaultToolId: string): Route {
  const parsed = parseHash(hash);
  if (parsed && tools.some((t) => t.id === parsed.toolId && t.formats.length > 0)) return parsed;
  if (!parsed) {
    const firstVersionFormat = new URLSearchParams(search).get('format');
    if (firstVersionFormat) return { toolId: defaultToolId, format: firstVersionFormat };
  }
  return { toolId: defaultToolId, format: null };
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/router.ts tests/router.test.ts
git commit -m "feat(ui): hash router with first-version link support"
```

---

### Task 5: Per-section state, navigation drawer, tool pages

**Files:**
- Modify: `src/ui/formatState.ts` (rewrite), `src/ui/generatePanel.ts`, `src/ui/icons.ts`, `src/ui/theme.css`, `src/main.ts` (rewrite), `index.html` (rewrite)
- Create: `src/ui/sidebar.ts`, `src/ui/toolPage.ts`
- Test: `tests/formatState.test.ts` (rewrite), `tests/privacy.test.ts` (extend)

**Interfaces:**
- Consumes: `buildHash`, `resolveRoute` (Task 4); `TOOLS`, `CATEGORIES`, `DEFAULT_TOOL_ID`, `findTool`, `toolsByCategory`, `Tool` (Task 3); `mountValidatePanel(root, options)` (Task 3); `mountFormatSwitch`, `mountGeneratePanel`, `mdIcon`, `el` (first feature).
- Produces:
  - `STORAGE_PREFIX = 'by-data-tools:format:'`, `LEGACY_STORAGE_KEY = 'by-data-tools:format'`, `storageKey(toolId): string`, `resolveFormatId(toolId, formats, requested, stored, legacyStored): string`, `readStoredFormats(toolId): { stored: string | null; legacy: string | null }`, `persistFormat(toolId, formatId): void`.
  - `mountSidebar(nav, menuButton, scrim, groups): { setActive(toolId: string): void }`.
  - `mountToolPage(root, tool, initial, onFormatChange): { setFormat(format: FormatModule): void }`.

- [ ] **Step 1: Write failing tests**

Replace `tests/formatState.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { PASSPORT_FORMATS, PERSONAL_NUMBER_FORMATS } from '../src/formats';
import { resolveFormatId, storageKey } from '../src/ui/formatState';

describe('formatState', () => {
  it('keys storage per section', () => {
    expect(storageKey('passport-number')).toBe('by-data-tools:format:passport-number');
  });

  it('prefers the requested format', () => {
    expect(resolveFormatId('passport-number', PASSPORT_FORMATS, 'biometric', '1996', null)).toBe('biometric');
  });

  it('falls back to the stored format, then to the first one', () => {
    expect(resolveFormatId('passport-number', PASSPORT_FORMATS, null, 'biometric', null)).toBe('biometric');
    expect(resolveFormatId('passport-number', PASSPORT_FORMATS, null, null, null)).toBe('1996');
  });

  it('ignores a format that belongs to another section', () => {
    expect(resolveFormatId('passport-number', PASSPORT_FORMATS, 'legacy', 'modern', null)).toBe('1996');
  });

  it('reads the first-version key for the personal number only', () => {
    expect(resolveFormatId('personal-number', PERSONAL_NUMBER_FORMATS, null, null, 'legacy')).toBe('legacy');
    expect(resolveFormatId('passport-number', PASSPORT_FORMATS, null, null, 'biometric')).toBe('1996');
  });

  it('lets the per-section key win over the first-version key', () => {
    expect(resolveFormatId('personal-number', PERSONAL_NUMBER_FORMATS, null, 'modern', 'legacy')).toBe('modern');
  });
});
```

In `tests/privacy.test.ts` replace the `PERSISTENCE` line and the last test:
```ts
const PERSISTENCE = [
  /localStorage/,
  /sessionStorage/,
  /history\.\w+State/,
  /document\.cookie/,
  /indexedDB/,
  /location\.(hash|href|search)\s*=(?!=)/,
  /location\.(assign|replace)\s*\(/,
];
```
```ts
  it('formatState stores only format ids', () => {
    const code = readFileSync(join(SRC, 'ui', 'formatState.ts'), 'utf8');
    expect(code.match(/setItem\(/g)).toHaveLength(1);
    expect(code).toContain('setItem(storageKey(toolId), formatId)');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/formatState.test.ts tests/privacy.test.ts`
Expected: FAIL — `resolveFormatId`/`storageKey` are not exported; "formatState stores only format ids" fails on the `setItem(storageKey(toolId), formatId)` text.

- [ ] **Step 3: Rewrite `src/ui/formatState.ts`**

```ts
import type { FormatModule } from '../core/types';
import { buildHash } from './router';

// The only module allowed to touch localStorage or the URL: it persists format ids, never a number.

export const STORAGE_PREFIX = 'by-data-tools:format:';
// Key of the first version, when the site had a single section.
export const LEGACY_STORAGE_KEY = 'by-data-tools:format';
const LEGACY_TOOL_ID = 'personal-number';

export function storageKey(toolId: string): string {
  return `${STORAGE_PREFIX}${toolId}`;
}

/** Requested (URL) → stored for the section → first-version key (personal number only) → first format. */
export function resolveFormatId(
  toolId: string,
  formats: FormatModule[],
  requested: string | null,
  stored: string | null,
  legacyStored: string | null,
): string {
  const ids = formats.map((f) => f.id);
  const candidates = [requested, stored, toolId === LEGACY_TOOL_ID ? legacyStored : null];
  return candidates.find((c): c is string => c !== null && ids.includes(c)) ?? ids[0];
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readStoredFormats(toolId: string): { stored: string | null; legacy: string | null } {
  return { stored: read(storageKey(toolId)), legacy: read(LEGACY_STORAGE_KEY) };
}

/** Remembers the section's format and rewrites the URL to `#/<tool>?format=<id>` without a history entry. */
export function persistFormat(toolId: string, formatId: string): void {
  try {
    localStorage.setItem(storageKey(toolId), formatId);
  } catch {
    // Storage blocked (private mode): the hash still carries the choice.
  }
  const url = new URL(location.href);
  url.searchParams.delete('format');
  url.hash = buildHash({ toolId, format: formatId });
  history.replaceState(null, '', url);
}
```

- [ ] **Step 4: Run the two test files**

Run: `npx vitest run tests/formatState.test.ts tests/privacy.test.ts`
Expected: PASS. (`npm run typecheck` fails until Step 9 — `main.ts` still imports the old API.)

- [ ] **Step 5: Add the `menu` icon and the generator hint**

`src/ui/icons.ts` — add to `PATHS`:
```ts
  menu: 'M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z',
```

`src/ui/generatePanel.ts` — after `output.append(el('output', { class: 'generated' }, value), copy, check);` add:
```ts
    if (r.hint) output.append(el('span', { class: 'gen-hint' }, r.hint));
```

- [ ] **Step 6: Write `src/ui/sidebar.ts`**

```ts
import type { Category, Tool } from '../tools';
import { el } from './dom';

export interface Sidebar {
  setActive(toolId: string): void;
}

const MODAL = '(max-width: 839px)';

// Material 3 navigation drawer: persistent on wide screens, modal behind ☰ on narrow ones.
export function mountSidebar(
  nav: HTMLElement,
  menuButton: HTMLElement,
  scrim: HTMLElement,
  groups: { category: Category; tools: Tool[] }[],
): Sidebar {
  const links = new Map<string, HTMLAnchorElement>();
  for (const { category, tools } of groups) {
    const items = tools.map((tool) => {
      if (tool.formats.length === 0) {
        return el(
          'li',
          {},
          el('span', { class: 'nav-item soon', 'aria-disabled': 'true' }, tool.title, el('span', { class: 'badge' }, 'скоро')),
        );
      }
      const link = el('a', { class: 'nav-item', href: `#/${tool.id}` }, tool.title);
      link.addEventListener('click', close);
      links.set(tool.id, link);
      return el('li', {}, link);
    });
    const headingId = `nav-${category.id}`;
    nav.append(
      el('section', { class: 'nav-section', 'aria-labelledby': headingId }, el('h2', { id: headingId }, category.title), el('ul', {}, ...items)),
    );
  }

  const modal = window.matchMedia(MODAL);

  function open(): void {
    document.body.classList.add('drawer-open');
    scrim.hidden = false;
    menuButton.setAttribute('aria-expanded', 'true');
    const target = nav.querySelector<HTMLElement>('[aria-current="page"]') ?? links.values().next().value;
    target?.focus();
  }

  function close(): void {
    if (!document.body.classList.contains('drawer-open')) return;
    document.body.classList.remove('drawer-open');
    scrim.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    if (modal.matches) menuButton.focus();
  }

  menuButton.addEventListener('click', open);
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  modal.addEventListener('change', close);

  return {
    setActive(toolId) {
      for (const [id, link] of links) {
        if (id === toolId) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
    },
  };
}
```

- [ ] **Step 7: Write `src/ui/toolPage.ts`**

```ts
import type { FormatId, FormatModule } from '../core/types';
import type { Tool } from '../tools';
import { el } from './dom';
import { mountFormatSwitch } from './formatSwitch';
import { mountGeneratePanel } from './generatePanel';
import { mountValidatePanel } from './validatePanel';

export interface ToolPage {
  setFormat(format: FormatModule): void;
}

function card(id: string, title: string, body: HTMLElement): HTMLElement {
  return el('section', { class: 'card', 'aria-labelledby': id }, el('h2', { id }, title), body);
}

/** One section: format switch (when there are several), notice, validate and generate cards. */
export function mountToolPage(
  root: HTMLElement,
  tool: Tool,
  initial: FormatModule,
  onFormatChange: (id: FormatId) => void,
): ToolPage {
  const switchBox = el('div');
  const header = el('div', { class: 'tool-header' }, switchBox);
  const notice = el('p', { class: 'notice' });
  const validateBody = el('div');
  const generateBody = el('div');
  root.append(
    header,
    notice,
    card(`${tool.id}-validate`, 'Проверка и разбор', validateBody),
    card(`${tool.id}-generate`, 'Генерация', generateBody),
  );

  const formatSwitch = tool.formats.length > 1 ? mountFormatSwitch(switchBox, tool.formats, initial.id, onFormatChange) : null;
  header.hidden = !formatSwitch;
  const validatePanel = mountValidatePanel(validateBody, {
    formats: tool.formats,
    inputLabel: tool.inputLabel,
    onSwitchFormat: onFormatChange,
  });
  const generatePanel = mountGeneratePanel(generateBody, (value) => validatePanel.check(value));

  function setFormat(format: FormatModule): void {
    formatSwitch?.set(format.id);
    notice.textContent = format.notice ?? '';
    notice.hidden = !format.notice;
    validatePanel.setFormat(format);
    generatePanel.setFormat(format);
  }

  setFormat(initial);
  return { setFormat };
}
```

- [ ] **Step 8: Rewrite `index.html`**

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="description" content="Проверка, разбор и генерация тестовых данных Республики Беларусь" />
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%23006a60'/%3E%3C/svg%3E" />
    <title>by-data-tools</title>
  </head>
  <body>
    <div class="app">
      <nav id="sidebar" class="drawer" aria-label="Разделы">
        <p class="drawer-brand">by-data-tools<span>данные Республики Беларусь</span></p>
      </nav>
      <div id="scrim" class="scrim" hidden></div>
      <div class="content">
        <header class="top">
          <md-icon-button id="menu-button" class="menu-button" aria-label="Открыть меню" aria-controls="sidebar" aria-expanded="false"></md-icon-button>
          <h1 id="tool-title" tabindex="-1"></h1>
        </header>
        <main id="tool"></main>
        <footer class="foot">
          Данные обрабатываются только в вашем браузере и никуда не отправляются. Инструмент для тестовых данных.
        </footer>
      </div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 9: Rewrite `src/main.ts`**

```ts
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/button/text-button.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/textfield/outlined-text-field.js';
import './ui/theme.css';

import { DEFAULT_TOOL_ID, findTool, TOOLS, toolsByCategory } from './tools';
import { persistFormat, readStoredFormats, resolveFormatId } from './ui/formatState';
import { mdIcon } from './ui/icons';
import { resolveRoute } from './ui/router';
import { mountSidebar } from './ui/sidebar';
import { mountToolPage, type ToolPage } from './ui/toolPage';

const byId = (id: string) => document.getElementById(id) as HTMLElement;

const title = byId('tool-title');
const container = byId('tool');
const menuButton = byId('menu-button');
menuButton.append(mdIcon('menu'));
const sidebar = mountSidebar(byId('sidebar'), menuButton, byId('scrim'), toolsByCategory());

let current: { toolId: string; page: ToolPage } | null = null;

function show(): void {
  const route = resolveRoute(location.hash, location.search, TOOLS, DEFAULT_TOOL_ID);
  const tool = findTool(route.toolId)!;
  const { stored, legacy } = readStoredFormats(tool.id);
  const formatId = resolveFormatId(tool.id, tool.formats, route.format, stored, legacy);
  persistFormat(tool.id, formatId);
  const format = tool.formats.find((f) => f.id === formatId)!;

  if (current?.toolId === tool.id) {
    current.page.setFormat(format);
    return;
  }

  const firstRender = current === null;
  container.replaceChildren();
  const page = mountToolPage(container, tool, format, (id) => {
    persistFormat(tool.id, id);
    page.setFormat(tool.formats.find((f) => f.id === id)!);
  });
  current = { toolId: tool.id, page };
  title.textContent = tool.title;
  document.title = `${tool.title} — by-data-tools`;
  sidebar.setActive(tool.id);
  if (!firstRender) title.focus();
}

window.addEventListener('hashchange', show);
show();
```

- [ ] **Step 10: Update `src/ui/theme.css`**

Replace the line
```css
.top { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; padding-block: 32px 16px; }
```
with
```css
.top { display: flex; gap: 8px; align-items: center; padding-block: 32px 16px; }
h1:focus { outline: none; }
.tool-header { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-block: 0 16px; }
.tool-header[hidden] { display: none; }
.gen-hint { flex-basis: 100%; font: 0.875rem/1.4 ui-monospace, 'SF Mono', Menlo, monospace; color: var(--md-sys-color-on-surface-variant); }
```
and append at the end of the file:
```css
/* Navigation drawer: persistent from 840px, modal below. */
.app { display: flex; min-height: 100vh; }
.content { flex: 1; min-width: 0; }

.drawer {
  position: sticky; top: 0; flex: none; width: 280px; height: 100vh; overflow-y: auto;
  padding: 12px; background: var(--md-sys-color-surface-container-low);
}
.drawer-brand { margin: 0; padding: 16px 16px 8px; font-weight: 500; }
.drawer-brand span { display: block; font-size: 0.75rem; font-weight: 400; color: var(--md-sys-color-on-surface-variant); }
.nav-section h2 { margin: 16px 16px 4px; font-size: 0.875rem; font-weight: 500; color: var(--md-sys-color-on-surface-variant); }
.nav-section ul { margin: 0; padding: 0; list-style: none; }
.nav-item {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  min-height: 48px; padding: 0 16px; border-radius: 24px;
  font-size: 0.875rem; font-weight: 500; text-decoration: none; color: var(--md-sys-color-on-surface-variant);
}
a.nav-item:hover { background: color-mix(in srgb, var(--md-sys-color-on-surface) 8%, transparent); }
a.nav-item[aria-current='page'] { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
a.nav-item:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: -2px; }
.nav-item.soon { cursor: default; color: color-mix(in srgb, var(--md-sys-color-on-surface) 45%, transparent); }
.badge { padding: 2px 8px; border-radius: 8px; font-size: 0.75rem; font-weight: 400; background: var(--md-sys-color-surface-container-highest); }

.menu-button { display: none; }
.scrim { display: none; }

@media (max-width: 839px) {
  .drawer {
    position: fixed; inset: 0 auto 0 0; z-index: 20; height: 100%; width: min(280px, 85vw);
    border-radius: 0 16px 16px 0; transform: translateX(-100%); visibility: hidden;
    transition: transform 0.2s ease, visibility 0s linear 0.2s;
  }
  .drawer-open .drawer { transform: none; visibility: visible; transition: transform 0.2s ease; }
  .scrim { display: block; position: fixed; inset: 0; z-index: 10; background: rgb(0 0 0 / 0.32); }
  .scrim[hidden] { display: none; }
  .menu-button { display: inline-flex; margin-inline-start: -8px; }
  .top { padding-block: 16px 8px; }
}
```

- [ ] **Step 11: Verify tests, types and build**

Run: `npm test && npm run typecheck && npm run build`
Expected: all tests PASS (privacy test now scans `sidebar.ts`, `toolPage.ts`, `router.ts`, `main.ts`); no type errors; build succeeds. `grep -c "Content-Security-Policy" dist/index.html` → `1`.

- [ ] **Step 12: Browser smoke check**

Start `npx vite preview --port 4173 --strictPort` in the background, open `http://localhost:4173/by-data-tools/`, check:
1. 1280px: drawer visible with «Документы / Организации / Финансы / Контакты», three items marked «скоро», «Идентификационный номер» active; URL became `#/personal-number?format=modern`.
2. Click «Номер паспорта» → URL `#/passport-number?format=1996`, `<h1>` and tab title «Номер паспорта — by-data-tools», item active.
3. Validate `MP1234567` → «Номер валиден», rows `MP — г. Минск`, `1234567`, `MP12345677`.
4. Validate `МР 123-45-67` → valid with the Cyrillic warning.
5. Validate `XX1234567` → «валиден, есть предупреждения», «Позиция 1: Серия «XX» не из известного списка…».
6. Switch to «Биометрический (с 2021)» → notice shown; `XX1234567` valid without warnings; `DP1234567` → `DP — дипломатический паспорт`, `DP12345674`.
7. Generator (biometric): series `мр`, number `1234567` → `MP1234567`, hint `Номер документа в MRZ: MP12345677`; empty fields → valid random number.
8. Open `http://localhost:4173/by-data-tools/#/passport-number?format=biometric` in a new tab → biometric selected.
9. Open `http://localhost:4173/by-data-tools/?format=legacy` → personal number, «До 2012» selected, URL rewritten to `/by-data-tools/#/personal-number?format=legacy` (no `?format` before the hash).
10. `#/unp` and `#/foo` → personal number.
11. Browser Back after steps 2→1 navigation returns to the previous section.
12. 400px: drawer hidden, ☰ visible; ☰ opens drawer with scrim, focus on the active item; `Escape` closes and focus returns to ☰; scrim click closes; item click navigates and closes; Tab while closed never lands in the drawer.
13. DevTools → Local Storage holds only `by-data-tools:format:*` keys (plus `by-data-tools:format` if present from the first version); no number in the URL at any point.
14. Console has no errors.

Fix anything that fails before committing. Stop the preview server.

- [ ] **Step 13: Commit**

```bash
git add index.html src/main.ts src/ui tests/formatState.test.ts tests/privacy.test.ts
git commit -m "feat(ui): categorized navigation drawer, hash routing, per-section format state"
```

---

### Task 6: README, merge, deploy

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md`**

Replace the section `## Идентификационный номер паспорта` heading line and insert before it:
```markdown
## Разделы

Разделы собраны в левом меню по категориям. Адрес раздела можно сохранить или отправить:
`#/personal-number`, `#/passport-number`, формат — параметром `?format=`.

| Категория | Раздел | Статус |
|---|---|---|
| Документы | Идентификационный номер | готово |
| Документы | Номер паспорта | готово |
| Организации | УНП | скоро |
| Финансы | IBAN / номер счёта | скоро |
| Контакты | Телефон | скоро |

```
Append after the personal-number section (before `## Разработка`):
```markdown
## Номер паспорта

Серия (2 латинские буквы) и номер (7 цифр). Два формата:

- **Образца 1996 г.** — серия по органу выдачи (`AB`, `BM`, `HB`, `KH`, `MP`, `MC`, `KB`, `PP`, `SP`, `DP`);
  серия не из списка — предупреждение, а не ошибка.
- **Биометрический (с 2021)** — серии бланков официально не опубликованы
  ([постановление Совмина № 297](https://etalonline.by/document/?regnum=c22100297) задаёт только формат),
  принимается любая пара латинских букв; `DP` — дипломатический.

В разборе и при генерации показывается номер документа из машиночитаемой зоны с контрольной цифрой
(ICAO 9303, веса `7-3-1`).

```
And change the sentence `Новый документ — новый модуль в \`src/formats/\`, реализующий \`FormatModule\` из \`src/core/types.ts\`.` to:
```markdown
Новый раздел — модуль формата в `src/formats/` (реализует `FormatModule` из `src/core/types.ts`)
и запись в реестре `src/tools/index.ts`; меню и маршрут появятся сами.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README sections for navigation and passport number"
```

- [ ] **Step 3: Merge and deploy** (after the final review and its fixes)

```bash
git status --short                       # expect empty
git switch main && git merge --ff-only feat/sidebar-passport
git push origin main
gh run watch "$(gh run list --workflow pages.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```
Expected: push succeeds; both Pages jobs succeed.

- [ ] **Step 4: Verify the live site**

Run: `curl -s https://aquahitt.github.io/by-data-tools/ | grep -c "Content-Security-Policy"` → `1`. Repeat smoke items 1, 2, 3, 6, 9 and 12 against `https://aquahitt.github.io/by-data-tools/`.
