import type { FormatModule } from '../core/types';
import { buildHash } from './router';

// The only module allowed to touch localStorage or the URL: it persists format ids, never a number.

export const STORAGE_PREFIX = 'by-data-tools:format:';
// Key of the first version, when the site had a single section.
export const LEGACY_STORAGE_KEY = 'by-data-tools:format';
const LEGACY_TOOL_ID = 'personal-number';

export function storageKey(toolId: string): string {
  return `${STORAGE_PREFIX}${toolId}`;
}

/** Requested (URL) → stored for the section → first-version key (personal number only) → first format. */
export function resolveFormatId(
  toolId: string,
  formats: FormatModule[],
  requested: string | null,
  stored: string | null,
  legacyStored: string | null,
): string {
  const ids = formats.map((f) => f.id);
  const candidates = [requested, stored, toolId === LEGACY_TOOL_ID ? legacyStored : null];
  return candidates.find((c): c is string => c !== null && ids.includes(c)) ?? ids[0];
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readStoredFormats(toolId: string): { stored: string | null; legacy: string | null } {
  return { stored: read(storageKey(toolId)), legacy: read(LEGACY_STORAGE_KEY) };
}

/** Remembers the section's format and rewrites the URL to `#/<tool>?format=<id>` without a history entry. */
export function persistFormat(toolId: string, formatId: string): void {
  try {
    localStorage.setItem(storageKey(toolId), formatId);
  } catch {
    // Storage blocked (private mode): the hash still carries the choice.
  }
  const url = new URL(location.href);
  url.searchParams.delete('format');
  url.hash = buildHash({ toolId, format: formatId });
  history.replaceState(null, '', url);
}
