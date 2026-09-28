import type { FormatId } from '../core/types';

// The only module allowed to touch localStorage or the URL: it persists the format id, never a number.

export const STORAGE_KEY = 'by-data-tools:format';
const PARAM = 'format';
const IDS: readonly FormatId[] = ['modern', 'legacy'];

export function isFormatId(v: unknown): v is FormatId {
  return typeof v === 'string' && (IDS as readonly string[]).includes(v);
}

export function resolveInitialFormat(search: string, stored: string | null): FormatId {
  const fromUrl = new URLSearchParams(search).get(PARAM);
  if (isFormatId(fromUrl)) return fromUrl;
  if (isFormatId(stored)) return stored;
  return 'modern';
}

export function withFormatParam(search: string, id: FormatId): string {
  const params = new URLSearchParams(search);
  params.set(PARAM, id);
  return `?${params}`;
}

export function readStoredFormat(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function persistFormat(id: FormatId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage blocked (private mode): the URL param still carries the choice.
  }
  const url = new URL(location.href);
  url.search = withFormatParam(url.search, id);
  history.replaceState(null, '', url);
}
