import { describe, expect, it } from 'vitest';
import { DEFAULT_TOOL_ID, TOOLS } from '../src/tools';
import { buildHash, parseHash, resolveRoute } from '../src/ui/router';

const resolve = (hash: string, search = '') => resolveRoute(hash, search, TOOLS, DEFAULT_TOOL_ID);

describe('parseHash', () => {
  it('reads tool and format', () => {
    expect(parseHash('#/passport-number?format=biometric')).toEqual({ toolId: 'passport-number', format: 'biometric' });
  });

  it('reads a tool without a format', () => {
    expect(parseHash('#/passport-number')).toEqual({ toolId: 'passport-number', format: null });
  });

  it.each(['', '#', '#foo', '#/', '#/Passport'])('rejects %j', (hash) => {
    expect(parseHash(hash)).toBeNull();
  });
});

describe('buildHash', () => {
  it('round-trips with parseHash', () => {
    const route = { toolId: 'passport-number', format: 'biometric' };
    expect(parseHash(buildHash(route))).toEqual(route);
  });

  it('omits an empty format', () => {
    expect(buildHash({ toolId: 'personal-number', format: null })).toBe('#/personal-number');
  });
});

describe('resolveRoute', () => {
  it('opens an available section with its format', () => {
    expect(resolve('#/passport-number?format=biometric')).toEqual({ toolId: 'passport-number', format: 'biometric' });
  });

  it('opens the UNP section once it is implemented', () => {
    expect(resolve('#/unp')).toEqual({ toolId: 'unp', format: null });
  });

  it.each(['', '#/unknown', '#/phone'])('falls back to the default section for %j', (hash) => {
    expect(resolve(hash)).toEqual({ toolId: 'personal-number', format: null });
  });

  it('maps a first-version ?format= link to the personal number', () => {
    expect(resolve('', '?format=legacy')).toEqual({ toolId: 'personal-number', format: 'legacy' });
  });

  it('prefers the hash over a first-version query', () => {
    expect(resolve('#/passport-number', '?format=legacy')).toEqual({ toolId: 'passport-number', format: null });
  });
});
