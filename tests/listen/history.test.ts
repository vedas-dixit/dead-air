import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { alertKey, HISTORY_LIMIT, recordHeard, type History } from '../../src/listen/history';
import { encodeOrThrow } from '../message-code/generators';
import { heardSequenceArb, testAlertArb } from './generators';

// Feature: listen-page, Property 1
// One card per Alert_Key, with a matching count.
// **Validates: Requirements 7.1, 7.2, 7.4, 7.5, 7.6, 15.4**

describe('Feature: listen-page, Property 1: one card per Alert_Key, with a matching count', () => {
  it('matches a simple map model for any heard sequence', () => {
    fc.assert(
      fc.property(heardSequenceArb, (items) => {
        let history: History = [];
        // Model: key -> { count, first alert }, in first-heard order.
        const model = new Map<string, { count: number; bytes: Uint8Array }>();

        items.forEach((item, i) => {
          history = recordHeard(history, item.bytes, item.alert, 1000 + i);
          const key = alertKey(item.alert);
          const seen = model.get(key);
          if (seen) seen.count += 1;
          else model.set(key, { count: 1, bytes: item.bytes });
        });

        // Exactly one entry per distinct key.
        const keys = history.map((e) => alertKey(e.alert));
        expect(new Set(keys).size).toBe(keys.length);
        expect(history.length).toBe(model.size);

        // Each count matches, and the first stored payload is kept.
        for (const entry of history) {
          const expected = model.get(alertKey(entry.alert));
          expect(expected).toBeDefined();
          expect(entry.heardCount).toBe(expected!.count);
          expect(Array.from(entry.bytes)).toEqual(Array.from(expected!.bytes));
        }

        // Newest first heard comes first.
        const modelOrder = [...model.keys()].reverse();
        expect(keys).toEqual(modelOrder);
      }),
      { numRuns: 200 },
    );
  });

  it('keeps alerts that differ only in sentMinute as separate cards', () => {
    fc.assert(
      fc.property(testAlertArb, fc.integer({ min: 1, max: 1000 }), (alert, delta) => {
        // Stay inside the encodable range: go down when going up could overflow.
        const down = alert.sentMinute > 1_000_000_000;
        const other = {
          ...alert,
          sentMinute: down ? alert.sentMinute - delta : alert.sentMinute + delta,
        };
        let history: History = [];
        history = recordHeard(history, encodeOrThrow(alert), alert, 1);
        history = recordHeard(history, encodeOrThrow(other), other, 2);
        history = recordHeard(history, encodeOrThrow(alert), alert, 3);

        expect(history.length).toBe(2);
        const a = history.find((e) => e.alert.sentMinute === alert.sentMinute)!;
        const b = history.find((e) => e.alert.sentMinute === other.sentMinute)!;
        expect(a.heardCount).toBe(2);
        expect(b.heardCount).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: listen-page, Property 8
// The history is ordered and never longer than the limit.
// **Validates: Requirements 8.5, 8.6**

describe('Feature: listen-page, Property 8: the history is ordered and never longer than the limit', () => {
  const dummyBytes = new Uint8Array([1, 2, 3]);
  // Distinct keys come from sentMinute = index; more than HISTORY_LIMIT of them.
  const manyKeysArb = fc.record({
    base: testAlertArb,
    distinct: fc.integer({ min: HISTORY_LIMIT + 1, max: 260 }),
    repeats: fc.array(fc.nat({ max: 259 }), { maxLength: 150 }),
  });

  it('caps the length, keeps first-heard newest first and drops the oldest', () => {
    fc.assert(
      fc.property(manyKeysArb, ({ base, distinct, repeats }) => {
        const alertAt = (i: number) => ({ ...base, sentMinute: i });
        // First pass: every key once, in order. Then random repeats of keys heard so far.
        const order = [
          ...Array.from({ length: distinct }, (_, i) => i),
          ...repeats.map((r) => r % distinct),
        ];

        let history: History = [];
        let model: number[] = []; // newest first
        order.forEach((k, t) => {
          history = recordHeard(history, dummyBytes, alertAt(k), t);
          if (!model.includes(k)) model = [k, ...model].slice(0, HISTORY_LIMIT);
          expect(history.length).toBeLessThanOrEqual(HISTORY_LIMIT);
        });

        const keys = history.map((e) => e.alert.sentMinute);
        expect(keys).toEqual(model);
        expect(new Set(keys).size).toBe(keys.length);
        // First heard times fall as we go down the list.
        for (let i = 1; i < history.length; i++) {
          expect(history[i - 1].firstHeardMs).toBeGreaterThanOrEqual(history[i].firstHeardMs);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('with only new keys, holds exactly the latest HISTORY_LIMIT, newest first', () => {
    fc.assert(
      fc.property(testAlertArb, fc.integer({ min: HISTORY_LIMIT + 1, max: 300 }), (base, n) => {
        let history: History = [];
        for (let i = 0; i < n; i++) {
          history = recordHeard(history, dummyBytes, { ...base, sentMinute: i }, i);
        }
        expect(history.length).toBe(HISTORY_LIMIT);
        const expected = Array.from({ length: HISTORY_LIMIT }, (_, j) => n - 1 - j);
        expect(history.map((e) => e.alert.sentMinute)).toEqual(expected);
        // The oldest keys are gone.
        expect(history.some((e) => e.alert.sentMinute === 0)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
