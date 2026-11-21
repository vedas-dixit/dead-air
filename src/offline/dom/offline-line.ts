// Writes the Offline_Line text into #offline-line.
import { INITIAL_LINE_STATE, reduceOfflineLine } from '../line-state.ts';
import type { OfflineEvent, OfflineLineState } from '../line-state.ts';
import type { Strings } from '../../broadcast/strings.types.ts';
import { stringsEn } from '../../broadcast/strings.en.ts';
import { OFFLINE_IDS } from './ids.ts';
import { getPageLanguage } from '../../languages/page-language.ts';
import { watchSavedCopy } from './saved-copy.ts';

export function createOfflineLine(doc: Document, strings: Strings): { apply(event: OfflineEvent): void; setStrings(next: Strings): void } {
  let current = strings;
  let state: OfflineLineState = INITIAL_LINE_STATE;
  const write = (): void => {
    const el = doc.getElementById(OFFLINE_IDS.line);
    if (!el) return;
    el.textContent = state === 'saved' ? current.text['offline.saved'] : current.text['offline.unsaved'];
  };
  write(); // unsaved text until a probe says otherwise (also under the dev server)
  return {
    apply(event: OfflineEvent): void {
      state = reduceOfflineLine(state, event);
      write();
    },
    setStrings(next: Strings): void {
      current = next;
      write();
    },
  };
}

/** Shows the line and keeps it current. Safe when the element is missing. */
export function connectOfflineLine(doc: Document = document, strings?: Strings): void {
  try {
    const language = getPageLanguage();
    const line = createOfflineLine(doc, strings ?? language?.current().strings ?? stringsEn);
    if (!strings) language?.subscribe((entry) => line.setStrings(entry.strings));
    watchSavedCopy(import.meta.env.BASE_URL, (event) => line.apply(event));
  } catch {
    // the line is optional
  }
}
