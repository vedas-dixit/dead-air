import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildDemoAlert } from '../../src/front/demo-alert';
import { decodeMessage, encodeAlert } from '../../src/message-code/index';

const MAX_NOW_MS = 4294967295 * 60000 + 59999;

const usableNowMs = fc.oneof(
  { arbitrary: fc.constantFrom(0, 59999, 60000, 60001, MAX_NOW_MS - 60000, MAX_NOW_MS - 1, MAX_NOW_MS), weight: 1 },
  { arbitrary: fc.integer({ min: 0, max: 4294967295 }).map((m) => m * 60000), weight: 1 },
  { arbitrary: fc.integer({ min: 0, max: 4294967295 }).map((m) => m * 60000 + 59999), weight: 1 },
  { arbitrary: fc.integer({ min: 0, max: MAX_NOW_MS }), weight: 3 },
);

describe('demo alert round trip', () => {
  // Feature: front-page, Property 1: Demo alert survives encode and decode, marked TEST
  // **Validates: Requirements 4.2, 4.3, 9.1, 9.2**
  it('encodes, decodes, and stays marked TEST', () => {
    fc.assert(
      fc.property(usableNowMs, (nowMs) => {
        const alert = buildDemoAlert(nowMs);
        expect(alert).not.toBeNull();
        const encoded = encodeAlert(alert!);
        expect(encoded.ok).toBe(true);
        if (!encoded.ok) return;
        const decoded = decodeMessage(encoded.bytes);
        expect(decoded.ok).toBe(true);
        if (!decoded.ok) return;
        expect(decoded.alert.test).toBe(true);
        expect(decoded.alert.event).toBe('flood');
        expect(decoded.alert.sentMinute).toBe(Math.floor(nowMs / 60000));
        expect(decoded.alert.validSteps).toBe(4);
      }),
      { numRuns: 200 },
    );
  });
});
