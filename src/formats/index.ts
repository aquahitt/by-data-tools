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
