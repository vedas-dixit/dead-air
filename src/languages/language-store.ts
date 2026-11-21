import { LANGUAGES, type LanguageEntry } from './catalog';

/** The one key the chosen language is stored under. The value is the plain code, for example 'hi'. */
export const LANGUAGE_STORAGE_KEY = 'dead-air.language.v1';

/** Where the chosen language code is kept. Neither method throws. */
export interface LanguageStorage {
  /** The stored value, or null when nothing is stored or storage is unavailable. */
  read(): string | null;
  /** True when the code was stored. False on any failure. */
  write(code: string): boolean;
}

/**
 * Returns the catalog entry whose `code` equals `raw` exactly (no trimming,
 * no case folding). Anything else, including null, gives null.
 */
export function parseStoredLanguage(
  raw: unknown,
  catalog: readonly LanguageEntry[] = LANGUAGES,
): LanguageEntry | null {
  if (typeof raw !== 'string') return null;
  return catalog.find((entry) => entry.code === raw) ?? null;
}
