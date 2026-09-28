# BY Personal Number Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static GitHub Pages site that validates, parses and generates Belarusian passport identification numbers in two user-selectable formats (2012+ official, pre-2012 unofficial).

**Architecture:** Pure TypeScript core (`src/core`) and one module per number format (`src/formats`) behind a shared `FormatModule` interface, fully unit-tested with Vitest. A thin vanilla-TS UI (`src/ui`) built from `@material/web` components renders whichever format is selected. Vite builds to `dist/`; GitHub Actions deploys it to Pages.

**Tech Stack:** Node ≥ 20.19 (CI: 22), Vite `^8.3`, TypeScript `~5.9.3`, Vitest `^4.1`, `@material/web` `^2.5`, `@fontsource/roboto` `^5.3`.

**Spec:** `docs/superpowers/specs/2026-09-28-by-personal-number-design.md`

**Project root:** `/Users/aramanouski/Work/repositories/qa/tools/by-data-tools` — every path below is relative to it. Git identity is already set locally to `aquahitt <124697399+aquahitt@users.noreply.github.com>`; never change it and never commit with the global identity.

## Global Constraints

- Repository `aquahitt/by-data-tools`, public; Pages URL `https://aquahitt.github.io/by-data-tools/`.
- Vite `base: '/by-data-tools/'`.
- UI language: Russian. Code, comments, commit messages: English.
- Design: material minimalism — Material 3 tokens, light/dark by `prefers-color-scheme`, one accent palette, flat cards.
- The number is never sent over the network, never written to the URL or `localStorage`. Only the format id (`modern` | `legacy`) is persisted, under key `by-data-tools:format` and query param `format`.
- No third-party requests from the built page: fonts via `@fontsource/roboto`, icons as inline SVG (deviation from spec: `material-symbols` replaced by inline SVG — five icons do not justify a multi-MB font; still self-hosted). Built `index.html` carries a CSP with `connect-src 'none'`.
- Check digit: first 13 chars, weights `7,3,1` repeating, `A=10 … Z=35`, sum mod 10.
- 2012+ format: all rules hard. Pre-2012 format: check-digit mismatch is a **warning**, never an error.
- Cyrillic `А В С Е Н К М Р` → Latin with a visible warning; any other non-`[A-Z0-9]` char → error with position.
- Segmented format switch is hand-built (`role="radiogroup"`); `@material/web` has it only under `labs/`.
- `FormatModule.generate` returns `GenerateResult` (`{ok:true,value}` | `{ok:false,fieldErrors}`) instead of the spec's bare `string` — needed so invalid field input blocks generation with per-field errors, as the spec's UI section requires.
- Pre-2012 birth date in the generator is typed as `ДД.ММ.ГГГГ` text (not `<input type=date>`, which `@material/web` does not style).

## Review Focus

1. **Cyrillic lookalikes pasted from a document** (`7000000А000РВ1`) — expected: accepted as valid, with a warning naming positions 8, 12, 13. Pinned in Task 2 (`normalize`) and Task 3 (`modern.validate`).
2. **Formatting noise** — spaces, dashes (`-`, `–`, `—`, non-breaking hyphen), lowercase — expected: ignored. Pinned in Task 2.
3. **29 February across centuries** — `1900` not leap, `2000` leap, `1800` not leap, `1904` leap; century comes from digit 1, not from `YY`. Pinned in Task 4.
4. **A real pre-2012 number whose check digit disagrees with 7-3-1** (`3271182A001PB5`) — expected: valid, warning only. Pinned in Task 4.
5. **Number pasted while the wrong format is selected** — expected: hint offering to switch, no silent pass. Pinned in Task 5 (`suggestOtherFormat`).

---

## Files

| Action | Path | Responsibility |
|---|---|---|
| Create | `package.json`, `package-lock.json` | scripts, dependencies |
| Create | `tsconfig.json` | strict TS config |
| Create | `vite.config.ts` | base path, build-only CSP, Vitest config |
| Create | `.gitignore` | ignore build output |
| Create | `index.html` | page shell |
| Create | `src/core/types.ts` | shared types |
| Create | `src/core/checkDigit.ts` | 7-3-1 check digit |
| Create | `src/core/normalize.ts` | input normalization |
| Create | `src/core/structure.ts` | 14-char digit/letter template check |
| Create | `src/core/random.ts` | RNGs and helpers |
| Create | `src/core/fields.ts` | resolve generator fields (given or random) |
| Create | `src/formats/modern.ts` | 2012+ format |
| Create | `src/formats/legacy.ts` | pre-2012 format + region/status tables |
| Create | `src/formats/index.ts` | format registry, cross-format hint |
| Create | `src/ui/formatState.ts` | the only place touching URL/localStorage |
| Create | `src/ui/dom.ts` | `el()` helper |
| Create | `src/ui/icons.ts` | inline SVG icons |
| Create | `src/ui/formatSwitch.ts` | segmented switch |
| Create | `src/ui/validatePanel.ts` | validate + parse card |
| Create | `src/ui/generatePanel.ts` | generate card |
| Create | `src/ui/theme.css` | M3 tokens + layout |
| Create | `src/main.ts` | wiring |
| Create | `tests/*.test.ts` | unit tests per module |
| Create | `.github/workflows/ci.yml`, `.github/workflows/pages.yml` | CI, deploy |
| Create | `README.md` | usage, sources, disclaimer |

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `index.html`, `src/main.ts`

**Interfaces:**
- Produces: scripts `npm run dev | build | preview | test | typecheck`.

- [ ] **Step 1: Init package and install dependencies**

```bash
cd /Users/aramanouski/Work/repositories/qa/tools/by-data-tools
npm init -y
npm pkg set name=by-data-tools private=true type=module version=0.1.0 engines.node=">=20.19"
npm pkg delete main keywords author license description
npm pkg set scripts.dev="vite" scripts.build="tsc && vite build" scripts.preview="vite preview" scripts.test="vitest run" scripts.typecheck="tsc"
npm install @material/web@^2.5.0 @fontsource/roboto@^5.3.0
npm install -D vite@^8.3.1 vitest@^4.1.11 typescript@~5.9.3 @types/node@^20
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client", "node"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

// Build-only: the dev server needs a websocket for HMR, which this policy forbids.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

export default defineConfig({
  base: '/by-data-tools/',
  plugins: [
    {
      name: 'csp-meta',
      apply: 'build',
      transformIndexHtml: () => [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
      ],
    },
  ],
  test: { include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
dist/
coverage/
.DS_Store
```

- [ ] **Step 5: Write placeholder `index.html` and `src/main.ts`** (both replaced in Task 7)

`index.html`:
```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Идентификационный номер РБ</title>
  </head>
  <body>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:
```ts
export {};
```

- [ ] **Step 6: Verify toolchain**

Run: `npm run typecheck && npx vitest run --passWithNoTests && npx vite build`
Expected: no type errors; Vitest "No test files found, exiting with code 0"; `dist/index.html` exists and `grep -c "Content-Security-Policy" dist/index.html` prints `1`; `grep -c "/by-data-tools/assets/" dist/index.html` prints `1`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .gitignore index.html src/main.ts
git commit -m "chore: scaffold Vite + TypeScript + Vitest project"
```

---

### Task 2: Core — types, check digit, normalization, structure, random, fields

**Files:**
- Create: `src/core/types.ts`, `src/core/checkDigit.ts`, `src/core/normalize.ts`, `src/core/structure.ts`, `src/core/random.ts`, `src/core/fields.ts`
- Test: `tests/checkDigit.test.ts`, `tests/normalize.test.ts`, `tests/structure.test.ts`, `tests/random.test.ts`, `tests/fields.test.ts`

**Interfaces:**
- Produces (exact):
  - `type Rng = () => number` (in `[0,1)`)
  - `interface Issue { code: string; message: string; position?: number }` — `message` never contains the position; the UI prefixes `Позиция N:`.
  - `interface ValidationResult { valid: boolean; normalized: string; errors: Issue[]; warnings: Issue[] }`
  - `interface ParsedField { label: string; value: string }`
  - `interface FieldOption { value: string; label: string }`
  - `interface FieldSpec { key: string; label: string; kind: 'text' | 'select'; options?: FieldOption[]; placeholder?: string; check(value: string): string | null; random(rng: Rng): string }`
  - `type GenerateResult = { ok: true; value: string } | { ok: false; fieldErrors: Record<string, string> }`
  - `type FormatId = 'modern' | 'legacy'`
  - `interface FormatModule { id: FormatId; title: string; official: boolean; notice?: string; fields: FieldSpec[]; validate(input: string): ValidationResult; parse(input: string): ParsedField[] | null; generate(partial: Record<string, string>, rng: Rng): GenerateResult }`
  - `charValue(ch: string): number`, `checkDigit731(body13: string): number`
  - `normalize(input: string): { value: string; errors: Issue[]; warnings: Issue[] }`
  - `NUMBER_LENGTH = 14`, `structureIssues(value: string): Issue[]`
  - `mulberry32(seed: number): Rng`, `cryptoRng: Rng`, `randInt(rng, min, max): number` (inclusive), `pick<T>(rng, items: readonly T[]): T`, `pad(n: number, width: number): string`
  - `resolveFields(fields: FieldSpec[], partial: Record<string, string>, rng: Rng): { values: Record<string, string>; fieldErrors: Record<string, string> }`

