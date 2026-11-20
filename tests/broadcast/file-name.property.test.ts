// Property 16 and the composeBroadcastAudio example. Seeded, 100 runs.
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { wavFileName } from '../../src/broadcast/file-name';
import { composeBroadcastAudio } from '../../src/broadcast/compose';
import { FC_OPTIONS, decodedAlertArb, sourceAlertArb } from './generators';

const PATTERN = /^dead-air-(test|alert)-([a-z-]+?)-(\d{4,})(\d{2})(\d{2})T(\d{2})(\d{2})Z-s(\d+)-n(\d+)\.wav$/;

describe('Property 16: The file name follows the pattern and reads back', () => {
  // **Validates: Requirements 12.5**
  for (const [label, arb] of [
    ['decoded alerts', decodedAlertArb()],
    ['source alerts', sourceAlertArb()],
  ] as const) {
    it(`matches the pattern and parses back (${label})`, () => {
      fc.assert(
        fc.property(arb, (alert) => {
          const m = PATTERN.exec(wavFileName(alert));
          expect(m).not.toBeNull();
          if (!m) return;
          expect(m[1]).toBe(alert.test ? 'test' : 'alert');
          expect(m[2]).toBe(String(alert.event));
          const ms = Date.UTC(+m[3]!, +m[4]! - 1, +m[5]!, +m[6]!, +m[7]!);
          expect(ms / 60000).toBe(alert.sentMinute);
          expect(Number(m[8])).toBe(alert.stationId);
          expect(Number(m[9])).toBe(alert.counter);
        }),
        FC_OPTIONS,
      );
    });
  }
});

describe('composeBroadcastAudio', () => {
  for (const rate of [44100, 48000]) {
    it(`plays twice with a one second gap at ${rate}`, () => {
      const input = Float32Array.from({ length: 1000 }, (_, i) => Math.fround(Math.sin(i) * 0.5 + 0.25));
      const copy = Float32Array.from(input);
      const out = composeBroadcastAudio(input, rate);
      const n = input.length;
      expect(out.length).toBe(2 * n + Math.round(rate));
      expect(Array.from(out.subarray(0, n))).toEqual(Array.from(input));
      expect(out.subarray(n, n + rate).every((v) => v === 0)).toBe(true);
      expect(Array.from(out.subarray(out.length - n))).toEqual(Array.from(input));
      expect(Array.from(input)).toEqual(Array.from(copy));
      expect(out.buffer).not.toBe(input.buffer);
    });
  }
});
