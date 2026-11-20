// Preview model. Built only from the decoded alert, never from the form (promise 1).
// Holds codes and formatted values. The DOM layer turns codes into words with the strings file.
// Pure, no browser API.

import { checkExpiry } from '../message-code/index';
import type { Action, Alert, EventType, ExpiryStatus, Severity, Urgency } from '../message-code/index';
import { formatLocal, formatUtc } from '../shared/time';
import { unitsToDegreesText } from './map-point';

export interface PreviewModel {
  draft: boolean;
  test: boolean; // true shows the TEST banner
  event: EventType;
  urgency: Urgency;
  severity: Severity;
  action: Action;
  placeName: string | null; // null when empty
  stationId: number;
  counter: number;
  map: { kind: 'none' } | { kind: 'point'; latitude: string; longitude: string };
  sent: { utc: string; local: string }; // minute precision, always present
  until: { utc: string; local: string };
  status: ExpiryStatus;
}

export function buildPreview(
  decoded: Alert,
  nowMs: number,
  offsetMinutes: number,
  draft: boolean,
): PreviewModel {
  const expiry = checkExpiry(decoded, nowMs);
  const map: PreviewModel['map'] =
    decoded.latitude === null || decoded.longitude === null
      ? { kind: 'none' }
      : {
          kind: 'point',
          latitude: unitsToDegreesText(decoded.latitude),
          longitude: unitsToDegreesText(decoded.longitude),
        };

  return {
    draft,
    test: decoded.test,
    event: decoded.event,
    urgency: decoded.urgency,
    severity: decoded.severity,
    action: decoded.action,
    placeName: decoded.placeName === '' ? null : decoded.placeName,
    stationId: decoded.stationId,
    counter: decoded.counter,
    map,
    sent: {
      utc: formatUtc(expiry.sentAtMs),
      local: formatLocal(expiry.sentAtMs, offsetMinutes),
    },
    until: {
      utc: formatUtc(expiry.expiresAtMs),
      local: formatLocal(expiry.expiresAtMs, offsetMinutes),
    },
    status: expiry.status,
  };
}
