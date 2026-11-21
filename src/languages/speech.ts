import { DEFAULT_LANGUAGE_CODE, type LanguageEntry } from './catalog';
import { pickLocalVoice, type VoiceInfo } from './voice';

export interface SpeechHost {
  readonly supported: boolean;
  voices(): readonly VoiceInfo[];
  onVoicesChanged(fn: () => void): () => void;
  speak(
    req: { text: string; voiceId: string; lang: string },
    cb: { onEnd(): void; onError(): void },
  ): void;
  cancel(): void;
}

export type VoiceBlock = 'button' | 'missing' | 'none';

export function voiceBlockFor(i: {
  supported: boolean;
  hasLocalVoice: boolean;
  languageCode: string;
}): VoiceBlock {
  if (!i.supported) return 'none';
  if (i.hasLocalVoice) return 'button';
  return i.languageCode !== DEFAULT_LANGUAGE_CODE ? 'missing' : 'none';
}

export interface SpeechUi {
  /** Which one voice block every card shows. */
  block: VoiceBlock;
  /** A Local_Voice exists for the Chosen_Language. */
  available: boolean;
  /** block is 'button' and the Chosen_Language is not English. */
  showHelp: boolean;
  /** Alert_Key of the card being read. */
  speakingKey: string | null;
  /** Alert_Key whose last speech failed. */
  errorKey: string | null;
}

export interface SpeechController {
  refresh(): void;
  languageChanged(): void;
  tap(alertKey: string): void;
  stop(): void;
  snapshot(): SpeechUi;
  subscribe(fn: (ui: SpeechUi) => void): () => void;
  dispose(): void;
}

export function createSpeechController(deps: {
  host: SpeechHost;
  language: () => LanguageEntry;
  buildText: (alertKey: string) => string | null;
}): SpeechController {
  const { host, language, buildText } = deps;

  let available = false;
  let block: VoiceBlock = 'none';
  let showHelp = false;
  let speakingKey: string | null = null;
  let errorKey: string | null = null;
  let token = 0;
  let disposed = false;
  const subscribers = new Set<(ui: SpeechUi) => void>();

  const snapshot = (): SpeechUi => ({ block, available, showHelp, speakingKey, errorKey });

  const notify = (): void => {
    const ui = snapshot();
    for (const fn of [...subscribers]) fn(ui);
  };

  const sameUi = (a: SpeechUi, b: SpeechUi): boolean =>
    a.block === b.block &&
    a.available === b.available &&
    a.showHelp === b.showHelp &&
    a.speakingKey === b.speakingKey &&
    a.errorKey === b.errorKey;

  /** Runs a change and notifies once if anything visible changed. */
  const change = (fn: () => void): void => {
    const before = snapshot();
    fn();
    if (!sameUi(before, snapshot())) notify();
  };

  const stopInner = (): void => {
    if (speakingKey === null) return;
    token += 1; // late events from the canceled speech are stale
    speakingKey = null;
    try {
      host.cancel();
    } catch {
      // Nothing more to do; the speech is already dropped from our state.
    }
  };

  const refreshInner = (): void => {
    let voices: readonly VoiceInfo[] = [];
    if (host.supported) {
      try {
        voices = host.voices();
      } catch {
        voices = [];
      }
    }
    const code = language().code;
    available = host.supported && pickLocalVoice(voices, language().speechTag) !== null;
    block = voiceBlockFor({ supported: host.supported, hasLocalVoice: available, languageCode: code });
    showHelp = block === 'button' && code !== DEFAULT_LANGUAGE_CODE;
    if (!available) stopInner();
  };

  const unsubscribeVoices = host.onVoicesChanged(() => {
    if (!disposed) change(refreshInner);
  });

  refreshInner();

  return {
    refresh: () => change(refreshInner),
    languageChanged: () =>
      change(() => {
        stopInner();
        errorKey = null;
        refreshInner();
      }),
    tap(alertKey: string): void {
      change(() => {
        if (speakingKey === alertKey) {
          stopInner();
          return;
        }
        stopInner();
        errorKey = null;
        let text: string | null = null;
        let voice: VoiceInfo | null = null;
        try {
          text = buildText(alertKey);
          voice = host.supported ? pickLocalVoice(host.voices(), language().speechTag) : null;
        } catch {
          text = null;
        }
        if (text === null || voice === null) {
          errorKey = alertKey;
          return;
        }
        token += 1;
        const mine = token;
        speakingKey = alertKey;
        try {
          host.speak(
            { text, voiceId: voice.id, lang: voice.lang },
            {
              onEnd: () => {
                if (mine !== token) return;
                change(() => {
                  speakingKey = null;
                });
              },
              onError: () => {
                if (mine !== token) return;
                change(() => {
                  speakingKey = null;
                  errorKey = alertKey;
                });
              },
            },
          );
        } catch {
          if (mine === token) {
            token += 1;
            speakingKey = null;
            errorKey = alertKey;
          }
        }
      });
    },
    stop: () => change(stopInner),
    snapshot,
    subscribe(fn: (ui: SpeechUi) => void): () => void {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      stopInner();
      unsubscribeVoices();
      subscribers.clear();
    },
  };
}
