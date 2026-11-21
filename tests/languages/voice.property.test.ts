import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { sameLanguage } from '../../src/languages/tags';
import { pickLocalVoice, type VoiceInfo } from '../../src/languages/voice';
import { voiceBlockFor } from '../../src/languages/speech';

const NUM_RUNS = 200;

const langArb = fc.constantFrom(
  'en', 'en-US', 'en-GB', 'hi', 'hi-IN', 'es', 'es-MX', 'fr-FR', 'ar', 'pt-BR', 'zh-CN', 'EN_us', '',
);
const tagArb = fc.constantFrom('en-US', 'en', 'hi-IN', 'es-ES', 'fr-FR', 'ar-SA', 'pt-BR', 'zh-CN');

const voiceArb: fc.Arbitrary<VoiceInfo> = fc.record({
  id: fc.uuid(),
  name: fc.string({ maxLength: 8 }),
  lang: langArb,
  localService: fc.boolean(),
  isDefault: fc.boolean(),
});
const voicesArb = fc.array(voiceArb, { maxLength: 12 });

describe('voice properties', () => {
  // Feature: languages, Property 12: Only a local voice of the right language is chosen
  // **Validates: Requirements 7.3, 7.4, 7.5, 7.6**
  it('Property 12: picks only a local voice of the right language', () => {
    fc.assert(
      fc.property(voicesArb, tagArb, (voices, tag) => {
        const eligible = voices.filter((v) => v.localService === true && sameLanguage(v.lang, tag));
        const picked = pickLocalVoice(voices, tag);
        if (eligible.length === 0) {
          expect(picked).toBeNull();
          return;
        }
        expect(picked).not.toBeNull();
        expect(picked!.localService).toBe(true);
        expect(sameLanguage(picked!.lang, tag)).toBe(true);
        expect(picked).toBe(eligible.find((v) => v.isDefault) ?? eligible[0]);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: languages, Property 13: A card shows exactly one voice outcome
  // **Validates: Requirements 7.19, 7.21, 7.22, 7.23**
  it('Property 13: voiceBlockFor yields exactly one outcome following the table', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom('en', 'hi', 'es', 'fr', 'ar', 'pt', 'zh'),
        (supported, hasLocalVoice, languageCode) => {
          const block = voiceBlockFor({ supported, hasLocalVoice, languageCode });
          expect(['button', 'missing', 'none']).toContain(block);
          const english = languageCode === 'en';
          const expected = !supported
            ? 'none'
            : hasLocalVoice
              ? 'button'
              : english
                ? 'none'
                : 'missing';
          expect(block).toBe(expected);
          // Help and missing lines are never shown together.
          const showHelp = block === 'button' && !english;
          const showMissing = block === 'missing';
          expect(showHelp && showMissing).toBe(false);
          if (!supported) expect(showHelp || showMissing).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
