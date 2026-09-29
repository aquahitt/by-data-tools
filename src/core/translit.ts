// Cyrillic → Latin for names in Belarusian documents. Two schemes are shown because sources disagree on which one
// is applied by default:
// - 'mvd': MVD resolution No. 288 of 09.10.2008 (instruction on transliteration for the population register), as
//   published by the MFA (france.mfa.gov.by/be/consular_issues/passport/trans/): Г G, Й J, Ў W; Е Ё Ю Я of the
//   Belarusian form — IE IO IU IA after a consonant, JE JO JU JA at the start, after a vowel or Ў; J + vowel after
//   Ь, Ъ or the apostrophe; the Russian form keeps E E IU IA.
// - 'icao': ICAO Doc 9303 part 3 table (Й I, Ъ IE, Ю IU, Я IA, Ў U), with Г → H for the Belarusian form — the
//   spelling seen in issued passports (SIARHEI, ALIAKSANDR, HANNA).

export type NameLanguage = 'be' | 'ru';
export type TranslitScheme = 'mvd' | 'icao';

const COMMON: Record<string, string> = {
  А: 'A', Б: 'B', В: 'V', Д: 'D', Ж: 'ZH', З: 'Z', И: 'I', І: 'I', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P',
  Р: 'R', С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'KH', Ц: 'TS', Ч: 'CH', Ш: 'SH', Щ: 'SHCH', Ы: 'Y', Э: 'E', Ь: '',
};

const APOSTROPHES = "'’ʼ";
const VOWELS = 'АЕЁИІОУЫЭЮЯ';
const IOTATED: Record<string, string> = { Е: 'E', Ё: 'O', Ю: 'U', Я: 'A' };
const ICAO_IOTATED: Record<string, string> = { Е: 'E', Ё: 'E', Ю: 'IU', Я: 'IA' };

function mvdChar(ch: string, prev: string, language: NameLanguage): string {
  if (Object.hasOwn(IOTATED, ch)) {
    if (prev === 'Ь' || prev === 'Ъ' || (prev !== '' && APOSTROPHES.includes(prev))) return `J${IOTATED[ch]}`;
    if (language === 'ru') return { Е: 'E', Ё: 'E', Ю: 'IU', Я: 'IA' }[ch]!;
    const start = prev === '' || !/\p{L}/u.test(prev);
    return start || VOWELS.includes(prev) || prev === 'Ў' ? `J${IOTATED[ch]}` : `I${IOTATED[ch]}`;
  }
  if (ch === 'Г') return 'G';
  if (ch === 'Й') return 'J';
  if (ch === 'Ў') return 'W';
  if (ch === 'Ъ' || APOSTROPHES.includes(ch)) return '';
  return COMMON[ch] ?? ch;
}

function icaoChar(ch: string, language: NameLanguage): string {
  if (Object.hasOwn(ICAO_IOTATED, ch)) return ICAO_IOTATED[ch];
  if (ch === 'Г') return language === 'be' ? 'H' : 'G';
  if (ch === 'Й') return 'I';
  if (ch === 'Ў') return 'U';
  if (ch === 'Ъ') return 'IE';
  if (APOSTROPHES.includes(ch)) return '';
  return COMMON[ch] ?? ch;
}

/** Uppercase Latin as printed in documents; spaces and hyphens are kept. */
export function transliterate(text: string, language: NameLanguage, scheme: TranslitScheme): string {
  const chars = [...text.toUpperCase()];
  return chars.map((ch, i) => (scheme === 'mvd' ? mvdChar(ch, chars[i - 1] ?? '', language) : icaoChar(ch, language))).join('');
}
