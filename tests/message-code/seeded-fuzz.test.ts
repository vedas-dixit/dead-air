// Seeded no-throw test for the decoder (Requirements 7.12, 12.7).
// Example-based: fixed pseudo-random inputs, 200 for each length 0 to 64.

import { describe, expect, it } from 'vitest';
import { decodeMessage } from '../../src/message-code';

const BASE_SEED = 0xdead4177;
const INPUTS_PER_LENGTH = 200;
const MAX_LENGTH = 64;

// mulberry32: small seeded generator returning floats in [0, 1).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' ');
}

function sameKeys(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && [...actual].sort().join() === [...expected].sort().join();
}

describe('seeded decoder fuzz', () => {
  for (let length = 0; length <= MAX_LENGTH; length++) {
    it(`never throws for ${INPUTS_PER_LENGTH} seeded inputs of length ${length}`, () => {
      const seed = (BASE_SEED + length) >>> 0;
      const next = mulberry32(seed);
      for (let n = 0; n < INPUTS_PER_LENGTH; n++) {
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) bytes[i] = Math.floor(next() * 256);
        const where = `seed=${seed} length=${length} index=${n} bytes=[${hex(bytes)}]`;

        let result: unknown;
        try {
          result = decodeMessage(bytes);
        } catch (error) {
          throw new Error(`decodeMessage threw: ${String(error)} at ${where}`);
        }

        const r = result as Record<string, unknown>;
        expect(typeof r === 'object' && r !== null, where).toBe(true);
        if (r.ok === true) {
          expect(sameKeys(Object.keys(r), ['ok', 'alert']), where).toBe(true);
          expect(typeof r.alert, where).toBe('object');
          expect(r.alert, where).not.toBeNull();
        } else {
          expect(r.ok, where).toBe(false);
          expect(sameKeys(Object.keys(r), ['ok', 'reason']), where).toBe(true);
          expect(typeof r.reason, where).toBe('string');
        }
      }
    });
  }
});
