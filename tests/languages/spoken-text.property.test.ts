// Property test for the Spoken_Text, over every language in the catalog.
// Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.8, 8.9, 14.7
import fc from 'fast-check';
import { describe, it } from 'vitest';
import { LANGUAGES } from '../../src/languages/catalog';
import { spokenAge } from '../../src/languages/spoken-age';
import { buildSpokenText } from '../../src/languages/spoken-text';
import { checkExpiry } from '../../src/message-code/index';
import { formatLocal } from '../../src/shared/time';
import { alertArb } from '../message-code/generators';

const languageArb = fc.constantFrom(...LANGUAGES);

// Device time: an offset from the sent time (covers every status), or an unusable clock.
const nowOffsetArb = fc.oneof(
  { weight: 8, arbitrary: fc.integer({ min: -60, max: 4000 }).map((m) => ({ kind: 'offset' as const, m })) },
  { weight: 1, arbitrary: fc.constantFrom(NaN, Infinity, -1).map((v) => ({ kind: 'raw' as const, v })) },
);

describe('spoken text properties', () => {
  it('Property 5: The Spoken_Text carries the promises', () => {
    // Feature: languages, Property 5: The Spoken_Text carries the promises
    // Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.8, 8.9, 14.7
    fc.assert(
      fc.property(alertArb, languageArb, nowOffsetArb, (alert, lang, nowSpec) => {
        const sentAtMs = alert.sentMinute * 60_000;
        const nowMs = nowSpec.kind === 'offset' ? sentAtMs + nowSpec.m * 60_000 : nowSpec.v;
        const s = lang.strings;
        const text = s.text as Record<string, string>;
        const spoken = buildSpokenText(alert, nowMs, s);
        if (spoken === null) return false;

        const status = checkExpiry(alert, nowMs).status;
        const testSentence = text['sayfirst.test'];
        const expiredLabel = s.labels.status.expired;
        const clockLine = text['listen.clock.line'];

        if (alert.test && !spoken.startsWith(testSentence)) return false;
        if (alert.placeName.trim().length > 0 && !spoken.includes(alert.placeName)) return false;

        if (status === 'expired') {
          if (!spoken.includes(expiredLabel)) return false;
          if (alert.test && spoken.indexOf(expiredLabel) < testSentence.length) return false;
        }

        if (status === 'sent-in-future' || status === 'clock-unknown') {
          if (!spoken.includes(clockLine)) return false;
          if (spoken.includes(formatLocal(sentAtMs, 0))) return false;
          // No Spoken_Age phrase: the phrase for the Sent_Age (clamped at 0) is absent.
          const age = spokenAge(Math.max(0, nowMs - sentAtMs), s);
          if (age !== null && Number.isFinite(nowMs) && spoken.includes(age)) return false;
        }

        if (status === 'current' || status === 'expired') {
          const age = spokenAge(Math.max(0, nowMs - sentAtMs), s);
          if (age === null || !spoken.includes(age)) return false;
          if (status === 'expired' && spoken.indexOf(age) < spoken.indexOf(expiredLabel)) return false;
          if (spoken.includes(formatLocal(sentAtMs, 0))) return false;
        }

        if (status === 'current') {
          if (spoken.includes(expiredLabel) || spoken.includes(clockLine)) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });
});
