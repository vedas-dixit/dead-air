// Build and Self_Check. Alert in, bytes and sound out, checked by decoding the sound in memory.
// Synchronous, no browser API. The sound is never logged or stored.
import { decodeMessage, encodeAlert } from '../message-code/index';
import type { Alert, DecodeRejectionReason } from '../message-code/index';
import type { AudioResult, SoundLink } from '../sound-link/index';
import type { FormModel } from './form';
import type { FieldName } from './strings.types';

export type LinkLike = Pick<SoundLink, 'bytesToAudio' | 'createListener' | 'sampleRate'>;

export type AudioFailReason = Extract<AudioResult, { ok: false }>['reason'];

export interface Build {
  readonly alert: Alert; // the source alert
  readonly decoded: Alert; // what decodeMessage returned
  readonly bytes: Uint8Array; // Alert_Bytes
  readonly samples: Float32Array; // one Play, without the check silence
  readonly sampleRate: number;
  readonly draft: boolean;
}

export type BuildFailure =
  | { kind: 'encode'; reason: 'invalid-field' | 'place-name-too-long'; field: FieldName }
  | { kind: 'audio'; reason: AudioFailReason }
  | {
      kind: 'check';
      why: 'listener-unavailable' | 'no-payload' | 'many-payloads' | 'payload-differs' | 'feed-failed';
    }
  | { kind: 'check'; why: 'decode-rejected'; reason: DecodeRejectionReason }
  | { kind: 'check'; why: 'field-differs'; field: FieldName };

export type BuildResult = { ok: true; build: Build } | { ok: false; failure: BuildFailure };

export const CHECK_SILENCE_SECONDS = 2;
export const CHECK_CHUNK_SAMPLES = 1024;
const MAX_SENT_MINUTE = 4294967295;

const ALERT_FIELDS: readonly FieldName[] = [
  'test',
  'passedOn',
  'event',
  'urgency',
  'severity',
  'action',
  'sentMinute',
  'validSteps',
  'latitude',
  'longitude',
  'stationId',
  'counter',
  'placeName',
];

/** Minutes since the epoch from a clock reading, or null when the clock value cannot be used. */
export function sentMinuteFrom(nowMs: number): number | null {
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs) || nowMs < 0) return null;
  const minute = Math.floor(nowMs / 60000);
  return minute > MAX_SENT_MINUTE ? null : minute;
}

export function toAlert(model: FormModel, sentMinute: number, counter: number): Alert {
  return {
    test: model.test,
    passedOn: false,
    hopCount: 0,
    event: model.event,
    urgency: model.urgency,
    severity: model.severity,
    action: model.action,
    sentMinute,
    validSteps: model.validSteps,
    latitude: model.latitude,
    longitude: model.longitude,
    stationId: model.stationId,
    counter,
    placeName: model.placeName,
  };
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function fail(failure: BuildFailure): BuildResult {
  return { ok: false, failure };
}

/**
 * Encode, make the sound, hear it back through a fresh listener, decode, and compare every field.
 * `draft` only labels the result. A draft and a real Build take the same path.
 * A failure carries no samples.
 */
export function runBuild(link: LinkLike, alert: Alert, draft: boolean): BuildResult {
  const encoded = encodeAlert(alert);
  if (!encoded.ok) {
    return fail({ kind: 'encode', reason: encoded.reason, field: encoded.field });
  }
  const bytes = encoded.bytes;

  const audio = link.bytesToAudio(bytes);
  if (!audio.ok) return fail({ kind: 'audio', reason: audio.reason });
  const samples = audio.samples;

  // Padded copy for the check only. The returned samples stay as the link made them.
  const rate = link.sampleRate;
  const padded = new Float32Array(samples.length + Math.round(CHECK_SILENCE_SECONDS * rate));
  padded.set(samples, 0);

  const created = link.createListener();
  if (!created.ok) return fail({ kind: 'check', why: 'listener-unavailable' });
  const listener = created.listener;

  const payloads: Uint8Array[] = [];
  try {
    for (let i = 0; i < padded.length; i += CHECK_CHUNK_SAMPLES) {
      const fed = listener.feed(padded.subarray(i, Math.min(i + CHECK_CHUNK_SAMPLES, padded.length)));
      if (!fed.ok) return fail({ kind: 'check', why: 'feed-failed' });
      for (const p of fed.payloads) payloads.push(p);
    }
  } catch {
    return fail({ kind: 'check', why: 'feed-failed' });
  } finally {
    try {
      listener.dispose();
    } catch {
      // A failing dispose must not hide the result.
    }
  }

  if (payloads.length === 0) return fail({ kind: 'check', why: 'no-payload' });
  if (payloads.length > 1) return fail({ kind: 'check', why: 'many-payloads' });
  const payload = payloads[0];
  if (!sameBytes(payload, bytes)) return fail({ kind: 'check', why: 'payload-differs' });

  const decodedResult = decodeMessage(payload);
  if (!decodedResult.ok) {
    return fail({ kind: 'check', why: 'decode-rejected', reason: decodedResult.reason });
  }
  const decoded = decodedResult.alert;

  for (const field of ALERT_FIELDS) {
    if (decoded[field] !== alert[field]) {
      return fail({ kind: 'check', why: 'field-differs', field });
    }
  }

  return {
    ok: true,
    build: { alert, decoded, bytes, samples, sampleRate: rate, draft },
  };
}
