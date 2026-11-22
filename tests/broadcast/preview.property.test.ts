import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { checkExpiry } from '../../src/message-code';
import type { Alert } from '../../src/message-code';
import { buildPreview } from '../../src/broadcast/preview';
import { FC_OPTIONS, alertWithClockArb, decodedAlertArb, nowMsArb, offsetMinutesArb } from './generators';

// A test alert sent at 2026-11-19 10:00 UTC, valid for 1 hour (4 steps).
const SENT_MS = Date.UTC(2026, 10, 19, 10, 0);
const base: Alert = {
  test: true,
  passedOn: false,
  hopCount: 0,
  event: 'flood',
  urgency: 'unknown',
  severity: 'unknown',
  action: 'monitor',
  sentMinute: SENT_MS / 60000,
  validSteps: 4,
  latitude: null,
  longitude: null,
  stationId: 1,
  counter: 0,
  placeName: '',
} as Alert;

describe('preview properties', () => {
  // Feature: broadcast-page, Property 7: An expired alert is never shown as current
  // **Validates: Requirements 5.8, 5.9, 7.6, 8.5, 8.6, 8.7, 15.7**
  it('Property 7: status follows checkExpiry and is never current when not current', () => {
    fc.assert(
      fc.property(alertWithClockArb, offsetMinutesArb, fc.boolean(), ({ alert, nowMs }, offset, draft) => {
        const expected = checkExpiry(alert, nowMs).status;
        const p = buildPreview(alert, nowMs, offset, draft);
        expect(p.status).toBe(expected);
        if (expected !== 'current') {
          expect(p.status).not.toBe('current');
        }
        expect(p.sent.utc).not.toBe('');
        expect(p.sent.local).not.toBe('');
      }),
      FC_OPTIONS,
    );
  });

  it('Property 7: holds for any alert and any clock time', () => {
    fc.assert(
      fc.property(decodedAlertArb(), nowMsArb, offsetMinutesArb, (alert, nowMs, offset) => {
        const expected = checkExpiry(alert, nowMs).status;
        const p = buildPreview(alert, nowMs, offset, false);
        expect(p.status).toBe(expected);
        expect(p.sent.utc).toMatch(/^\d{4,}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);
      }),
      FC_OPTIONS,
    );
  });

  // Feature: broadcast-page, Property 17: The preview map and banner follow the decoded alert
  // **Validates: Requirements 8.3, 8.8, 8.13, 15.22**
  it('Property 17: map kind, point text and TEST banner follow the decoded alert', () => {
    fc.assert(
      fc.property(decodedAlertArb(), nowMsArb, offsetMinutesArb, (alert, nowMs, offset) => {
        const p = buildPreview(alert, nowMs, offset, false);
        expect(p.map.kind === 'none').toBe(alert.latitude === null);
        if (alert.latitude !== null && alert.longitude !== null) {
          expect(p.map).toEqual({
            kind: 'point',
            latitude: (alert.latitude / 10000).toFixed(4),
            longitude: (alert.longitude / 10000).toFixed(4),
          });
        }
        expect(p.test).toBe(alert.test);
      }),
      FC_OPTIONS,
    );
  });
});

describe('preview examples', () => {
  it('shows UTC and local text at several offsets', () => {
    const cases: Array<[number, string, string]> = [
      [0, '2026-11-19 10:00 UTC+00:00', '2026-11-19 11:00 UTC+00:00'],
      [330, '2026-11-19 15:30 UTC+05:30', '2026-11-19 16:30 UTC+05:30'],
      [-480, '2026-11-19 02:00 UTC-08:00', '2026-11-19 03:00 UTC-08:00'],
      [345, '2026-11-19 15:45 UTC+05:45', '2026-11-19 16:45 UTC+05:45'],
      [840, '2026-11-20 00:00 UTC+14:00', '2026-11-20 01:00 UTC+14:00'],
    ];
    for (const [offset, sentLocal, untilLocal] of cases) {
      const p = buildPreview(base, SENT_MS + 60000, offset, false);
      expect(p.sent.utc).toBe('2026-11-19 10:00 UTC');
      expect(p.until.utc).toBe('2026-11-19 11:00 UTC');
      expect(p.sent.local).toBe(sentLocal);
      expect(p.until.local).toBe(untilLocal);
      expect(p.status).toBe('current');
    }
  });

  it('marks an alert expired after its valid-for period', () => {
    const p = buildPreview(base, SENT_MS + 2 * 3_600_000, 0, false);
    expect(p.status).toBe('expired');
    expect(p.sent.utc).toBe('2026-11-19 10:00 UTC');
  });

  it('uses map kind none, never 0,0, when there is no map point', () => {
    const p = buildPreview(base, SENT_MS, 0, false);
    expect(p.map).toEqual({ kind: 'none' });
  });

  it('keeps a real 0,0 as a point', () => {
    const p = buildPreview({ ...base, latitude: 0, longitude: 0 }, SENT_MS, 0, false);
    expect(p.map).toEqual({ kind: 'point', latitude: '0.0000', longitude: '0.0000' });
  });

  it('shows the TEST flag only for test alerts', () => {
    expect(buildPreview(base, SENT_MS, 0, false).test).toBe(true);
    expect(buildPreview({ ...base, test: false }, SENT_MS, 0, false).test).toBe(false);
  });
});
