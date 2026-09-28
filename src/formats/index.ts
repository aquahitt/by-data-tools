import type { FormatId, FormatModule } from '../core/types';
import { ibanBy } from './iban';
import { legacy } from './legacy';
import { modern } from './modern';
import { passport1996 } from './passport1996';
import { phoneLandline, phoneMobile } from './phone';
import { passportBiometric } from './passportBiometric';
import { unpIndividual } from './unpIndividual';
import { unpOrganization } from './unpOrganization';

export const PERSONAL_NUMBER_FORMATS: FormatModule[] = [modern, legacy];

export const PASSPORT_FORMATS: FormatModule[] = [passport1996, passportBiometric];

export const UNP_FORMATS: FormatModule[] = [unpOrganization, unpIndividual];

export const IBAN_FORMATS: FormatModule[] = [ibanBy];

export const PHONE_FORMATS: FormatModule[] = [phoneMobile, phoneLandline];

/** Another format of the same section that accepts the input, when the current one rejects it. */
export function suggestOtherFormat(input: string, current: FormatId, formats: FormatModule[]): FormatModule | null {
  const active = formats.find((f) => f.id === current);
  if (!active || active.validate(input).valid) return null;
  return formats.find((f) => f.id !== current && f.validate(input).valid) ?? null;
}
