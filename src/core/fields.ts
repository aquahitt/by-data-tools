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
    const value = given ? (field.normalize ? field.normalize(given) : given) : field.random(rng);
    const error = field.check(value);
    if (error) fieldErrors[field.key] = error;
    values[field.key] = value;
  }
  return { values, fieldErrors };
}
