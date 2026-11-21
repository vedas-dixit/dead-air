// StorageProvider around localStorage for the Listen history. Never throws.

import { HISTORY_STORAGE_KEY } from '../history-store';
import type { StorageProvider } from '../providers';

function getStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function createStorageProvider(): StorageProvider {
  return {
    get available(): boolean {
      const s = getStorage();
      if (!s) return false;
      try {
        s.getItem(HISTORY_STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    },

    read(): string | null {
      try {
        return getStorage()?.getItem(HISTORY_STORAGE_KEY) ?? null;
      } catch {
        return null;
      }
    },

    write(text: string): boolean {
      try {
        const s = getStorage();
        if (!s) return false;
        s.setItem(HISTORY_STORAGE_KEY, text);
        return true;
      } catch {
        return false;
      }
    },

    remove(): boolean {
      try {
        const s = getStorage();
        if (!s) return false;
        s.removeItem(HISTORY_STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    },
  };
}
