// Property tests for the alert sentence, over every language in the catalog.
// Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 3.2, 3.4, 3.6, 12.12, 14.7
import fc from 'fast-check';
import { describe, it } from 'vitest';
import type { Strings } from '../../src/broadcast/strings.types';
import { LANGUAGES } from '../../src/languages/catalog';
import { VALID_FOR } from '../../src/broadcast/valid-for';
import { buildSayFirst } from '../../src/broadcast/say-first';
import { buildAlertSentence } from '../../src/languages/sentence';
import { buildSpokenText } from '../../src/languages/spoken-text';
import type { Alert } from '../../src/message-code/index';
import { alertArb } from '../message-code/generators';

const languageArb = fc.constantFrom(...LANGUAGES);

type LabelGroup = 'event' | 'urgency' | 'severity' | 'action';
const LABEL_GROUPS: readonly LabelGroup[] = ['event', 'urgency', 'severity', 'action'];

function withText(strings: Strings, key: string, value: string | undefined): Strings {
  const text: Record<string, string> = { ...(strings.text as Record<string, string>) };
  if (value === undefined) delete text[key];
  else text[key] = value;
  return { ...strings, text: text as unknown as Strings['text'] };
}

function withLabel(strings: Strings, group: LabelGroup, code: string, value: string | undefined): Strings {
  const map: Record<string, string> = { ...(strings.labels[group] as Record<string, string>) };
  if (value === undefined) delete map[code];
  else map[code] = value;
  return { ...strings, labels: { ...strings.labels, [group]: map } as unknown as Strings['labels'] };
}

describe('alert sentence properties', () => {
  it('Property 1: The sentence holds the four labels and the place name', () => {
    // Feature: languages, Property 1: The sentence holds the four labels and the place name
    // Validates: Requirements 2.1, 2.2, 2.3, 3.2, 3.4, 3.6, 12.12, 14.7
    fc.assert(
      fc.property(alertArb, languageArb, (alert, lang) => {
        const s = buildAlertSentence(alert, lang.strings);
        if (!s.ok) return false;
        const l = lang.strings.labels as unknown as Record<LabelGroup, Record<string, string>>;
        const labels = [
          l.event[alert.event],
          l.urgency[alert.urgency],
          l.severity[alert.severity],
          l.action[alert.action],
        ];
        if (!labels.every((x) => typeof x === 'string' && x.length > 0 && s.text.includes(x))) return false;
        return alert.placeName.trim().length === 0 || s.text.includes(alert.placeName);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 2: Sentence structure and determinism', () => {
    // Feature: languages, Property 2: Sentence structure and determinism
    // Validates: Requirements 2.4, 2.5, 2.8
    fc.assert(
      fc.property(alertArb, languageArb, (alert, lang) => {
        const s = buildAlertSentence(alert, lang.strings);
        const again = buildAlertSentence(alert, lang.strings);
        if (!s.ok || !again.ok) return false;
        if (s.text !== again.text) return false;

        const testSentence = (lang.strings.text as Record<string, string>)['sayfirst.test'];
        if (s.text.startsWith(testSentence) !== alert.test) return false;
        if ((s.parts.test !== null) !== alert.test) return false;

        const blank = alert.placeName.trim().length === 0;
        if ((s.parts.place === null) !== blank) return false;

        const joined = [s.parts.test, s.parts.main, s.parts.place]
          .filter((p): p is string => p !== null)
          .join(' ');
        return s.text === joined;
      }),
      { numRuns: 200 },
    );
  });

  it('Property 3: A missing template or label gives no sentence', () => {
    // Feature: languages, Property 3: A missing template or label gives no sentence
    // Validates: Requirements 2.7, 3.6
    const breakArb = fc.record({
      pick: fc.nat(),
      remove: fc.boolean(),
    });
    fc.assert(
      fc.property(alertArb, languageArb, breakArb, (alert: Alert, lang, { pick, remove }) => {
        const value = remove ? undefined : '';
        const targets: Array<(s: Strings) => Strings> = [
          (s) => withText(s, 'sentence.main', value),
          ...LABEL_GROUPS.map((g) => (s: Strings) => withLabel(s, g, alert[g], value)),
        ];
        if (alert.test) targets.push((s) => withText(s, 'sayfirst.test', value));
        if (alert.placeName.trim().length > 0) targets.push((s) => withText(s, 'sayfirst.place', value));

        const broken = targets[pick % targets.length](lang.strings);
        const result = buildAlertSentence(alert, broken);
        return !result.ok && !('text' in result);
      }),
      { numRuns: 200 },
    );
  });

  it('Property 4: Shared parts agree word for word', () => {
    // Feature: languages, Property 4: Shared parts agree word for word
    // Validates: Requirements 2.9
    const words = (t: string): string => t.split(/\s+/).filter((w) => w.length > 0).join(' ');
    const has = (whole: string, part: string): boolean => ` ${words(whole)} `.includes(` ${words(part)} `);
    fc.assert(
      fc.property(alertArb, languageArb, fc.constantFrom(...VALID_FOR), (raw, lang, valid) => {
        // Say_First only knows the durations the Broadcast page offers.
        const alert: Alert = { ...raw, validSteps: valid.steps };
        const s = buildAlertSentence(alert, lang.strings);
        const say = buildSayFirst(alert, lang.strings, 0);
        const spoken = buildSpokenText(alert, alert.sentMinute * 60000, lang.strings);
        if (!s.ok || !say.ok || spoken === null) return false;
        // Say_First shares the test part and the place part. Say_First (spec 3)
        // trims the place name and the sentence keeps it exactly as sent, so the
        // place parts only match when the name has no leading or trailing space
        // (design, note on placeName).
        if (s.parts.test !== null && !has(say.text, s.parts.test)) return false;
        const trimmed = alert.placeName === alert.placeName.trim();
        if (trimmed && s.parts.place !== null && !has(say.text, s.parts.place)) return false;
        // Spoken_Text shares the test part, the main part and the place part.
        if (s.parts.test !== null && !has(spoken, s.parts.test)) return false;
        if (!has(spoken, s.parts.main)) return false;
        if (s.parts.place !== null && !has(spoken, s.parts.place)) return false;
        return true;
      }),
      { numRuns: 200 },
    );
  });
});
