// Property test for the Listen card across every language in the catalog.
// Validates: Requirements 3.1, 3.5, 6.6, 6.9, 8.16, 12.12
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildCardView } from '../../src/listen/card';
import type { HistoryEntry } from '../../src/listen/history';
import { LANGUAGES } from '../../src/languages/catalog';
import { buildAlertSentence } from '../../src/languages/sentence';
import { alertArb, encodeOrThrow } from '../message-code/generators';

const SENT_FORMAT = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC[+-]\d{2}:\d{2}$/;

// Keep sent times below year 9999 so the date has four digits. The largest
// sentMinute the message code allows (4294967295) falls in year 10136.
const MAX_SENT_MINUTE = 4_000_000_000;

const entryArb = alertArb.map((generated) => {
  const alert = { ...generated, sentMinute: generated.sentMinute % MAX_SENT_MINUTE };
  return {
    bytes: encodeOrThrow(alert),
    alert,
    heardCount: 1,
    highestHop: alert.hopCount,
    firstHeardMs: 0,
    lastHeardMs: 0,
  } as HistoryEntry;
});

describe('card properties', () => {
  it('Property 7: The card keeps place, test banner and time format in every Language', () => {
    // Feature: languages, Property 7: The card keeps place, test banner and time format in every Language
    // Validates: Requirements 3.1, 3.5, 6.6, 6.9, 8.16, 12.12
    fc.assert(
      fc.property(
        entryArb,
        fc.integer({ min: -3_600_000, max: 3_600_000 * 24 }),
        fc.integer({ min: -720, max: 840 }),
        (entry, delta, offset) => {
          const alert = entry.alert;
          const nowMs = alert.sentMinute * 60_000 + delta;
          const views = LANGUAGES.map((lang) => ({
            lang,
            view: buildCardView(entry, nowMs, offset, lang.strings, { phase: 'idle' }),
          }));
          const untilOf = (v: (typeof views)[number]['view'], untilLabel: string) =>
            v.rows.find((r) => r.label === untilLabel)?.value;

          const first = views[0]!;
          const firstUntil = untilOf(first.view, (first.lang.strings.text as Record<string, string>)['preview.until']!);

          for (const { lang, view } of views) {
            const t = lang.strings.text as Record<string, string>;
            // Place row: exact name, direction follows the name.
            const placeRow = view.rows.find((r) => r.label === t['preview.place']);
            if (alert.placeName !== '') {
              expect(placeRow?.value).toBe(alert.placeName);
              expect(placeRow?.dirAuto).toBe(true);
            } else {
              expect(placeRow).toBeUndefined();
            }
            // Test banner.
            if (alert.test) expect(view.testBanner).toBe(t['test.banner']);
            else expect(view.testBanner).toBeNull();
            expect(view.testBanner !== null).toBe(alert.test);
            // Time format is the same in every language.
            expect(view.sentText).toMatch(SENT_FORMAT);
            expect(view.sentText).toBe(first.view.sentText);
            const until = untilOf(view, t['preview.until']!);
            expect(until).toBeDefined();
            expect(until).toMatch(SENT_FORMAT);
            expect(until).toBe(firstUntil);
            // Sentence equals the Alert_Sentence text.
            const built = buildAlertSentence(alert, lang.strings);
            expect(view.sentence).toBe(built.ok ? built.text : null);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
