// Pure cache-name helpers. No browser API.

export const CACHE_PREFIX = 'dead-air-offline-';

export const cacheNameFor = (version: string): string => CACHE_PREFIX + version;

export const markerPathFor = (base: string): string => base + 'offline-saved';

/** Names of Dead Air caches that are not the current one. Never a foreign cache, never the current one. */
export function selectCachesToDelete(names: readonly string[], currentVersion: string): string[] {
  const current = cacheNameFor(currentVersion);
  return names.filter((n) => n.startsWith(CACHE_PREFIX) && n !== current);
}
