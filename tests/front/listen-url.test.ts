// Validates: Requirements 3.1, 3.8
import { describe, it, expect } from 'vitest';
import { listenUrl } from '../../src/front/listen-url';

describe('listenUrl', () => {
  it('uses the root base', () => {
    expect(listenUrl('https://deadair.vedasdixit.com', '/')).toBe(
      'https://deadair.vedasdixit.com/listen/',
    );
  });

  it('uses a sub-path base', () => {
    expect(listenUrl('https://someone.github.io', '/dead-air/')).toBe(
      'https://someone.github.io/dead-air/listen/',
    );
  });
});
