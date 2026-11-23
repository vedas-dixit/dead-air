// Demo alert for the front page. Pure, no browser API. Always a TEST alert (promise 3).
import { sentMinuteFrom } from '../broadcast/build';
import type { Alert } from '../message-code/index';

export const DEMO_VALID_STEPS = 4; // 4 x 15 minutes = 1 hour

/** The Demo alert for a clock reading, or null when the clock value cannot be used. */
export function buildDemoAlert(nowMs: number): Alert | null {
  const sentMinute = sentMinuteFrom(nowMs);
  if (sentMinute === null) return null;
  return {
    test: true,
    passedOn: false,
    hopCount: 0,
    event: 'flood',
    urgency: 'immediate',
    severity: 'severe',
    action: 'evacuate',
    sentMinute,
    validSteps: DEMO_VALID_STEPS,
    latitude: null,
    longitude: null,
    stationId: 0,
    counter: 0,
    placeName: '',
  };
}
