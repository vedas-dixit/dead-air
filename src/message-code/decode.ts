import { eventFromCode, unpackUsa } from './codes';
import { crc32 } from './crc32';
import {
  CHECK_BYTES,
  FLAG_COMPACT_PLACE,
  FLAG_PASSED_ON,
  FLAG_TEST,
  MAX_MESSAGE_BYTES,
  MIN_MESSAGE_BYTES,
  OFFSET,
  RESERVED_MASK,
  VERSION,
  readI24,
  readU32,
} from './layout';
import { decodePlaceName } from './place-name';
import type { Alert, DecodeRejectionReason, DecodeResult } from './types';
import { validateAlert } from './validate';

function reject(reason: DecodeRejectionReason): DecodeResult {
  return { ok: false, reason };
}

/**
 * Turns untrusted bytes into an Alert, or a rejection with a reason only.
 * Order: type, length, version, check value, then fields. Nothing from the
 * message body is read before the check value passes. Never mutates input.
 */
export function decodeMessage(input: unknown): DecodeResult {
  if (!(input instanceof Uint8Array)) return reject('not-bytes');

  const len = input.length;
  if (len < MIN_MESSAGE_BYTES) return reject('too-short');
  if (len > MAX_MESSAGE_BYTES) return reject('too-long');

  if (input[OFFSET.versionFlags]! >>> 4 !== VERSION) return reject('unknown-version');

  const checkStart = len - CHECK_BYTES;
  if (crc32(input, 0, checkStart) !== readU32(input, checkStart)) return reject('bad-check');

  const flags = input[OFFSET.versionFlags]!;
  const event = eventFromCode(input[OFFSET.event]!);
  if (event === null) return reject('unknown-event');

  if ((flags & RESERVED_MASK) !== 0) return reject('invalid-field');

  const usa = unpackUsa(input[OFFSET.usa]!);
  if (usa === null) return reject('invalid-field');

  const validSteps = input[OFFSET.validSteps]!;
  if (validSteps < 1) return reject('invalid-field');

  const latitude = readI24(input, OFFSET.latitude);
  if (latitude < -900000 || latitude > 900000) return reject('invalid-field');
  const longitude = readI24(input, OFFSET.longitude);
  if (longitude < -1800000 || longitude > 1800000) return reject('invalid-field');

  const placeName = decodePlaceName(
    input.subarray(OFFSET.placeName, checkStart),
    (flags & FLAG_COMPACT_PLACE) !== 0,
  );
  if (placeName === null) return reject('invalid-field');

  const alert: Alert = {
    test: (flags & FLAG_TEST) !== 0,
    passedOn: (flags & FLAG_PASSED_ON) !== 0,
    event,
    urgency: usa.urgency,
    severity: usa.severity,
    action: usa.action,
    sentMinute: readU32(input, OFFSET.sentMinute),
    validSteps,
    latitude,
    longitude,
    stationId: (input[OFFSET.stationId]! << 8) | input[OFFSET.stationId + 1]!,
    counter: input[OFFSET.counter]!,
    placeName,
  };

  if (validateAlert(alert) !== null) return reject('invalid-field');
  return { ok: true, alert };
}
