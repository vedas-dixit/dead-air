// Feature: front-page, Property 2: Demo alert is current only inside its hour
// **Validates: Requirements 9.2**
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkExpiry, decodeMessage, encodeAlert } from '../../src/message-code/index';
import { buildDemoAlert } from '../../src/front/demo-alert';

const MS_PER_MINUTE = 60_000;
const MAX_CLOCK = 4294967295 * MS_PER_MINUTE + 59999;

// Whole range, with the edges and minute boundaries drawn often.
const clock = fc.oneof(
  { arbitrary: fc.integer({ min: 0, max: MAX_CLOCK }), weight: 3 },
  {
    arbitrary: fc.constantFrom(0, 1, 59999, 60000, MAX_CLOCK, MAX_CLOCK - 1, MAX_CLOCK - 60000),
    weight: 2,
  },
);

// A usable tap time t, and a check time c: anywhere in range, or within a few
// minutes of the tap time, or within a few minutes of the expiry.
const scenario = clock.chain((t) => {
  const expiry = (Math.floor(t / MS_PER_MINUTE) + 60) * MS_PER_MINUTE;
  const near = (centre: number) =>
    fc
      .integer({ min: -10 * MS_PER_MINUTE, max: 10 * MS_PER_MINUTE })
      .map((d) => Math.max(0, Math.min(MAX_CLOCK + 60 * MS_PER_MINUTE, centre + d)));
  const edgeOffset = fc.constantFrom(-1, 0, 1);
  const c = fc.oneof(
    { arbitrary: clock, weight: 2 },
    { arbitrary: near(t), weight: 2 },
    { arbitrary: near(expiry), weight: 2 },
    { arbitrary: edgeOffset.map((d) => Math.max(0, expiry + d)), weight: 3 },
  );
  return c.map((check) => ({ t, c: check }));
});

describe('Property 2: Demo alert is current only inside its hour', () => {
  it('matches the reference interval and is never current at or after expiry', () => {
    fc.assert(
      fc.property(scenario, ({ t, c }) => {
        const demo = buildDemoAlert(t);
        expect(demo).not.toBeNull();
        const encoded = encodeAlert(demo!);
        expect(encoded.ok).toBe(true);
        if (!encoded.ok) return;
        const decoded = decodeMessage(encoded.bytes);
        expect(decoded.ok).toBe(true);
        if (!decoded.ok) return;

        const sentMinute = Math.floor(t / MS_PER_MINUTE);
        const reference = checkExpiry({ sentMinute, validSteps: 4 }, c);
        const actual = checkExpiry(decoded.alert, c);

        expect(actual.status).toBe(reference.status);
        expect(actual.expiresAtMs).toBe((sentMinute + 60) * MS_PER_MINUTE);
        if (c >= (sentMinute + 60) * MS_PER_MINUTE) {
          expect(actual.status).not.toBe('current');
        }
      }),
      { numRuns: 200 },
    );
  });
});
