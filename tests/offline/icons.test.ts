import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

// Requirements 4.4, 4.8, 4.9: the manifest icons exist and are the size the manifest states.
function readSize(path: string): { width: number; height: number; signature: number[] } {
  const b = readFileSync(path);
  const u32 = (o: number) => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
  // 8 byte signature, then the IHDR chunk: length(4) type(4) width(4) height(4).
  return {
    signature: Array.from(b.slice(0, 8)),
    width: u32(16),
    height: u32(20),
  };
}

describe('placeholder icons', () => {
  for (const size of [192, 512]) {
    it(`public/icons/icon-${size}.png is a ${size} by ${size} PNG`, () => {
      const path = `public/icons/icon-${size}.png`;
      expect(existsSync(path)).toBe(true);
      const r = readSize(path);
      expect(r.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(r.width).toBe(size);
      expect(r.height).toBe(size);
    });
  }
});
