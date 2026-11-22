// Tests for the new Pass it on strings.
// Validates: Requirements 12.2, 12.3, 12.5, 12.7, 12.8, 12.9, 12.10, 12.11, 12.12, 12.13, 12.15
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { PLACEHOLDERS, TEXT_KEYS } from '../../src/broadcast/strings.types';
import { LANGUAGES } from '../../src/languages/catalog';
import { buildSpokenText } from '../../src/languages/spoken-text';
import { stringsHi } from '../../src/languages/strings.hi';
import {
  buildSampleEntries,
  buildStringEntries,
  parseReviewedList,
  parseTranslationCheck,
  renderTranslationCheck,
} from '../../src/languages/translation-check';
import type { Alert } from '../../src/message-code/index';

const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator}|\u200D|\uFE0F|\u20E3/u;

const en = stringsEn.text as Readonly<Record<string, string>>;
const hi = stringsHi.text as Readonly<Record<string, string>>;

const PASS_KEYS = TEXT_KEYS.filter((k) => k.startsWith('listen.pass.'));
const FAILURE_KEYS = [
  'listen.pass.err.load',
  'listen.pass.err.not-current',
  'listen.pass.err.expired-mid',
  'listen.pass.err.failed',
  'listen.pass.err.audio',
];

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe('listen.pass.* strings', () => {
  it('has the new keys', () => {
    expect(PASS_KEYS.length).toBeGreaterThanOrEqual(14);
    for (const k of FAILURE_KEYS) expect(PASS_KEYS as readonly string[]).toContain(k);
  });

  it('every key has English and Hindi text with matching placeholders', () => {
    for (const k of PASS_KEYS) {
      expect(typeof en[k] === 'string' && en[k].trim() !== '', `en ${k}`).toBe(true);
      expect(typeof hi[k] === 'string' && hi[k].trim() !== '', `hi ${k}`).toBe(true);
      expect(placeholders(en[k]), k).toEqual([...PLACEHOLDERS[k as keyof typeof PLACEHOLDERS]].sort());
      expect(placeholders(hi[k]), k).toEqual(placeholders(en[k]));
    }
  });

  it('has no emoji in any new text', () => {
    for (const k of PASS_KEYS) {
      expect(EMOJI.test(en[k]), `en ${k}`).toBe(false);
      expect(EMOJI.test(hi[k]), `hi ${k}`).toBe(false);
    }
  });

  it('each Failure_Line has its own key and its own English and Hindi text', () => {
    for (const lang of [en, hi]) {
      for (const k of FAILURE_KEYS) {
        expect(k in lang, k).toBe(true);
        const clashes = Object.keys(lang).filter((o) => o !== k && lang[o] === lang[k]);
        expect(clashes, k).toEqual([]);
      }
    }
    for (const k of FAILURE_KEYS) expect(en[k]).not.toBe(hi[k]);
  });

  it('English texts of err.load and err.expired-mid match the requirements', () => {
    expect(en['listen.pass.err.load']).toBe(
      'The sound could not be loaded. Tap Pass it on to try again.',
    );
    expect(en['listen.pass.err.expired-mid']).toBe(
      'This alert ended while it was playing, so it was not played a second time. It cannot be passed on any more.',
    );
  });

  it('has no listen.pass.err.check key', () => {
    const key = 'listen.pass.err.check';
    expect((TEXT_KEYS as readonly string[]).includes(key)).toBe(false);
    expect(key in en).toBe(false);
    expect(key in hi).toBe(false);
  });
});

describe('translation check with the new strings', () => {
  const doc = (name: string): string => readFileSync(join(process.cwd(), 'docs', name), 'utf8');
  const hiEntry = LANGUAGES.find((l) => l.code === 'hi');
  if (hiEntry === undefined) throw new Error('catalog has no hi entry');
  const parsedReviewed = parseReviewedList(doc('translation-reviewed.json'));
  if (!parsedReviewed.ok) throw new Error(parsedReviewed.reason);
  const reviewed = parsedReviewed.list.reviewed['hi'] ?? {};
  const strings = buildStringEntries(stringsEn, hiEntry.strings, reviewed);
  const samples = buildSampleEntries(stringsEn, hiEntry.strings, reviewed);

  it('reports zero failures: file in sync and no empty Hindi text', () => {
    const md = doc('translation-check.md');
    expect(md).toBe(renderTranslationCheck(strings, samples));
    const parsed = parseTranslationCheck(md);
    expect(parsed.strings).toEqual(strings);
    expect(parsed.samples).toEqual(samples);
    for (const e of strings) expect(e.hindi.trim(), e.key).not.toBe('');
  });

  it('records every new Hindi text as needs human check', () => {
    for (const k of PASS_KEYS) {
      const e = strings.find((s) => s.key === `text.${k}`);
      expect(e, k).toBeDefined();
      expect(e?.status, k).toBe('needs human check');
    }
  });
});

describe('spoken text is unchanged', () => {
  const ALERT: Alert = {
    test: true,
    passedOn: false,
    hopCount: 0,
    event: 'flood',
    urgency: 'immediate',
    severity: 'severe',
    action: 'evacuate',
    sentMinute: 29_000_000,
    validSteps: 4,
    latitude: null,
    longitude: null,
    stationId: 7,
    counter: 1,
    placeName: 'Pune',
  };
  const NOW = ALERT.sentMinute * 60_000 + 10 * 60_000;

  it('keeps the Languages spec wording and ignores hop count and pass texts', () => {
    const expected = `${stringsEn.text['sayfirst.test']} Flood. Urgency: Immediate. Severity: Severe. Evacuate. Place: Pune. Sent 10 minutes ago.`;
    expect(buildSpokenText(ALERT, NOW, stringsEn)).toBe(expected);

    const hopped = buildSpokenText({ ...ALERT, passedOn: true, hopCount: 3 }, NOW, stringsEn);
    expect(hopped).toBe(expected);

    const blanked = { ...en };
    for (const k of PASS_KEYS) blanked[k] = 'PASS-TEXT';
    const changed = { ...stringsEn, text: blanked } as unknown as typeof stringsEn;
    expect(buildSpokenText(ALERT, NOW, changed)).toBe(expected);
  });
});
