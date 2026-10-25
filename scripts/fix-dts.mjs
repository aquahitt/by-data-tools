// tsc keeps the sources' extensionless imports in the emitted declarations, and TypeScript projects with
// "moduleResolution": "node16" / "nodenext" cannot resolve them. Adds `.js` (or `/index.js`) to relative specifiers.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = process.argv[2];
const SPECIFIER = /(from\s+|import\()(['"])(\.\.?\/[^'"]+)\2/g;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.d.ts') ? [path] : [];
  });
}

for (const file of files(ROOT)) {
  const source = readFileSync(file, 'utf8');
  const fixed = source.replace(SPECIFIER, (match, prefix, quote, spec) => {
    if (spec.endsWith('.js')) return match;
    const target = join(dirname(file), spec);
    if (existsSync(`${target}.d.ts`)) return `${prefix}${quote}${spec}.js${quote}`;
    if (existsSync(join(target, 'index.d.ts'))) return `${prefix}${quote}${spec}/index.js${quote}`;
    throw new Error(`${file}: cannot resolve ${spec}`);
  });
  if (fixed !== source) writeFileSync(file, fixed);
}
