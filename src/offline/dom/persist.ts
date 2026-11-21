// Browser wiring for the persistence request and the Storage_Note.
import { createPersistController } from '../persist.ts';
import type { PersistController } from '../persist.ts';
import { isHomeScreenMode } from '../storage-note.ts';
import type { Strings } from '../../broadcast/strings.types.ts';
import { OFFLINE_IDS } from './ids.ts';

export function createPersistence(doc: Document, strings: Strings): PersistController {
  return createPersistController({
    storage: typeof navigator !== 'undefined' ? navigator.storage : undefined,
    homeScreen: () =>
      isHomeScreenMode({
        displayStandalone:
          typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches === true,
        navigatorStandalone: (navigator as Navigator & { standalone?: boolean }).standalone,
      }),
    showNote: (visible) => {
      const el = doc.getElementById(OFFLINE_IDS.storageNote);
      if (!el) return;
      el.textContent = strings.text['offline.storageNote'];
      el.hidden = !visible;
    },
  });
}
