// Run-time validation of an Alert. Used by both the encoder and the decoder.
// Pure. Never throws for null, non-objects or missing fields.

import { ACTIONS, EVENT_TYPES, SEVERITIES, URGENCIES } from './codes';
import { isValidPlaceNameText } from './place-name';
import type { Alert } from './types';

function isIntInRange(v: unknown, min: number, max: number): boolean {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
}

function isMember(list: readonly string[], v: unknown): boolean {
  return typeof v === 'string' && list.includes(v);
}

/** Returns the name of the first invalid field in Alert order, or null if valid. Does not check the 19-byte limit. */
export function validateAlert(a: unknown): keyof Alert | null {
  if (typeof a !== 'object' || a === null) return 'test';
  const r = a as Record<string, unknown>;

  if (typeof r.test !== 'boolean') return 'test';
  if (typeof r.passedOn !== 'boolean') return 'passedOn';
  if (!isIntInRange(r.hopCount, 0, 15)) return 'hopCount';
  if (r.passedOn !== (r.hopCount as number >= 1)) return 'passedOn';
  if (!isMember(EVENT_TYPES, r.event)) return 'event';
  if (!isMember(URGENCIES, r.urgency)) return 'urgency';
  if (!isMember(SEVERITIES, r.severity)) return 'severity';
  if (!isMember(ACTIONS, r.action)) return 'action';
  if (!isIntInRange(r.sentMinute, 0, 4294967295)) return 'sentMinute';
  if (!isIntInRange(r.validSteps, 1, 255)) return 'validSteps';
  if (r.latitude === null && r.longitude === null) {
    // no map point: valid
  } else if (r.latitude === null || r.longitude === null) {
    return 'latitude'; // exactly one is null: the first field that is null alone, or paired with a non-null
  } else {
    if (!isIntInRange(r.latitude, -900000, 900000)) return 'latitude';
    if (!isIntInRange(r.longitude, -1800000, 1800000)) return 'longitude';
  }
  if (!isIntInRange(r.stationId, 0, 65535)) return 'stationId';
  if (!isIntInRange(r.counter, 0, 255)) return 'counter';
  if (typeof r.placeName !== 'string' || !isValidPlaceNameText(r.placeName)) return 'placeName';
  return null;
}
