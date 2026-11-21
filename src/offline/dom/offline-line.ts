// Writes the Offline_Line text into #offline-line.
import { INITIAL_LINE_STATE, reduceOfflineLine } from '../line-state.ts';
import type { OfflineEvent, OfflineLineState } from '../line-state.ts';
import type { Strings } from '../../broadcast/strings.types.ts';
import { stringsEn } from '../../broadcast/strings.en.ts';
import { OFFLINE_IDS } from './ids.ts';
import { watchSavedCopy } from './saved-copy.ts';

export function createOfflineLine(doc: Document, strings: Strings): { apply(event: OfflineEvent): void } {
  let state: OfflineLineState = INITIAL_LINE_STATE;
  const write = (): void => {
    const el = doc.getElementById(OFFLINE_IDS.line);
    if (!el) return;
    el.textContent = state === 'saved' ? strings.text['offline.saved'] : strings.text['offline.unsaved'];
  };
  write(); // unsaved text until a probe says otherwise (also under the dev server)
  return {
    apply(event: OfflineEvent): void {
      state = reduceOfflineLine(state, event);
      write();
    },
  };
}

/** Shows the line and keeps it current. Safe when the element is missing. */
export function connectOfflineLine(doc: Document = document, strings: Strings = stringsEn): void {
  try {
    const line = createOfflineLine(doc, strings);
    watchSavedCopy(import.meta.env.BASE_URL, (event) => line.apply(event));
  } catch {
    // the line is optional
  }
}
