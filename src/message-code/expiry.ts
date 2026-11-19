import type { Alert, ExpiryResult } from './types';

export const VALID_STEP_MINUTES = 15;
export const CLOCK_TOLERANCE_MINUTES = 5;

const MS_PER_MINUTE = 60_000;

/**
 * Pure expiry check. All arithmetic is in milliseconds.
 * `current` is returned only when both comparisons are true; any other
 * outcome (including NaN in the inputs) is not `current`.
 */
export function checkExpiry(
  alert: Pick<Alert, 'sentMinute' | 'validSteps'>,
  currentTimeMs: number,
): ExpiryResult {
  const sentAtMs = alert.sentMinute * MS_PER_MINUTE;
  const expiresAtMs =
    (alert.sentMinute + alert.validSteps * VALID_STEP_MINUTES) * MS_PER_MINUTE;

  if (!Number.isFinite(currentTimeMs) || currentTimeMs < 0) {
    return { status: 'clock-unknown', sentAtMs, expiresAtMs };
  }
  if (!(currentTimeMs < expiresAtMs)) {
    return { status: 'expired', sentAtMs, expiresAtMs };
  }
  if (!(sentAtMs - currentTimeMs <= CLOCK_TOLERANCE_MINUTES * MS_PER_MINUTE)) {
    return { status: 'sent-in-future', sentAtMs, expiresAtMs };
  }
  return { status: 'current', sentAtMs, expiresAtMs };
}
