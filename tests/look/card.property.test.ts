// Property 10: card order and always-visible fields.
// Property 11: an expired alert is never styled as current.
// Feature: radio-look, Property 10 and Property 11
// **Validates: Requirements 10.1, 10.2, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12**
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { LANGUAGES } from '../../src/languages/catalog';
import { buildCardView } from '../../src/listen/card';
import { cardLayout } from '../../src/listen/card-layout';
import type { HistoryEntry } from '../../src/listen/history';
import { buildPreview } from '../../src/broadcast/preview';
import { checkExpiry } from '../../src/message-code';
import { alertArb, encodeOrThrow } from '../message-code/generators';
import { testAlertArb } from '../listen/generators';
import { cardLook } from '../../src/shared/ui/card-look';

const MIN = 60_000;

function toEntry(alert: HistoryEntry['alert']): HistoryEntry {
  return { bytes: encodeOrThrow(alert), alert, heardCount: 1, highestHop: alert.hopCount, firstHeardMs: 0, lastHeardMs: 0 };
}

// Any alert (test or not): the banner rule must hold for both.
const anyAlertArb = fc.oneof(testAlertArb, alertArb);

const caseArb = anyAlertArb.chain((alert) => {
  const sentMs = alert.sentMinute * MIN;
  const expiresMs = (alert.sentMinute + alert.validSteps * 15) * MIN;
  const nowArb = fc.oneof(
    fc.integer({ min: -3_600_000, max: 3_600_000 }).map((d) => sentMs + d),
    fc.integer({ min: -3_600_000, max: 3_600_000 }).map((d) => expiresMs + d),
    fc.constantFrom(NaN, Infinity, -Infinity, 0, -1, sentMs, expiresMs - 1, expiresMs, expiresMs + 1),
    fc.double({ noNaN: false }),
  );
  return fc.record({
    alert: fc.constant(alert),
    nowMs: nowArb,
    offset: fc.integer({ min: -720, max: 840 }),
    language: fc.constantFrom(...LANGUAGES),
  });
});

describe('Property 10: card order and always-visible fields', () => {
  it('banner first only for test alerts, icon tile before name, sent always present', () => {
    fc.assert(
      fc.property(caseArb, ({ alert, nowMs, offset, language }) => {
        const view = buildCardView(toEntry(alert), nowMs, offset, language.strings, { phase: 'idle' });
        const parts = cardLayout(view);
        if (alert.test) {
          expect(parts[0]).toBe('test-banner');
          expect(view.testBanner).toBe(language.strings.text['test.banner']);
        } else {
          expect(parts).not.toContain('test-banner');
          expect(view.testBanner).toBeNull();
        }
        expect(parts.filter((p) => p === 'test-banner').length).toBe(alert.test ? 1 : 0);
        expect(parts.indexOf('icon-tile')).toBeGreaterThanOrEqual(0);
        expect(parts.indexOf('icon-tile')).toBeLessThan(parts.indexOf('event-name'));
        expect(parts).toContain('sent');
        expect(view.sentText.length).toBeGreaterThan(0);
        expect(view.event).toBe(alert.event);
      }),
      { numRuns: 200 },
    );
  });

  it('the preview of a test alert carries the TEST flag for the banner', () => {
    fc.assert(
      fc.property(caseArb, ({ alert, nowMs, offset }) => {
        expect(buildPreview(alert, nowMs, offset, false).test).toBe(alert.test);
      }),
      { numRuns: 100 },
    );
  });
});

describe('Property 11: an expired alert is never styled as current', () => {
  it('card-live only for current, expired label and sent time for expired, never both classes', () => {
    fc.assert(
      fc.property(caseArb, ({ alert, nowMs, offset, language }) => {
        const status = checkExpiry(alert, nowMs).status;
        const view = buildCardView(toEntry(alert), nowMs, offset, language.strings, { phase: 'idle' });
        const look = cardLook(view);
        expect(look.state === 'current').toBe(status === 'current');
        expect(look.state === 'expired').toBe(status === 'expired');
        expect(look.classes.includes('card-live')).toBe(status === 'current');
        expect(look.classes.includes('card-expired')).toBe(status === 'expired');
        expect(look.classes.includes('card-live') && look.classes.includes('card-expired')).toBe(false);
        if (status === 'expired') {
          expect(look.showExpiredLabel).toBe(true);
          expect(view.expiredLabel).toBe(language.strings.text['card.expired']);
          expect(view.expiredLabel).toBeTruthy();
          expect(cardLayout(view)).toContain('expired-label');
          expect(view.sentText.length).toBeGreaterThan(0);
          expect(cardLayout(view)).toContain('sent');
        } else {
          expect(look.showExpiredLabel).toBe(false);
          expect(view.expiredLabel).toBeNull();
          expect(cardLayout(view)).not.toContain('expired-label');
        }
      }),
      { numRuns: 300 },
    );
  });
});
