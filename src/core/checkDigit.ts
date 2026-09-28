const WEIGHTS = [7, 3, 1] as const;

/** Digit value per MVD resolution No. 345, item 1.3: 0-9 as is, A..Z = 10..35. */
export function charValue(ch: string): number {
  const code = ch.charCodeAt(0);
  if (ch.length === 1 && code >= 48 && code <= 57) return code - 48;
  if (ch.length === 1 && code >= 65 && code <= 90) return code - 55;
  throw new RangeError(`Invalid character: ${ch}`);
}

/** Mod-10 check digit with repeating 7-3-1 weights over the first 13 characters. */
export function checkDigit731(body: string): number {
  if (body.length !== 13) throw new RangeError(`Expected 13 characters, got ${body.length}`);
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += charValue(body[i]) * WEIGHTS[i % 3];
  return sum % 10;
}
