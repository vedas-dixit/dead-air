// fast-check generators for the offline property tests. Standalone: they import only fast-check
// and types from fakes.ts, so they work before the modules under test exist.
import * as fc from 'fast-check';
import type { PersistBehaviour, PersistedBehaviour, StorageBehaviour } from './fakes';

const segmentArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,7}$/);

/** A valid Base: "/" or "/seg/" or "/seg/seg/". */
export const baseArb: fc.Arbitrary<string> = fc.oneof(
  { weight: 2, arbitrary: fc.constant('/') },
  { weight: 3, arbitrary: fc.array(segmentArb, { minLength: 1, maxLength: 3 }).map((s) => `/${s.join('/')}/`) },
);

export const ORIGIN = 'https://deadair.example';
export const OTHER_ORIGINS: readonly string[] = [
  'https://other.example',
  'http://deadair.example',
  'https://deadair.example:8443',
  'https://cdn.example.org',
];

const pathPartArb = fc.array(fc.stringMatching(/^[a-z0-9._-]{1,8}$/), { minLength: 0, maxLength: 4 });
const queryArb = fc.oneof(fc.constant(''), fc.stringMatching(/^\?[a-z0-9=&]{0,10}$/));
const fragmentArb = fc.oneof(fc.constant(''), fc.stringMatching(/^#[a-z0-9]{0,8}$/));

/**
 * An absolute URL for any origin (same or other), any path (inside the base or not),
 * with or without a trailing slash, query and fragment.
 * Pass the base so about half of the paths start with it.
 */
export function urlArb(base: string = '/'): fc.Arbitrary<string> {
  return fc
    .record({
      origin: fc.oneof({ weight: 3, arbitrary: fc.constant(ORIGIN) }, fc.constantFrom(...OTHER_ORIGINS)),
      inside: fc.boolean(),
      parts: pathPartArb,
      slash: fc.boolean(),
      query: queryArb,
      fragment: fragmentArb,
    })
    .map(({ origin, inside, parts, slash, query, fragment }) => {
      const rel = parts.join('/') + (slash && parts.length > 0 ? '/' : '');
      const path = inside ? base + rel : '/' + rel;
      return origin + path + query + fragment;
    });
}

/** The Site_Version shape: 16 lowercase hex characters. */
export const versionArb: fc.Arbitrary<string> = fc.stringMatching(/^[0-9a-f]{16}$/);

/** A list of cache names: Dead Air names, foreign names, and names that only contain the prefix. */
export const cacheNamesArb: fc.Arbitrary<string[]> = fc.array(
  fc.oneof(
    versionArb.map((v) => `dead-air-offline-${v}`),
    fc.stringMatching(/^[a-z0-9-]{1,20}$/),
    fc.stringMatching(/^[a-z0-9]{1,6}$/).map((s) => `${s}-dead-air-offline-${s}`),
    fc.constantFrom('dead-air-offline-', 'dead-air-offline', 'workbox-precache', 'Dead-Air-Offline-x'),
  ),
  { maxLength: 12 },
);

export type MarkerKind = 'valid' | 'otherVersion' | 'otherBase' | 'emptyList' | 'notJson' | 'wrongShape' | 'absent';

export interface MarkerCase {
  kind: MarkerKind;
  /** Version in the cache name (cache name is dead-air-offline-<cacheVersion>). */
  cacheVersion: string;
  /** The page base. */
  base: string;
  /** Paths the marker lists (relative to base). For emptyList the text lists none. */
  files: string[];
  /** Marker body, or null when the marker entry is absent. */
  text: string | null;
}

const filePathArb = fc
  .array(fc.stringMatching(/^[a-z0-9-]{1,8}$/), { minLength: 1, maxLength: 3 })
  .map((s) => s.join('/') + '.js');

/** Marker bodies of every kind that chooseSavedState has to tell apart. */
export const markerArb: fc.Arbitrary<MarkerCase> = fc
  .record({
    kind: fc.constantFrom<MarkerKind>('valid', 'valid', 'otherVersion', 'otherBase', 'emptyList', 'notJson', 'wrongShape', 'absent'),
    cacheVersion: versionArb,
    otherVersion: versionArb,
    base: baseArb,
    otherBase: baseArb,
    files: fc.uniqueArray(filePathArb, { minLength: 1, maxLength: 8 }),
  })
  .map(({ kind, cacheVersion, otherVersion, base, otherBase, files }): MarkerCase => {
    const version = otherVersion === cacheVersion ? cacheVersion.split('').reverse().join('') + 'x' : otherVersion;
    const base2 = otherBase === base ? base + 'x/' : otherBase;
    const body = (v: string, b: string, f: string[]): string => JSON.stringify({ version: v, base: b, files: f });
    switch (kind) {
      case 'valid':
        return { kind, cacheVersion, base, files, text: body(cacheVersion, base, files) };
      case 'otherVersion':
        return { kind, cacheVersion, base, files, text: body(version, base, files) };
      case 'otherBase':
        return { kind, cacheVersion, base, files, text: body(cacheVersion, base2, files) };
      case 'emptyList':
        return { kind, cacheVersion, base, files: [], text: body(cacheVersion, base, []) };
      case 'notJson':
        return { kind, cacheVersion, base, files, text: '{"version":' };
      case 'wrongShape':
        return { kind, cacheVersion, base, files, text: JSON.stringify({ version: 1, base, files: 'x' }) };
      case 'absent':
        return { kind, cacheVersion, base, files, text: null };
    }
  });

/** Offline_Line events (the OfflineEvent type of src/offline/line-state.ts), as plain data. */
export type EventType =
  | 'copy-found'
  | 'copy-missing'
  | 'unsupported'
  | 'update-downloading'
  | 'update-failed'
  | 'update-done';

export const PROBE_EVENT_TYPES: readonly EventType[] = ['copy-found', 'copy-missing', 'unsupported'];
export const UPDATE_EVENT_TYPES: readonly EventType[] = ['update-downloading', 'update-failed', 'update-done'];

export const eventArb: fc.Arbitrary<{ type: EventType }> = fc
  .constantFrom<EventType>(...PROBE_EVENT_TYPES, ...UPDATE_EVENT_TYPES)
  .map((type) => ({ type }));

/** Any sequence of events, including none. */
export const eventsArb: fc.Arbitrary<Array<{ type: EventType }>> = fc.array(eventArb, { maxLength: 30 });

/** Events that are only update events. */
export const updateEventsArb: fc.Arbitrary<Array<{ type: EventType }>> = fc.array(
  fc.constantFrom<EventType>(...UPDATE_EVENT_TYPES).map((type) => ({ type })),
  { maxLength: 20 },
);

const persistedArb = fc.constantFrom<PersistedBehaviour>('true', 'false', 'throws', 'rejects', 'missing');
const persistArb = fc.constantFrom<PersistBehaviour>('true', 'false', 'throws', 'rejects', 'never', 'missing');

/** How navigator.storage behaves: missing, or any mix of persisted() and persist() answers. */
export const storageBehaviourArb: fc.Arbitrary<StorageBehaviour> = fc.oneof(
  { weight: 1, arbitrary: fc.constant<StorageBehaviour>({ present: false, persisted: 'missing', persistedAfter: 'missing', persist: 'missing' }) },
  {
    weight: 6,
    arbitrary: fc.record({
      present: fc.constant(true),
      persisted: persistedArb,
      persistedAfter: persistedArb,
      persist: persistArb,
    }),
  },
);
