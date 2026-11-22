// Listen page history: pure list logic. No DOM, no browser API.
import type { Alert } from '../message-code';

export interface HistoryEntry {
  readonly bytes: Uint8Array; // the payload that passed the check
  readonly alert: Alert; // decodeMessage(bytes).alert, never edited
  readonly heardCount: number; // >= 1
  readonly highestHop: number; // highest hopCount heard for this key
  readonly firstHeardMs: number;
  readonly lastHeardMs: number;
}

/** First heard newest first. */
export type History = readonly HistoryEntry[];

export const HISTORY_LIMIT = 100;

export function alertKey(a: Pick<Alert, 'stationId' | 'counter' | 'sentMinute'>): string {
  return `${a.stationId}:${a.counter}:${a.sentMinute}`;
}

/**
 * Records one alert that passed the check.
 * A repeat only raises that entry's heardCount and lastHeardMs.
 * A new key goes to the front and the oldest entries drop past the limit.
 */
export function recordHeard(
  h: History,
  bytes: Uint8Array,
  alert: Alert,
  nowMs: number,
): History {
  const key = alertKey(alert);
  const index = h.findIndex((e) => alertKey(e.alert) === key);
  if (index >= 0) {
    return h.map((e, i) =>
      i === index
        ? {
            ...e,
            heardCount: e.heardCount + 1,
            lastHeardMs: nowMs,
            highestHop: Math.max(e.highestHop, alert.hopCount),
          }
        : e,
    );
  }
  const entry: HistoryEntry = {
    bytes: new Uint8Array(bytes),
    alert,
    heardCount: 1,
    highestHop: alert.hopCount,
    firstHeardMs: nowMs,
    lastHeardMs: nowMs,
  };
  return [entry, ...h].slice(0, HISTORY_LIMIT);
}