- [ ] **Step 1: Write `src/core/types.ts`**

```ts
export type Rng = () => number;

export interface Issue {
  code: string;
  message: string;
  position?: number;
}

export interface ValidationResult {
  valid: boolean;
  normalized: string;
  errors: Issue[];
  warnings: Issue[];
}

export interface ParsedField {
  label: string;
  value: string;
}

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  key: string;
  label: string;
  kind: 'text' | 'select';
  options?: FieldOption[];
  placeholder?: string;
  check(value: string): string | null;
  random(rng: Rng): string;
}

export type GenerateResult =
  | { ok: true; value: string }
  | { ok: false; fieldErrors: Record<string, string> };

export type FormatId = 'modern' | 'legacy';

export interface FormatModule {
  id: FormatId;
  title: string;
  official: boolean;
  notice?: string;
  fields: FieldSpec[];
  validate(input: string): ValidationResult;
  parse(input: string): ParsedField[] | null;
  generate(partial: Record<string, string>, rng: Rng): GenerateResult;
}
```

- [ ] **Step 2: Write failing tests**

`tests/checkDigit.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { charValue, checkDigit731 } from '../src/core/checkDigit';

describe('checkDigit731', () => {
  // Hand-computed vectors (spec, "Контрольная цифра").
  it.each([
    ['7000000A000PB', 1],
    ['7123456A789PB', 6],
    ['7654321A042PB', 4],
    ['4140385H007BI', 6],
    ['3271182A001PB', 1],
  ])('%s -> %i', (body, expected) => {
    expect(checkDigit731(body)).toBe(expected);
  });

  it('maps digits to themselves and A..Z to 10..35', () => {
    expect(charValue('0')).toBe(0);
    expect(charValue('9')).toBe(9);
    expect(charValue('A')).toBe(10);
    expect(charValue('P')).toBe(25);
    expect(charValue('Z')).toBe(35);
  });

  it('rejects a body that is not 13 characters', () => {
    expect(() => checkDigit731('123')).toThrow(RangeError);
  });

  it('rejects characters outside [0-9A-Z]', () => {
    expect(() => charValue('а')).toThrow(RangeError);
    expect(() => charValue('a')).toThrow(RangeError);
  });
});
```

`tests/normalize.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { normalize } from '../src/core/normalize';

describe('normalize', () => {
  it('strips whitespace and every dash kind, uppercases', () => {
    const r = normalize(' 7000000-a000 pb\u20111\t');
    expect(r.value).toBe('7000000A000PB1');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('strips en and em dashes', () => {
    expect(normalize('7000000\u2013A000\u2014PB1').value).toBe('7000000A000PB1');
  });

  it('replaces Cyrillic lookalikes and reports their positions', () => {
    const r = normalize('7000000А000РВ1');
    expect(r.value).toBe('7000000A000PB1');
    expect(r.errors).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].code).toBe('CYRILLIC_REPLACED');
    expect(r.warnings[0].message).toContain('8, 12, 13');
  });

  it('replaces lowercase Cyrillic lookalikes too', () => {
    expect(normalize('7000000а000рв1').value).toBe('7000000A000PB1');
  });

  it('reports a non-lookalike character with its position', () => {
    const r = normalize('7000000Ж000PB1');
    expect(r.errors).toEqual([
      { code: 'INVALID_CHAR', message: 'Недопустимый символ «Ж»', position: 8 },
    ]);
  });
});
```

`tests/structure.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { structureIssues } from '../src/core/structure';

describe('structureIssues', () => {
  it('accepts the 7-digit, letter, 3-digit, 2-letter, digit template', () => {
    expect(structureIssues('7000000A000PB1')).toEqual([]);
  });

  it('reports wrong length only', () => {
    expect(structureIssues('7000000A000PB')).toEqual([
      { code: 'LENGTH', message: 'Длина 13, ожидается 14 символов' },
    ]);
  });

  it('reports each misplaced character with its position', () => {
    expect(structureIssues('70000A0A000P11')).toEqual([
      { code: 'STRUCTURE', message: 'Ожидается цифра', position: 6 },
      { code: 'STRUCTURE', message: 'Ожидается латинская буква', position: 13 },
    ]);
  });
});
```

`tests/random.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { cryptoRng, mulberry32, pad, pick, randInt } from '../src/core/random';

describe('random helpers', () => {
  it('mulberry32 is deterministic per seed and in [0,1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('randInt covers both inclusive bounds', () => {
    const rng = mulberry32(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(randInt(rng, 0, 3));
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it('pick returns an element of the list', () => {
    expect(['M', 'F']).toContain(pick(mulberry32(1), ['M', 'F']));
  });

  it('pad left-pads with zeros', () => {
    expect(pad(7, 3)).toBe('007');
    expect(pad(123, 3)).toBe('123');
  });

  it('cryptoRng returns values in [0,1)', () => {
    const x = cryptoRng();
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThan(1);
  });
});
```

`tests/fields.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { resolveFields } from '../src/core/fields';
import { mulberry32 } from '../src/core/random';
import type { FieldSpec } from '../src/core/types';

const digit: FieldSpec = {
  key: 'd',
  label: 'Digit',
  kind: 'text',
  check: (v) => (/^\d$/.test(v) ? null : 'одна цифра'),
  random: () => '5',
};

describe('resolveFields', () => {
  it('keeps a given value (trimmed)', () => {
    expect(resolveFields([digit], { d: ' 3 ' }, mulberry32(1)).values.d).toBe('3');
  });

  it('fills an empty or missing value randomly', () => {
    expect(resolveFields([digit], { d: '' }, mulberry32(1)).values.d).toBe('5');
    expect(resolveFields([digit], {}, mulberry32(1)).values.d).toBe('5');
  });

  it('reports a given invalid value per field', () => {
    expect(resolveFields([digit], { d: 'x' }, mulberry32(1)).fieldErrors).toEqual({ d: 'одна цифра' });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "../src/core/checkDigit"` (and the same for the other modules).

- [ ] **Step 4: Implement the core modules**

`src/core/checkDigit.ts`:
```ts
const WEIGHTS = [7, 3, 1] as const;

/** Digit value per MVD resolution No. 345, item 1.3: 0-9 as is, A..Z = 10..35. */
export function charValue(ch: string): number {
  const code = ch.charCodeAt(0);
  if (ch.length === 1 && code >= 48 && code <= 57) return code - 48;
  if (ch.length === 1 && code >= 65 && code <= 90) return code - 55;
  throw new RangeError(`Invalid character: ${ch}`);
}

/** Mod-10 check digit with repeating 7-3-1 weights over the first 13 characters. */
export function checkDigit731(body: string): number {
  if (body.length !== 13) throw new RangeError(`Expected 13 characters, got ${body.length}`);
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += charValue(body[i]) * WEIGHTS[i % 3];
  return sum % 10;
}
```

`src/core/normalize.ts`:
```ts
import type { Issue } from './types';

// Every Latin letter the two formats use has a Cyrillic twin that users paste by accident.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  А: 'A', В: 'B', С: 'C', Е: 'E', Н: 'H', К: 'K', М: 'M', Р: 'P',
};

// Whitespace, hyphen-minus, hyphen, non-breaking hyphen, en dash, em dash.
const NOISE = /[\s\-\u2010\u2011\u2013\u2014]/g;

export interface Normalized {
  value: string;
  errors: Issue[];
  warnings: Issue[];
}

export function normalize(input: string): Normalized {
  const replaced: number[] = [];
  const errors: Issue[] = [];
  const value = [...input.replace(NOISE, '').toUpperCase()]
    .map((ch, i) => {
      const latin = CYRILLIC_TO_LATIN[ch];
      if (latin) {
        replaced.push(i + 1);
        return latin;
      }
      if (!/^[A-Z0-9]$/.test(ch)) {
        errors.push({ code: 'INVALID_CHAR', message: `Недопустимый символ «${ch}»`, position: i + 1 });
      }
      return ch;
    })
    .join('');
  const warnings: Issue[] = replaced.length
    ? [{
        code: 'CYRILLIC_REPLACED',
        message: `Кириллические буквы заменены на латинские в позициях ${replaced.join(', ')}`,
      }]
    : [];
  return { value, errors, warnings };
}
```

