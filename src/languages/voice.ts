import { sameLanguage } from './tags';

/** The parts of a speech synthesis voice that the app needs. */
export interface VoiceInfo {
  readonly id: string;
  readonly name: string;
  readonly lang: string;
  readonly localService: boolean;
  readonly isDefault: boolean;
}

/**
 * Picks an on-device voice for the speech tag. Only voices with
 * `localService === true` and the same primary language are considered.
 * A default voice wins, otherwise the first in list order. Null when none match.
 */
export function pickLocalVoice(
  voices: readonly VoiceInfo[],
  speechTag: string,
): VoiceInfo | null {
  const matches = voices.filter(
    (v) => v.localService === true && sameLanguage(v.lang, speechTag),
  );
  return matches.find((v) => v.isDefault) ?? matches[0] ?? null;
}
