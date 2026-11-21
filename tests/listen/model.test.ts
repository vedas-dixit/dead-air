import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { decodeMessage } from '../../src/message-code';
import { recordHeard, type History } from '../../src/listen/history';
import { serializeHistory } from '../../src/listen/history-store';
import { applyPayload, initialModel } from '../../src/listen/model';
import { changedByteArb, heardSequenceArb } from './generators';

function buildHistory(items: { alert: Parameters<typeof recordHeard>[2]; bytes: Uint8Array }[]): History {
  let history: History = [];
  items.forEach((item, i) => {
    history = recordHeard(history, item.bytes, item.alert, 1_000_000 + i * 1000);
  });
  return history;
}

// Random bytes that fail the check. Lengths cover the valid range 21 to 40 and beyond.
const failingBytesArb = fc
  .uint8Array({ minLength: 0, maxLength: 64 })
  .filter((b) => !decodeMessage(b).ok);

// Feature: listen-page, Property 2
// A payload that fails the check changes nothing.
// **Validates: Requirements 3.4, 6.1, 6.2, 6.3, 15.4**
describe('Feature: listen-page, Property 2: a payload that fails the check changes nothing', () => {
  const payloadArb = fc.oneof(
    changedByteArb.map((c) => c.changed).filter((b) => !decodeMessage(b).ok),
    failingBytesArb,
  );

  it('keeps the same history object, the same stored data and the same last heard time', () => {
    fc.assert(
      fc.property(
        heardSequenceArb,
        payloadArb,
        fc.integer({ min: 0, max: 4_000_000_000_000 }),
        (items, bytes, nowMs) => {
          const model = initialModel(buildHistory(items));
          const storedBefore = serializeHistory(model.history);

          const next = applyPayload(model, bytes, nowMs);

          expect(next.history).toBe(model.history);
          expect(serializeHistory(next.history)).toBe(storedBefore);
          expect(next.unreadable).toBe(true);
          expect(next.lastHeardMs).toBe(model.lastHeardMs);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('keeps nothing from the failed payload in the model', () => {
    fc.assert(
      fc.property(payloadArb, (bytes) => {
        const next = applyPayload(initialModel([]), bytes, 5000);
        expect(next.history).toEqual([]);
        expect(next.lastHeardMs).toBeNull();
        expect(next.unreadable).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// Unit tests. Alerts are test alerts only, sampled with a fixed seed.
// **Validates: Requirements 6.4, 6.5, 9.2, 9.3, 10.10**
import { clearHistory, endSession, startSession } from '../../src/listen/model';
import { testAlertArb } from './generators';
import { encodeOrThrow } from '../message-code/generators';

function goodBytes(seed: number): Uint8Array {
  const alert = fc.sample(testAlertArb, { seed, numRuns: 1 })[0]!;
  expect(alert.test).toBe(true);
  return encodeOrThrow(alert);
}

const BAD = new Uint8Array([1, 2, 3]);

describe('listen model unit tests', () => {
  it('a good payload after a bad one clears the unreadable notice', () => {
    let m = startSession(initialModel([]), 1000);
    m = applyPayload(m, BAD, 2000);
    expect(m.unreadable).toBe(true);
    m = applyPayload(m, goodBytes(1), 3000);
    expect(m.unreadable).toBe(false);
    expect(m.history).toHaveLength(1);
    expect(m.lastHeardMs).toBe(3000);
  });

  it('endSession clears the unreadable notice', () => {
    let m = startSession(initialModel([]), 1000);
    m = applyPayload(m, BAD, 2000);
    expect(m.unreadable).toBe(true);
    m = endSession(m);
    expect(m.unreadable).toBe(false);
    expect(m.sessionStartMs).toBeNull();
    expect(m.lastPayloadMs).toBeNull();
  });

  it('clearHistory empties the history and the last heard time', () => {
    let m = applyPayload(initialModel([]), goodBytes(2), 5000);
    expect(m.history).toHaveLength(1);
    expect(m.lastHeardMs).toBe(5000);
    m = clearHistory(m);
    expect(m.history).toEqual([]);
    expect(m.lastHeardMs).toBeNull();
  });

  it('initialModel uses the newest lastHeardMs', () => {
    const a = recordHeard([], goodBytes(3), fc.sample(testAlertArb, { seed: 3, numRuns: 1 })[0]!, 4000);
    const b = recordHeard(a, goodBytes(4), fc.sample(testAlertArb, { seed: 4, numRuns: 1 })[0]!, 9000);
    const c = recordHeard(b, goodBytes(5), fc.sample(testAlertArb, { seed: 5, numRuns: 1 })[0]!, 6000);
    const m = initialModel(c);
    expect(m.lastHeardMs).toBe(Math.max(...c.map((e) => e.lastHeardMs)));
    expect(m.lastHeardMs).toBe(9000);
  });

  it('initialModel on an empty history has no last heard time', () => {
    expect(initialModel([]).lastHeardMs).toBeNull();
  });
});
