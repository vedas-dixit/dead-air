import { describe, expect, it } from 'vitest';
import { resolveBase } from '../../build/base-path';

describe('resolveBase', () => {
  it('returns "/" for undefined and empty', () => {
    expect(resolveBase(undefined)).toBe('/');
    expect(resolveBase('')).toBe('/');
  });

  it.each(['x', '/x', 'x/', '/x/'])('normalizes %j to "/x/"', (input) => {
    expect(resolveBase(input)).toBe('/x/');
  });

  it.each(['https://example.com/x/', 'a://b', '../x', '/x/../y', '..'])(
    'throws for %j',
    (input) => {
      expect(() => resolveBase(input)).toThrow();
    },
  );
});
