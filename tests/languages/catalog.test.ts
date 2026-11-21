// Language catalog checks: every language in LANGUAGES must pass the same text checks.
// Catalog-driven, so a new language needs no edit here.
// Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.9, 15.3
import { describe, expect, it } from 'vitest';
import { VALID_FOR } from '../../src/broadcast/valid-for';
import { stringsEn } from '../../src/broadcast/strings.en';
import { PLACEHOLDERS, TEXT_KEYS } from '../../src/broadcast/strings.types';
import type { Strings, TextKey } from '../../src/broadcast/strings.types';
import { LANGUAGES, findLanguage } from '../../src/languages/catalog';
import type { LanguageEntry } from '../../src/languages/catalog';
import { ACTIONS, EVENT_TYPES, SEVERITIES, URGENCIES } from '../../src/message-code/index';

const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator}|\u200D|\uFE0F|\u20E3/u;

const EXPIRY_STATUSES = ['current', 'expired', 'sent-in-future', 'clock-unknown'];
const FIELD_NAMES = [
  'test', 'passedOn', 'event', 'urgency', 'severity', 'action', 'sentMinute',
  'validSteps', 'latitude', 'longitude', 'stationId', 'counter', 'placeName',
];
const DECODE_REASONS = [
  'not-bytes', 'too-short', 'too-long', 'unknown-version', 'bad-check', 'unknown-event', 'invalid-field',
];
const AUDIO_REASONS = ['not-bytes', 'too-short', 'too-long', 'engine-error', 'disposed'];
const WAV_REASONS = ['not-float32', 'empty', 'not-finite', 'bad-sample-rate'];

const LABEL_CODES: Record<keyof Strings['labels'], readonly string[]> = {
  event: EVENT_TYPES,
  urgency: URGENCIES,
  severity: SEVERITIES,
  action: ACTIONS,
  status: EXPIRY_STATUSES,
  validFor: VALID_FOR.map((c) => c.key),
  field: FIELD_NAMES,
  decodeReason: DECODE_REASONS,
  audioReason: AUDIO_REASONS,
  wavReason: WAV_REASONS,
};

function placeholdersIn(template: string): string[] {
  return [...template.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1] as string);
}

function labelMap(strings: Strings, group: string): Record<string, string> {
  return (strings.labels as unknown as Record<string, Record<string, string>>)[group] as Record<
    string,
    string
  >;
}

function declareChecks(entry: LanguageEntry): void {
  const { strings } = entry;
  const text = strings.text as Record<string, string>;

  it('has a non-empty value for every TEXT_KEYS key', () => {
    for (const key of TEXT_KEYS) {
      expect(typeof text[key], key).toBe('string');
      expect((text[key] as string).trim().length, key).toBeGreaterThan(0);
    }
  });

  it('has a non-empty label for every code', () => {
    for (const [group, codes] of Object.entries(LABEL_CODES)) {
      const map = labelMap(strings, group);
      for (const code of codes) {
        expect(typeof map[code], `${group}.${code}`).toBe('string');
        expect((map[code] as string).trim().length, `${group}.${code}`).toBeGreaterThan(0);
      }
    }
  });

  it('has no key outside English', () => {
    expect(Object.keys(text).sort()).toEqual([...TEXT_KEYS].sort());
    expect(Object.keys(strings.labels).sort()).toEqual(Object.keys(stringsEn.labels).sort());
    for (const group of Object.keys(stringsEn.labels)) {
      expect(Object.keys(labelMap(strings, group)).sort(), group).toEqual(
        Object.keys(labelMap(stringsEn, group)).sort(),
      );
    }
  });

  it('uses exactly the placeholders that PLACEHOLDERS declares, in both directions', () => {
    for (const key of TEXT_KEYS as readonly TextKey[]) {
      const used = new Set(placeholdersIn(text[key] as string));
      const declared = new Set(PLACEHOLDERS[key]);
      for (const name of used) expect(declared.has(name), `${key} uses {${name}}`).toBe(true);
      for (const name of declared) expect(used.has(name), `${key} lacks {${name}}`).toBe(true);
    }
  });

  it('has no emoji in any label or text', () => {
    for (const [group] of Object.entries(strings.labels)) {
      for (const [code, label] of Object.entries(labelMap(strings, group))) {
        expect(EMOJI.test(label), `${group}.${code}`).toBe(false);
      }
    }
    for (const key of TEXT_KEYS) expect(EMOJI.test(text[key] as string), key).toBe(false);
  });

  it('has unique labels inside field, decodeReason, audioReason and wavReason', () => {
    for (const group of ['field', 'decodeReason', 'audioReason', 'wavReason']) {
      const labels = Object.values(labelMap(strings, group));
      expect(new Set(labels).size, group).toBe(labels.length);
    }
  });

  it('keeps the offline lines to 60 characters or fewer', () => {
    expect([...(text['offline.unsaved'] as string)].length).toBeLessThanOrEqual(60);
    expect([...(text['offline.saved'] as string)].length).toBeLessThanOrEqual(60);
  });

  it('has no emoji in the storage note', () => {
    expect(EMOJI.test(text['offline.storageNote'] as string)).toBe(false);
  });
}

