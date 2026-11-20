import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  COUNTER_KEY,
  STATION_ID_KEY,
  createStationStore,
  type KeyValueStorage,
} from '../../src/broadcast/station-store';
import { FC_OPTIONS, storedValueArb } from './generators';

/** Local in-memory storage that records every key written. */
class MemoryStorage implements KeyValueStorage {
  readonly data = new Map<string, string>();
  readonly writtenKeys = new Set<string>();
  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.data.set(k, v);
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.writtenKeys.add(key);
    this.data.set(key, value);
  }
}

const TWO_KEYS = [COUNTER_KEY, STATION_ID_KEY].sort();

/** Canonical decimal in range: "0" or no leading zero, within max. */
function expected(text: string, max: number): number | null {
  if (!/^(0|[1-9]\d*)$/.test(text)) return null;
  const n = Number(text);
  return n <= max ? n : null;
}

describe('station store: Property 11', () => {
  // Feature: broadcast-page, Property 11: The station store accepts only valid stored values and round trips
  // **Validates: Requirements 4.3, 4.4, 4.8, 4.10**
  it('reads a stored station ID only when it is canonical decimal in range', () => {
    fc.assert(
      fc.property(storedValueArb, (text) => {
        const store = createStationStore(new MemoryStorage({ [STATION_ID_KEY]: text }));
        expect(store.readStationId()).toBe(expected(text, 65535));
      }),
      FC_OPTIONS,
    );
  });

  it('reads a stored counter only when it is canonical decimal in range, else 0', () => {
    fc.assert(
      fc.property(storedValueArb, (text) => {
        const store = createStationStore(new MemoryStorage({ [COUNTER_KEY]: text }));
        expect(store.peekCounter()).toBe(expected(text, 255) ?? 0);
      }),
      FC_OPTIONS,
    );
  });

  it('round trips any station ID, in memory and after reload, writing only its key', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 65535 }), (id) => {
        const storage = new MemoryStorage();
        const store = createStationStore(storage);
        store.writeStationId(id);
        expect(store.readStationId()).toBe(id);
        expect(createStationStore(storage).readStationId()).toBe(id);
        expect([...storage.writtenKeys]).toEqual([STATION_ID_KEY]);
      }),
      FC_OPTIONS,
    );
  });

  it('only ever writes the two keys', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({ kind: fc.constant('id' as const), n: fc.integer({ min: -10, max: 70000 }) }),
            fc.record({ kind: fc.constant('counter' as const), n: fc.integer({ min: -10, max: 300 }) }),
          ),
          { maxLength: 20 },
        ),
        (ops) => {
          const storage = new MemoryStorage();
          const store = createStationStore(storage);
          for (const op of ops) {
            if (op.kind === 'id') store.writeStationId(op.n);
            else store.commitCounter(op.n);
          }
          for (const k of storage.writtenKeys) expect(TWO_KEYS).toContain(k);
          for (const k of storage.data.keys()) expect(TWO_KEYS).toContain(k);
        },
      ),
      FC_OPTIONS,
    );
  });
});

describe('station store: counter', () => {
  it('commitCounter saves (n + 1) mod 256 for all 256 values, and reload restores it', () => {
    for (let n = 0; n < 256; n++) {
      const storage = new MemoryStorage();
      const store = createStationStore(storage);
      store.commitCounter(n);
      const next = (n + 1) % 256;
      expect(store.peekCounter()).toBe(next);
      expect(storage.getItem(COUNTER_KEY)).toBe(String(next));
      expect(createStationStore(storage).peekCounter()).toBe(next);
    }
  });

  it('starts at 0 and peek does not save anything', () => {
    const storage = new MemoryStorage();
    const store = createStationStore(storage);
    expect(store.peekCounter()).toBe(0);
    expect(store.peekCounter()).toBe(0);
    expect(storage.writtenKeys.size).toBe(0);
  });

  it('ignores invalid commits and station IDs', () => {
    const storage = new MemoryStorage();
    const store = createStationStore(storage);
    store.writeStationId(5);
    store.commitCounter(9);
    for (const bad of [-1, 256, 1.5, NaN, Infinity, '7' as unknown as number]) {
      store.commitCounter(bad);
    }
    for (const bad of [-1, 65536, 1.5, NaN, Infinity, '7' as unknown as number]) {
      store.writeStationId(bad);
    }
    expect(store.peekCounter()).toBe(10);
    expect(store.readStationId()).toBe(5);
    expect(storage.getItem(COUNTER_KEY)).toBe('10');
    expect(storage.getItem(STATION_ID_KEY)).toBe('5');
  });

  it('falls back to empty station ID and counter 0 for invalid stored values', () => {
    for (const junk of ['1.5', '-1', 'abc', '', ' 7', '1e2', '65536', '999999']) {
      const store = createStationStore(
        new MemoryStorage({ [STATION_ID_KEY]: junk, [COUNTER_KEY]: junk }),
      );
      expect(store.readStationId()).toBeNull();
      expect(store.peekCounter()).toBe(0);
    }
    const store = createStationStore(new MemoryStorage({ [COUNTER_KEY]: '256' }));
    expect(store.peekCounter()).toBe(0);
  });
});

describe('station store: unavailable storage', () => {
  it('null storage: not persistent, memory still works', () => {
    const store = createStationStore(null);
    expect(store.persistent).toBe(false);
    expect(store.readStationId()).toBeNull();
    expect(store.peekCounter()).toBe(0);
    store.writeStationId(4242);
    store.commitCounter(255);
    expect(store.readStationId()).toBe(4242);
    expect(store.peekCounter()).toBe(0);
    store.commitCounter(0);
    expect(store.peekCounter()).toBe(1);
    expect(store.persistent).toBe(false);
  });

  it('storage that throws on read: not persistent, defaults used, memory works', () => {
    const storage: KeyValueStorage = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {},
    };
    const store = createStationStore(storage);
    expect(store.persistent).toBe(false);
    expect(store.readStationId()).toBeNull();
    expect(store.peekCounter()).toBe(0);
    store.writeStationId(7);
    store.commitCounter(3);
    expect(store.readStationId()).toBe(7);
    expect(store.peekCounter()).toBe(4);
  });

  it('storage that throws on write: becomes not persistent, memory works', () => {
    const storage: KeyValueStorage = {
      getItem: () => null,
      setItem() {
        throw new Error('quota');
      },
    };
    const store = createStationStore(storage);
    expect(store.persistent).toBe(true);
    store.writeStationId(12);
    expect(store.persistent).toBe(false);
    expect(store.readStationId()).toBe(12);
    store.commitCounter(41);
    expect(store.peekCounter()).toBe(42);
  });
});
