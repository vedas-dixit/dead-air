import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { stringsEn } from '../../src/broadcast/strings.en';
import { buildCardView } from '../../src/listen/card';
import type { HistoryEntry } from '../../src/listen/history';
import { parseHistory, serializeHistory } from '../../src/listen/history-store';
import { checkExpiry } from '../../src/message-code';
import { alertArb, encodeOrThrow } from '../message-code/generators';
import { testAlertArb } from './generators';

// Feature: listen-page, Property 3
// An alert that is not current is never shown as current.
// **Validates: Requirements 3.6, 5.1, 5.2, 5.3, 5.4, 5.6, 15.4**

const MS_PER_MINUTE = 60_000;

const entryArb: fc.Arbitrary<HistoryEntry> = fc
  .tuple(testAlertArb, fc.integer({ min: 1, max: 50 }))
  .map(([alert, heardCount]) => ({
    bytes: encodeOrThrow(alert),
    alert,
    heardCount,
    highestHop: alert.hopCount,
    firstHeardMs: 0,
    lastHeardMs: 0,
  })) as fc.Arbitrary<HistoryEntry>;

/** A device time, chosen relative to the alert's own sent and expiry times. */
const timedEntryArb = entryArb.chain((entry) => {
  const sentMs = entry.alert.sentMinute * MS_PER_MINUTE;
  const expiresMs = (entry.alert.sentMinute + entry.alert.validSteps * 15) * MS_PER_MINUTE;
  const timeArb = fc.oneof(
    fc.integer({ min: -3_600_000, max: 3_600_000 }).map((d) => sentMs + d), // around sending
    fc.integer({ min: -3_600_000, max: 3_600_000 }).map((d) => expiresMs + d), // around expiry
    fc.integer({ min: -10, max: 10 }).map((m) => sentMs - 5 * MS_PER_MINUTE + m * 1000), // tolerance edge
    fc.constantFrom(
      NaN,
      Infinity,
      -Infinity,
      -1,
      0,
      -1e15,
      Number.MAX_SAFE_INTEGER,
      sentMs,
      expiresMs,
      expiresMs - 1,
      expiresMs + 1,
    ),
    fc.double({ noNaN: false }),
  );
  return fc.tuple(fc.constant(entry), timeArb, fc.integer({ min: -720, max: 840 }));
});

describe('Feature: listen-page, Property 3: not current is never shown as current', () => {
  it('presents as current only when checkExpiry says current', () => {
    fc.assert(
      fc.property(timedEntryArb, ([entry, nowMs, offset]) => {
        const status = checkExpiry(entry.alert, nowMs).status;
        const view = buildCardView(entry, nowMs, offset, stringsEn, { phase: 'idle' });

        expect(view.expiryStatus).toBe(status);
        expect(view.presentedAsCurrent).toBe(status === 'current');
        expect(view.sentText.length).toBeGreaterThan(0);

        if (status === 'expired') {
          expect(view.greyedOut).toBe(true);
          expect(view.expiredWord).toBe(stringsEn.labels.status['expired']);
          expect(view.expiredWord).toBeTruthy();
        } else {
          expect(view.greyedOut).toBe(false);
          expect(view.expiredWord).toBeNull();
        }

        if (status === 'sent-in-future' || status === 'clock-unknown') {
          expect(view.clockLine).toBe(stringsEn.text['listen.clock.line']);
          expect(view.clockLine).toBeTruthy();
          expect(view.presentedAsCurrent).toBe(false);
        } else {
          expect(view.clockLine).toBeNull();
        }
      }),
      { numRuns: 200 },
    );
  });

  it('never presents NaN, Infinity or negative times as current', () => {
    const entry = {
      bytes: new Uint8Array(0),
      alert: { stationId: 1, counter: 0, sentMinute: 1000, validSteps: 4, test: true },
      heardCount: 1,
      highestHop: 0,
      firstHeardMs: 0,
      lastHeardMs: 0,
    } as unknown as HistoryEntry;
    for (const t of [NaN, Infinity, -Infinity, -5]) {
      expect(checkExpiry(entry.alert, t).status).not.toBe('current');
    }
  });
});

// Feature: listen-page, Property 4
// The TEST banner and the sent time are always shown.
// **Validates: Requirements 4.5, 4.6, 4.7, 4.8**

function toEntry(alert: HistoryEntry['alert'], heardCount: number): HistoryEntry {
  return { bytes: encodeOrThrow(alert), alert, heardCount, highestHop: alert.hopCount, firstHeardMs: 0, lastHeardMs: 0 };
}

/** Test alerts in any state, some taken back through serializeHistory and parseHistory. */
const bannerCaseArb = fc
  .tuple(testAlertArb, fc.integer({ min: 1, max: 50 }), fc.boolean())
  .chain(([alert, count, viaStore]) =>
    fc
      .tuple(
        fc.constant([alert, count, viaStore] as const),
        timedEntryArb.map(([, t, o]) => [t, o] as const),
      )
      .map(([[a, c, v], [t, o]]) => {
        const entry = toEntry(a, c);
        const restored = v ? parseHistory(serializeHistory([entry]))[0] : entry;
        return { entry: restored ?? entry, nowMs: t, offset: o };
      }),
  );

