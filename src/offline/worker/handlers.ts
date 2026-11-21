// Service worker decisions over injected dependencies. No browser global is used here.
import { cacheNameFor, markerPathFor, selectCachesToDelete } from '../caches.ts';
import { chooseSavedState, makeMarkerText } from '../marker.ts';
import { joinBase } from '../paths.ts';
import { routeRequest } from '../route.ts';

export interface OfflineConfig {
  version: string;
  base: string;
  files: readonly string[];
}

export interface ResponseLike {
  ok: boolean;
  type?: string;
  redirected?: boolean;
}

export interface CacheLike<R extends ResponseLike> {
  put(url: string, response: R): Promise<void>;
  match(url: string): Promise<R | undefined>;
  keys(): Promise<string[]>;
}

export interface CacheStorageLike<R extends ResponseLike> {
  open(name: string): Promise<CacheLike<R>>;
  has(name: string): Promise<boolean>;
  delete(name: string): Promise<boolean>;
  keys(): Promise<string[]>;
}

export interface WorkerDeps<R extends ResponseLike> {
  caches: CacheStorageLike<R>;
  fetchFresh(url: string, init: { cache: 'reload' }): Promise<R>;
  fetchNetwork(request: unknown): Promise<R>;
  makeMarker(json: string): R;
  readText(response: R): Promise<string>;
  origin: string;
  config: OfflineConfig;
}

export interface WorkerHandlers<R extends ResponseLike> {
  install(): Promise<void>;
  activate(): Promise<void>;
  handleFetch(request: { url: string; method: string }, raw: unknown): Promise<R> | null;
}

export function createWorkerHandlers<R extends ResponseLike>(deps: WorkerDeps<R>): WorkerHandlers<R> {
  const { caches, origin, config } = deps;
  const { version, base, files } = config;
  const name = cacheNameFor(version);
  const urlFor = (path: string): string => origin + joinBase(base, path);
  const markerUrl = origin + markerPathFor(base);

  async function isComplete(): Promise<boolean> {
    try {
      if (!(await caches.has(name))) return false;
      const cache = await caches.open(name);
      const marker = await cache.match(markerUrl);
      const markerText = marker ? await deps.readText(marker) : null;
      return (
        chooseSavedState({
          cacheName: name,
          markerText,
          presentUrls: await cache.keys(),
          origin,
          base,
        }) === 'saved'
      );
    } catch {
      return false;
    }
  }

  async function install(): Promise<void> {
    if (await isComplete()) return;
    try {
      if (await caches.has(name)) await caches.delete(name);
      const cache = await caches.open(name);
      for (const path of files) {
        const url = urlFor(path);
        const res = await deps.fetchFresh(url, { cache: 'reload' });
        if (!res.ok || res.type !== 'basic' || res.redirected === true) {
          throw new Error(`offline install: bad response for ${path}`);
        }
        await cache.put(url, res);
      }
      const present = new Set(await cache.keys());
      for (const path of files) {
        if (!present.has(urlFor(path))) throw new Error(`offline install: ${path} missing after save`);
      }
      await cache.put(markerUrl, deps.makeMarker(makeMarkerText({ version, base, files: [...files] })));
    } catch (err) {
      try {
        await caches.delete(name);
      } catch {
        // keep the original error
      }
      throw err;
    }
  }

  async function activate(): Promise<void> {
    for (const old of selectCachesToDelete(await caches.keys(), version)) {
      await caches.delete(old);
    }
  }

  function handleFetch(request: { url: string; method: string }, raw: unknown): Promise<R> | null {
    const route = routeRequest(request, { origin, base, files });
    if (route.action === 'network') return null;
    return (async () => {
      try {
        const cache = await caches.open(name);
        const hit = await cache.match(urlFor(route.path));
        if (hit) return hit;
      } catch {
        // fall through to the network
      }
      return deps.fetchNetwork(raw);
    })();
  }

  return { install, activate, handleFetch };
}
