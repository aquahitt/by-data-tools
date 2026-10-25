import { cryptoRng, mulberry32 } from './core/random';
import type { FormatModule, ParsedField, Rng, ValidationResult } from './core/types';
import { ADDRESS_SET } from './formats/address';
import { ORGANIZATION_SET } from './formats/organization';
import { PERSONA_SET } from './formats/persona';
import { type DataRecord, type RecordSet, toCsv } from './formats/records';
import { TOOLS } from './tools';

// The npm package: the site's sections without the UI. A section is addressed by its id from the site's address
// (`#/unp` → 'unp'), a format by its id within the section; without a format the section's first one is used.

export type { FieldSpec, FormatModule, Issue, ParsedField, Rng, ValidationResult } from './core/types';
export type { DataRecord } from './formats/records';

export interface FormatOptions {
  /** Format id within the section, e.g. 'individual' for 'unp'. */
  format?: string;
}

export interface GenerateOptions extends FormatOptions {
  /** Fixed parts of the value by generator field key; the rest is random. See `formatsOf(section)[i].fields`. */
  fields?: Record<string, string>;
  /** Same seed — same values, for reproducible test data. Without it values come from crypto.getRandomValues. */
  seed?: number;
}

export type RecordKind = 'persona' | 'organization' | 'address';

export interface RecordOptions {
  count?: number;
  seed?: number;
  /** persona: { gender: 'M' | 'F' }; organization: { kind: 'org' | 'ip' }; address: { region: 'Минская' … }. */
  filters?: Record<string, string>;
}

const SECTIONS = new Map(TOOLS.filter((t) => t.formats.length > 0).map((t) => [t.id, t.formats]));
const RECORD_SETS: Record<RecordKind, RecordSet> = { persona: PERSONA_SET, organization: ORGANIZATION_SET, address: ADDRESS_SET };

/** Ids of sections with validation and generation, e.g. 'personal-number', 'unp', 'iban'. */
export function sections(): string[] {
  return [...SECTIONS.keys()];
}

/** The section's formats, the default first. */
export function formatsOf(section: string): FormatModule[] {
  const formats = SECTIONS.get(section);
  if (!formats) throw new Error(`Unknown section "${section}". Known: ${sections().join(', ')}`);
  return formats;
}

function formatOf(section: string, format?: string): FormatModule {
  const formats = formatsOf(section);
  if (format === undefined) return formats[0];
  const found = formats.find((f) => f.id === format);
  if (!found) throw new Error(`Unknown format "${format}" in "${section}". Known: ${formats.map((f) => f.id).join(', ')}`);
  return found;
}

const rngFor = (seed?: number): Rng => (seed === undefined ? cryptoRng : mulberry32(seed));

/**
 * Checks a value. With `format` — by that format only; without it — by the first format of the section that
 * accepts the value, or, if none does, by the default format (its errors are returned).
 */
export function validate(section: string, value: string, options: FormatOptions = {}): ValidationResult & { format: string } {
  const formats = options.format === undefined ? formatsOf(section) : [formatOf(section, options.format)];
  const results = formats.map((f) => ({ ...f.validate(value), format: f.id }));
  return results.find((r) => r.valid) ?? results[0];
}

export function isValid(section: string, value: string, options: FormatOptions = {}): boolean {
  return validate(section, value, options).valid;
}

/** The value's parts with their meaning (region, bank, check digit…), by the format `validate` picks. */
export function parse(section: string, value: string, options: FormatOptions = {}): ParsedField[] | null {
  return formatOf(section, validate(section, value, options).format).parse(value);
}

function generateWith(format: FormatModule, fields: Record<string, string>, rng: Rng): string {
  const result = format.generate(fields, rng);
  if (!result.ok) {
    const errors = Object.entries(result.fieldErrors).map(([key, message]) => `${key}: ${message}`);
    throw new Error(`Cannot generate "${format.id}": ${errors.join('; ')}`);
  }
  return result.value;
}

/** A valid value; throws when a given field is invalid. */
export function generate(section: string, options: GenerateOptions = {}): string {
  return generateWith(formatOf(section, options.format), options.fields ?? {}, rngFor(options.seed));
}

export function generateMany(section: string, count: number, options: GenerateOptions = {}): string[] {
  const format = formatOf(section, options.format);
  const rng = rngFor(options.seed);
  return Array.from({ length: count }, () => generateWith(format, options.fields ?? {}, rng));
}

function recordSet(kind: RecordKind): RecordSet {
  const set = RECORD_SETS[kind];
  if (!set) throw new Error(`Unknown record kind "${kind}". Known: ${Object.keys(RECORD_SETS).join(', ')}`);
  return set;
}

/** Consistent test people, organizations or addresses, as on the site's pages of the same names. */
export function generateRecords(kind: RecordKind, options: RecordOptions = {}): DataRecord[] {
  const set = recordSet(kind);
  const filters = options.filters ?? {};
  for (const [key, value] of Object.entries(filters)) {
    const filter = set.filters.find((f) => f.key === key);
    if (!filter) throw new Error(`Unknown filter "${key}" for "${kind}". Known: ${set.filters.map((f) => f.key).join(', ')}`);
    if (!filter.options.some(([v]) => v === value)) {
      throw new Error(`Unknown ${key} "${value}". Known: ${filter.options.map(([v]) => v).join(', ')}`);
    }
  }
  const rng = rngFor(options.seed);
  return Array.from({ length: options.count ?? 1 }, () => set.generate(rng, filters));
}

/** CSV with Russian column labels and `;`, as on the site (Excel with Russian regional settings opens it as is). */
export function recordsToCsv(kind: RecordKind, rows: DataRecord[]): string {
  return toCsv(recordSet(kind).fields, rows);
}
