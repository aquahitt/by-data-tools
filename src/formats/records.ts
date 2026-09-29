import type { Rng } from '../core/types';

// Generator-only sections (test person, organisation, address): a set of consistent values per row, shown as a
// table and copied as JSON or CSV.

export interface RecordField {
  key: string;
  label: string;
}

export type DataRecord = Record<string, string>;

export interface RecordFilter {
  key: string;
  label: string;
  options: [value: string, label: string][];
}

export interface RecordSet {
  notice: string;
  filters: RecordFilter[];
  fields: RecordField[];
  /** `filters` holds the chosen option of each filter, '' for «Случайно». */
  generate(rng: Rng, filters: Record<string, string>): DataRecord;
}

const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** Semicolon-separated, as Excel with Russian regional settings expects; header row of Russian labels. */
export function toCsv(fields: RecordField[], rows: DataRecord[]): string {
  const header = fields.map((f) => csvCell(f.label)).join(';');
  return [header, ...rows.map((r) => fields.map((f) => csvCell(r[f.key] ?? '')).join(';'))].join('\r\n');
}

export function toJson(rows: DataRecord[]): string {
  return JSON.stringify(rows, null, 2);
}
