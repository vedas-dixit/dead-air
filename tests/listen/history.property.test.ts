// History merge properties for Pass it on. Every alert here is a test alert.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { stringsEn } from '../../src/broadcast/strings.en';
import { createListenController } from '../../src/listen/controller';
import { alertKey, recordHeard, type History } from '../../src/listen/history';
import { applyPayload, initialModel } from '../../src/listen/model';
import type { Alert } from '../../src/message-code';
import { encodeOrThrow } from '../message-code/generators';
import {
  FakeAudioInput,
  FakeIntervalTimers,
  FakeListenClock,
  FakeListenStorage,
  FakePageVisibility,
  makeFakeHost,
  makeFakeTimeouts,
  FakeSoundLinkLoader,
  FakeWakeLock,
  flushPromises,
} from './fakes';
import { heardSequenceArb, rejectedBytesArb, reorderedSequenceArb, type HeardItem } from './generators';

function feed(items: readonly HeardItem[]): History {
  let h: History = [];
  items.forEach((item, i) => {
    h = recordHeard(h, item.bytes, item.alert, 1000 + i);
  });
  return h;
}

function hopsByKey(h: History): Map<string, number> {
  return new Map(h.map((e) => [alertKey(e.alert), e.highestHop]));
}

function expectedHops(items: readonly HeardItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const { alert } of items) {
    const k = alertKey(alert);
    m.set(k, Math.max(m.get(k) ?? 0, alert.hopCount));
  }
  return m;
}

function testAlert(over: Partial<Alert> = {}): Alert {
  return {
    test: true,
    passedOn: false,
    hopCount: 0,
    event: 'flood',
    urgency: 'immediate',
    severity: 'severe',
    action: 'evacuate',
    sentMinute: 29_000_000,
    validSteps: 8,
    latitude: null,
    longitude: null,
    stationId: 7,
    counter: 1,
    placeName: 'Test Town',
    ...over,
  };
}

const NOW = 29_000_000 * 60000 + 60_000;

// Feature: pass-it-on, Property 6
// Highest hop count merge is monotonic, idempotent and order independent.
// **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.7, 9.8, 9.9**
describe('Feature: pass-it-on, Property 6: highest hop count merge', () => {
  it('keeps one card per key with the largest hop count heard', () => {
    fc.assert(
      fc.property(heardSequenceArb, (items) => {
        const h = feed(items);
        const expected = expectedHops(items);
        expect(h.length).toBe(expected.size);
        expect(hopsByKey(h)).toEqual(expected);
      }),
      { numRuns: 200 },
    );
  });

  it('never lowers highestHop and ignores a repeated payload', () => {
    fc.assert(
      fc.property(heardSequenceArb, fc.nat(), (items, pick) => {
        let h: History = [];
        items.forEach((item, i) => {
          const before = hopsByKey(h);
          h = recordHeard(h, item.bytes, item.alert, 1000 + i);
          for (const [k, hop] of before) expect(hopsByKey(h).get(k)!).toBeGreaterThanOrEqual(hop);
        });
        if (items.length === 0) return;
        const again = items[pick % items.length]!;
        const once = hopsByKey(h);
        const twice = hopsByKey(recordHeard(h, again.bytes, again.alert, 5000));
        expect(twice).toEqual(once);
      }),
      { numRuns: 200 },
    );
  });

  it('gives the same highestHop for any two orderings', () => {
    fc.assert(
      fc.property(reorderedSequenceArb, ({ first, second }) => {
        expect(hopsByKey(feed(second))).toEqual(hopsByKey(feed(first)));
      }),
      { numRuns: 200 },
    );
  });

  it('keeps the first heard alert and bytes unedited', () => {
    fc.assert(
      fc.property(heardSequenceArb, (items) => {
        const h = feed(items);
        const firstByKey = new Map<string, HeardItem>();
        for (const item of items) {
          const k = alertKey(item.alert);
          if (!firstByKey.has(k)) firstByKey.set(k, item);
        }
        for (const e of h) {
          const first = firstByKey.get(alertKey(e.alert))!;
          expect(e.alert).toEqual(first.alert);
          expect(Array.from(e.bytes)).toEqual(Array.from(first.bytes));
        }
      }),
      { numRuns: 200 },
    );
  });
});

