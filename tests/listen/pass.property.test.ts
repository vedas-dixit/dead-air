// Property tests for the pass logic and the flag/hop pairing, over the real Message_Code.
// This is not one of the four Message_Code property tests.
// Every alert here is a test alert (TEST flag set).
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  checkExpiry,
  decodeMessage,
  encodeAlert,
  MAX_HOP_COUNT,
  VALID_STEP_MINUTES,
  type Alert,
} from '../../src/message-code';
import { alertKey, type HistoryEntry } from '../../src/listen/history';
import { buildCopy, canPassOn, prepareCopy } from '../../src/listen/pass';
import { encodeOrThrow } from '../message-code/generators';
import { buildRaw } from '../message-code/raw-message';
import { testAlertArb } from './generators';

const RUNS = { numRuns: 200 };
const MS_PER_MINUTE = 60_000;
const VERSION_1_TEST = 0x18;
const PASSED_ON_BIT = 0x04;

function entryOf(alert: Alert, highestHop: number): HistoryEntry {
  return {
    bytes: encodeOrThrow(alert),
    alert,
    highestHop,
    heardCount: 1,
    firstHeardMs: 0,
    lastHeardMs: 0,
  };
}

const hopArb = fc.integer({ min: 0, max: MAX_HOP_COUNT });

describe('Property 3: the flag and the hop count are paired in encode, decode and validate', () => {
  /**
   * **Validates: Requirements 1.6, 1.7, 2.2, 2.3, 2.7, 2.11, 2.12**
   */
  it('encode accepts a pair exactly when passedOn equals hopCount >= 1', () => {
    fc.assert(
      fc.property(testAlertArb, hopArb, fc.boolean(), (base, hopCount, passedOn) => {
        const alert: Alert = { ...base, hopCount, passedOn };
        const r = encodeAlert(alert);
        if (passedOn === hopCount >= 1) {
          expect(r.ok).toBe(true);
        } else {
          expect(r).toEqual({ ok: false, reason: 'invalid-field', field: 'passedOn' });
        }
      }),
      RUNS,
    );
  });

  it('decode of hand-built bytes with a correct check accepts a pair exactly when it is paired', () => {
    fc.assert(
      fc.property(
        hopArb,
        fc.boolean(),
        fc.integer({ min: 1, max: 9 }),
        (hopCount, flag, event) => {
          const flagsByte = VERSION_1_TEST | (flag ? PASSED_ON_BIT : 0);
          const r = decodeMessage(buildRaw({ flagsByte, hopCount, event }));
          if (flag === hopCount >= 1) {
            expect(r.ok).toBe(true);
            if (r.ok) {
              expect(r.alert.hopCount).toBe(hopCount);
              expect(r.alert.passedOn).toBe(flag);
              expect(r.alert.test).toBe(true);
            }
          } else {
            expect(r).toEqual({ ok: false, reason: 'invalid-field' });
          }
        },
      ),
      RUNS,
    );
  });

  it('every decoded alert is paired, and re-encoding returns the same bytes', () => {
    fc.assert(
      fc.property(testAlertArb, (alert) => {
        const bytes = encodeOrThrow(alert);
        const r = decodeMessage(bytes);
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(r.alert.passedOn).toBe(r.alert.hopCount >= 1);
          expect(encodeOrThrow(r.alert)).toEqual(bytes);
        }
      }),
      RUNS,
    );
  });
});

// A current alert: now is inside [sentAt, expiresAt), highestHop is at least the heard hop count.
const currentCaseArb = fc
  .tuple(
    testAlertArb.map((a): Alert => (a.hopCount === MAX_HOP_COUNT ? { ...a, hopCount: 0, passedOn: false } : a)),
    fc.double({ min: 0, max: 1, noNaN: true }),
    fc.nat(),
  )
  .map(([alert, frac, extra]) => {
    const sentAtMs = alert.sentMinute * MS_PER_MINUTE;
    const spanMs = alert.validSteps * VALID_STEP_MINUTES * MS_PER_MINUTE;
    const nowMs = sentAtMs + Math.min(Math.floor(frac * spanMs), spanMs - 1);
    const highestHop = Math.min(MAX_HOP_COUNT - 1, alert.hopCount + (extra % 3));
    return { alert, nowMs, highestHop };
  });

