const WEIGHTS = [7, 3, 1] as const;

/** Character value per MVD No. 345 item 1.3 and ICAO 9303: 0-9 as is, A..Z = 10..35, filler '<' = 0. */
export function charValue(ch: string): number {
  if (ch === '<') return 0;
  const code = ch.charCodeAt(0);
  if (ch.length === 1 && code >= 48 && code <= 57) return code - 48;
  if (ch.length === 1 && code >= 65 && code <= 90) return code - 55;
  throw new RangeError(`Invalid character: ${ch}`);
}

/** Mod-10 check digit with repeating 7-3-1 weights (ICAO 9303 part 3, 4.9). */
export function icaoCheckDigit(value: string): number {
  let sum = 0;
  for (let i = 0; i < value.length; i++) sum += charValue(value[i]) * WEIGHTS[i % 3];
  return sum % 10;
}

/** Personal-number check digit over its first 13 characters (MVD No. 345 item 1.2). */
export function checkDigit731(body: string): number {
  if (body.length !== 13) throw new RangeError(`Expected 13 characters, got ${body.length}`);
  return icaoCheckDigit(body);
}
