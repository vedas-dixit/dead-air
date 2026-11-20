/**
 * Station ID and counter, remembered between visits.
 *
 * Logic only: no browser API. The caller passes in a storage object
 * (or null when none exists). The store never writes any key other than
 * STATION_ID_KEY and COUNTER_KEY.
 */

/** The small part of `Storage` that the store uses. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const STATION_ID_KEY = 'dead-air.broadcast.stationId';
export const COUNTER_KEY = 'dead-air.broadcast.counter';

const STATION_ID_MAX = 65535;
const COUNTER_MAX = 255;

export interface StationStore {
  /** False when storage is null or any read or write has thrown. */
  readonly persistent: boolean;
  /** The saved station ID, or null when none or invalid. */
  readStationId(): number | null;
  /** Keeps a valid station ID in memory and saves it. Invalid values are ignored. */
  writeStationId(id: number): void;
  /** The counter to use next, 0 to 255. Does not save anything. */
  peekCounter(): number;
  /** Records that `used` was sent: saves (used + 1) mod 256. */
  commitCounter(used: number): void;
}

function isWholeInRange(n: unknown, max: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;
}

function parseStored(text: string | null, digits: RegExp, max: number): number | null {
  if (typeof text !== 'string' || !digits.test(text)) return null;
  const n = Number(text);
  return isWholeInRange(n, max) ? n : null;
}

export function createStationStore(storage: KeyValueStorage | null): StationStore {
  let persistent = storage !== null && storage !== undefined;
  let stationId: number | null = null;
  let counter = 0;

  function read(key: string): string | null {
    if (!storage) return null;
    try {
      return storage.getItem(key);
    } catch {
      persistent = false;
      return null;
    }
  }

  function write(key: string, value: string): void {
    if (!storage) return;
    try {
      storage.setItem(key, value);
    } catch {
      persistent = false;
    }
  }

  stationId = parseStored(read(STATION_ID_KEY), /^(0|[1-9]\d{0,4})$/, STATION_ID_MAX);
  counter = parseStored(read(COUNTER_KEY), /^(0|[1-9]\d{0,2})$/, COUNTER_MAX) ?? 0;

  return {
    get persistent() {
      return persistent;
    },
    readStationId() {
      return stationId;
    },
    writeStationId(id: number) {
      if (!isWholeInRange(id, STATION_ID_MAX)) return;
      stationId = id;
      write(STATION_ID_KEY, String(id));
    },
    peekCounter() {
      return counter;
    },
    commitCounter(used: number) {
      if (!isWholeInRange(used, COUNTER_MAX)) return;
      counter = (used + 1) % 256;
      write(COUNTER_KEY, String(counter));
    },
  };
}
