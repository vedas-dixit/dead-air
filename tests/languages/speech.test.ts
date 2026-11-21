import { describe, expect, it } from 'vitest';
import { LANGUAGES, findLanguage } from '../../src/languages/catalog';
import { createSpeechController, type SpeechHost } from '../../src/languages/speech';
import type { VoiceInfo } from '../../src/languages/voice';

const hi = findLanguage('hi')!;
const en = findLanguage('en')!;
const hiVoice: VoiceInfo = { id: 'v-hi', name: 'Hindi', lang: 'hi-IN', localService: true, isDefault: false };
const enVoice: VoiceInfo = { id: 'v-en', name: 'English', lang: 'en-US', localService: true, isDefault: true };

function fakeHost(supported: boolean, voices: VoiceInfo[]) {
  const listeners = new Set<() => void>();
  const speaks: { voiceId: string; lang: string; text: string }[] = [];
  const state = { voices };
  const host: SpeechHost = {
    supported,
    voices: () => state.voices,
    onVoicesChanged(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    speak(req) {
      speaks.push(req);
    },
    cancel() {},
  };
  return {
    host,
    speaks,
    setVoices(v: VoiceInfo[]) {
      state.voices = v;
      for (const fn of [...listeners]) fn();
    },
  };
}

const make = (host: SpeechHost, language = hi) =>
  createSpeechController({ host, language: () => language, buildText: (k) => `t:${k}` });

describe('speech controller', () => {
  it('voices arriving late turn the missing line into the button', () => {
    const f = fakeHost(true, []);
    const ctl = make(f.host);
    expect(ctl.snapshot().block).toBe('missing');
    expect(ctl.snapshot().available).toBe(false);
    const seen: string[] = [];
    ctl.subscribe((ui) => seen.push(ui.block));
    f.setVoices([hiVoice]);
    expect(ctl.snapshot().block).toBe('button');
    expect(ctl.snapshot().showHelp).toBe(true);
    expect(seen).toEqual(['button']);
  });

  it('an unsupported host gives none', () => {
    const ctl = make(fakeHost(false, [hiVoice]).host);
    expect(ctl.snapshot().block).toBe('none');
    expect(ctl.snapshot().available).toBe(false);
  });

  it('Hindi with no local voice gives missing, English gives none', () => {
    const remote = { ...hiVoice, localService: false };
    expect(make(fakeHost(true, [remote, enVoice]).host, hi).snapshot().block).toBe('missing');
    expect(make(fakeHost(true, []).host, en).snapshot().block).toBe('none');
    expect(make(fakeHost(true, [enVoice]).host, en).snapshot().block).toBe('button');
    expect(make(fakeHost(true, [enVoice]).host, en).snapshot().showHelp).toBe(false);
  });

  it('sets speakingKey while speaking and uses the voice id and lang', () => {
    const f = fakeHost(true, [hiVoice]);
    const ctl = make(f.host);
    ctl.tap('k1');
    expect(ctl.snapshot().speakingKey).toBe('k1');
    expect(f.speaks).toEqual([{ text: 't:k1', voiceId: 'v-hi', lang: 'hi-IN' }]);
    ctl.stop();
    expect(ctl.snapshot().speakingKey).toBeNull();
  });

  it('knows the catalog languages', () => {
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(2);
  });
});
