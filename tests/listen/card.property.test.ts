import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { stringsEn } from '../../src/broadcast/strings.en';
import { buildCardView } from '../../src/listen/card';
import type { PassUiInput } from '../../src/listen/card';
import type { HistoryEntry } from '../../src/listen/history';
import { checkExpiry } from '../../src/message-code';
import type { Alert } from '../../src/message-code';
import { alertArb, encodeOrThrow } from '../message-code/generators';

const MS_PER_MINUTE = 60_000;

// Local helpers (tests/listen/generators.ts is owned by another task).
const testAlertArb: fc.Arbitrary<Alert> = alertArb.map((a): Alert => ({ ...a, test: true }));

function makeEntry(alert: Alert, highestHop: number, heardCount = 1): HistoryEntry {
  return {
    bytes: encodeOrThrow(alert),
    alert,
    heardCount,
    highestHop,
    firstHeardMs: 0,
    lastHeardMs: 0,
  } as HistoryEntry;
}

const entryArb: fc.Arbitrary<HistoryEntry> = fc
  .tuple(testAlertArb, fc.integer({ min: 0, max: 15 }), fc.integer({ min: 1, max: 50 }))
  .map(([alert, hop, heard]) => makeEntry(alert, hop, heard));

/** A device time around sending and expiry, so every status is reached. */
const timedEntryArb = entryArb.chain((entry) => {
  const sentMs = entry.alert.sentMinute * MS_PER_MINUTE;
  const expiresMs = (entry.alert.sentMinute + entry.alert.validSteps * 15) * MS_PER_MINUTE;
  const timeArb = fc.oneof(
    fc.integer({ min: -3_600_000, max: 3_600_000 }).map((d) => sentMs + d),
    fc.integer({ min: -3_600_000, max: 3_600_000 }).map((d) => expiresMs + d),
    fc.constantFrom(NaN, Infinity, -Infinity, sentMs, expiresMs, expiresMs + 1),
  );
  return fc.tuple(fc.constant(entry), timeArb, fc.integer({ min: -720, max: 840 }));
});

const idle: PassUiInput = { phase: 'idle' };

// Feature: pass-it-on, Property 8: The card line matches the highest hop count
// **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.8**
describe('Feature: pass-it-on, Property 8: the card line matches the highest hop count', () => {
  it('shows the Passed_On_Line for the highest hop, and keeps sent time, expiry fields and TEST banner', () => {
    fc.assert(
      fc.property(timedEntryArb, ([entry, nowMs, offset]) => {
        const view = buildCardView(entry, nowMs, offset, stringsEn, idle);
        const hop = entry.highestHop;

        if (hop === 0) {
          expect(view.passedOnLine).toBeNull();
        } else if (hop === 1) {
          expect(view.passedOnLine).toBe(stringsEn.text['listen.pass.line.one']);
        } else {
          expect(view.passedOnLine).toBe(
            stringsEn.text['listen.pass.line.many']!.replace('{n}', String(hop)),
          );
          expect(view.passedOnLine).toContain(String(hop));
        }

        expect(view.sentText.length).toBeGreaterThan(0);
        expect(view.rows.some((r) => r.value === view.sentText)).toBe(true);
        expect(view.rows.some((r) => r.label === stringsEn.text['preview.until'])).toBe(true);
        expect(view.testBanner).toBe(stringsEn.text['test.banner']);
        expect(view.testBanner).toBeTruthy();
        if (view.expiryStatus === 'expired') {
          expect(view.expiredLabel).toBeTruthy();
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('Pass_Button states', () => {
  const base = fc.sample(testAlertArb, 1)[0]!;
  const alert: Alert = { ...base, sentMinute: 1_000_000, validSteps: 4, test: true };
  const sentMs = alert.sentMinute * MS_PER_MINUTE;
  const currentNow = sentMs + MS_PER_MINUTE;
  const view = (hop: number, nowMs: number, phase: PassUiInput['phase']) =>
    buildCardView(makeEntry(alert, hop), nowMs, 0, stringsEn, { phase });

  it('fixture is current at currentNow', () => {
    expect(checkExpiry(alert, currentNow).status).toBe('current');
  });

  it('is enabled when current and phase is idle', () => {
    const b = view(0, currentNow, 'idle').passButton;
    expect(b).not.toBeNull();
    expect(b!.enabled).toBe(true);
    expect(b!.note).toBeNull();
  });

  it('is absent when expired', () => {
    const now = sentMs + alert.validSteps * 15 * MS_PER_MINUTE + MS_PER_MINUTE;
    expect(checkExpiry(alert, now).status).toBe('expired');
    expect(view(0, now, 'idle').passButton).toBeNull();
  });

  it('is absent when sent in the future', () => {
    const now = sentMs - 60 * MS_PER_MINUTE;
    expect(checkExpiry(alert, now).status).toBe('sent-in-future');
    expect(view(0, now, 'idle').passButton).toBeNull();
  });

  it('is absent when the clock is unknown', () => {
    expect(checkExpiry(alert, NaN).status).toBe('clock-unknown');
    expect(view(0, NaN, 'idle').passButton).toBeNull();
  });

  it('is disabled with the max note at hop 15', () => {
    const b = view(15, currentNow, 'idle').passButton;
    expect(b).not.toBeNull();
    expect(b!.enabled).toBe(false);
    expect(b!.note).toBe(stringsEn.text['listen.pass.max']);
  });

  it('is enabled below hop 15 and has no note', () => {
    const b = view(14, currentNow, 'idle').passButton;
    expect(b!.enabled).toBe(true);
    expect(b!.note).toBeNull();
  });

  it.each(['loading', 'playing'] as const)('is disabled in phase %s', (phase) => {
    const b = view(0, currentNow, phase).passButton;
    expect(b).not.toBeNull();
    expect(b!.enabled).toBe(false);
  });

  it('carries a real button label with no emoji', () => {
    const b = view(0, currentNow, 'idle').passButton!;
    expect(b.label).toBe(stringsEn.text['listen.pass.btn']);
    expect(b.label.trim().length).toBeGreaterThan(0);
    expect(/\p{Extended_Pictographic}/u.test(b.label)).toBe(false);
  });
});
