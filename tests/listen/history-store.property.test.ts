import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { recordHeard, type History } from '../../src/listen/history';
import { HISTORY_STORAGE_KEY, parseHistory, serializeHistory } from '../../src/listen/history-store';
import { heardSequenceArb } from './generators';

interface Stored {
  v: number;
  entries: Record<string, unknown>[];
}

function build(items: { bytes: Uint8Array; alert: History[number]['alert'] }[]): History {
  let history: History = [];
  items.forEach((item, i) => {
    history = recordHeard(history, item.bytes, item.alert, 1_000_000 + i * 1000);
  });
  return history;
}

// Feature: pass-it-on, Property 9
// Saving then loading gives the same history, and the loaded highestHop follows the saved h.
// **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.7**
describe('Feature: pass-it-on, Property 9: History storage round trip', () => {
  it('round-trips alerts, counts, highestHop and times', () => {
    fc.assert(
      fc.property(
        heardSequenceArb,
        fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 4, maxLength: 4 }),
        (items, extras) => {
          const base = build(items);
          // Raise highestHop to any value from the decoded hop count up to 15.
          const history: History = base.map((e, i) => ({
            ...e,
            highestHop: Math.max(e.alert.hopCount, extras[i % extras.length]!),
          }));
          const loaded = parseHistory(serializeHistory(history));
          expect(loaded.length).toBe(history.length);
          history.forEach((e, i) => {
            const got = loaded[i]!;
            expect(got.alert).toEqual(e.alert);
            expect(Array.from(got.bytes)).toEqual(Array.from(e.bytes));
            expect(got.heardCount).toBe(e.heardCount);
            expect(got.highestHop).toBe(e.highestHop);
            expect(got.firstHeardMs).toBe(e.firstHeardMs);
            expect(got.lastHeardMs).toBe(e.lastHeardMs);
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a missing or invalid h gives the decoded hop count, and a valid h gives the larger value', () => {
    const badH: fc.Arbitrary<unknown> = fc.oneof(
      fc.constant(undefined),
      fc.integer({ min: -1000, max: -1 }),
      fc.integer({ min: 16, max: 1000 }),
      fc.double({ noNaN: true, noDefaultInfinity: true }).filter((n) => !Number.isInteger(n)),
      fc.string(),
      fc.constant(null),
      fc.boolean(),
    );
    fc.assert(
      fc.property(
        heardSequenceArb.filter((s) => s.length > 0),
        badH,
        fc.integer({ min: 0, max: 15 }),
        (items, bad, good) => {
          const history = build(items);
          const stored = JSON.parse(serializeHistory(history)) as Stored;
          const bads = stored.entries.map((e) => ({ ...e, h: bad }));
          const goods = stored.entries.map((e) => ({ ...e, h: good }));
          const loadedBad = parseHistory(JSON.stringify({ v: 1, entries: bads }));
          const loadedGood = parseHistory(JSON.stringify({ v: 1, entries: goods }));
          expect(loadedBad.length).toBe(history.length);
          expect(loadedGood.length).toBe(history.length);
          loadedBad.forEach((e) => expect(e.highestHop).toBe(e.alert.hopCount));
          loadedGood.forEach((e) => expect(e.highestHop).toBe(Math.max(good, e.alert.hopCount)));
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('History store examples (pass-it-on)', () => {
  const items = fc.sample(
    heardSequenceArb.filter((s) => s.length > 0),
    { numRuns: 1, seed: 42 },
  )[0]!;
  const history = build(items);
  const stored = (): Stored => JSON.parse(serializeHistory(history)) as Stored;

  it('a missing h falls back to the decoded hop count and keeps the entry', () => {
    const s = stored();
    s.entries.forEach((e) => delete e.h);
    const loaded = parseHistory(JSON.stringify(s));
    expect(loaded.length).toBe(history.length);
    loaded.forEach((e) => expect(e.highestHop).toBe(e.alert.hopCount));
  });

  it('a non-integer h and an out-of-range h fall back and keep the entry', () => {
    for (const h of [1.5, '3', 16, -1, null]) {
      const s = stored();
      s.entries.forEach((e) => (e.h = h));
      const loaded = parseHistory(JSON.stringify(s));
      expect(loaded.length).toBe(history.length);
      loaded.forEach((e) => expect(e.highestHop).toBe(e.alert.hopCount));
    }
  });

  it('a larger saved h wins over the decoded hop count', () => {
    const s = stored();
    s.entries.forEach((e) => (e.h = 15));
    parseHistory(JSON.stringify(s)).forEach((e) => expect(e.highestHop).toBe(15));
  });

  it('an entry whose bytes fail the check is dropped and the rest stay', () => {
    const s = stored();
    const hex = s.entries[0]!.b as string;
    const flipped = (parseInt(hex.slice(2, 4), 16) ^ 0x01).toString(16).padStart(2, '0');
    s.entries[0]!.b = hex.slice(0, 2) + flipped + hex.slice(4);
    const loaded = parseHistory(JSON.stringify(s));
    expect(loaded.length).toBe(history.length - 1);
  });

  it('a history saved before this spec (no h) still loads under the same key', () => {
    expect(HISTORY_STORAGE_KEY).toBe('dead-air.listen.history.v1');
    const old = {
      v: 1,
      entries: stored().entries.map(({ b, n, f, l }) => ({ b, n, f, l })),
    };
    const loaded = parseHistory(JSON.stringify(old));
    expect(loaded.length).toBe(history.length);
    loaded.forEach((e) => expect(e.highestHop).toBe(e.alert.hopCount));
  });

  it('stores nothing audio: only bytes, counts, hop and times', () => {
    const text = serializeHistory(history);
    const parsed = JSON.parse(text) as Stored;
    expect(Object.keys(parsed).sort()).toEqual(['entries', 'v']);
    for (const e of parsed.entries) {
      expect(Object.keys(e).sort()).toEqual(['b', 'f', 'h', 'l', 'n']);
    }
    expect(text).not.toMatch(/audio|samples|pcm|wav/i);
  });
});
