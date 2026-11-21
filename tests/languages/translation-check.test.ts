// Validates: Requirements 13.2, 13.3, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 14.10
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { stringsHi } from '../../src/languages/strings.hi';
import { EVENT_TYPES } from '../../src/message-code/index';
import {
  buildSampleEntries,
  buildStringEntries,
  parseTranslationCheck,
  renderTranslationCheck,
  statusFor,
} from '../../src/languages/translation-check';

const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Regional_Indicator}|\u200D|\uFE0F|\u20E3/u;

describe('statusFor', () => {
  it('string entry: checked only for the exact stored text', () => {
    const reviewed = { 'text.sayfirst.test': 'यह एक परीक्षण है।' };
    expect(statusFor(reviewed, 'text.sayfirst.test', 'यह एक परीक्षण है।')).toBe('checked');
    expect(statusFor(reviewed, 'text.sayfirst.test', 'यह एक परीक्षण है')).toBe('needs human check');
    expect(statusFor(reviewed, 'text.other', 'यह एक परीक्षण है।')).toBe('needs human check');
  });

  it('sample entry: checked only for the exact stored text', () => {
    const reviewed = { 'sample.flood': 'abc' };
    expect(statusFor(reviewed, 'sample.flood', 'abc')).toBe('checked');
    expect(statusFor(reviewed, 'sample.flood', 'abd')).toBe('needs human check');
    expect(statusFor({}, 'sample.flood', 'abc')).toBe('needs human check');
  });
});

describe('rendered translation check file', () => {
  const strings = buildStringEntries(stringsEn, stringsHi, {});
  const samples = buildSampleEntries(stringsEn, stringsHi, {});
  const md = renderTranslationCheck(strings, samples);
  const parsed = parseTranslationCheck(md);

  it('begins with the note and has no emoji', () => {
    const lines = md.split('\n');
    expect(lines[0].startsWith('#')).toBe(true);
    expect(lines[2]).toContain('machine-written');
    expect(EMOJI.test(md)).toBe(false);
  });

  it('lists one sample per event type, each starting with the test sentence', () => {
    expect(EVENT_TYPES).toHaveLength(9);
    expect(parsed.samples.map((s) => s.key)).toEqual(EVENT_TYPES.map((e) => `sample.${e}`));
    const en = (stringsEn.text as Record<string, string>)['sayfirst.test'];
    const hi = (stringsHi.text as Record<string, string>)['sayfirst.test'];
    for (const s of parsed.samples) {
      expect(s.english.startsWith(en)).toBe(true);
      expect(s.hindi.startsWith(hi)).toBe(true);
    }
  });

  it('shows checked for an exact reviewed sample and needs human check after one changed character', () => {
    const base = buildSampleEntries(stringsEn, stringsHi, {})[0];
    const exact = buildSampleEntries(stringsEn, stringsHi, { [base.key]: base.hindi })[0];
    expect(exact.status).toBe('checked');
    const changed = buildSampleEntries(stringsEn, stringsHi, { [base.key]: base.hindi + 'x' })[0];
    expect(changed.status).toBe('needs human check');

    const out = parseTranslationCheck(
      renderTranslationCheck([], buildSampleEntries(stringsEn, stringsHi, { [base.key]: base.hindi })),
    );
    expect(out.samples[0].status).toBe('checked');
    expect(out.checked).toBe(1);
    expect(out.needsCheck).toBe(8);
  });
});
