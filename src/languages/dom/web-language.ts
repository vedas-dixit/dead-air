import type { LanguageEntry } from '../catalog';
import { createLanguageState, type LanguageState } from '../language-state';
import { LANGUAGE_STORAGE_KEY, type LanguageStorage } from '../language-store';
import { setPageLanguage } from '../page-language';

function createWebLanguageStorage(): LanguageStorage {
  return {
    read(): string | null {
      try {
        return localStorage.getItem(LANGUAGE_STORAGE_KEY);
      } catch {
        return null;
      }
    },
    write(code: string): boolean {
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
        return true;
      } catch {
        return false;
      }
    },
  };
}

function deviceTags(): readonly unknown[] {
  const list = navigator.languages;
  if (Array.isArray(list) && list.length > 0) return list;
  if (list && list.length > 0) return Array.from(list);
  return [navigator.language];
}

/** Builds the language state from storage and the device, and shares it with the page. */
export function createWebLanguageState(): LanguageState {
  const state = createLanguageState({ storage: createWebLanguageStorage(), deviceTags });
  setPageLanguage(state);
  return state;
}

export function applyDocumentLanguage(doc: Document, entry: LanguageEntry): void {
  doc.documentElement.lang = entry.code;
}
