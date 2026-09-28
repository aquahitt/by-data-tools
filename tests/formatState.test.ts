import { describe, expect, it } from 'vitest';
import { isFormatId, resolveInitialFormat, withFormatParam } from '../src/ui/formatState';

describe('formatState', () => {
  it('URL wins over storage', () => {
    expect(resolveInitialFormat('?format=legacy', 'modern')).toBe('legacy');
  });

  it('falls back to storage, then to modern', () => {
    expect(resolveInitialFormat('', 'legacy')).toBe('legacy');
    expect(resolveInitialFormat('', null)).toBe('modern');
  });

  it('ignores unknown values', () => {
    expect(resolveInitialFormat('?format=x', 'y')).toBe('modern');
    expect(isFormatId('modern')).toBe(true);
    expect(isFormatId('other')).toBe(false);
  });

  it('sets only the format param and keeps others', () => {
    expect(withFormatParam('?a=1', 'legacy')).toBe('?a=1&format=legacy');
    expect(withFormatParam('?format=modern', 'legacy')).toBe('?format=legacy');
  });
});
