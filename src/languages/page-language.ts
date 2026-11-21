import type { LanguageState } from './language-state';

// Type-only import: the front page bundle must not pull in the Hindi file.
let pageLanguage: LanguageState | null = null;

/** Called by both page mounts so the Offline_Line shares the same state. */
export function setPageLanguage(state: LanguageState): void {
  pageLanguage = state;
}

export function getPageLanguage(): LanguageState | null {
  return pageLanguage;
}