describe('Property 4: expired alerts are never offered or played', () => {
  /**
   * **Validates: Requirements 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6**
   */
  it('canPassOn and prepareCopy refuse at and after the Expiry_Time, at any hop', () => {
    fc.assert(
      fc.property(
        testAlertArb,
        hopArb,
        fc.oneof(fc.constant(0), fc.nat({ max: 10_000_000_000 })),
        (alert, highestHop, after) => {
          const expiresAtMs =
            (alert.sentMinute + alert.validSteps * VALID_STEP_MINUTES) * MS_PER_MINUTE;
          const nowMs = expiresAtMs + after;
          const entry = entryOf(alert, Math.max(highestHop, alert.hopCount));
          expect(checkExpiry(alert, nowMs).status).toBe('expired');
          const check = canPassOn(entry, nowMs);
          expect(check.ok).toBe(false);
          if (!check.ok) expect(check.reason).toBe('not-current');
          const copy = prepareCopy(entry, nowMs);
          expect(copy).toEqual({ ok: false, reason: 'refused', refusal: 'not-current' });
        },
      ),
      RUNS,
    );
  });

  it('is offered one millisecond before the Expiry_Time and refused at it', () => {
    fc.assert(
      fc.property(currentCaseArb, ({ alert, highestHop }) => {
        const expiresAtMs =
          (alert.sentMinute + alert.validSteps * VALID_STEP_MINUTES) * MS_PER_MINUTE;
        const entry = entryOf(alert, highestHop);
        expect(canPassOn(entry, expiresAtMs - 1).ok).toBe(true);
        expect(prepareCopy(entry, expiresAtMs - 1).ok).toBe(true);
        expect(canPassOn(entry, expiresAtMs).ok).toBe(false);
        expect(prepareCopy(entry, expiresAtMs).ok).toBe(false);
      }),
      RUNS,
    );
  });

  it('refuses any alert that is not current, whatever the reason', () => {
    fc.assert(
      fc.property(
        testAlertArb,
        fc.double({ min: -1e15, max: 1e16, noNaN: true }),
        (alert, nowMs) => {
          const entry = entryOf(alert, alert.hopCount);
          if (checkExpiry(alert, nowMs).status !== 'current') {
            expect(canPassOn(entry, nowMs).ok).toBe(false);
            expect(prepareCopy(entry, nowMs).ok).toBe(false);
          }
        },
      ),
      RUNS,
    );
  });

  it('refuses a current alert at hop 15 and still passes the sent time through unchanged', () => {
    fc.assert(
      fc.property(currentCaseArb, ({ alert, nowMs }) => {
        const maxed = entryOf({ ...alert, hopCount: MAX_HOP_COUNT, passedOn: true }, MAX_HOP_COUNT);
        expect(canPassOn(maxed, nowMs)).toMatchObject({ ok: false, reason: 'max-hops' });
        const ok = entryOf(alert, alert.hopCount);
        const copy = buildCopy(ok);
        expect(copy.sentMinute).toBe(alert.sentMinute);
        expect(copy.validSteps).toBe(alert.validSteps);
      }),
      RUNS,
    );
  });
});

describe('Property 5: the Copy is the same alert with one more hop', () => {
  /**
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.6, 6.8, 6.9, 6.10, 13.2**
   */
  it('decodes equal to the original except passedOn true and hopCount + 1', () => {
    fc.assert(
      fc.property(currentCaseArb, ({ alert, nowMs, highestHop }) => {
        const entry = entryOf(alert, highestHop);
        const copy = prepareCopy(entry, nowMs);
        expect(copy.ok).toBe(true);
        if (!copy.ok) return;
        const dec = decodeMessage(copy.bytes);
        expect(dec.ok).toBe(true);
        if (!dec.ok) return;
        expect(dec.alert).toEqual({ ...alert, passedOn: true, hopCount: highestHop + 1 });
        expect(copy.alert).toEqual(dec.alert);
        expect(alertKey(dec.alert)).toBe(alertKey(alert));
        expect(dec.alert.test).toBe(true);
        expect(copy.bytes.length).toBeGreaterThanOrEqual(21);
        expect(copy.bytes.length).toBeLessThanOrEqual(40);
        expect(copy.bytes.length).toBe(entry.bytes.length);
      }),
      RUNS,
    );
  });

  it('leaves the history entry untouched', () => {
    fc.assert(
      fc.property(currentCaseArb, ({ alert, nowMs, highestHop }) => {
        const entry = entryOf(alert, highestHop);
        const bytesBefore = Uint8Array.from(entry.bytes);
        const alertBefore = { ...alert };
        prepareCopy(entry, nowMs);
        expect(entry.bytes).toEqual(bytesBefore);
        expect(entry.alert).toEqual(alertBefore);
        expect(entry.highestHop).toBe(highestHop);
      }),
      RUNS,
    );
  });
});