// Feature: pass-it-on, Property 7
// Failed payloads change nothing.
// **Validates: Requirements 9.10**
describe('Feature: pass-it-on, Property 7: failed payloads change nothing', () => {
  it('leaves the History, with every highestHop, unchanged', () => {
    fc.assert(
      fc.property(heardSequenceArb, rejectedBytesArb, (items, bad) => {
        let m = initialModel([]);
        items.forEach((item, i) => {
          m = applyPayload(m, item.bytes, 1000 + i);
        });
        const after = applyPayload(m, bad, 9000);
        expect(after.history).toBe(m.history);
        expect(after.lastHeardMs).toBe(m.lastHeardMs);
      }),
      { numRuns: 200 },
    );
  });
});

describe('pass-it-on history examples', () => {
  it('a first payload with hop 3 adds one card with highestHop 3', () => {
    const alert = testAlert({ passedOn: true, hopCount: 3 });
    const m = applyPayload(initialModel([]), encodeOrThrow(alert), NOW);
    expect(m.history.length).toBe(1);
    expect(m.history[0]!.highestHop).toBe(3);
  });

  it('highestHop never lowers when a lower hop arrives', () => {
    let m = initialModel([]);
    m = applyPayload(m, encodeOrThrow(testAlert({ passedOn: true, hopCount: 5 })), NOW);
    m = applyPayload(m, encodeOrThrow(testAlert({ passedOn: true, hopCount: 2 })), NOW + 1);
    m = applyPayload(m, encodeOrThrow(testAlert()), NOW + 2);
    expect(m.history.length).toBe(1);
    expect(m.history[0]!.highestHop).toBe(5);
    expect(m.history[0]!.heardCount).toBe(3);
  });

  it('the first heard alert stays unedited when a higher hop arrives', () => {
    const original = testAlert();
    let m = applyPayload(initialModel([]), encodeOrThrow(original), NOW);
    m = applyPayload(m, encodeOrThrow(testAlert({ passedOn: true, hopCount: 4 })), NOW + 1);
    const e = m.history[0]!;
    expect(e.highestHop).toBe(4);
    expect(e.alert).toEqual(original);
    expect(e.alert.hopCount).toBe(0);
    expect(e.alert.passedOn).toBe(false);
  });

  it('onNewAlert is called once for a new key and not for a known key', async () => {
    const clock = new FakeListenClock(NOW);
    const audio = new FakeAudioInput();
    const loader = new FakeSoundLinkLoader();
    const calls: unknown[] = [];
    const ctl = createListenController({
      clock,
      timers: new FakeIntervalTimers(clock),
      audio,
      loadLink: loader.load,
      storage: new FakeListenStorage(),
      wake: new FakeWakeLock(),
      visibility: new FakePageVisibility(true), host: makeFakeHost(), timeouts: makeFakeTimeouts(),
      strings: stringsEn,
      onNewAlert: (e) => calls.push(e),
    });
    await ctl.tapStart();
    await flushPromises();
    const hear = (bytes: Uint8Array) => {
      loader.lastLink!.lastListener!.queuePayloads(bytes);
      audio.lastHandle!.pushBlock(new Float32Array(128));
    };
    hear(encodeOrThrow(testAlert()));
    expect(calls.length).toBe(1);
    hear(encodeOrThrow(testAlert({ passedOn: true, hopCount: 2 })));
    hear(encodeOrThrow(testAlert()));
    expect(calls.length).toBe(1);
    expect(ctl.snapshot().cards.length).toBe(1);
  });
});
