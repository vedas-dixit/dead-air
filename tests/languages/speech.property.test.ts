import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { LANGUAGES, type LanguageEntry } from '../../src/languages/catalog';
import {
  createSpeechController,
  voiceBlockFor,
  type SpeechHost,
} from '../../src/languages/speech';
import type { VoiceInfo } from '../../src/languages/voice';

interface SpeakCall {
  req: { text: string; voiceId: string; lang: string };
  cb: { onEnd(): void; onError(): void };
  live: boolean;
  activeBefore: number;
}

function makeHost(supported: boolean, initial: VoiceInfo[]) {
  const state = {
    voices: initial,
    calls: [] as SpeakCall[],
    listeners: new Set<() => void>(),
  };
  const live = (): number => state.calls.filter((c) => c.live).length;
  const host: SpeechHost = {
    supported,
    voices: () => state.voices,
    onVoicesChanged(fn) {
      state.listeners.add(fn);
      return () => state.listeners.delete(fn);
    },
    speak(req, cb) {
      state.calls.push({ req, cb, live: true, activeBefore: live() });
    },
    cancel() {
      for (const c of state.calls) c.live = false;
    },
  };
  return { host, state, live };
}

const voiceArb: fc.Arbitrary<VoiceInfo> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 6 }),
  name: fc.string({ maxLength: 6 }),
  lang: fc.constantFrom('en-US', 'en-GB', 'hi-IN', 'hi', 'fr-FR', 'en_IN'),
  localService: fc.boolean(),
  isDefault: fc.boolean(),
});
const voicesArb = fc.array(voiceArb, { maxLength: 6 });
const keyArb = fc.constantFrom('a', 'b', 'c');

type Action =
  | { t: 'tap'; key: string }
  | { t: 'stop' }
  | { t: 'lang'; index: number }
  | { t: 'voices'; voices: VoiceInfo[] }
  | { t: 'end'; n: number }
  | { t: 'error'; n: number };

const actionArb: fc.Arbitrary<Action> = fc.oneof(
  { weight: 4, arbitrary: keyArb.map((key): Action => ({ t: 'tap', key })) },
  { weight: 1, arbitrary: fc.constant<Action>({ t: 'stop' }) },
  { weight: 1, arbitrary: fc.nat(LANGUAGES.length - 1).map((index): Action => ({ t: 'lang', index })) },
  { weight: 1, arbitrary: voicesArb.map((voices): Action => ({ t: 'voices', voices })) },
  { weight: 2, arbitrary: fc.nat(20).map((n): Action => ({ t: 'end', n })) },
  { weight: 2, arbitrary: fc.nat(20).map((n): Action => ({ t: 'error', n })) },
);

describe('speech controller', () => {
  // Feature: languages, Property 14: One speech at a time, and speech follows the rules
  // **Validates: Requirements 7.2, 7.5, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.15, 7.16, 7.18, 7.21, 7.23**
  it('Property 14: one speech at a time, and speech follows the rules', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        voicesArb,
        fc.nat(LANGUAGES.length - 1),
        fc.array(actionArb, { maxLength: 40 }),
        (supported, initial, startIndex, actions) => {
          const { host, state, live } = makeHost(supported, initial);
          let language: LanguageEntry = LANGUAGES[startIndex]!;
          const ctl = createSpeechController({
            host,
            language: () => language,
            buildText: (key) => `text:${key}`,
          });

          const expectedAvailable = (): boolean =>
            supported &&
            state.voices.some(
              (v) =>
                v.localService &&
                v.lang.toLowerCase().split(/[-_]/)[0] === language.speechTag.toLowerCase(),
            );

          const checkState = (): void => {
            const ui = ctl.snapshot();
            expect(live()).toBeLessThanOrEqual(1);
            expect(live()).toBe(ui.speakingKey === null ? 0 : 1);
            expect(ui.available).toBe(expectedAvailable());
            expect(ui.block).toBe(
              voiceBlockFor({
                supported,
                hasLocalVoice: expectedAvailable(),
                languageCode: language.code,
              }),
            );
            if (!ui.available) expect(ui.speakingKey).toBeNull();
          };
          checkState();

          for (const a of actions) {
            const before = state.calls.length;
            const wasSpeaking = ctl.snapshot().speakingKey;
            switch (a.t) {
              case 'tap':
                ctl.tap(a.key);
                break;
              case 'stop':
                ctl.stop();
                expect(ctl.snapshot().speakingKey).toBeNull();
                break;
              case 'lang':
                language = LANGUAGES[a.index]!;
                ctl.languageChanged();
                expect(ctl.snapshot().speakingKey).toBeNull();
                break;
              case 'voices':
                state.voices = a.voices;
                for (const fn of [...state.listeners]) fn();
                break;
              case 'end':
              case 'error': {
                const call = state.calls[a.n % Math.max(state.calls.length, 1)];
                if (call) {
                  call.live = false; // the host's own speech is over
                  if (a.t === 'end') call.cb.onEnd();
                  else call.cb.onError();
                }
                break;
              }
            }
            const added = state.calls.length - before;
            if (a.t !== 'tap') expect(added).toBe(0);
            else {
              expect(added).toBeLessThanOrEqual(1);
              if (wasSpeaking === a.key) expect(added).toBe(0);
              if (added === 1) {
                const call = state.calls[state.calls.length - 1]!;
                expect(call.activeBefore).toBe(0);
                expect(call.req.text).toBe(`text:${a.key}`);
                expect(ctl.snapshot().speakingKey).toBe(a.key);
                const voice = state.voices.find((v) => v.id === call.req.voiceId);
                expect(voice).toBeDefined();
                expect(voice!.localService).toBe(true);
                expect(voice!.lang).toBe(call.req.lang);
                expect(voice!.lang.toLowerCase().split(/[-_]/)[0]).toBe(
                  language.speechTag.toLowerCase(),
                );
              }
            }
            checkState();
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
