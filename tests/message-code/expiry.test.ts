import { describe, expect, it } from 'vitest';
import {
  CLOCK_TOLERANCE_MINUTES,
  VALID_STEP_MINUTES,
  checkExpiry,
} from '../../src/message-code/expiry';

const MIN = 60_000;
const alert = { sentMinute: 1_000_000, validSteps: 4 };
const sentAtMs = alert.sentMinute * MIN;
const expiresAtMs = sentAtMs + 4 * VALID_STEP_MINUTES * MIN;
const toleranceMs = CLOCK_TOLERANCE_MINUTES * MIN;

describe('checkExpiry', () => {
  it('exports the 15 minute step and 5 minute tolerance', () => {
    expect(VALID_STEP_MINUTES).toBe(15);
    expect(CLOCK_TOLERANCE_MINUTES).toBe(5);
  });

  it('is expired at exactly expiresAtMs and current one millisecond before (8.3, 8.5, 8.6)', () => {
    expect(checkExpiry(alert, expiresAtMs).status).toBe('expired');
    expect(checkExpiry(alert, expiresAtMs - 1).status).toBe('current');
    expect(checkExpiry(alert, expiresAtMs + 1).status).toBe('expired');
  });

  it('returns sent time and expiry time with the status (8.10)', () => {
    expect(checkExpiry(alert, sentAtMs)).toEqual({ status: 'current', sentAtMs, expiresAtMs });
  });

  it('is current at exactly 5 minutes ahead and sent-in-future one millisecond later (8.6, 8.7)', () => {
    expect(checkExpiry(alert, sentAtMs - toleranceMs).status).toBe('current');
    expect(checkExpiry(alert, sentAtMs - toleranceMs - 1).status).toBe('sent-in-future');
  });

  it.each([NaN, Infinity, -Infinity, -1, -0.001])('gives clock-unknown for %s (8.8)', (t) => {
    expect(checkExpiry(alert, t).status).toBe('clock-unknown');
  });

  it('accepts time 0 as a known clock', () => {
    expect(checkExpiry({ sentMinute: 0, validSteps: 1 }, 0).status).toBe('current');
  });

  it('gives equal results on repeated calls (8.11)', () => {
    const t = sentAtMs + 7 * MIN;
    const first = checkExpiry(alert, t);
    for (let i = 0; i < 5; i++) expect(checkExpiry(alert, t)).toEqual(first);
  });

  it('leaves the TEST flag unchanged (9.6)', () => {
    const testAlert = { sentMinute: 5, validSteps: 2, test: true };
    const before = { ...testAlert };
    checkExpiry(testAlert, 0);
    checkExpiry(testAlert, Number.MAX_SAFE_INTEGER);
    expect(testAlert).toEqual(before);
    expect(testAlert.test).toBe(true);
  });

  it('handles sent minute 0 (8.2)', () => {
    const a = { sentMinute: 0, validSteps: 1 };
    expect(checkExpiry(a, 15 * MIN - 1).status).toBe('current');
    expect(checkExpiry(a, 15 * MIN).status).toBe('expired');
  });

  it('handles sent minute 4294967295 (8.2, 12.6)', () => {
    const a = { sentMinute: 4294967295, validSteps: 1 };
    const sent = 4294967295 * MIN;
    const exp = sent + 15 * MIN;
    expect(checkExpiry(a, sent)).toEqual({ status: 'current', sentAtMs: sent, expiresAtMs: exp });
    expect(checkExpiry(a, exp).status).toBe('expired');
    expect(checkExpiry(a, exp - 1).status).toBe('current');
    expect(checkExpiry(a, sent - toleranceMs - 1).status).toBe('sent-in-future');
    expect(checkExpiry(a, 0).status).toBe('sent-in-future');
  });
});