`src/core/structure.ts`:
```ts
import type { Issue } from './types';

export const NUMBER_LENGTH = 14;

// D = digit, L = Latin letter: ЦЦЦЦЦЦЦ Б ЦЦЦ ББ Ц
const TEMPLATE = 'DDDDDDDLDDDLLD';

export function structureIssues(value: string): Issue[] {
  if (value.length !== NUMBER_LENGTH) {
    return [{ code: 'LENGTH', message: `Длина ${value.length}, ожидается ${NUMBER_LENGTH} символов` }];
  }
  const issues: Issue[] = [];
  for (let i = 0; i < NUMBER_LENGTH; i++) {
    const wantDigit = TEMPLATE[i] === 'D';
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

`src/core/random.ts`:
```ts
import type { Rng } from './types';

/** Seedable PRNG for deterministic tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const cryptoRng: Rng = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;

/** Integer in [min, max], both inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, 0, items.length - 1)];
}

export function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}
```

`src/core/fields.ts`:
```ts
import type { FieldSpec, Rng } from './types';

/** Takes each field from `partial` when given, otherwise draws it; checks every value. */
export function resolveFields(
  fields: FieldSpec[],
  partial: Record<string, string>,
  rng: Rng,
): { values: Record<string, string>; fieldErrors: Record<string, string> } {
  const values: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};
  for (const field of fields) {
    const given = partial[field.key]?.trim();
    const value = given ? given : field.random(rng);
    const error = field.check(value);
    if (error) fieldErrors[field.key] = error;
    values[field.key] = value;
  }
  return { values, fieldErrors };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: all tests in the five files PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/core tests
git commit -m "feat(core): check digit, normalization, structure check, RNG"
```

---

### Task 3: 2012+ format module

**Files:**
- Create: `src/formats/modern.ts`
- Test: `tests/modern.test.ts`

**Interfaces:**
- Consumes: everything from Task 2.
- Produces: `export const modern: FormatModule` with `id: 'modern'`, `title: '2012+ (МВД № 345)'`, `official: true`, field keys `number`, `sequence`.

- [ ] **Step 1: Write the failing test**

`tests/modern.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { modern } from '../src/formats/modern';
import { mulberry32 } from '../src/core/random';

const codes = (input: string) => modern.validate(input).errors.map((e) => e.code);

describe('modern.validate', () => {
  it.each(['7000000A000PB1', '7123456A789PB6', '7654321A042PB4'])('accepts %s', (n) => {
    expect(modern.validate(n)).toEqual({ valid: true, normalized: n, errors: [], warnings: [] });
  });

  it('accepts a Cyrillic-typed number with a warning', () => {
    const r = modern.validate('7000000А000РВ1');
    expect(r.valid).toBe(true);
    expect(r.warnings.map((w) => w.code)).toEqual(['CYRILLIC_REPLACED']);
  });

  it('rejects a first digit other than 7', () => {
    expect(codes('6000000A000PB1')).toContain('FIRST_DIGIT');
  });

  it('rejects group 2 other than A', () => {
    const r = modern.validate('7000000B000PB1');
    expect(r.errors.find((e) => e.code === 'GROUP2')?.position).toBe(8);
  });

  it('rejects a signature other than PB', () => {
    const r = modern.validate('7000000A000BA1');
    expect(r.errors.find((e) => e.code === 'SIGNATURE')?.position).toBe(12);
  });

  it('rejects a wrong check digit and names the expected one', () => {
    const r = modern.validate('7000000A000PB2');
    const e = r.errors.find((x) => x.code === 'CHECK_DIGIT');
    expect(e?.position).toBe(14);
    expect(e?.message).toBe('Контрольная цифра 2, ожидается 1');
  });

  it('stops at structural errors', () => {
    expect(codes('7000000A000PB')).toEqual(['LENGTH']);
    expect(codes('7000000Ж000PB1')).toEqual(['INVALID_CHAR']);
  });
});

describe('modern.parse', () => {
  it('splits into the five groups', () => {
    expect(modern.parse('7123456A789PB6')).toEqual([
      { label: 'Группа 1 — случайное число', value: '7123456' },
      { label: 'Группа 2 — символ', value: 'A' },
      { label: 'Группа 3 — номер последовательности', value: '789' },
      { label: 'Группа 4 — сигнатура', value: 'PB' },
      { label: 'Группа 5 — контрольная цифра', value: '6 — верная' },
    ]);
  });

  it('shows the expected check digit when it differs', () => {
    expect(modern.parse('7123456A789PB0')?.[4].value).toBe('0 — ожидается 6');
  });

  it('returns null when the structure is broken', () => {
    expect(modern.parse('7123')).toBeNull();
  });
});

