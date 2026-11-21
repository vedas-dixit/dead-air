// Pure Completion_Marker helpers. No browser API.
import { CACHE_PREFIX } from './caches.ts';

export interface MarkerData {
  version: string;
  base: string;
  files: string[];
}

/** JSON with no spaces, keys in the order version, base, files. */
export function makeMarkerText(data: MarkerData): string {
  return JSON.stringify({ version: data.version, base: data.base, files: data.files });
}

/** Returns null for missing text, bad JSON, or a wrong shape. */
export function parseMarker(text: string | null): MarkerData | null {
  if (text === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const { version, base, files } = rec;
  if (typeof version !== 'string' || typeof base !== 'string' || !Array.isArray(files)) return null;
  const list: string[] = [];
  for (const f of files as unknown[]) {
    if (typeof f !== 'string') return null;
    list.push(f);
  }
  return { version, base, files: list };
}

export interface SavedInput {
  cacheName: string;
  markerText: string | null;
  presentUrls: readonly string[];
  origin: string;
  base: string;
}

/**
 * 'saved' only if the marker parses, its version equals the cache name's version, its base equals base,
 * its list is non-empty, and every listed path is present as origin + base + path.
 */
export function chooseSavedState(input: SavedInput): 'saved' | 'unsaved' {
  const marker = parseMarker(input.markerText);
  if (marker === null) return 'unsaved';
  if (!input.cacheName.startsWith(CACHE_PREFIX)) return 'unsaved';
  if (input.cacheName.slice(CACHE_PREFIX.length) !== marker.version) return 'unsaved';
  if (marker.base !== input.base) return 'unsaved';
  if (marker.files.length === 0) return 'unsaved';
  const present = new Set(input.presentUrls);
  for (const path of marker.files) {
    if (!present.has(input.origin + input.base + path)) return 'unsaved';
  }
  return 'saved';
}
