// Validates: Requirements 13.4, 13.5, 13.6, 13.10, 13.11
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { LANGUAGES } from '../../src/languages/catalog';
import {
  buildSampleEntries,
  buildStringEntries,
  parseReviewedList,
  parseTranslationCheck,
  renderTranslationCheck,
} from '../../src/languages/translation-check';
import { EVENT_TYPES } from '../../src/message-code/index';
import { utf8Decode } from '../../src/message-code/utf8';

function readDoc(name: string): string {
  const text = utf8Decode(readFileSync(join(process.cwd(), 'docs', name)));
  if (text === null) throw new Error(`${name} is not valid UTF-8`);
  return text;
}

const hi = LANGUAGES.find((l) => l.code === 'hi');
if (hi === undefined) throw new Error('catalog has no hi entry');

const parsedReviewed = parseReviewedList(readDoc('translation-reviewed.json'));
if (!parsedReviewed.ok) throw new Error(`reviewed list invalid: ${parsedReviewed.reason}`);
const reviewed = parsedReviewed.list.reviewed['hi'] ?? {};

const strings = buildStringEntries(stringsEn, hi.strings, reviewed);
const samples = buildSampleEntries(stringsEn, hi.strings, reviewed);
const onDisk = readDoc('translation-check.md');

describe('translation-check.md is in sync', () => {
  it('equals a fresh render from the language files and the reviewed list', () => {
    expect(onDisk).toBe(renderTranslationCheck(strings, samples));
  });

  it('parsed entries and counts equal the generated entries', () => {
    const parsed = parseTranslationCheck(onDisk);
    expect(parsed.strings).toEqual(strings);
    expect(parsed.samples).toEqual(samples);
    const all = [...strings, ...samples];
    const checked = all.filter((e) => e.status === 'checked').length;
    expect(parsed.checked).toBe(checked);
    expect(parsed.needsCheck).toBe(all.length - checked);
    expect(parsed.checked + parsed.needsCheck).toBe(all.length);
  });

  it('has one sample per event type', () => {
    expect(samples.map((s) => s.key)).toEqual(EVENT_TYPES.map((e) => `sample.${e}`));
  });

  it('every reviewed key is a string key or a sample key (no stale review)', () => {
    const known = new Set([...strings, ...samples].map((e) => e.key));
    for (const [code, map] of Object.entries(parsedReviewed.list.reviewed)) {
      for (const key of Object.keys(map)) {
        expect(known.has(key), `${code}: ${key}`).toBe(true);
      }
    }
  });
});
