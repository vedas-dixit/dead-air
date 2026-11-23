// Validates: Requirements 4.10, 4.11
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const root = resolve(__dirname, '../..');
const frontDir = resolve(root, 'src/front');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const FORBIDDEN = [
  'getUserMedia',
  'fetch(',
  'XMLHttpRequest',
  'sendBeacon',
  'WebSocket',
  'EventSource',
  'indexedDB',
];

const files = walk(frontDir).filter((p) => /\.(ts|mts|js|mjs)$/.test(p));

describe('src/front has no network, microphone or storage calls', () => {
  it('finds the front source files, including dom/', () => {
    const names = files.map((f) => relative(frontDir, f));
    expect(names).toContain('main.ts');
    expect(names.some((n) => n.startsWith('dom/'))).toBe(true);
  });

  for (const file of files) {
    it(`${relative(root, file)} uses none of the forbidden names`, () => {
      const text = readFileSync(file, 'utf8');
      const found = FORBIDDEN.filter((word) => text.includes(word));
      expect(found).toEqual([]);
    });
  }
});
