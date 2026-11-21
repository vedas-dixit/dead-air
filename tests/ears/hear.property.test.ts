// Tasks 6.2 and 6.3. Properties 15 and 16.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { checkExpiry, encodeAlert } from '../../src/message-code';
import { reportPayload } from '../../tools/ears/hear';
import { validTestAlertArb } from './generators';

function bytesOf(alert: Parameters<typeof encodeAlert>[0]): Uint8Array {
  const r = encodeAlert(alert);
  if (!r.ok) throw new Error('encode failed');
  return r.bytes;
}

describe('reportPayload', () => {
  // Feature: kiro-ears, Property 15: A failed check shows nothing
  it('Property 15: one changed byte gives a failed check with no alert fields', () => {
    fc.assert(
      fc.property(validTestAlertArb, fc.nat(), fc.integer({ min: 1, max: 255 }), (alert, at, flip) => {
        const bytes = bytesOf(alert).slice();
        bytes[at % bytes.length] = bytes[at % bytes.length]! ^ flip;
        const report = reportPayload(bytes, 1_000_000_000);
        expect(report.check).toBe('failed');
        expect(report.reason).toBeDefined();
        expect(report.bytes).toBe(bytes.length);
        for (const key of ['alert', 'sentUtc', 'status', 'statusText']) expect(key in report).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  // Feature: kiro-ears, Property 16: Expiry is reported from the clock and never as current when it is not
  it('Property 16: status comes from checkExpiry', () => {
    fc.assert(
      fc.property(validTestAlertArb, fc.integer({ min: 0, max: 4e12 }), (alert, now) => {
        const report = reportPayload(bytesOf(alert), now);
        expect(report.check).toBe('passed');
        const expected = checkExpiry(alert, now);
        expect(report.status).toBe(expected.status);
        expect(report.sentUtc).toBe(new Date(alert.sentMinute * 60000).toISOString());
        expect(report.alert).toEqual(alert);
        if (expected.status !== 'current') expect(report.statusText).toContain('not current');
        else expect(report.statusText).toBe('current');
      }),
      { numRuns: 100 },
    );
  });
});
