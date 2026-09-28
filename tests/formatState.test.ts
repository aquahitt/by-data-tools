import { describe, expect, it } from 'vitest';
import { PASSPORT_FORMATS, PERSONAL_NUMBER_FORMATS } from '../src/formats';
import { resolveFormatId, storageKey } from '../src/ui/formatState';

describe('formatState', () => {
  it('keys storage per section', () => {
    expect(storageKey('passport-number')).toBe('by-data-tools:format:passport-number');
  });

  it('prefers the requested format', () => {
    expect(resolveFormatId('passport-number', PASSPORT_FORMATS, 'biometric', '1996', null)).toBe('biometric');
  });

  it('falls back to the stored format, then to the first one', () => {
    expect(resolveFormatId('passport-number', PASSPORT_FORMATS, null, 'biometric', null)).toBe('biometric');
    expect(resolveFormatId('passport-number', PASSPORT_FORMATS, null, null, null)).toBe('1996');
  });

  it('ignores a format that belongs to another section', () => {
    expect(resolveFormatId('passport-number', PASSPORT_FORMATS, 'legacy', 'modern', null)).toBe('1996');
  });

  it('reads the first-version key for the personal number only', () => {
    expect(resolveFormatId('personal-number', PERSONAL_NUMBER_FORMATS, null, null, 'legacy')).toBe('legacy');
    expect(resolveFormatId('passport-number', PASSPORT_FORMATS, null, null, 'biometric')).toBe('1996');
  });

  it('lets the per-section key win over the first-version key', () => {
    expect(resolveFormatId('personal-number', PERSONAL_NUMBER_FORMATS, null, 'modern', 'legacy')).toBe('modern');
  });
});