describe('catalog', () => {
  it('has unique non-empty codes and a lookup for each', () => {
    const codes = LANGUAGES.map((l) => l.code);
    expect(codes.length).toBeGreaterThan(0);
    expect(new Set(codes).size).toBe(codes.length);
    for (const entry of LANGUAGES) {
      expect(entry.code.trim().length).toBeGreaterThan(0);
      expect(entry.name.trim().length).toBeGreaterThan(0);
      expect(entry.speechTag.trim().length).toBeGreaterThan(0);
      expect(findLanguage(entry.code)).toBe(entry);
    }
  });
});

describe.each(LANGUAGES.map((l) => [l.code, l] as const))('language %s', (_code, entry) => {
  declareChecks(entry);
});

// Hindi checks. Validates: Requirements 1.1, 1.7, 1.8, 2.6, 12.7, 12.9, 12.10
describe('Hindi language', () => {
  const hi = findLanguage('hi');
  const hiText = hi?.strings.text as Record<string, string>;
  const enText = stringsEn.text as Record<string, string>;
  const DEVANAGARI = /\p{Script=Devanagari}/u;
  const LATIN = /[A-Za-z]/;

  // Keys allowed to repeat an English value that has A to Z.
  const REPEAT_EXCEPTIONS = new Set<string>([
    'page.title', // The product name stays in Latin letters ("Dead Air").
    'test.banner', // Must carry the Latin word TEST (promise 3).
    'sayfirst.test', // Must carry the Latin word TEST (promise 3).
  ]);

  it('has exactly the entries en and hi, each with strings', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'hi']);
    for (const entry of LANGUAGES) {
      expect(entry.strings).toBeDefined();
      expect(entry.strings.text).toBeDefined();
      expect(entry.strings.labels).toBeDefined();
    }
  });

  it('has a test banner with a Devanagari letter and the word TEST', () => {
    expect(DEVANAGARI.test(hiText['test.banner'] as string)).toBe(true);
    expect(hiText['test.banner']).toMatch(/\bTEST\b/);
  });

  it('has the word TEST in the say-first test line', () => {
    expect(hiText['sayfirst.test']).toMatch(/\bTEST\b/);
  });

  it('repeats no English value that has A to Z, except the named exceptions', () => {
    for (const key of TEXT_KEYS) {
      if (REPEAT_EXCEPTIONS.has(key)) continue;
      if (!LATIN.test(enText[key] as string)) continue;
      expect(hiText[key], key).not.toBe(enText[key]);
    }
  });

  it('may keep the product name in Latin letters in page.title', () => {
    expect(hiText['page.title']).toMatch(/^Dead Air/);
  });

  it('has no A to Z letter in any label other than TEST', () => {
    const strings = (hi as LanguageEntry).strings;
    for (const group of Object.keys(strings.labels)) {
      for (const [code, label] of Object.entries(labelMap(strings, group))) {
        expect(LATIN.test(label.replaceAll('TEST', '')), `${group}.${code}`).toBe(false);
      }
    }
  });

  it('has no A to Z letter in sentence.main other than TEST', () => {
    // Placeholder names such as {event} are code, not text, so they are removed first.
    const fixed = (hiText['sentence.main'] as string).replace(/\{[^{}]*\}/g, '').replaceAll('TEST', '');
    expect(LATIN.test(fixed)).toBe(false);
  });
});

// A new language is one file and one catalog entry. This catalog adds a fake third entry
// (a copy of English with another code) and must pass the same checks.
describe('catalog with a fake third language', () => {
  const fake: LanguageEntry = {
    code: 'zz',
    name: 'Fake',
    speechTag: 'zz',
    strings: (JSON.parse(JSON.stringify(stringsEn)) as Strings),
  };
  const extended: readonly LanguageEntry[] = [...LANGUAGES, fake];

  it('has unique codes and finds the fake entry', () => {
    expect(new Set(extended.map((l) => l.code)).size).toBe(extended.length);
    expect(findLanguage('zz', extended)).toBe(fake);
  });

  describe.each(extended.map((l) => [l.code, l] as const))('language %s', (_code, entry) => {
    declareChecks(entry);
  });
});
