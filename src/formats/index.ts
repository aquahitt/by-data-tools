import type { FormatId, FormatModule } from '../core/types';
import { amount } from './amount';
import { bic } from './bic';
import { cadastral } from './cadastral';
import { card } from './card';
import { customsDeclaration } from './customsDeclaration';
import { EAN_FORMATS } from './ean';
import { email } from './email';
import { ibanBy } from './iban';
import { idCard, residencePermit } from './idDocuments';
import { imei, imeisv } from './imei';
import { inventoryNumber } from './inventory';
import { oldAccount, oldBankCode } from './legacyBank';
import { legacy } from './legacy';
import { modern } from './modern';
import { oked } from './oked';
import { okpo12, okpo8 } from './okpo';
import { passport1996 } from './passport1996';
import { phoneLandline, phoneMobile } from './phone';
import { passportBiometric } from './passportBiometric';
import { PLATE_FORMATS } from './plate';
import { postalCode } from './postal';
import { soato } from './soato';
import { NAME_FORMATS } from './translitName';
import { unpIndividual } from './unpIndividual';
import { unpOrganization } from './unpOrganization';
import { vin } from './vin';

export const PERSONAL_NUMBER_FORMATS: FormatModule[] = [modern, legacy];

export const PASSPORT_FORMATS: FormatModule[] = [passport1996, passportBiometric, idCard, residencePermit];

export const UNP_FORMATS: FormatModule[] = [unpOrganization, unpIndividual];

export const IBAN_FORMATS: FormatModule[] = [ibanBy, oldAccount];

export const PHONE_FORMATS: FormatModule[] = [phoneMobile, phoneLandline];

export const BIC_FORMATS: FormatModule[] = [bic, oldBankCode];
export const CARD_FORMATS: FormatModule[] = [card];
export const OKPO_FORMATS: FormatModule[] = [okpo8, okpo12];
export const OKED_FORMATS: FormatModule[] = [oked];
export { NAME_FORMATS, PLATE_FORMATS };
export const VIN_FORMATS: FormatModule[] = [vin];
export const POSTAL_FORMATS: FormatModule[] = [postalCode];
export const SOATO_FORMATS: FormatModule[] = [soato];
export const CADASTRAL_FORMATS: FormatModule[] = [cadastral];
export const EMAIL_FORMATS: FormatModule[] = [email];
export const IMEI_FORMATS: FormatModule[] = [imei, imeisv];
export const AMOUNT_FORMATS: FormatModule[] = [amount];
export { EAN_FORMATS };
export const CUSTOMS_FORMATS: FormatModule[] = [customsDeclaration];
export const INVENTORY_FORMATS: FormatModule[] = [inventoryNumber];

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
