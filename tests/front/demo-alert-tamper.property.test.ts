import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildDemoAlert } from '../../src/front/demo-alert';
import { encodeAlert, decodeMessage } from '../../src/message-code/index';

const MAX_CLOCK = 4294967295 * 60000 + 59999;

const nowMsArb = fc.oneof(
  fc.integer({ min: 0, max: MAX_CLOCK }),
  fc.constantFrom(0, 1, 59999, 60000, MAX_CLOCK - 1, MAX_CLOCK),
  fc.integer({ min: 0, max: 100 }),
  fc.integer({ min: MAX_CLOCK - 100, max: MAX_CLOCK }),
);

describe('Demo alert tamper', () => {
  // Feature: front-page, Property 3: Any single changed byte of the Demo alert is rejected
  // **Validates: Requirements 9.3**
  it('rejects any single changed byte and returns no alert', () => {
    fc.assert(
      fc.property(
        nowMsArb,
        fc.nat(),
        fc.integer({ min: 1, max: 255 }),
        (nowMs, posSeed, delta) => {
          const alert = buildDemoAlert(nowMs);
          expect(alert).not.toBeNull();
          const enc = encodeAlert(alert!);
          expect(enc.ok).toBe(true);
          if (!enc.ok) return;
          const bytes = new Uint8Array(enc.bytes);
          const pos = posSeed % bytes.length;
          // delta in 1..255 guarantees a different byte value.
          bytes[pos] = (bytes[pos]! + delta) & 0xff;
          const result = decodeMessage(bytes);
          expect(result.ok).toBe(false);
          expect('alert' in result).toBe(false);
        },
      ),
      { numRuns: 500 },
    );
  });
});
