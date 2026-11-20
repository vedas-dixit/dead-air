// Turns an Alert into 21 to 40 bytes. Pure: no clock, no random, no mutation of input.

import { EVENT_CODES, packUsa } from './codes';
import { crc32 } from './crc32';
import {
  CHECK_BYTES,
  FIXED_PREFIX_BYTES,
  FLAG_COMPACT_PLACE,
  FLAG_NO_MAP_POINT,
  FLAG_PASSED_ON,
  FLAG_TEST,
  OFFSET,
  VERSION,
  writeI24,
  writeU32,
} from './layout';
import { encodePlaceName } from './place-name';
import type { Alert, EncodeResult } from './types';
import { validateAlert } from './validate';

export function encodeAlert(alert: Alert): EncodeResult {
  const bad = validateAlert(alert);
  if (bad !== null) return { ok: false, reason: 'invalid-field', field: bad };

  const place = encodePlaceName(alert.placeName);
  if (!place.ok) {
    return place.reason === 'too-long'
      ? { ok: false, reason: 'place-name-too-long', field: 'placeName' }
      : { ok: false, reason: 'invalid-field', field: 'placeName' };
  }

  const length = FIXED_PREFIX_BYTES + place.bytes.length + CHECK_BYTES;
  const out = new Uint8Array(length);

  let flags = VERSION << 4;
  if (alert.test) flags |= FLAG_TEST;
  if (alert.passedOn) flags |= FLAG_PASSED_ON;
  if (place.compact) flags |= FLAG_COMPACT_PLACE;
  const hasPoint = alert.latitude !== null && alert.longitude !== null;
  if (!hasPoint) flags |= FLAG_NO_MAP_POINT;

  out[OFFSET.versionFlags] = flags;
  out[OFFSET.event] = EVENT_CODES[alert.event];
  out[OFFSET.usa] = packUsa(alert.urgency, alert.severity, alert.action);
  writeU32(out, OFFSET.sentMinute, alert.sentMinute);
  out[OFFSET.validSteps] = alert.validSteps;
  // With no map point the six point bytes stay zero (the array starts zeroed).
  if (alert.latitude !== null && alert.longitude !== null) {
    writeI24(out, OFFSET.latitude, alert.latitude);
    writeI24(out, OFFSET.longitude, alert.longitude);
  }
  out[OFFSET.stationId] = alert.stationId >>> 8;
  out[OFFSET.stationId + 1] = alert.stationId & 0xff;
  out[OFFSET.counter] = alert.counter;
  out.set(place.bytes, OFFSET.placeName);

  writeU32(out, length - CHECK_BYTES, crc32(out, 0, length - CHECK_BYTES));
  return { ok: true, bytes: out };
}
