// WakeLockProvider around navigator.wakeLock for the Listen page. No network.

import type { WakeLockHandle, WakeLockProvider } from '../../broadcast/providers';

export function createWakeLockProvider(): WakeLockProvider {
  const api = (): WakeLock | undefined =>
    typeof navigator !== 'undefined' && 'wakeLock' in navigator ? navigator.wakeLock : undefined;

  return {
    get supported(): boolean {
      return api() !== undefined;
    },

    async request(): Promise<WakeLockHandle | null> {
      const wl = api();
      if (!wl) return null;
      try {
        const sentinel = await wl.request('screen');
        return {
          release: async () => {
            try {
              await sentinel.release();
            } catch {
              // already released
            }
          },
          onRelease: (cb) => sentinel.addEventListener('release', () => cb()),
        };
      } catch {
        return null;
      }
    },
  };
}
