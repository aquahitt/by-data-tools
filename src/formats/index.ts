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

// Errors that mean "this is not the shape of the format at all", as opposed to a wrong code or check digit.
const SHAPE_ERRORS = new Set(['EMPTY', 'LENGTH', 'STRUCTURE', 'INVALID_CHAR', 'FORMAT']);

// Errors a single mistyped character produces in a number that otherwise fits the format.
const TYPO_ERRORS = new Set(['CHECK_DIGIT', 'CHECK_DIGITS', 'NOT_ISSUED']);

const fitsShape = (format: FormatModule, input: string) =>
  !format.validate(input).errors.some((e) => SHAPE_ERRORS.has(e.code));

const onlyTypo = (format: FormatModule, input: string) => {
  const { errors } = format.validate(input);
  return errors.length > 0 && errors.every((e) => TYPO_ERRORS.has(e.code));
};

/**
 * Another format of the same section for the input, when the current one rejects it: one that accepts it,
 * else — when the current format's shape does not fit — one where only the check digit is off (e.g. an
 * individual UNP with a typo). A format that would reject the number for other reasons is never suggested:
 * 900000000 fits the organization UNP's shape but has no such region, so "Физлицо / ИП" points nowhere.
 */
export function suggestOtherFormat(input: string, current: FormatId, formats: FormatModule[]): FormatModule | null {
  const active = formats.find((f) => f.id === current);
  if (!active || active.validate(input).valid) return null;
  const others = formats.filter((f) => f.id !== current);
  const accepting = others.find((f) => f.validate(input).valid);
  if (accepting) return accepting;
  return fitsShape(active, input) ? null : (others.find((f) => onlyTypo(f, input)) ?? null);
}
