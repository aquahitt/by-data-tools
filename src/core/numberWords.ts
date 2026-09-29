// Russian cardinal numbers in words with case-agreed nouns: «одна тысяча», «две тысячи», «пять тысяч».

type Gender = 'm' | 'f';

const UNITS: Record<Gender, string[]> = {
  m: ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'],
  f: ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'],
};
const TEENS = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
const TENS = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
const HUNDREDS = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

/** Form for 1 / 2–4 / 5–20 and zero: plural(21, ['рубль', 'рубля', 'рублей']) → 'рубль'. */
export function plural(n: number, [one, few, many]: [string, string, string]): string {
  const n100 = n % 100;
  const n10 = n % 10;
  if (n100 >= 11 && n100 <= 14) return many;
  if (n10 === 1) return one;
  if (n10 >= 2 && n10 <= 4) return few;
  return many;
}

function triad(n: number, gender: Gender): string[] {
  const words: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) words.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) words.push(TEENS[rest - 10]);
  else {
    if (rest >= 20) words.push(TENS[Math.floor(rest / 10)]);
    if (rest % 10) words.push(UNITS[gender][rest % 10]);
  }
  return words;
}

const SCALES: { forms: [string, string, string]; gender: Gender }[] = [
  { forms: ['тысяча', 'тысячи', 'тысяч'], gender: 'f' },
  { forms: ['миллион', 'миллиона', 'миллионов'], gender: 'm' },
  { forms: ['миллиард', 'миллиарда', 'миллиардов'], gender: 'm' },
];

/** 0 ≤ n < 10¹²; `gender` is that of the counted noun (рубль — m, копейка — f). */
export function numberInWords(n: number, gender: Gender): string {
  if (!Number.isInteger(n) || n < 0 || n >= 1e12) throw new RangeError(`Out of range: ${n}`);
  if (n === 0) return 'ноль';
  const words: string[] = [];
  const groups: number[] = [];
  for (let x = n; x > 0; x = Math.floor(x / 1000)) groups.push(x % 1000);
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (!g) continue;
    if (i === 0) words.push(...triad(g, gender));
    else {
      const scale = SCALES[i - 1];
      words.push(...triad(g, scale.gender), plural(g, scale.forms));
    }
  }
  return words.join(' ');
}
