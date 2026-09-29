/** Luhn (ISO/IEC 7812-1 annex B) check digit for `body`, the number without its last digit. */
export function luhnCheckDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    // Doubling starts at the rightmost digit of the body (next to the check digit).
    let d = Number(body[body.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

export function luhnValid(digits: string): boolean {
  return /^\d{2,}$/.test(digits) && luhnCheckDigit(digits.slice(0, -1)) === Number(digits[digits.length - 1]);
}
