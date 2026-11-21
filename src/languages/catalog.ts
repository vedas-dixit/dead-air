import { stringsEn } from '../broadcast/strings.en';
import type { Strings } from '../broadcast/strings.types';
import { stringsHi } from './strings.hi';

export interface LanguageEntry {
  /** Language code, for example 'en'. Also the stored value and the `lang` attribute. */
  readonly code: string;
  /** The language's own name, for example 'English'. */
  readonly name: string;
  /** BCP 47 tag used to pick a speech voice. */
  readonly speechTag: string;
  readonly strings: Strings;
}

export const LANGUAGES: readonly LanguageEntry[] = [
  { code: 'en', name: 'English', speechTag: 'en', strings: stringsEn },
  { code: 'hi', name: 'हिन्दी', speechTag: 'hi', strings: stringsHi },
];

export const DEFAULT_LANGUAGE_CODE = 'en';

/** Exact match on `code`. Returns null when none matches. */
export function findLanguage(
  code: string,
  catalog: readonly LanguageEntry[] = LANGUAGES,
): LanguageEntry | null {
  return catalog.find((entry) => entry.code === code) ?? null;
}
