import { DEFAULT_LANGUAGE_CODE, LANGUAGES, type LanguageEntry } from './catalog';
import { pickDeviceLanguage } from './device-language';
import { parseStoredLanguage, type LanguageStorage } from './language-store';

export interface LanguageState {
  current(): LanguageEntry;
  /** False when `code` is not in the catalog; nothing changes then. */
  set(code: string): boolean;
  /** Returns a function that removes the subscriber. */
  subscribe(fn: (entry: LanguageEntry) => void): () => void;
}

export function createLanguageState(deps: {
  catalog?: readonly LanguageEntry[];
  storage: LanguageStorage;
  deviceTags: () => readonly unknown[];
}): LanguageState {
  const catalog = deps.catalog ?? LANGUAGES;
  const { storage, deviceTags } = deps;

  let stored: unknown = null;
  try {
    stored = storage.read();
  } catch {
    stored = null;
  }

  let tags: readonly unknown[] = [];
  try {
    tags = deviceTags();
  } catch {
    tags = [];
  }

  let currentEntry: LanguageEntry =
    parseStoredLanguage(stored, catalog) ??
    pickDeviceLanguage(tags, catalog) ??
    catalog.find((entry) => entry.code === DEFAULT_LANGUAGE_CODE) ??
    catalog[0];

  const subscribers = new Set<(entry: LanguageEntry) => void>();

  return {
    current: () => currentEntry,
    set(code: string): boolean {
      const entry = catalog.find((e) => e.code === code);
      if (!entry) return false;
      currentEntry = entry;
      try {
        storage.write(entry.code);
      } catch {
        // A failed write keeps the language for the life of the page.
      }
      for (const fn of [...subscribers]) fn(entry);
      return true;
    },
    subscribe(fn: (entry: LanguageEntry) => void): () => void {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
}
