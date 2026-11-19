import { describe, expect, it } from 'vitest';
import { crc32 } from '../../src/message-code/crc32';

function ascii(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i);
  return out;
}

describe('crc32', () => {
  it('gives 0xCBF43926 for "123456789" (Requirement 5.2)', () => {
    expect(crc32(ascii('123456789'))).toBe(0xcbf43926);
  });

  it('gives 0 for empty input', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('uses start and end to select a range (Requirement 5.1)', () => {
    const bytes = ascii('xx123456789yy');
    expect(crc32(bytes, 2, 11)).toBe(0xcbf43926);
    expect(crc32(bytes, 2, 11)).toBe(crc32(ascii('123456789')));
    expect(crc32(bytes, 3, 3)).toBe(0);
    expect(crc32(bytes, 2)).toBe(crc32(ascii('123456789yy')));
  });
});
