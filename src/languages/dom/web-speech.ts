import type { SpeechHost } from '../speech';
import type { VoiceInfo } from '../voice';

/** Speech is read on the device only. Nothing here sends text anywhere. */
export function createWebSpeechHost(win: Window = window): SpeechHost {
  const synth: SpeechSynthesis | undefined = (win as { speechSynthesis?: SpeechSynthesis })
    .speechSynthesis;
  const Utterance = (win as { SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance })
    .SpeechSynthesisUtterance;
  const supported = !!synth && typeof Utterance === 'function';

  const byId = new Map<string, SpeechSynthesisVoice>();
  /** Keeps utterances alive until end or error (some browsers drop them early). */
  const live = new Set<SpeechSynthesisUtterance>();

  return {
    supported,

    voices(): readonly VoiceInfo[] {
      if (!synth) return [];
      byId.clear();
      const out: VoiceInfo[] = [];
      for (const v of synth.getVoices()) {
        if (!byId.has(v.voiceURI)) byId.set(v.voiceURI, v);
        out.push({
          id: v.voiceURI,
          name: v.name,
          lang: v.lang,
          localService: v.localService,
          isDefault: v.default,
        });
      }
      return out;
    },

    onVoicesChanged(fn: () => void): () => void {
      if (!synth) return () => {};
      synth.addEventListener('voiceschanged', fn);
      return () => synth.removeEventListener('voiceschanged', fn);
    },

    speak(req, cb): void {
      if (!synth || typeof Utterance !== 'function') throw new Error('speech unsupported');
      const u = new Utterance(req.text);
      const voice = byId.get(req.voiceId) ?? synth.getVoices().find((v) => v.voiceURI === req.voiceId);
      if (voice) u.voice = voice;
      u.lang = req.lang;
      live.add(u);
      u.onend = () => {
        live.delete(u);
        cb.onEnd();
      };
      u.onerror = () => {
        live.delete(u);
        cb.onError();
      };
      synth.speak(u);
    },

    cancel(): void {
      synth?.cancel();
    },
  };
}
