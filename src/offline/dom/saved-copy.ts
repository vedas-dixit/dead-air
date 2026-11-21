// Finds out whether a complete saved copy exists, and follows worker updates. Works offline.
// Reads only Cache Storage and service worker events. No network request.
import { CACHE_PREFIX, markerPathFor } from '../caches.ts';
import { chooseSavedState } from '../marker.ts';
import type { OfflineEvent } from '../line-state.ts';

export type CopyState = 'saved' | 'unsaved' | 'unsupported';

/** 'unsupported' when there is no Cache Storage. 'saved' when any Dead Air cache is complete. */
export async function probeSavedCopy(base: string): Promise<CopyState> {
  try {
    if (typeof caches === 'undefined') return 'unsupported';
    const origin = location.origin;
    const names = (await caches.keys()).filter((n) => n.startsWith(CACHE_PREFIX));
    for (const name of names) {
      try {
        const cache = await caches.open(name);
        const response = await cache.match(new URL(markerPathFor(base), origin).href);
        const markerText = response ? await response.text() : null;
        const presentUrls = (await cache.keys()).map((r) => r.url);
        if (chooseSavedState({ cacheName: name, markerText, presentUrls, origin, base }) === 'saved') {
          return 'saved';
        }
      } catch {
        // try the next cache
      }
    }
    return 'unsaved';
  } catch {
    return 'unsaved';
  }
}

/** Emits events now and on every worker change. Returns a function that stops listening. */
export function watchSavedCopy(base: string, emit: (event: OfflineEvent) => void): () => void {
  let stopped = false;
  const cleanups: Array<() => void> = [];
  const safeEmit = (event: OfflineEvent): void => {
    if (stopped) return;
    try {
      emit(event);
    } catch {
      // a failing listener must not break the watcher
    }
  };
  const probe = (): void => {
    probeSavedCopy(base)
      .then((state) => {
        if (state === 'saved') safeEmit({ type: 'copy-found' });
        else if (state === 'unsaved') safeEmit({ type: 'copy-missing' });
        else safeEmit({ type: 'unsupported' });
      })
      .catch(() => safeEmit({ type: 'copy-missing' }));
  };
  const listen = (target: EventTarget, type: string, fn: () => void): void => {
    target.addEventListener(type, fn);
    cleanups.push(() => target.removeEventListener(type, fn));
  };
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !import.meta.env.PROD) {
      safeEmit({ type: 'unsupported' });
      return () => {
        stopped = true;
      };
    }
    const container = navigator.serviceWorker;
    probe();
    listen(container, 'controllerchange', probe);
    const follow = (registration: ServiceWorkerRegistration): void => {
      const track = (): void => {
        const worker = registration.installing;
        if (!worker) return;
        safeEmit({ type: 'update-downloading' });
        listen(worker, 'statechange', () => {
          if (worker.state === 'installed' || worker.state === 'activated') {
            safeEmit({ type: 'update-done' });
            probe();
          } else if (worker.state === 'redundant') {
            safeEmit({ type: 'update-failed' });
            probe();
          }
        });
      };
      listen(registration, 'updatefound', track);
      track();
    };
    container
      .getRegistration()
      .then((registration) => {
        if (registration && !stopped) follow(registration);
      })
      .catch(() => {});
    // The first registration happens at window load; follow it when it appears.
    container.ready.then((registration) => (stopped ? undefined : (probe(), follow(registration)))).catch(() => {});
  } catch {
    safeEmit({ type: 'unsupported' });
  }
  return () => {
    stopped = true;
    for (const fn of cleanups) fn();
  };
}
