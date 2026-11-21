// Service worker entry: wires real browser objects into the handlers.
import { createWorkerHandlers } from './handlers.ts';
import type { CacheLike, CacheStorageLike } from './handlers.ts';

declare const __OFFLINE_CONFIG__: { version: string; base: string; files: string[] };

const sw = self as unknown as ServiceWorkerGlobalScope;

function wrapCache(cache: Cache): CacheLike<Response> {
  return {
    put: (url, response) => cache.put(url, response),
    match: (url) => cache.match(url),
    keys: async () => (await cache.keys()).map((request) => request.url),
  };
}

const cacheStorage: CacheStorageLike<Response> = {
  open: async (name) => wrapCache(await sw.caches.open(name)),
  has: (name) => sw.caches.has(name),
  delete: (name) => sw.caches.delete(name),
  keys: () => sw.caches.keys(),
};

const handlers = createWorkerHandlers<Response>({
  caches: cacheStorage,
  fetchFresh: (url, init) => fetch(url, init),
  fetchNetwork: (request) => fetch(request as Request),
  makeMarker: (json) =>
    new Response(json, { headers: { 'content-type': 'application/json' } }),
  readText: (response) => response.text(),
  origin: sw.location.origin,
  config: __OFFLINE_CONFIG__,
});

sw.addEventListener('install', (event) => {
  event.waitUntil(handlers.install());
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(handlers.activate());
});

sw.addEventListener('fetch', (event) => {
  // handleFetch decides synchronously: null means the network handles it.
  const answer = handlers.handleFetch(
    { url: event.request.url, method: event.request.method },
    event.request,
  );
  if (answer !== null) event.respondWith(answer);
});
