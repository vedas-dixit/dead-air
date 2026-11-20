// Generator vacuity test (Requirements 12.5, 12.9). It samples with fc.sample
// and a fixed seed, so it is not a property test and is not counted as one.
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SCRIPT_WINDOWS, decodeMessage } from '../../src/message-code';
import { alertArb, byteArrayArb } from './generators';

const SEED = 20260601;
const FLAG_COMPACT = 0b0000_0010;

function utf8Length(s: string): number {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return n;
}

function windowsIn(s: string): Set<number> {
  const found = new Set<number>();
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    SCRIPT_WINDOWS.forEach((w, i) => {
      if (cp >= w.start && cp < w.start + 128) found.add(i);
    });
  }
  return found;
}

describe('generator coverage', () => {
  it('Property 4 byte arrays reach every decoder outcome', () => {
    const samples = fc.sample(byteArrayArb, { numRuns: 500, seed: SEED });
    expect(samples).toHaveLength(500);

    const reasons = new Map<string, number>();
    let accepted = 0;
    let compactSet = 0;
    let compactClear = 0;
    for (const bytes of samples) {
      const r = decodeMessage(bytes);
      if (r.ok) {
        accepted++;
        if ((bytes[0]! & FLAG_COMPACT) !== 0) compactSet++;
        else compactClear++;
      } else {
        reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
      }
    }
    const counts = {
      accepted,
      compactSet,
      compactClear,
      ...Object.fromEntries(reasons),
    };
    const msg = JSON.stringify(counts);

    expect(accepted / samples.length, msg).toBeGreaterThanOrEqual(0.1);
    expect(compactSet, msg).toBeGreaterThan(0);
    expect(compactClear, msg).toBeGreaterThan(0);
    for (const reason of ['bad-check', 'invalid-field', 'too-short', 'unknown-version']) {
      expect(reasons.get(reason) ?? 0, `${reason}: ${msg}`).toBeGreaterThan(0);
    }
  });

  it('alertArb covers alerts with and without a map point, and a real 0, 0', () => {
    const alerts = fc.sample(alertArb, { numRuns: 500, seed: SEED });
    const none = alerts.filter((a) => a.latitude === null).length;
    const zero = alerts.filter((a) => a.latitude === 0 && a.longitude === 0).length;
    const point = alerts.filter((a) => a.latitude !== null && !(a.latitude === 0 && a.longitude === 0)).length;
    const msg = JSON.stringify({ none, zero, point });
    expect(none, msg).toBeGreaterThan(30);
    expect(zero, msg).toBeGreaterThan(0);
    expect(point, msg).toBeGreaterThan(100);
    expect(alerts.every((a) => (a.latitude === null) === (a.longitude === null))).toBe(true);
  });
  it('alertArb place names cover every category', () => {
    const alerts = fc.sample(alertArb, { numRuns: 500, seed: SEED });
    const windowsSeen = new Set<number>();
    let asciiOnly = 0;
    let twoWindow = 0;
    let zw = 0;
    let longUtf8 = 0;
    for (const { placeName } of alerts) {
      const ws = windowsIn(placeName);
      ws.forEach((w) => windowsSeen.add(w));
      if (/^[\x20-\x7e]*$/.test(placeName)) asciiOnly++;
      if (ws.size >= 2) twoWindow++;
      if (/[\u200c\u200d]/.test(placeName)) zw++;
      if (utf8Length(placeName) > 19) longUtf8++;
    }
    const msg = JSON.stringify({
      windows: [...windowsSeen].sort(),
      asciiOnly,
      twoWindow,
      zw,
      longUtf8,
    });
    expect(windowsSeen.size, msg).toBe(9);
    expect(asciiOnly, msg).toBeGreaterThan(0);
    expect(twoWindow, msg).toBeGreaterThan(0);
    expect(zw, msg).toBeGreaterThan(0);
    expect(longUtf8, msg).toBeGreaterThan(0);
  });
});
