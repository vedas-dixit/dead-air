// Pure scoring for round_trip: classify one try, count all tries.
import type { Alert } from '../../src/message-code';
import type { PayloadReport } from './hear';

export type TryOutcome = 'ok' | 'wrong-alert' | 'check-failed' | 'nothing-heard';

export interface TryResult {
  readonly outcome: TryOutcome;
  readonly differingFields: readonly string[];
  readonly bothPlaysHeard: boolean;
}

export const ALERT_FIELDS: readonly (keyof Alert)[] = [
  'test', 'passedOn', 'hopCount', 'event', 'urgency', 'severity', 'action', 'sentMinute', 'validSteps',
  'latitude', 'longitude', 'stationId', 'counter', 'placeName',
];

export function diffFields(sent: Alert, got: Alert): string[] {
  return ALERT_FIELDS.filter((f) => !Object.is(sent[f], got[f]));
}

export function classifyTry(sent: Alert, payloads: readonly PayloadReport[]): TryResult {
  if (payloads.length === 0) return { outcome: 'nothing-heard', differingFields: [], bothPlaysHeard: false };
  const passed: Alert[] = [];
  for (const p of payloads) if (p.check === 'passed' && p.alert !== undefined) passed.push(p.alert);
  if (passed.length === 0) return { outcome: 'check-failed', differingFields: [], bothPlaysHeard: false };
  for (const a of passed) {
    const d = diffFields(sent, a);
    if (d.length > 0) return { outcome: 'wrong-alert', differingFields: d, bothPlaysHeard: false };
  }
  return { outcome: 'ok', differingFields: [], bothPlaysHeard: passed.length >= 2 };
}

export interface Tally {
  readonly counts: Record<TryOutcome, number>;
  readonly successes: number;
  readonly failures: number;
  readonly bothPlaysHeardTries: number;
}

export function tally(results: readonly TryResult[]): Tally {
  const counts: Record<TryOutcome, number> = { ok: 0, 'wrong-alert': 0, 'check-failed': 0, 'nothing-heard': 0 };
  let both = 0;
  for (const r of results) {
    counts[r.outcome] += 1;
    if (r.bothPlaysHeard) both += 1;
  }
  return { counts, successes: counts.ok, failures: results.length - counts.ok, bothPlaysHeardTries: both };
}
