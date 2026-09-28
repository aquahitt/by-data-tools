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
const PERSISTENCE = [/localStorage/, /sessionStorage/, /history\.\w+State/, /document\.cookie/, /indexedDB/];

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

  it('formatState stores only the format id', () => {
    const code = readFileSync(join(SRC, 'ui', 'formatState.ts'), 'utf8');
    expect(code.match(/setItem\(/g)).toHaveLength(1);
    expect(code).toContain('setItem(STORAGE_KEY, id)');
  });
});
