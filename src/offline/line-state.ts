// Offline_Line state. Pure: no browser API.
export type OfflineLineState = 'unsaved' | 'saved';

export type OfflineEvent =
  | { type: 'copy-found' } // a probe found a complete saved copy
  | { type: 'copy-missing' } // a probe found no complete copy
  | { type: 'unsupported' } // no service worker, no Cache Storage, or dev server
  | { type: 'update-downloading' } // a new worker is installing
  | { type: 'update-failed' } // a new worker failed
  | { type: 'update-done' }; // a new worker finished install

export const INITIAL_LINE_STATE: OfflineLineState = 'unsaved';

/** The line follows the last copy probe event. Update events never change it. */
export function reduceOfflineLine(state: OfflineLineState, event: OfflineEvent): OfflineLineState {
  switch (event.type) {
    case 'copy-found':
      return 'saved';
    case 'copy-missing':
    case 'unsupported':
      return 'unsaved';
    default:
      return state;
  }
}
