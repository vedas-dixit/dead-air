// Pass it on: pure checks and Copy building. No browser API, clock or random.
// The time is always an argument.

import { checkExpiry, decodeMessage, encodeAlert, MAX_HOP_COUNT } from '../message-code';
import type { Alert, ExpiryStatus } from '../message-code';
import type { HistoryEntry } from './history';

export type PassRefusal = 'not-current' | 'max-hops';
export type PassCheck =
  | { ok: true; hopCount: number; expiry: 'current' }
  | { ok: false; reason: PassRefusal; expiry: ExpiryStatus };

/** Expiry is tested first, so an expired card never reports max-hops instead. */
export function canPassOn(entry: HistoryEntry, nowMs: number): PassCheck {
  const { status } = checkExpiry(
    { sentMinute: entry.alert.sentMinute, validSteps: entry.alert.validSteps },
    nowMs,
  );
  if (status !== 'current') return { ok: false, reason: 'not-current', expiry: status };
  if (entry.highestHop >= MAX_HOP_COUNT) return { ok: false, reason: 'max-hops', expiry: status };
  return { ok: true, hopCount: entry.highestHop + 1, expiry: 'current' };
}

/** Builds the Copy fields. Does not encode. Call only after canPassOn is ok. */
export function buildCopy(entry: HistoryEntry): Alert {
  return { ...entry.alert, passedOn: true, hopCount: entry.highestHop + 1 };
}

export type CopyResult =
  | { ok: true; alert: Alert; bytes: Uint8Array }
  | { ok: false; reason: 'refused' | 'encode-failed' | 'self-check-failed'; refusal?: PassRefusal };

const FIELDS: readonly (keyof Alert)[] = [
  'test', 'passedOn', 'hopCount', 'event', 'urgency', 'severity', 'action',
  'sentMinute', 'validSteps', 'latitude', 'longitude', 'stationId', 'counter', 'placeName',
];

/** canPassOn, buildCopy, encodeAlert, decodeMessage, then a field-by-field compare. */
export function prepareCopy(entry: HistoryEntry, nowMs: number): CopyResult {
  const check = canPassOn(entry, nowMs);
  if (!check.ok) return { ok: false, reason: 'refused', refusal: check.reason };

  const alert = buildCopy(entry);
  const enc = encodeAlert(alert);
  if (!enc.ok) return { ok: false, reason: 'encode-failed' };

  const dec = decodeMessage(enc.bytes);
  if (!dec.ok) return { ok: false, reason: 'self-check-failed' };
  for (const f of FIELDS) {
    if (!Object.is(dec.alert[f], alert[f])) return { ok: false, reason: 'self-check-failed' };
  }
  return { ok: true, alert, bytes: enc.bytes };
}
