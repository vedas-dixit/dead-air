// Tasks 2.3 to 2.5. Properties 8, 9 and 10.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

vi.mock('../../src/message-code', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/message-code')>();
  return { ...actual, encodeAlert: vi.fn(actual.encodeAlert) };
});

import { decodeMessage, encodeAlert } from '../../src/message-code';
import { prepareAlert } from '../../tools/ears/alert-input';
import { invalidAlertArb, nonObjectArb, nonTestInputArb, validTestAlertArb, validTestInputArb } from './generators';

beforeEach(() => {
  vi.mocked(encodeAlert).mockClear();
});

describe('prepareAlert', () => {
  // Feature: kiro-ears, Property 8: Only TEST alerts, only objects
  it('Property 8: non-objects and non-TEST alerts are rejected before encoding', () => {
    fc.assert(
      fc.property(nonObjectArb, nonTestInputArb, fc.integer({ min: 0, max: 2e12 }), (bad, nonTest, now) => {
        const a = prepareAlert(bad, now);
        expect(a.ok).toBe(false);
        if (!a.ok) expect(a.reason).toBe('invalid-input-type');
        const b = prepareAlert(nonTest, now);
        expect(b.ok).toBe(false);
        if (!b.ok) expect(b.reason).toBe('not-a-test-alert');
        expect(vi.mocked(encodeAlert)).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });

  // Feature: kiro-ears, Property 9: Alert rejections name the field
  it('Property 9: a rejected field is named with the encodeAlert reason', () => {
    fc.assert(
      fc.property(invalidAlertArb, (c) => {
        const r = prepareAlert(c.input, 1_000_000);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.field).toBe(c.field);
          expect(['invalid-field', 'place-name-too-long']).toContain(r.reason);
        }
      }),
      { numRuns: 100 },
    );
  });

  // Feature: kiro-ears, Property 10: Default sent time
  it('Property 10: sentMinute defaults to the current minute and no other field changes', () => {
    fc.assert(
      fc.property(validTestInputArb, validTestAlertArb, fc.integer({ min: 0, max: 4e12 }), (input, withMinute, now) => {
        const r = prepareAlert(input, now);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const d = decodeMessage(r.bytes);
        expect(d.ok).toBe(true);
        if (!d.ok) return;
        expect(d.alert).toEqual({ ...input, sentMinute: Math.floor(now / 60000) });

        const r2 = prepareAlert(withMinute, now);
        expect(r2.ok).toBe(true);
        if (!r2.ok) return;
        const d2 = decodeMessage(r2.bytes);
        expect(d2.ok && d2.alert).toEqual(withMinute);
      }),
      { numRuns: 100 },
    );
  });
});