describe('Feature: listen-page, Property 4: TEST banner and sent time always shown', () => {
  it('shows the TEST banner and the sent time for every test alert', () => {
    fc.assert(
      fc.property(bannerCaseArb, ({ entry, nowMs, offset }) => {
        expect(entry.alert.test).toBe(true);
        const view = buildCardView(entry, nowMs, offset, stringsEn, { phase: 'idle' });
        expect(view.testBanner).toBe(stringsEn.text['test.banner']);
        expect(view.testBanner).toBeTruthy();
        expect(view.sentText.length).toBeGreaterThan(0);
        expect(view.rows.some((r) => r.value === view.sentText)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });

  it('has no banner for an alert that is not a test, and still shows the sent time', () => {
    fc.assert(
      fc.property(
        alertArb,
        fc.integer({ min: 1, max: 50 }),
        fc.double({ noNaN: false }),
        (a, count, nowMs) => {
          // ALLOWED-NON-TEST: deliberate negative case, checked by fixtures.test.ts.
          const entry = toEntry({ ...a, test: false }, count);
          const view = buildCardView(entry, nowMs, 0, stringsEn, { phase: 'idle' });
          expect(view.testBanner).toBeNull();
          expect(view.sentText.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: listen-page, Property 5
// Optional rows appear only when the alert has the data.
// **Validates: Requirements 4.3, 4.4, 4.11, 4.12, 4.13**

const optionalRowsArb = fc.tuple(
  testAlertArb,
  fc.oneof(fc.constant(''), fc.constantFrom('A', 'Oslo', 'Zürich')),
  fc.oneof(
    fc.constant<[number, number] | null>(null),
    fc.constant<[number, number] | null>([0, 0]),
    fc.tuple(fc.integer({ min: -900000, max: 900000 }), fc.integer({ min: -1800000, max: 1800000 })),
  ),
  fc.integer({ min: 0, max: 65535 }),
);

describe('Feature: listen-page, Property 5: optional rows appear only when the data exists', () => {
  it('shows place and map rows only with data, and always the sender ID', () => {
    fc.assert(
      fc.property(optionalRowsArb, ([base, placeName, point, stationId]) => {
        const alert = {
          ...base,
          placeName,
          latitude: point ? point[0] : null,
          longitude: point ? point[1] : null,
          stationId,
        } as HistoryEntry['alert'];
        const view = buildCardView(toEntry(alert, 1), 0, 0, stringsEn, { phase: 'idle' });
        const labels = view.rows.map((r) => r.label);
        const placeLabel = stringsEn.text['preview.place'];
        const mapLabel = stringsEn.text['preview.map'];
        const senderLabel = stringsEn.text['listen.row.sender'];

        expect(labels.includes(placeLabel)).toBe(placeName !== '');
        expect(labels.includes(mapLabel)).toBe(point !== null);
        expect(labels.filter((l) => l === senderLabel)).toHaveLength(1);
        expect(view.rows.find((r) => r.label === senderLabel)?.value).toBe(String(stationId));
      }),
      { numRuns: 200 },
    );
  });
});

// Unit tests for the card. Test alerts only.
// **Validates: Requirements 4.1, 4.2, 4.13, 7.3**

const fixedAlert: HistoryEntry['alert'] = {
  test: true,
  passedOn: false,
  hopCount: 0,
  event: 'flood',
  urgency: 'immediate',
  severity: 'extreme',
  action: 'shelter',
  sentMinute: 29_000_000,
  validSteps: 4,
  latitude: null,
  longitude: null,
  stationId: 4242,
  counter: 7,
  placeName: '',
};

describe('card unit tests', () => {
  const nowMs = fixedAlert.sentMinute * MS_PER_MINUTE;

  it('says "Heard 1 time" for one and "Heard N times" for more', () => {
    expect(buildCardView(toEntry(fixedAlert, 1), nowMs, 0, stringsEn, { phase: 'idle' }).heardText).toBe('Heard 1 time');
    expect(buildCardView(toEntry(fixedAlert, 2), nowMs, 0, stringsEn, { phase: 'idle' }).heardText).toBe('Heard 2 times');
    expect(buildCardView(toEntry(fixedAlert, 17), nowMs, 0, stringsEn, { phase: 'idle' }).heardText).toBe('Heard 17 times');
  });

  it('shows event, urgency, severity, action and sender ID with exact values', () => {
    const view = buildCardView(toEntry(fixedAlert, 1), nowMs, 0, stringsEn, { phase: 'idle' });
    const row = (label: string) => view.rows.find((r) => r.label === label)?.value;
    expect(row('Event')).toBe('Flood');
    expect(row('Urgency')).toBe('Immediate');
    expect(row('Severity')).toBe('Extreme');
    expect(row('Action')).toBe('Take shelter');
    expect(row('Sender ID')).toBe('4242');
  });

  it('shows a map row of 0.0000 for a card at map point 0 and 0', () => {
    const alert = { ...fixedAlert, latitude: 0, longitude: 0 };
    const view = buildCardView(toEntry(alert, 1), nowMs, 0, stringsEn, { phase: 'idle' });
    const map = view.rows.find((r) => r.label === 'Map point');
    expect(map).toBeDefined();
    expect(map?.value).toContain('0.0000');
    expect(map?.value).toBe('0.0000, 0.0000');
  });
});
