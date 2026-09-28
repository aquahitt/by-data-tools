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
