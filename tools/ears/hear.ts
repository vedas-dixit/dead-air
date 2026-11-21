// Feeds samples to a Sound Link listener and checks every payload, as the Listen page does.
import { checkExpiry, decodeMessage } from '../../src/message-code';
import type { Alert, DecodeRejectionReason, ExpiryStatus } from '../../src/message-code';
import type { SoundLink } from '../../src/sound-link';

export interface PayloadReport {
  readonly bytes: number;
  readonly check: 'passed' | 'failed';
  readonly reason?: DecodeRejectionReason;
  readonly alert?: Alert;
  readonly sentUtc?: string;
  readonly status?: ExpiryStatus;
  readonly statusText?: string;
}

export const STATUS_TEXT: Record<ExpiryStatus, string> = {
  current: 'current',
  expired: 'EXPIRED, not current',
  'sent-in-future': 'sent time is in the future, not current',
  'clock-unknown': 'device clock unknown, not current',
};

/** decodeMessage, then checkExpiry. A failed check returns no alert key at all (promise 1). */
export function reportPayload(payload: Uint8Array, nowMs: number): PayloadReport {
  const decoded = decodeMessage(payload);
  if (!decoded.ok) return { bytes: payload.length, check: 'failed', reason: decoded.reason };
  const expiry = checkExpiry(decoded.alert, nowMs);
  return {
    bytes: payload.length,
    check: 'passed',
    alert: decoded.alert,
    sentUtc: new Date(expiry.sentAtMs).toISOString(),
    status: expiry.status,
    statusText: STATUS_TEXT[expiry.status],
  };
}

export type HearResult =
  | { ok: true; payloads: PayloadReport[]; decoded: Alert[] }
  | { ok: false; reason: 'engine-error' };

/** Creates a listener, feeds all samples at once, reports every payload, disposes the listener. */
export function hearSamples(link: SoundLink, samples: Float32Array, nowMs: number): HearResult {
  const made = link.createListener();
  if (!made.ok) return { ok: false, reason: 'engine-error' };
  try {
    const fed = made.listener.feed(samples);
    if (!fed.ok) return { ok: false, reason: 'engine-error' };
    const payloads = fed.payloads.map((p) => reportPayload(p, nowMs));
    const decoded: Alert[] = [];
    for (const p of payloads) if (p.alert !== undefined) decoded.push(p.alert);
    return { ok: true, payloads, decoded };
  } finally {
    made.listener.dispose();
  }
}
