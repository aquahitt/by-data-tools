import { resolveFields } from '../core/fields';
import { describeChar } from '../core/normalize';
import { pad, pick, randInt } from '../core/random';
import type { FieldSpec, FormatModule, GenerateResult, Issue, ParsedField, Rng, ValidationResult } from '../core/types';
import { randomPerson } from './names';

// Practical address check (RFC 5321/5322 without quoted local parts and IP literals): local part up to 64
// characters of letters, digits and !#$%&'*+/=?^_`{|}~- with single dots inside; domain up to 253 characters of
// labels (letters, digits, hyphens not at the ends, up to 63 each), top level at least two letters, so .by and
// the Cyrillic .бел are both accepted. Generated addresses use reserved domains (RFC 2606, RFC 6761) by default.

const LOCAL_CHAR = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]$/;
const LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u;

function checkAddress(input: string): { value: string; errors: Issue[]; warnings: Issue[] } {
  const value = input.trim().replace(/^mailto:/i, '');
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  if (value === '') return { value, errors: [{ code: 'EMPTY', message: 'Адрес пустой' }], warnings };
  const at = value.lastIndexOf('@');
  if (at < 0 || value.indexOf('@') !== at) {
    const message = at < 0 ? 'Нет знака «@»' : 'Знак «@» встречается больше одного раза';
    return { value, errors: [{ code: 'FORMAT', message }], warnings };
  }
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local === '') errors.push({ code: 'FORMAT', message: 'Пустое имя до «@»' });
  if (local.length > 64) errors.push({ code: 'LOCAL_LENGTH', message: `Имя до «@» — ${local.length} символов, допустимо до 64` });
  [...local].forEach((ch, i) => {
    if (ch !== '.' && !LOCAL_CHAR.test(ch)) errors.push({ code: 'INVALID_CHAR', message: describeChar(ch), position: i + 1 });
  });
  if (/^\.|\.$|\.\./.test(local)) errors.push({ code: 'DOT', message: 'Точка в начале, в конце или две точки подряд до «@»' });
  if (domain === '') {
    errors.push({ code: 'FORMAT', message: 'Пустой домен после «@»' });
  } else {
    if (domain.length > 253) errors.push({ code: 'DOMAIN_LENGTH', message: `Домен — ${domain.length} символов, допустимо до 253` });
    const labels = domain.split('.');
    if (labels.length < 2) errors.push({ code: 'DOMAIN', message: 'В домене нет зоны: ожидается, например, example.by' });
    let offset = at + 2;
    for (const label of labels) {
      if (!LABEL.test(label)) {
        errors.push({ code: 'DOMAIN', message: `Часть домена «${label}» недопустима: буквы, цифры и дефисы не по краям, до 63 символов`, position: offset });
      }
      offset += [...label].length + 1;
    }
    const tld = labels[labels.length - 1];
    if (labels.length >= 2 && LABEL.test(tld) && !/^(\p{L}{2,}|xn--[a-z0-9-]+)$/iu.test(tld)) {
      errors.push({ code: 'TLD', message: `Зона «${tld}» — ожидаются буквы, не короче двух` });
    }
  }
  if (errors.length === 0 && value !== value.toLowerCase()) {
    warnings.push({ code: 'CASE', message: 'Заглавные буквы: домен к регистру не чувствителен, имя до «@» — зависит от почтового сервера' });
  }
  return { value, errors, warnings };
}

const PROVIDERS: Record<string, string> = {
  'gmail.com': 'Gmail',
  'yandex.by': 'Яндекс Почта',
  'yandex.ru': 'Яндекс Почта',
  'mail.ru': 'Mail.ru',
  'outlook.com': 'Outlook',
  'hotmail.com': 'Outlook',
  'icloud.com': 'iCloud',
};

const RESERVED = /(^|\.)(example\.(com|net|org)|test|example|invalid|localhost)$/i;

function parse(input: string): ParsedField[] | null {
  const r = checkAddress(input);
  if (r.errors.length > 0) return null;
  const at = r.value.lastIndexOf('@');
  const domain = r.value.slice(at + 1).toLowerCase();
  const tld = domain.split('.').pop()!;
  const zone = tld === 'by' ? 'by — Беларусь' : tld === 'бел' || tld === 'xn--90ais' ? 'бел — Беларусь (кириллическая зона)' : tld;
  const rows: ParsedField[] = [
    { label: 'Имя ящика', value: r.value.slice(0, at) },
    { label: 'Домен', value: domain },
    { label: 'Зона', value: zone },
  ];
  if (PROVIDERS[domain]) rows.push({ label: 'Почтовый сервис', value: PROVIDERS[domain] });
  if (RESERVED.test(domain)) rows.push({ label: 'Резервный домен', value: 'да — письма никому не доставляются (RFC 2606 / 6761)' });
  return rows;
}

const DOMAINS: Record<string, string> = {
  'example.com': 'example.com — резервный, безопасно для тестов',
  'example.org': 'example.org — резервный',
  'mail.test': 'mail.test — резервная зона .test',
  'gmail.com': 'gmail.com — реальный сервис',
  'yandex.by': 'yandex.by — реальный сервис',
  'mail.ru': 'mail.ru — реальный сервис',
};

const fields: FieldSpec[] = [
  {
    key: 'domain',
    label: 'Домен',
    kind: 'select',
    options: Object.entries(DOMAINS).map(([value, label]) => ({ value, label })),
    check: (v) => (checkAddress(`a@${v}`).errors.length === 0 ? null : 'Домен вида example.by'),
    // Only reserved domains at random: a real mailbox could belong to a real person.
    random: (rng) => pick(rng, ['example.com', 'example.org', 'mail.test']),
  },
];

/** A name-like mailbox: ivan.kovalev, ivan_kovalev85, i.kovalev. */
export function randomMailbox(rng: Rng, first: string, last: string): string {
  const f = first.toLowerCase();
  const l = last.toLowerCase();
  return pick(rng, [`${f}.${l}`, `${f}_${l}${pad(randInt(rng, 70, 99), 2)}`, `${f[0]}.${l}`, `${l}.${f}${randInt(rng, 1, 999)}`]);
}

function generate(partial: Record<string, string>, rng: Rng): GenerateResult {
  const { values, fieldErrors } = resolveFields(fields, partial, rng);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  const person = randomPerson(rng, {});
  const value = `${randomMailbox(rng, person.latinFirst, person.latinLast)}@${values.domain}`;
  const real = !RESERVED.test(values.domain);
  return {
    ok: true,
    value,
    hint: real ? 'Домен реального сервиса: такой ящик может принадлежать живому человеку — не отправляйте на него письма' : 'Резервный домен: письма на него никому не доставляются',
  };
}

export const email: FormatModule = {
  id: 'email',
  title: 'Email',
  official: false,
  fields,
  validate: (input) => {
    const r = checkAddress(input);
    return { valid: r.errors.length === 0, normalized: r.value, errors: r.errors, warnings: r.warnings };
  },
  parse,
  generate,
};
