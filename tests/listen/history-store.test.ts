import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { recordHeard, type History } from '../../src/listen/history';
import { parseHistory, serializeHistory } from '../../src/listen/history-store';
import { heardSequenceArb } from './generators';

// Feature: listen-page, Property 6
// Saving then loading the history gives the same history.
// **Validates: Requirements 8.1, 8.2, 8.3, 8.5, 8.8, 15.4**
describe('Feature: listen-page, Property 6: saving then loading the history gives the same history', () => {
  it('round-trips alerts, bytes, counts, times and order', () => {
    fc.assert(
      fc.property(heardSequenceArb, (items) => {
        let history: History = [];
        items.forEach((item, i) => {
          history = recordHeard(history, item.bytes, item.alert, 1_000_000 + i * 1000);
        });

        const text = serializeHistory(history);
        const loaded = parseHistory(text);

        expect(loaded.length).toBe(history.length);
        history.forEach((entry, i) => {
          const got = loaded[i]!;
          expect(got.alert).toEqual(entry.alert);
          expect(Array.from(got.bytes)).toEqual(Array.from(entry.bytes));
          expect(got.heardCount).toBe(entry.heardCount);
          expect(got.firstHeardMs).toBe(entry.firstHeardMs);
          expect(got.lastHeardMs).toBe(entry.lastHeardMs);
        });

        // Only bytes, count and times are stored. No decoded fields.
        const parsed = JSON.parse(text) as { entries: Record<string, unknown>[] };
        expect(Object.keys(parsed).sort()).toEqual(['entries', 'v']);
        for (const e of parsed.entries) {
          expect(Object.keys(e).sort()).toEqual(['b', 'f', 'h', 'l', 'n']);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: listen-page, Property 7
// A damaged stored entry is dropped and the rest are kept. Bad text never throws.
// **Validates: Requirements 8.3, 8.4**
describe('Feature: listen-page, Property 7: a damaged stored entry is dropped and the rest are kept', () => {
  it('drops the entry with one changed byte and keeps the others unchanged', () => {
    fc.assert(
      fc.property(
        heardSequenceArb,
        fc.nat(),
        fc.nat(),
        fc.integer({ min: 1, max: 255 }),
        (items, pickEntry, pickByte, xor) => {
          let history: History = [];
          items.forEach((item, i) => {
            history = recordHeard(history, item.bytes, item.alert, 1_000_000 + i * 1000);
          });
          fc.pre(history.length > 0);

          const victim = pickEntry % history.length;
          const stored = JSON.parse(serializeHistory(history)) as { v: number; entries: { b: string }[] };
          const hex = stored.entries[victim]!.b;
          const at = pickByte % (hex.length / 2);
          const byte = parseInt(hex.slice(at * 2, at * 2 + 2), 16) ^ xor;
          stored.entries[victim]!.b =
            hex.slice(0, at * 2) + byte.toString(16).padStart(2, '0') + hex.slice(at * 2 + 2);

          const loaded = parseHistory(JSON.stringify(stored));
          const expected = history.filter((_, i) => i !== victim);

          expect(loaded.length).toBe(expected.length);
          expected.forEach((entry, i) => {
            const got = loaded[i]!;
            expect(got.alert).toEqual(entry.alert);
            expect(Array.from(got.bytes)).toEqual(Array.from(entry.bytes));
            expect(got.heardCount).toBe(entry.heardCount);
            expect(got.firstHeardMs).toBe(entry.firstHeardMs);
            expect(got.lastHeardMs).toBe(entry.lastHeardMs);
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it('gives [] and never throws for garbage text, null or a wrong version', () => {
    fc.assert(
      fc.property(fc.string(), fc.anything(), (garbage, other) => {
        expect(parseHistory(garbage)).toEqual([]);
        expect(parseHistory(null)).toEqual([]);
        expect(parseHistory(JSON.stringify({ v: 2, entries: [] }))).toEqual([]);
        expect(parseHistory(JSON.stringify({ v: 0, entries: [] }))).toEqual([]);
        expect(() => parseHistory(JSON.stringify(other) ?? 'undefined')).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});