describe('modern.generate', () => {
  it('builds from given fields', () => {
    expect(modern.generate({ number: '7654321', sequence: '042' }, mulberry32(1))).toEqual({
      ok: true,
      value: '7654321A042PB4',
    });
  });

  it('reports invalid fields instead of generating', () => {
    expect(modern.generate({ number: '6123456', sequence: '12' }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: {
        number: 'Семь цифр, от 7000000 до 7999999',
        sequence: 'Три цифры, от 000 до 999',
      },
    });
  });

  it('fills missing fields randomly and stays valid', () => {
    const r = modern.generate({ sequence: '001' }, mulberry32(3));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.slice(8, 11)).toBe('001');
      expect(modern.validate(r.value).valid).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/modern.test.ts`
Expected: FAIL — `Failed to resolve import "../src/formats/modern"`.

- [ ] **Step 3: Implement `src/formats/modern.ts`**

```ts
import { checkDigit731 } from '../core/checkDigit';
import { resolveFields } from '../core/fields';
import { normalize } from '../core/normalize';
import { pad, randInt } from '../core/random';
import { structureIssues } from '../core/structure';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// MVD resolution No. 345 of 18.10.2011: 7xxxxxx A NNN PB C, every rule mandatory.

const fields: FieldSpec[] = [
  {
    key: 'number',
    label: 'Группа 1 (7000000–7999999)',
    kind: 'text',
    placeholder: '7000000',
    check: (v) => (/^7\d{6}$/.test(v) ? null : 'Семь цифр, от 7000000 до 7999999'),
    random: (rng) => String(randInt(rng, 7000000, 7999999)),
  },
  {
    key: 'sequence',
    label: 'Номер последовательности (000–999)',
    kind: 'text',
    placeholder: '000',
    check: (v) => (/^\d{3}$/.test(v) ? null : 'Три цифры, от 000 до 999'),
    random: (rng) => pad(randInt(rng, 0, 999), 3),
  },
];

function validate(input: string): ValidationResult {
  const n = normalize(input);
  const errors: Issue[] = [...n.errors];
  if (errors.length === 0) errors.push(...structureIssues(n.value));
  if (errors.length === 0) {
    const v = n.value;
    if (v[0] !== '7') {
      errors.push({ code: 'FIRST_DIGIT', message: 'Группа 1 должна быть в диапазоне 7000000–7999999', position: 1 });
    }
    if (v[7] !== 'A') {
      errors.push({ code: 'GROUP2', message: `Группа 2 должна быть «A», получено «${v[7]}»`, position: 8 });
    }
    const signature = v.slice(11, 13);
    if (signature !== 'PB') {
      errors.push({ code: 'SIGNATURE', message: `Сигнатура должна быть «PB», получено «${signature}»`, position: 12 });
    }
    const expected = checkDigit731(v.slice(0, 13));
    if (Number(v[13]) !== expected) {
      errors.push({ code: 'CHECK_DIGIT', message: `Контрольная цифра ${v[13]}, ожидается ${expected}`, position: 14 });
    }
  }
  return { valid: errors.length === 0, normalized: n.value, errors, warnings: n.warnings };
}

function parse(input: string): ParsedField[] | null {
  const n = normalize(input);
  if (n.errors.length > 0 || structureIssues(n.value).length > 0) return null;
  const v = n.value;
  const expected = checkDigit731(v.slice(0, 13));
  return [
    { label: 'Группа 1 — случайное число', value: v.slice(0, 7) },
    { label: 'Группа 2 — символ', value: v[7] },
    { label: 'Группа 3 — номер последовательности', value: v.slice(8, 11) },
    { label: 'Группа 4 — сигнатура', value: v.slice(11, 13) },
    {
      label: 'Группа 5 — контрольная цифра',
      value: Number(v[13]) === expected ? `${v[13]} — верная` : `${v[13]} — ожидается ${expected}`,
    },
  ];
}

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const body = `${values.number}A${values.sequence}PB`;
  return { ok: true, value: `${body}${checkDigit731(body)}` };
}

export const modern: FormatModule = {
  id: 'modern',
  title: '2012+ (МВД № 345)',
  official: true,
  fields,
  validate,
  parse,
  generate,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/modern.test.ts && npm run typecheck`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/formats/modern.ts tests/modern.test.ts
git commit -m "feat(formats): 2012+ personal number per MVD resolution 345"
```

---

### Task 4: Pre-2012 format module

**Files:**
- Create: `src/formats/legacy.ts`
- Test: `tests/legacy.test.ts`

**Interfaces:**
- Consumes: everything from Task 2.
- Produces: `export const legacy: FormatModule` with `id: 'legacy'`, `title: 'До 2012'`, `official: false`, `notice` set; field keys `gender` (`M`|`F`), `birthDate` (`ДД.ММ.ГГГГ`), `region`, `sequence`, `status`. Also `export const REGIONS`, `export const STATUSES` (`Record<string, string>`).

- [ ] **Step 1: Write the failing test**

`tests/legacy.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { legacy } from '../src/formats/legacy';
import { checkDigit731 } from '../src/core/checkDigit';
import { mulberry32 } from '../src/core/random';

const withCheck = (body: string) => `${body}${checkDigit731(body)}`;
const codes = (input: string) => legacy.validate(input).errors.map((e) => e.code);

describe('legacy.validate', () => {
  it('accepts a number whose check digit matches 7-3-1', () => {
    expect(legacy.validate('3271182A001PB1')).toEqual({
      valid: true,
      normalized: '3271182A001PB1',
      errors: [],
      warnings: [],
    });
  });

  it('keeps a 7-3-1 mismatch as a warning, not an error', () => {
    const r = legacy.validate('3271182A001PB5');
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toEqual(['CHECK_DIGIT_UNCONFIRMED']);
    expect(r.warnings[0].message).toContain('ожидается 1');
  });

  it.each(['0', '7', '9'])('rejects first digit %s', (d) => {
    expect(codes(withCheck(`${d}271182A001PB`))).toContain('FIRST_DIGIT');
  });

  it.each([
    ['3290200A001PB', false], // 29.02.1900: not leap
    ['4290204A001PB', true], //  29.02.1904: leap
    ['5290200A001PB', true], //  29.02.2000: leap
    ['1290200A001PB', false], // 29.02.1800: not leap
    ['3310485A001PB', false], // 31.04.1985
    ['3001385A001PB', false], // month 13
  ])('date check for %s -> valid=%s', (body, ok) => {
    expect(codes(withCheck(body)).includes('DATE')).toBe(!ok);
  });

  it('rejects a birth date in the future', () => {
    expect(codes(withCheck('5010199A001PB'))).toContain('FUTURE_DATE');
  });

  it('rejects an unknown region at position 8', () => {
    const r = legacy.validate(withCheck('3271182D001PB'));
    expect(r.errors.find((e) => e.code === 'REGION')?.position).toBe(8);
  });

  it('rejects an unknown status at position 12', () => {
    const r = legacy.validate(withCheck('3271182A001XX'));
    expect(r.errors.find((e) => e.code === 'STATUS')?.position).toBe(12);
  });
});

describe('legacy.parse', () => {
  it('decodes every field', () => {
    expect(legacy.parse('4140385H007BI6')).toEqual([
      { label: 'Пол', value: 'женский' },
      { label: 'Век рождения', value: 'XX' },
      { label: 'Дата рождения', value: '14.03.1985' },
      { label: 'Регион', value: 'H — Гомельская область' },
      { label: 'Порядковый номер', value: '007' },
      { label: 'Статус', value: 'BI — иностранный гражданин' },
      { label: 'Контрольная цифра', value: '6 — совпадает с 7-3-1' },
    ]);
  });

  it('marks unknown codes instead of failing', () => {
    const fields = legacy.parse('9271182D001XX0');
    expect(fields?.[0].value).toBe('неизвестно (цифра 9)');
    expect(fields?.[3].value).toBe('D — неизвестный код');
    expect(fields?.[5].value).toBe('XX — неизвестный код');
  });

  it('returns null when the structure is broken', () => {
    expect(legacy.parse('3271182')).toBeNull();
  });
});

describe('legacy.generate', () => {
  it('builds from given fields', () => {
    expect(
      legacy.generate(
        { gender: 'F', birthDate: '14.03.1985', region: 'H', sequence: '007', status: 'BI' },
        mulberry32(1),
      ),
    ).toEqual({ ok: true, value: '4140385H007BI6' });
  });

  it('encodes century and gender in digit 1', () => {
    const r = legacy.generate({ gender: 'M', birthDate: '01.01.2005' }, mulberry32(2));
    expect(r.ok && r.value[0]).toBe('5');
  });

  it.each([
    ['31.02.1985', 'Дата в формате ДД.ММ.ГГГГ, должна существовать'],
    ['1985-02-01', 'Дата в формате ДД.ММ.ГГГГ, должна существовать'],
    ['01.01.1799', 'Год от 1800 до 2099'],
    ['01.01.2099', 'Дата рождения не может быть в будущем'],
  ])('rejects birth date %s', (birthDate, message) => {
    expect(legacy.generate({ birthDate }, mulberry32(1))).toEqual({
      ok: false,
      fieldErrors: { birthDate: message },
    });
  });

  it('rejects an unknown region', () => {
    const r = legacy.generate({ region: 'D' }, mulberry32(1));
    expect(r).toEqual({ ok: false, fieldErrors: { region: 'Выберите регион из списка' } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/legacy.test.ts`
Expected: FAIL — `Failed to resolve import "../src/formats/legacy"`.

- [ ] **Step 3: Implement `src/formats/legacy.ts`**

```ts
import { checkDigit731 } from '../core/checkDigit';
import { resolveFields } from '../core/fields';
import { normalize } from '../core/normalize';
import { pad, pick, randInt } from '../core/random';
import { structureIssues } from '../core/structure';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';

// Pre-2012 format is not published officially. Tables below follow the media sources cited in the
// spec (aif.by, forum.onliner.by), which agree with each other. Change them here and nowhere else.
export const REGIONS: Record<string, string> = {
  A: 'г. Минск',
  B: 'Минская область',
  C: 'Брестская область',
  E: 'Витебская область',
  H: 'Гомельская область',
  K: 'Гродненская область',
  M: 'Могилёвская область',
};

export const STATUSES: Record<string, string> = {
  PB: 'гражданин Республики Беларусь',
  BA: 'лицо без гражданства',
  BI: 'иностранный гражданин',
};

const CENTURIES = ['XIX', 'XX', 'XXI'];
const MIN_YEAR = 1800;
const MAX_YEAR = 2099;
const DAY_MS = 86_400_000;

function isValidDate(year: number, month: number, day: number): boolean {
  const t = new Date(Date.UTC(year, month - 1, day));
  return t.getUTCFullYear() === year && t.getUTCMonth() === month - 1 && t.getUTCDate() === day;
}

function isFuture(year: number, month: number, day: number): boolean {
  return Date.UTC(year, month - 1, day) > Date.now();
}

/** Digit 1: odd = male, even = female; 1-2 XIX, 3-4 XX, 5-6 XXI century. */
function decodeFirstDigit(ch: string): { gender: 'M' | 'F'; centuryIndex: number } | null {
  const d = Number(ch);
  if (!(d >= 1 && d <= 6)) return null;
  return { gender: d % 2 === 1 ? 'M' : 'F', centuryIndex: Math.floor((d - 1) / 2) };
}

function parseRuDate(v: string): { day: number; month: number; year: number } | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v);
  return m ? { day: Number(m[1]), month: Number(m[2]), year: Number(m[3]) } : null;
}

function checkBirthDate(v: string): string | null {
  const d = parseRuDate(v);
  if (!d || !isValidDate(d.year, d.month, d.day)) return 'Дата в формате ДД.ММ.ГГГГ, должна существовать';
  if (d.year < MIN_YEAR || d.year > MAX_YEAR) return 'Год от 1800 до 2099';
  if (isFuture(d.year, d.month, d.day)) return 'Дата рождения не может быть в будущем';
  return null;
}

function randomBirthDate(rng: Rng): string {
  const start = Date.UTC(1900, 0, 1);
  const days = Math.floor((Date.now() - start) / DAY_MS);
  const t = new Date(start + randInt(rng, 0, days) * DAY_MS);
  return `${pad(t.getUTCDate(), 2)}.${pad(t.getUTCMonth() + 1, 2)}.${t.getUTCFullYear()}`;
}

const options = (table: Record<string, string>) =>
  Object.entries(table).map(([value, label]) => ({ value, label: `${value} — ${label}` }));

const fields: FieldSpec[] = [
  {
    key: 'gender',
    label: 'Пол',
    kind: 'select',
    options: [{ value: 'M', label: 'Мужской' }, { value: 'F', label: 'Женский' }],
    check: (v) => (v === 'M' || v === 'F' ? null : 'Выберите пол'),
    random: (rng) => pick(rng, ['M', 'F']),
  },
  {
    key: 'birthDate',
    label: 'Дата рождения',
    kind: 'text',
    placeholder: 'ДД.ММ.ГГГГ',
    check: checkBirthDate,
    random: randomBirthDate,
  },
  {
    key: 'region',
    label: 'Регион',
    kind: 'select',
    options: options(REGIONS),
    check: (v) => (Object.hasOwn(REGIONS, v) ? null : 'Выберите регион из списка'),
    random: (rng) => pick(rng, Object.keys(REGIONS)),
  },
  {
    key: 'sequence',
    label: 'Порядковый номер (000–999)',
    kind: 'text',
    placeholder: '001',
    check: (v) => (/^\d{3}$/.test(v) ? null : 'Три цифры, от 000 до 999'),
    random: (rng) => pad(randInt(rng, 0, 999), 3),
  },
  {
    key: 'status',
    label: 'Статус',
    kind: 'select',
    options: options(STATUSES),
    check: (v) => (Object.hasOwn(STATUSES, v) ? null : 'Выберите статус из списка'),
    random: (rng) => pick(rng, Object.keys(STATUSES)),
  },
];

function validate(input: string): ValidationResult {
  const n = normalize(input);
  const errors: Issue[] = [...n.errors];
  const warnings: Issue[] = [...n.warnings];
  if (errors.length === 0) errors.push(...structureIssues(n.value));
  if (errors.length === 0) {
    const v = n.value;
    const first = decodeFirstDigit(v[0]);
    if (!first) {
      errors.push({ code: 'FIRST_DIGIT', message: 'Первая цифра должна быть от 1 до 6 (пол и век рождения)', position: 1 });
    } else {
      const day = Number(v.slice(1, 3));
      const month = Number(v.slice(3, 5));
      const year = MIN_YEAR + first.centuryIndex * 100 + Number(v.slice(5, 7));
      const shown = `${v.slice(1, 3)}.${v.slice(3, 5)}.${year}`;
      if (!isValidDate(year, month, day)) {
        errors.push({ code: 'DATE', message: `Несуществующая дата рождения ${shown}`, position: 2 });
      } else if (isFuture(year, month, day)) {
        errors.push({ code: 'FUTURE_DATE', message: `Дата рождения ${shown} в будущем`, position: 2 });
      }
    }
    if (!Object.hasOwn(REGIONS, v[7])) {
      errors.push({ code: 'REGION', message: `Неизвестный код региона «${v[7]}»`, position: 8 });
    }
    const status = v.slice(11, 13);
    if (!Object.hasOwn(STATUSES, status)) {
      errors.push({ code: 'STATUS', message: `Неизвестный код статуса «${status}»`, position: 12 });
    }
    const expected = checkDigit731(v.slice(0, 13));
    if (Number(v[13]) !== expected) {
      warnings.push({
        code: 'CHECK_DIGIT_UNCONFIRMED',
        message: `Контрольная цифра ${v[13]}, по формуле 7-3-1 ожидается ${expected}. Алгоритм для номеров до 2012 года официально не подтверждён, поэтому номер не отклонён`,
        position: 14,
      });
    }
  }
  return { valid: errors.length === 0, normalized: n.value, errors, warnings };
}

function parse(input: string): ParsedField[] | null {
  const n = normalize(input);
  if (n.errors.length > 0 || structureIssues(n.value).length > 0) return null;
  const v = n.value;
  const first = decodeFirstDigit(v[0]);
  const date = `${v.slice(1, 3)}.${v.slice(3, 5)}`;
  const expected = checkDigit731(v.slice(0, 13));
  const status = v.slice(11, 13);
  return [
    { label: 'Пол', value: first ? (first.gender === 'M' ? 'мужской' : 'женский') : `неизвестно (цифра ${v[0]})` },
    { label: 'Век рождения', value: first ? CENTURIES[first.centuryIndex] : '—' },
    {
      label: 'Дата рождения',
      value: first ? `${date}.${MIN_YEAR + first.centuryIndex * 100 + Number(v.slice(5, 7))}` : `${date}.${v.slice(5, 7)}`,
    },
    { label: 'Регион', value: `${v[7]} — ${REGIONS[v[7]] ?? 'неизвестный код'}` },
    { label: 'Порядковый номер', value: v.slice(8, 11) },
    { label: 'Статус', value: `${status} — ${STATUSES[status] ?? 'неизвестный код'}` },
    {
      label: 'Контрольная цифра',
      value: Number(v[13]) === expected ? `${v[13]} — совпадает с 7-3-1` : `${v[13]} — по 7-3-1 ожидается ${expected}`,
    },
  ];
}

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const d = parseRuDate(values.birthDate)!;
  const centuryIndex = Math.floor((d.year - MIN_YEAR) / 100);
  const first = centuryIndex * 2 + (values.gender === 'M' ? 1 : 2);
  const body = `${first}${pad(d.day, 2)}${pad(d.month, 2)}${pad(d.year % 100, 2)}${values.region}${values.sequence}${values.status}`;
  return { ok: true, value: `${body}${checkDigit731(body)}` };
}

export const legacy: FormatModule = {
  id: 'legacy',
  title: 'До 2012',
  official: false,
  notice:
    'Структура и алгоритм контрольной цифры для номеров до 2012 года официально не опубликованы. Коды регионов и статусов — по данным СМИ (АиФ, onliner.by).',
  fields,
  validate,
  parse,
  generate,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/legacy.test.ts && npm run typecheck`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/formats/legacy.ts tests/legacy.test.ts
git commit -m "feat(formats): pre-2012 personal number with unconfirmed check digit as warning"
```

---

### Task 5: Format registry, cross-format hint, round-trip properties

**Files:**
- Create: `src/formats/index.ts`
- Test: `tests/formats.test.ts`

**Interfaces:**
- Consumes: `modern` (Task 3), `legacy` (Task 4).
- Produces: `FORMATS: Record<FormatId, FormatModule>`, `FORMAT_LIST: FormatModule[]` (order: modern, legacy), `suggestOtherFormat(input: string, current: FormatId): FormatModule | null`.

- [ ] **Step 1: Write the failing test**

`tests/formats.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { FORMAT_LIST, FORMATS, suggestOtherFormat } from '../src/formats';
import { mulberry32 } from '../src/core/random';

describe('generated numbers', () => {
  for (const format of FORMAT_LIST) {
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

  it('a number of one format never validates in the other', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const m = FORMATS.modern.generate({}, mulberry32(seed));
      const l = FORMATS.legacy.generate({}, mulberry32(seed));
      if (m.ok) expect(FORMATS.legacy.validate(m.value).valid).toBe(false);
      if (l.ok) expect(FORMATS.modern.validate(l.value).valid).toBe(false);
    }
  });
});

describe('suggestOtherFormat', () => {
  it('suggests legacy for a legacy number checked as modern', () => {
    expect(suggestOtherFormat('3271182A001PB1', 'modern')?.id).toBe('legacy');
  });

  it('suggests modern for a modern number checked as legacy', () => {
    expect(suggestOtherFormat('7000000A000PB1', 'legacy')?.id).toBe('modern');
  });

  it('suggests nothing when the current format accepts the number', () => {
    expect(suggestOtherFormat('7000000A000PB1', 'modern')).toBeNull();
  });

  it('suggests nothing when no format accepts it', () => {
    expect(suggestOtherFormat('garbage', 'modern')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/formats.test.ts`
Expected: FAIL — `Failed to resolve import "../src/formats"`.

- [ ] **Step 3: Implement `src/formats/index.ts`**

```ts
import type { FormatId, FormatModule } from '../core/types';
import { legacy } from './legacy';
import { modern } from './modern';

export const FORMATS: Record<FormatId, FormatModule> = { modern, legacy };

export const FORMAT_LIST: FormatModule[] = [modern, legacy];

/** Another format that accepts the input, when the current one rejects it. */
export function suggestOtherFormat(input: string, current: FormatId): FormatModule | null {
  if (FORMATS[current].validate(input).valid) return null;
  return FORMAT_LIST.find((f) => f.id !== current && f.validate(input).valid) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/formats/index.ts tests/formats.test.ts
git commit -m "feat(formats): registry, cross-format hint, round-trip property tests"
```

---

### Task 6: Format persistence and privacy guard

**Files:**
- Create: `src/ui/formatState.ts`
- Test: `tests/formatState.test.ts`, `tests/privacy.test.ts`

**Interfaces:**
- Consumes: `FormatId` (Task 2).
- Produces: `STORAGE_KEY = 'by-data-tools:format'`, `isFormatId(v: unknown): v is FormatId`, `resolveInitialFormat(search: string, stored: string | null): FormatId`, `withFormatParam(search: string, id: FormatId): string`, `readStoredFormat(): string | null`, `persistFormat(id: FormatId): void`.

- [ ] **Step 1: Write the failing tests**

`tests/formatState.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isFormatId, resolveInitialFormat, withFormatParam } from '../src/ui/formatState';

describe('formatState', () => {
  it('URL wins over storage', () => {
    expect(resolveInitialFormat('?format=legacy', 'modern')).toBe('legacy');
  });

  it('falls back to storage, then to modern', () => {
    expect(resolveInitialFormat('', 'legacy')).toBe('legacy');
    expect(resolveInitialFormat('', null)).toBe('modern');
  });

  it('ignores unknown values', () => {
    expect(resolveInitialFormat('?format=x', 'y')).toBe('modern');
    expect(isFormatId('modern')).toBe(true);
    expect(isFormatId('other')).toBe(false);
  });

  it('sets only the format param and keeps others', () => {
    expect(withFormatParam('?a=1', 'legacy')).toBe('?a=1&format=legacy');
    expect(withFormatParam('?format=modern', 'legacy')).toBe('?format=legacy');
  });
});
```

`tests/privacy.test.ts`:
```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
  });
}

const NETWORK = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/];
const PERSISTENCE = [/localStorage/, /sessionStorage/, /history\.\w+State/, /document\.cookie/, /indexedDB/];

// The spec promises the number never leaves the browser and is never persisted.
describe('privacy', () => {
  it('no network API is used anywhere in src', () => {
    for (const file of sources(SRC)) {
      const code = readFileSync(file, 'utf8');
      for (const re of NETWORK) expect(re.test(code), `${relative(SRC, file)} uses ${re}`).toBe(false);
    }
  });

  it('storage and URL are touched only by ui/formatState.ts', () => {
    for (const file of sources(SRC)) {
      if (relative(SRC, file) === join('ui', 'formatState.ts')) continue;
      const code = readFileSync(file, 'utf8');
      for (const re of PERSISTENCE) expect(re.test(code), `${relative(SRC, file)} uses ${re}`).toBe(false);
    }
  });

  it('formatState stores only the format id', () => {
    const code = readFileSync(join(SRC, 'ui', 'formatState.ts'), 'utf8');
    expect(code.match(/setItem\(/g)).toHaveLength(1);
    expect(code).toContain('setItem(STORAGE_KEY, id)');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/formatState.test.ts tests/privacy.test.ts`
Expected: FAIL — `formatState.test.ts` cannot resolve `../src/ui/formatState`; `privacy.test.ts` fails "formatState stores only the format id" with `ENOENT`.

- [ ] **Step 3: Implement `src/ui/formatState.ts`**

```ts
import type { FormatId } from '../core/types';

// The only module allowed to touch localStorage or the URL: it persists the format id, never a number.

export const STORAGE_KEY = 'by-data-tools:format';
const PARAM = 'format';
const IDS: readonly FormatId[] = ['modern', 'legacy'];

export function isFormatId(v: unknown): v is FormatId {
  return typeof v === 'string' && (IDS as readonly string[]).includes(v);
}

export function resolveInitialFormat(search: string, stored: string | null): FormatId {
  const fromUrl = new URLSearchParams(search).get(PARAM);
  if (isFormatId(fromUrl)) return fromUrl;
  if (isFormatId(stored)) return stored;
  return 'modern';
}

export function withFormatParam(search: string, id: FormatId): string {
  const params = new URLSearchParams(search);
  params.set(PARAM, id);
  return `?${params}`;
}

export function readStoredFormat(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function persistFormat(id: FormatId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage blocked (private mode): the URL param still carries the choice.
  }
  const url = new URL(location.href);
  url.search = withFormatParam(url.search, id);
  history.replaceState(null, '', url);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: all tests PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/formatState.ts tests/formatState.test.ts tests/privacy.test.ts
git commit -m "feat(ui): persist format choice only; guard against network and number persistence"
```

---

### Task 7: UI — theme, switch, validate and generate cards

**Files:**
- Create: `src/ui/dom.ts`, `src/ui/icons.ts`, `src/ui/formatSwitch.ts`, `src/ui/validatePanel.ts`, `src/ui/generatePanel.ts`, `src/ui/theme.css`
- Modify (replace placeholder from Task 1): `index.html`, `src/main.ts`

**Interfaces:**
- Consumes: `FORMATS`, `FORMAT_LIST`, `suggestOtherFormat` (Task 5); `resolveInitialFormat`, `readStoredFormat`, `persistFormat` (Task 6); `cryptoRng` (Task 2).
- Produces:
  - `el(tag, attrs?, ...children)` — typed `document.createElement` + `setAttribute` + `append`.
  - `mdIcon(name: IconName): HTMLElement`, `IconName = 'check' | 'error' | 'warning' | 'copy' | 'dice'`.
  - `mountFormatSwitch(root, formats, initial, onChange): { set(id: FormatId): void }`.
  - `mountValidatePanel(root, onSwitchFormat): { setFormat(f: FormatModule): void; check(value: string): void }`.
  - `mountGeneratePanel(root, onCheck, rng?): { setFormat(f: FormatModule): void }`.

- [ ] **Step 1: Write `src/ui/dom.ts`**

```ts
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}
```

- [ ] **Step 2: Write `src/ui/icons.ts`**

```ts
// Material Icons (Apache 2.0), 24px viewBox — inlined so the page makes no font request.
const PATHS = {
  check: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  copy: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z',
  dice: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z',
} as const;

export type IconName = keyof typeof PATHS;

const SVG_NS = 'http://www.w3.org/2000/svg';

export function mdIcon(name: IconName): HTMLElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', PATHS[name]);
  svg.append(path);
  const icon = document.createElement('md-icon');
  icon.append(svg);
  return icon;
}
```

- [ ] **Step 3: Write `src/ui/formatSwitch.ts`**

```ts
import type { FormatId, FormatModule } from '../core/types';
import { el } from './dom';

// @material/web ships segmented buttons only under labs/, so this is a plain ARIA radiogroup.
export function mountFormatSwitch(
  root: HTMLElement,
  formats: FormatModule[],
  initial: FormatId,
  onChange: (id: FormatId) => void,
): { set(id: FormatId): void } {
  root.className = 'segmented';
  root.setAttribute('role', 'radiogroup');
  root.setAttribute('aria-label', 'Формат номера');
  const buttons = formats.map((f) => {
    const button = el('button', { type: 'button', role: 'radio', 'data-id': f.id }, f.title);
    button.addEventListener('click', () => onChange(f.id));
    return button;
  });
  root.append(...buttons);

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const current = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    const next = (current + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    onChange(formats[next].id);
    buttons[next].focus();
  });

  function set(id: FormatId): void {
    for (const b of buttons) {
      const on = b.dataset.id === id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
  }

  set(initial);
  return { set };
}
```

- [ ] **Step 4: Write `src/ui/validatePanel.ts`**

```ts
import type { FormatId, FormatModule, Issue, ValidationResult } from '../core/types';
import { suggestOtherFormat } from '../formats';
import { el } from './dom';
import { mdIcon } from './icons';

export interface ValidatePanel {
  setFormat(format: FormatModule): void;
  check(value: string): void;
}

export function mountValidatePanel(root: HTMLElement, onSwitchFormat: (id: FormatId) => void): ValidatePanel {
  const field = el('md-outlined-text-field', {
    label: 'Идентификационный номер',
    'supporting-text': 'Пробелы, дефисы и регистр не важны',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const button = el('md-filled-button', {}, 'Проверить');
  const result = el('div', { class: 'result', 'aria-live': 'polite' });
  root.append(el('div', { class: 'input-row' }, field, button), result);

  let format: FormatModule | null = null;
  let timer: number | undefined;
  const run = () => render(field.value);
  field.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(run, 300);
  });
  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') run();
  });
  button.addEventListener('click', run);

  function issueList(issues: Issue[], kind: 'error' | 'warning'): HTMLElement {
    return el(
      'ul',
      { class: `issues ${kind}` },
      ...issues.map((i) => el('li', {}, mdIcon(kind), i.position ? `Позиция ${i.position}: ${i.message}` : i.message)),
    );
  }

  function statusLine(r: ValidationResult): HTMLElement {
    if (!r.valid) return el('p', { class: 'status error' }, mdIcon('error'), 'Номер невалиден');
    if (r.warnings.length) return el('p', { class: 'status warning' }, mdIcon('warning'), 'Номер валиден, есть предупреждения');
    return el('p', { class: 'status ok' }, mdIcon('check'), 'Номер валиден');
  }

  function render(input: string): void {
    result.replaceChildren();
    if (!format || input.trim() === '') return;
    const r = format.validate(input);
    result.append(statusLine(r));
    if (r.errors.length) result.append(issueList(r.errors, 'error'));
    if (r.warnings.length) result.append(issueList(r.warnings, 'warning'));
    const other = suggestOtherFormat(input, format.id);
    if (other) {
      const switchButton = el('md-text-button', {}, 'Переключить');
      switchButton.addEventListener('click', () => onSwitchFormat(other.id));
      result.append(el('p', { class: 'hint' }, `Похоже на формат «${other.title}».`, switchButton));
    }
    const parsed = format.parse(input);
    if (parsed) {
      const rows = parsed.map((f) => el('tr', {}, el('th', { scope: 'row' }, f.label), el('td', {}, f.value)));
      result.append(el('table', { class: 'parsed' }, el('tbody', {}, ...rows)));
    }
  }

  return {
    setFormat(f) {
      format = f;
      render(field.value);
    },
    check(value) {
      field.value = value;
      render(value);
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
  };
}
```

- [ ] **Step 5: Write `src/ui/generatePanel.ts`**

```ts
import type { MdOutlinedSelect } from '@material/web/select/outlined-select.js';
import type { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js';
import { cryptoRng } from '../core/random';
import type { FieldSpec, FormatModule, Rng } from '../core/types';
import { el } from './dom';
import { mdIcon } from './icons';

type Control = MdOutlinedTextField | MdOutlinedSelect;

export interface GeneratePanel {
  setFormat(format: FormatModule): void;
}

export function mountGeneratePanel(
  root: HTMLElement,
  onCheck: (value: string) => void,
  rng: Rng = cryptoRng,
): GeneratePanel {
  const fieldsBox = el('div', { class: 'fields' });
  const generateButton = el('md-filled-button', {}, 'Сгенерировать');
  const randomButton = el('md-outlined-button', {}, 'Всё случайно');
  const output = el('div', { class: 'output', 'aria-live': 'polite' });
  root.append(
    el('p', { class: 'help' }, 'Пустые поля заполняются случайно. Контрольная цифра считается автоматически.'),
    fieldsBox,
    el('div', { class: 'actions' }, generateButton, randomButton),
    output,
  );

  let format: FormatModule | null = null;
  let controls = new Map<string, Control>();

  function buildControl(spec: FieldSpec): Control {
    if (spec.kind === 'select') {
      const select = el('md-outlined-select', { label: spec.label });
      select.append(el('md-select-option', { value: '' }, el('div', { slot: 'headline' }, 'Случайно')));
      for (const o of spec.options ?? []) {
        select.append(el('md-select-option', { value: o.value }, el('div', { slot: 'headline' }, o.label)));
      }
      return select;
    }
    return el('md-outlined-text-field', { label: spec.label, placeholder: spec.placeholder ?? '', autocomplete: 'off' });
  }

  function clearError(control: Control): void {
    control.error = false;
    control.errorText = '';
  }

  function setFormat(f: FormatModule): void {
    format = f;
    controls = new Map();
    fieldsBox.replaceChildren();
    output.replaceChildren();
    for (const spec of f.fields) {
      const control = buildControl(spec);
      const dice = el('md-icon-button', { 'aria-label': `Случайное значение: ${spec.label}` }, mdIcon('dice'));
      dice.addEventListener('click', () => {
        control.value = spec.random(rng);
        clearError(control);
      });
      controls.set(spec.key, control);
      fieldsBox.append(el('div', { class: 'field-row' }, control, dice));
    }
  }

  function run(partial: Record<string, string>): void {
    if (!format) return;
    controls.forEach(clearError);
    output.replaceChildren();
    const r = format.generate(partial, rng);
    if (!r.ok) {
      for (const [key, message] of Object.entries(r.fieldErrors)) {
        const control = controls.get(key);
        if (control) {
          control.error = true;
          control.errorText = message;
        }
      }
      return;
    }
    const value = r.value;
    const copy = el('md-icon-button', { 'aria-label': 'Копировать' }, mdIcon('copy'));
    copy.addEventListener('click', () => void navigator.clipboard?.writeText(value));
    const check = el('md-text-button', {}, 'Проверить');
    check.addEventListener('click', () => onCheck(value));
    output.append(el('output', { class: 'generated' }, value), copy, check);
  }

  generateButton.addEventListener('click', () =>
    run(Object.fromEntries([...controls].map(([key, control]) => [key, control.value]))),
  );
  randomButton.addEventListener('click', () => {
    controls.forEach((control) => (control.value = ''));
    run({});
  });

  return { setFormat };
}
```

- [ ] **Step 6: Write `src/ui/theme.css`**

```css
:root {
  color-scheme: light dark;
  --md-ref-typeface-brand: 'Roboto', system-ui, sans-serif;
  --md-ref-typeface-plain: 'Roboto', system-ui, sans-serif;

  --md-sys-color-primary: #006a60;
  --md-sys-color-on-primary: #ffffff;
  --md-sys-color-primary-container: #9ef2e4;
  --md-sys-color-on-primary-container: #00201c;
  --md-sys-color-secondary: #4a635f;
  --md-sys-color-on-secondary: #ffffff;
  --md-sys-color-secondary-container: #cce8e2;
  --md-sys-color-on-secondary-container: #051f1c;
  --md-sys-color-surface: #f4fbf8;
  --md-sys-color-on-surface: #171d1c;
  --md-sys-color-on-surface-variant: #3f4947;
  --md-sys-color-surface-container-lowest: #ffffff;
  --md-sys-color-surface-container-low: #eef5f2;
  --md-sys-color-surface-container: #e9efec;
  --md-sys-color-surface-container-high: #e3e9e7;
  --md-sys-color-surface-container-highest: #dde4e1;
  --md-sys-color-outline: #6f7977;
  --md-sys-color-outline-variant: #bec9c6;
  --md-sys-color-error: #ba1a1a;
  --md-sys-color-on-error: #ffffff;
  --md-sys-color-error-container: #ffdad6;
  --md-sys-color-on-error-container: #410002;
  --md-sys-color-inverse-surface: #2b3230;
  --md-sys-color-inverse-on-surface: #ecf2ef;
  --md-sys-color-shadow: #000000;

  --app-success: #006a60;
  --app-warning: #7a5900;
  --app-warning-container: #ffdea6;
}

@media (prefers-color-scheme: dark) {
  :root {
    --md-sys-color-primary: #82d5c8;
    --md-sys-color-on-primary: #003731;
    --md-sys-color-primary-container: #005048;
    --md-sys-color-on-primary-container: #9ef2e4;
    --md-sys-color-secondary: #b1ccc6;
    --md-sys-color-on-secondary: #1c3531;
    --md-sys-color-secondary-container: #334b47;
    --md-sys-color-on-secondary-container: #cce8e2;
    --md-sys-color-surface: #0e1513;
    --md-sys-color-on-surface: #dde4e1;
    --md-sys-color-on-surface-variant: #bec9c6;
    --md-sys-color-surface-container-lowest: #090f0e;
    --md-sys-color-surface-container-low: #171d1c;
    --md-sys-color-surface-container: #1b2120;
    --md-sys-color-surface-container-high: #252b2a;
    --md-sys-color-surface-container-highest: #303635;
    --md-sys-color-outline: #899390;
    --md-sys-color-outline-variant: #3f4947;
    --md-sys-color-error: #ffb4ab;
    --md-sys-color-on-error: #690005;
    --md-sys-color-error-container: #93000a;
    --md-sys-color-on-error-container: #ffdad6;
    --md-sys-color-inverse-surface: #dde4e1;
    --md-sys-color-inverse-on-surface: #2b3230;

    --app-success: #82d5c8;
    --app-warning: #f9bd3c;
    --app-warning-container: #4e3a00;
  }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--md-ref-typeface-plain);
  line-height: 1.5;
  background: var(--md-sys-color-surface);
  color: var(--md-sys-color-on-surface);
}

.top, main, .foot { max-width: 720px; margin-inline: auto; padding-inline: 16px; }
.top { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; justify-content: space-between; padding-block: 32px 16px; }
h1 { margin: 0; font-size: 1.5rem; font-weight: 500; }
h2 { margin: 0 0 16px; font-size: 1.125rem; font-weight: 500; }

.card { margin-block: 16px; padding: 24px; border-radius: 16px; background: var(--md-sys-color-surface-container-low); }
.notice { margin: 0; padding: 12px 16px; border-radius: 12px; background: var(--app-warning-container); }

.segmented { display: inline-flex; overflow: hidden; border: 1px solid var(--md-sys-color-outline); border-radius: 20px; }
.segmented button {
  min-height: 40px; padding: 0 16px; border: 0; cursor: pointer;
  font: 500 0.875rem/1 var(--md-ref-typeface-plain);
  background: transparent; color: var(--md-sys-color-on-surface);
}
.segmented button + button { border-left: 1px solid var(--md-sys-color-outline); }
.segmented button[aria-checked='true'] {
  background: var(--md-sys-color-secondary-container);
  color: var(--md-sys-color-on-secondary-container);
}
.segmented button:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: -2px; }

.input-row { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
.input-row md-outlined-text-field { flex: 1 1 260px; }
.input-row md-filled-button { margin-top: 8px; }

md-icon { flex: none; --md-icon-size: 20px; }
md-icon svg { fill: currentColor; }

.status { display: flex; gap: 8px; align-items: center; margin: 16px 0 8px; font-weight: 500; }
.status.ok { color: var(--app-success); }
.status.error { color: var(--md-sys-color-error); }
.status.warning { color: var(--app-warning); }

.issues { margin: 0 0 8px; padding: 0; list-style: none; }
.issues li { display: flex; gap: 8px; align-items: flex-start; padding-block: 4px; }
.issues.error md-icon { color: var(--md-sys-color-error); }
.issues.warning md-icon { color: var(--app-warning); }

.hint { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }

.parsed { width: 100%; margin-top: 8px; border-collapse: collapse; }
.parsed th, .parsed td { padding: 8px 0; text-align: left; vertical-align: top; border-bottom: 1px solid var(--md-sys-color-outline-variant); }
.parsed th { width: 45%; padding-right: 16px; font-weight: 400; color: var(--md-sys-color-on-surface-variant); }

.help { margin: 0 0 16px; color: var(--md-sys-color-on-surface-variant); }
.fields { display: grid; gap: 12px; }
.field-row { display: flex; gap: 4px; align-items: center; }
.field-row > :first-child { flex: 1; min-width: 0; }
.actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
.output { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 16px; }
.generated { font: 500 1.375rem/1.3 ui-monospace, 'SF Mono', Menlo, monospace; letter-spacing: 0.04em; word-break: break-all; }

.foot { padding-block: 16px 32px; font-size: 0.875rem; color: var(--md-sys-color-on-surface-variant); }
```

- [ ] **Step 7: Replace `index.html`**

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="description" content="Проверка, разбор и генерация идентификационного номера паспорта Республики Беларусь" />
    <title>Идентификационный номер РБ</title>
  </head>
  <body>
    <header class="top">
      <h1>Идентификационный номер РБ</h1>
      <div id="format-switch"></div>
    </header>
    <main>
      <p id="format-notice" class="notice" hidden></p>
      <section class="card" aria-labelledby="validate-title">
        <h2 id="validate-title">Проверка и разбор</h2>
        <div id="validate"></div>
      </section>
      <section class="card" aria-labelledby="generate-title">
        <h2 id="generate-title">Генерация</h2>
        <div id="generate"></div>
      </section>
    </main>
    <footer class="foot">
      Номер обрабатывается только в вашем браузере и никуда не отправляется. Инструмент для тестовых данных.
    </footer>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 8: Replace `src/main.ts`**

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

import type { FormatId } from './core/types';
import { FORMAT_LIST, FORMATS } from './formats';
import { persistFormat, readStoredFormat, resolveInitialFormat } from './ui/formatState';
import { mountFormatSwitch } from './ui/formatSwitch';
import { mountGeneratePanel } from './ui/generatePanel';
import { mountValidatePanel } from './ui/validatePanel';

const byId = (id: string) => document.getElementById(id) as HTMLElement;

const notice = byId('format-notice');
const validatePanel = mountValidatePanel(byId('validate'), (id) => setFormat(id));
const generatePanel = mountGeneratePanel(byId('generate'), (value) => validatePanel.check(value));
const initial = resolveInitialFormat(location.search, readStoredFormat());
const formatSwitch = mountFormatSwitch(byId('format-switch'), FORMAT_LIST, initial, (id) => setFormat(id));

function setFormat(id: FormatId): void {
  const format = FORMATS[id];
  persistFormat(id);
  formatSwitch.set(id);
  notice.textContent = format.notice ?? '';
  notice.hidden = !format.notice;
  validatePanel.setFormat(format);
  generatePanel.setFormat(format);
}

setFormat(initial);
```

- [ ] **Step 9: Verify build and guards**

Run: `npm run typecheck && npm test && npm run build`
Expected: no type errors; all tests PASS (including `privacy.test.ts` over the new UI files); build succeeds.
Then: `grep -c "Content-Security-Policy" dist/index.html` → `1`; `grep -rE "https?://(fonts\.googleapis|fonts\.gstatic|cdn)" dist | wc -l` → `0`.

- [ ] **Step 10: Browser smoke check**

Run: `npm run preview -- --port 4173` (in background), open `http://localhost:4173/by-data-tools/`, and check each item:
1. Default format `2012+ (МВД № 345)` is selected; no notice shown.
2. Validate `7000000A000PB1` → «Номер валиден», table of 5 groups.
3. Validate `7000000А000РВ1` (Cyrillic) → valid with warning naming positions 8, 12, 13.
4. Validate `7000000A000PB2` → «Номер невалиден», «Позиция 14: Контрольная цифра 2, ожидается 1».
5. Validate `3271182A001PB1` in 2012+ → hint «Похоже на формат «До 2012»» with «Переключить»; clicking it switches format, URL gets `?format=legacy`, notice appears, table shows `27.11.1982`, `A — г. Минск`.
6. In «До 2012» validate `3271182A001PB5` → «валиден, есть предупреждения».
7. Generate with empty fields → a number appears; «Проверить» moves it to the validate card and it is valid.
8. Type `31.02.1985` in «Дата рождения», press «Сгенерировать» → field error, no number.
9. Reload page → format «До 2012» restored; the validated number is **not** in the URL, and DevTools → Application → Local Storage holds only `by-data-tools:format`.
10. Network tab after reload shows only same-origin requests.
11. Toggle OS dark mode → dark palette; 400px viewport → no horizontal scroll.
12. Arrow keys on the format switch move selection.

Fix anything that fails before committing. Stop the preview server.

- [ ] **Step 11: Commit**

```bash
git add index.html src/main.ts src/ui
git commit -m "feat(ui): material minimalism UI with format switch, validate and generate cards"
```

---

### Task 8: CI, Pages workflow, README

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/pages.yml`, `README.md`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches-ignore: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Write `.github/workflows/pages.yml`**

```yaml
name: Deploy Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v6
      - uses: actions/upload-pages-artifact@v5
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 3: Write `README.md`**

````markdown
# by-data-tools

Валидация и генерация тестовых данных Республики Беларусь. Работает целиком в браузере:
введённые данные никуда не отправляются и не сохраняются.

**Открыть:** https://aquahitt.github.io/by-data-tools/

## Идентификационный номер паспорта

Проверка, разбор и генерация (случайно или по заданным полям) в двух форматах —
формат выбирается переключателем:

- **2012+** — по [постановлению МВД РБ № 345 от 18.10.2011](https://mvd.gov.by/uploads/dgim/r345.pdf):
  `7xxxxxx A NNN PB C`, все правила обязательны.
- **До 2012** — пол и век, дата рождения, регион, порядковый номер, статус. Официально не описан;
  структура и коды — по данным [АиФ](https://aif.by/dontknows/kak_rasshifrovat_lichnyy_nomer_pasporta)
  и [onliner.by](https://forum.onliner.by/viewtopic.php?t=895870&start=160). Несовпадение контрольной
  цифры с формулой 7-3-1 показывается как предупреждение, а не ошибка.

Контрольная цифра: первые 13 символов, веса `7-3-1`, `A=10 … Z=35`, сумма по модулю 10.

## Разработка

```bash
npm install
npm run dev        # http://localhost:5173/by-data-tools/
npm test
npm run build
```

Новый документ — новый модуль в `src/formats/`, реализующий `FormatModule` из `src/core/types.ts`.

Сгенерированные номера предназначены только для тестирования.
````

- [ ] **Step 4: Validate workflow syntax locally**

Run: `ruby -ryaml -e 'ARGV.each { |f| YAML.load_file(f) }' .github/workflows/ci.yml .github/workflows/pages.yml`
Expected: exits 0 with no output. Semantic errors surface on the first run in Task 9.

- [ ] **Step 5: Commit**

```bash
git add .github README.md
git commit -m "ci: typecheck, test, build; deploy dist to GitHub Pages"
```

---

### Task 9: Publish to GitHub and verify the live site

**Files:** none (remote operations).

- [ ] **Step 1: Confirm the local state is clean and the identity is the noreply one**

Run: `git status --short && git log --format='%h %ae %s'`
Expected: empty status; every commit shows `124697399+aquahitt@users.noreply.github.com`.

- [ ] **Step 2: Create the public repository without pushing**

```bash
gh repo create aquahitt/by-data-tools --public \
  --description "Валидация и генерация тестовых данных Республики Беларусь" \
  --homepage "https://aquahitt.github.io/by-data-tools/" \
  --source . --remote origin
```
Expected: repo URL printed; `git remote -v` shows `origin`.

- [ ] **Step 3: Enable Pages with the Actions source (before the first push)**

```bash
gh api -X POST repos/aquahitt/by-data-tools/pages -f build_type=workflow
```
Expected: JSON with `"build_type": "workflow"`.

- [ ] **Step 4: Push and watch the deploy**

```bash
git push -u origin main
gh run watch "$(gh run list --workflow pages.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```
Expected: both jobs succeed.

- [ ] **Step 5: Verify the live site**

Run: `curl -s https://aquahitt.github.io/by-data-tools/ | grep -c "Content-Security-Policy"`
Expected: `1`. Then repeat smoke items 2, 5, 7 and 10 from Task 7 against the live URL.
