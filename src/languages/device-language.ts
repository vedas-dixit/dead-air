import { LANGUAGES, type LanguageEntry } from './catalog';
import { sameLanguage } from './tags';

/**
 * First catalog entry matching a device language tag by primary subtag, or null.
 * Tags are taken in order; non-string entries are skipped.
 */
export function pickDeviceLanguage(
  tags: readonly unknown[],
  catalog: readonly LanguageEntry[] = LANGUAGES,
): LanguageEntry | null {
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const hit = catalog.find((entry) => sameLanguage(entry.code, tag));
    if (hit) return hit;
  }
  return null;
}
