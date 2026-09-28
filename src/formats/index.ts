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
