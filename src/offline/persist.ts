// Persistence request on the first press. Pure logic: storage, Home Screen check and note output
// are injected. Nothing here touches a browser global or localStorage.
import { storageNoteVisible } from './storage-note.ts';

export interface StorageLike {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

export interface PersistDeps {
  storage: StorageLike | undefined;
  homeScreen: () => boolean;
  showNote: (visible: boolean) => void;
}

export interface PersistController {
  firstPress(): void;
}

export function createPersistController(deps: PersistDeps): PersistController {
  let seenFirstPress = false; // in memory only, lost on reload

  const readPersisted = async (): Promise<boolean> => {
    try {
      const fn = deps.storage?.persisted;
      if (typeof fn !== 'function') return false;
      return (await fn.call(deps.storage)) === true;
    } catch {
      return false;
    }
  };

  const homeScreen = (): boolean => {
    try {
      return deps.homeScreen() === true;
    } catch {
      return false;
    }
  };

  const show = (persisted: boolean): void => {
    try {
      deps.showNote(storageNoteVisible({ firstPress: true, persisted, homeScreen: homeScreen() }));
    } catch {
      // a failing note writer must not reach the press
    }
  };

  const task = async (): Promise<void> => {
    if (await readPersisted()) {
      show(true);
      return;
    }
    show(false);
    try {
      const fn = deps.storage?.persist;
      if (typeof fn === 'function') await fn.call(deps.storage);
    } catch {
      // a refusal, a throw or a rejection all mean "not persistent"
    }
    show(await readPersisted());
  };

  return {
    firstPress(): void {
      if (seenFirstPress) return;
      seenFirstPress = true;
      try {
        task().catch(() => {});
      } catch {
        // never throws out of a press
      }
    },
  };
}
