// Bytes left for the place name, measured by asking encodeAlert. Never imports encodePlaceName.
import { encodeAlert, MAX_MESSAGE_BYTES } from '../message-code';
import type { Alert } from '../message-code';

export type BytesLeft =
  | { ok: true; left: number }
  | { ok: false; code: 'too-long' | 'bad-char' };

function probe(placeName: string): Alert {
  return {
    test: true,
    passedOn: false,
    event: 'flood',
    urgency: 'unknown',
    severity: 'unknown',
    action: 'monitor',
    sentMinute: 0,
    validSteps: 1,
    latitude: null,
    longitude: null,
    stationId: 0,
    counter: 0,
    placeName,
  };
}

export function bytesLeft(placeName: string): BytesLeft {
  const result = encodeAlert(probe(placeName));
  if (result.ok) return { ok: true, left: MAX_MESSAGE_BYTES - result.bytes.length };
  if (result.reason === 'place-name-too-long') return { ok: false, code: 'too-long' };
  // invalid-field for placeName. Other fields are fixed and valid, so nothing else can fail.
  return { ok: false, code: 'bad-char' };
}
