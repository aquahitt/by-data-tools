import type { Tool } from '../tools';

// Pure functions only: reading and building routes. Writing the URL belongs to formatState.ts.

export interface Route {
  toolId: string;
  format: string | null;
}

const HASH = /^#\/([a-z0-9-]+)(?:\?(.*))?$/;

export function parseHash(hash: string): Route | null {
  const m = HASH.exec(hash);
  if (!m) return null;
  return { toolId: m[1], format: new URLSearchParams(m[2] ?? '').get('format') || null };
}

export function buildHash(route: Route): string {
  return route.format ? `#/${route.toolId}?format=${encodeURIComponent(route.format)}` : `#/${route.toolId}`;
}

/** An available section named by the hash, else the default one; honours first-version `?format=` links. */
export function resolveRoute(hash: string, search: string, tools: Tool[], defaultToolId: string): Route {
  const parsed = parseHash(hash);
  if (parsed && tools.some((t) => t.id === parsed.toolId && t.formats.length > 0)) return parsed;
  if (!parsed) {
    const firstVersionFormat = new URLSearchParams(search).get('format');
    if (firstVersionFormat) return { toolId: defaultToolId, format: firstVersionFormat };
  }
  return { toolId: defaultToolId, format: null };
}
