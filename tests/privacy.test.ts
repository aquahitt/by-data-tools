import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
  });
}

const NETWORK = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/];
const PERSISTENCE = [
  /localStorage/,
  /sessionStorage/,
  /history\.\w+State/,
  /document\.cookie/,
  /indexedDB/,
  /location\.(hash|href|search)\s*=(?!=)/,
  /\blocation\s*=(?!=)/,
  /location\.(assign|replace)\s*\(/,
];

// Every way to give an element a link target or to open one, other than the menu's `href:` attribute.
const LINK_TARGETS = [
  /\.href\s*=(?!=)/, // link.href = …, location.href = …
  /\[\s*['"`]href['"`]\s*\]\s*=(?!=)/, // link['href'] = …
  /setAttribute(NS)?\s*\(\s*(null\s*,\s*)?['"`](href|xlink:href|src|action|formaction)['"`]/i,
  /\.(src|action|formAction)\s*=(?!=)/,
  /[{,]\s*href\s*[,}]/, // el('a', { href })
  /\b(window|globalThis|self|top|parent|opener)\s*(\.\s*open|\[\s*['"`]open['"`]\s*\])\s*\(/,
  /\bopen\s*\(\s*['"`/]/, // a destructured open('…')
];

// The spec promises the number never leaves the browser and is never persisted.
describe('privacy', () => {
  it('no network API is used anywhere in src', () => {
    for (const file of sources(SRC)) {
      const code = readFileSync(file, 'utf8');
      for (const re of NETWORK) expect(re.test(code), `${relative(SRC, file)} uses ${re}`).toBe(false);
    }
  });

  it('storage and URL are touched only by ui/formatState.ts', () => {
    for (const file of sources(SRC)) {
      if (relative(SRC, file) === join('ui', 'formatState.ts')) continue;
      const code = readFileSync(file, 'utf8');
      for (const re of PERSISTENCE) expect(re.test(code), `${relative(SRC, file)} uses ${re}`).toBe(false);
    }
  });

  it('formatState stores only format ids', () => {
    const code = readFileSync(join(SRC, 'ui', 'formatState.ts'), 'utf8');
    expect(code.match(/setItem\(/g)).toHaveLength(1);
    expect(code).toContain('setItem(storageKey(toolId), formatId)');
  });

  it('URLs are built only by formatState (new URL) and the menu (href to a section id)', () => {
    for (const file of sources(SRC)) {
      const name = relative(SRC, file);
      const code = readFileSync(file, 'utf8');
      if (name !== join('ui', 'formatState.ts')) expect(/new URL\(/.test(code), `${name} builds a URL`).toBe(false);
      if (name !== join('ui', 'sidebar.ts')) expect(/['"]?href['"]?\s*:/.test(code), `${name} sets an href`).toBe(false);
    }
    expect(readFileSync(join(SRC, 'ui', 'sidebar.ts'), 'utf8')).toContain('href: `#/${tool.id}`');
  });

  it('no other code sets a link target or opens a window', () => {
    for (const file of sources(SRC)) {
      const code = readFileSync(file, 'utf8');
      for (const re of LINK_TARGETS) expect(re.test(code), `${relative(SRC, file)} uses ${re}`).toBe(false);
    }
  });

  it.each([
    ["link.href = '#/x?n=' + value", LINK_TARGETS],
    ["link['href'] = url", LINK_TARGETS],
    ["a.setAttribute('href', url)", LINK_TARGETS],
    ['a.setAttributeNS(null, "href", url)', LINK_TARGETS],
    ['img.src = url', LINK_TARGETS],
    ["el('a', { href }, 'x')", LINK_TARGETS],
    ['window.open(url)', LINK_TARGETS],
    ["window['open'](url)", LINK_TARGETS],
    ['globalThis.open(url, "_blank")', LINK_TARGETS],
    ["window.location = '#/' + value", PERSISTENCE],
    ["location = url", PERSISTENCE],
  ])('the checks catch %s', (snippet, patterns) => {
    expect(patterns.some((re) => re.test(snippet))).toBe(true);
  });
});

