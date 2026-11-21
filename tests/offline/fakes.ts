// Fakes for the offline tests. Deterministic: no real timers, no Date.now, no network.
// Each fake records what was done to it. A method that the real API has but the fake does not
// implement throws Error('fake missing API: <name>'), so a test never passes by accident
// through an unimplemented call.

export const missingApiMessage = (name: string): string => `fake missing API: ${name}`;

/** Returns a function that throws the missing-API error when called. */
export function missing(name: string): (...args: unknown[]) => never {
  return () => {
    throw new Error(missingApiMessage(name));
  };
}

// ---------------------------------------------------------------------------------------------
// Responses and Cache Storage
// ---------------------------------------------------------------------------------------------

export interface FakeResponse {
  id: number; // identity, so a test can check "the same response object" came back
  url: string;
  ok: boolean;
  status: number;
  type: 'basic' | 'cors' | 'opaque' | 'opaqueredirect' | 'default';
  redirected: boolean;
  body: string;
}

let nextResponseId = 1;

export function makeResponse(url: string, body = '', over: Partial<FakeResponse> = {}): FakeResponse {
  return {
    id: nextResponseId++,
    url,
    ok: true,
    status: 200,
    type: 'basic',
    redirected: false,
    body,
    ...over,
  };
}

export type CacheCall =
  | { op: 'put'; cache: string; url: string }
  | { op: 'match'; cache: string; url: string }
  | { op: 'keys'; cache: string }
  | { op: 'open'; name: string; existed: boolean }
  | { op: 'has'; name: string }
  | { op: 'delete'; name: string }
  | { op: 'storage-keys' };

export class FakeCache {
  readonly entries = new Map<string, FakeResponse>();
  constructor(
    readonly name: string,
    private readonly owner: FakeCacheStorage,
  ) {}

  put(url: string, response: FakeResponse): Promise<void> {
    this.owner.log.push({ op: 'put', cache: this.name, url });
    this.owner.putCount += 1;
    if (this.owner.failPutAt !== null && this.owner.putCount - 1 === this.owner.failPutAt) {
      return Promise.reject(new Error('fake cache write failure'));
    }
    this.entries.set(url, response);
    return Promise.resolve();
  }

  match(url: string): Promise<FakeResponse | undefined> {
    this.owner.log.push({ op: 'match', cache: this.name, url });
    if (this.owner.failOpen) return Promise.reject(new Error('fake cache read failure'));
    return Promise.resolve(this.entries.get(url));
  }

  keys(): Promise<string[]> {
    this.owner.log.push({ op: 'keys', cache: this.name });
    return Promise.resolve([...this.entries.keys()]);
  }

  // Real Cache methods the code under test must not use.
  add = missing('Cache.add');
  addAll = missing('Cache.addAll');
  delete = missing('Cache.delete');
  matchAll = missing('Cache.matchAll');
}

export class FakeCacheStorage {
  readonly caches = new Map<string, FakeCache>();
  readonly log: CacheCall[] = [];
  /** Zero-based position, counted over all `put` calls on this storage, at which `put` rejects. */
  failPutAt: number | null = null;
  /** When true, `open` and `match` reject (a broken Cache Storage). */
  failOpen = false;
  putCount = 0;

  open(name: string): Promise<FakeCache> {
    this.log.push({ op: 'open', name, existed: this.caches.has(name) });
    if (this.failOpen) return Promise.reject(new Error('fake cache open failure'));
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new FakeCache(name, this);
      this.caches.set(name, cache);
    }
    return Promise.resolve(cache);
  }

  has(name: string): Promise<boolean> {
    this.log.push({ op: 'has', name });
    return Promise.resolve(this.caches.has(name));
  }

  delete(name: string): Promise<boolean> {
    this.log.push({ op: 'delete', name });
    return Promise.resolve(this.caches.delete(name));
  }

  keys(): Promise<string[]> {
    this.log.push({ op: 'storage-keys' });
    return Promise.resolve([...this.caches.keys()]);
  }

  // Real CacheStorage method the code under test must not use.
  match = missing('CacheStorage.match');

  /** Test setup: a cache with the given entries (url to body), no log entry. */
  seed(name: string, entries: Readonly<Record<string, string>>): FakeCache {
    const cache = new FakeCache(name, this);
    for (const [url, body] of Object.entries(entries)) cache.entries.set(url, makeResponse(url, body));
    this.caches.set(name, cache);
    return cache;
  }

  /** Cache name to (url to response id). Compare before and after to prove nothing changed. */
  snapshot(): Record<string, Record<string, number>> {
    const out: Record<string, Record<string, number>> = {};
    for (const [name, cache] of this.caches) {
      const inner: Record<string, number> = {};
      for (const [url, res] of cache.entries) inner[url] = res.id;
      out[name] = inner;
    }
    return out;
  }

  /** Names of caches that received a `put` since the last `resetLog`. */
  cachesWrittenTo(): string[] {
    return [...new Set(this.log.flatMap((c) => (c.op === 'put' ? [c.cache] : [])))];
  }

  resetLog(): void {
    this.log.length = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------------------------

export type NetworkFailure = 'network-error' | 'status' | 'not-basic' | 'redirected';

export interface RequestLogEntry {
  url: string;
  /** The `cache` mode of the request init, or undefined when none was given. */
  cacheMode: string | undefined;
  kind: 'fresh' | 'network';
}

export interface FakeNetworkOptions {
  /** URL to body. A URL not listed answers 404 (not ok). */
  files?: Readonly<Record<string, string>>;
  /** Zero-based position, counted over all requests in order, at which the request fails. */
  failAt?: number | null;
  failure?: NetworkFailure;
  /** When true every request rejects, like a device with no network. */
  offline?: boolean;
}

export class FakeNetwork {
  readonly requests: RequestLogEntry[] = [];
  files: Record<string, string>;
  failAt: number | null;
  failure: NetworkFailure;
  offline: boolean;

  constructor(options: FakeNetworkOptions = {}) {
    this.files = { ...(options.files ?? {}) };
    this.failAt = options.failAt ?? null;
    this.failure = options.failure ?? 'network-error';
    this.offline = options.offline ?? false;
  }

  private answer(url: string, kind: RequestLogEntry['kind'], cacheMode: string | undefined): Promise<FakeResponse> {
    const position = this.requests.length;
    this.requests.push({ url, cacheMode, kind });
    if (this.offline) return Promise.reject(new TypeError('fake network offline'));
    if (this.failAt !== null && position === this.failAt) {
      switch (this.failure) {
        case 'network-error':
          return Promise.reject(new TypeError('fake network error'));
        case 'status':
          return Promise.resolve(makeResponse(url, '', { ok: false, status: 500 }));
        case 'not-basic':
          return Promise.resolve(makeResponse(url, this.files[url] ?? '', { type: 'opaque' }));
        case 'redirected':
          return Promise.resolve(makeResponse(url, this.files[url] ?? '', { redirected: true }));
      }
    }
    const body = this.files[url];
    if (body === undefined) return Promise.resolve(makeResponse(url, '', { ok: false, status: 404 }));
    return Promise.resolve(makeResponse(url, body));
  }

  /** Matches WorkerDeps.fetchFresh. */
  fetchFresh = (url: string, init: { cache: 'reload' }): Promise<FakeResponse> =>
    this.answer(url, 'fresh', init?.cache);

  /** Matches WorkerDeps.fetchNetwork. The request is `{ url }` or a URL string. */
  fetchNetwork = (request: unknown): Promise<FakeResponse> => {
    const url = typeof request === 'string' ? request : (request as { url: string }).url;
    return this.answer(url, 'network', undefined);
  };

  /** URLs requested with the given kind, in order. */
  urls(kind?: RequestLogEntry['kind']): string[] {
    return this.requests.filter((r) => kind === undefined || r.kind === kind).map((r) => r.url);
  }
}

// ---------------------------------------------------------------------------------------------
// Service worker registration
// ---------------------------------------------------------------------------------------------

export interface RegisterCall {
  scriptUrl: string;
  options: { scope?: string; updateViaCache?: string } | undefined;
}

export class FakeRegistration {
  updateCalls = 0;
  updateError: Error | null = null;
  private listeners = new Map<string, Array<() => void>>();

  update(): Promise<void> {
    this.updateCalls += 1;
    return this.updateError ? Promise.reject(this.updateError) : Promise.resolve();
  }

  addEventListener(type: string, listener: () => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  /** Test helper: fire an event such as 'updatefound'. */
  dispatch(type: string): void {
    for (const l of this.listeners.get(type) ?? []) l();
  }

  unregister = missing('ServiceWorkerRegistration.unregister');
  showNotification = missing('ServiceWorkerRegistration.showNotification');
}

export class FakeServiceWorkerContainer {
  readonly registerCalls: RegisterCall[] = [];
  readonly registration = new FakeRegistration();
  registerError: Error | null = null;

  register(scriptUrl: string, options?: RegisterCall['options']): Promise<FakeRegistration> {
    this.registerCalls.push({ scriptUrl, options });
    return this.registerError ? Promise.reject(this.registerError) : Promise.resolve(this.registration);
  }

  getRegistrations = missing('ServiceWorkerContainer.getRegistrations');
  startMessages = missing('ServiceWorkerContainer.startMessages');
}

// ---------------------------------------------------------------------------------------------
// Storage manager (navigator.storage)
// ---------------------------------------------------------------------------------------------

export type PersistedBehaviour = 'true' | 'false' | 'throws' | 'rejects' | 'missing';
export type PersistBehaviour = 'true' | 'false' | 'throws' | 'rejects' | 'never' | 'missing';

export interface StorageBehaviour {
  /** false: `navigator.storage` itself is undefined. */
  present: boolean;
  /** The answer of the first `persisted()` call. */
  persisted: PersistedBehaviour;
  /** The answer of every later `persisted()` call (after `persist()` settled). */
  persistedAfter: PersistedBehaviour;
  persist: PersistBehaviour;
}

export type StorageCall = 'persisted' | 'persist';

export interface FakeStorageManager {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  /** Every call, in order. */
  readonly calls: StorageCall[];
  /** How many `persist()` promises were settled (for tests that wait for settling). */
  settled: number;
  estimate: () => never;
}

function answer(b: PersistedBehaviour): Promise<boolean> {
  switch (b) {
    case 'true':
      return Promise.resolve(true);
    case 'false':
      return Promise.resolve(false);
    case 'throws':
      throw new Error('fake persisted() threw');
    case 'rejects':
      return Promise.reject(new Error('fake persisted() rejected'));
    case 'missing':
      return Promise.resolve(false);
  }
}

/** A storage manager whose answers follow `behaviour`. Returns undefined when not present. */
export function makeStorageManager(behaviour: StorageBehaviour): FakeStorageManager | undefined {
  if (!behaviour.present) return undefined;
  const calls: StorageCall[] = [];
  let persistedCalls = 0;
  const manager: FakeStorageManager = {
    calls,
    settled: 0,
    estimate: missing('StorageManager.estimate') as () => never,
  };
  if (behaviour.persisted !== 'missing') {
    manager.persisted = () => {
      calls.push('persisted');
      const b = persistedCalls === 0 ? behaviour.persisted : behaviour.persistedAfter;
      persistedCalls += 1;
      return answer(b);
    };
  }
  if (behaviour.persist !== 'missing') {
    manager.persist = () => {
      calls.push('persist');
      switch (behaviour.persist) {
        case 'true':
          manager.settled += 1;
          return Promise.resolve(true);
        case 'false':
          manager.settled += 1;
          return Promise.resolve(false);
        case 'throws':
          throw new Error('fake persist() threw');
        case 'rejects':
          manager.settled += 1;
          return Promise.reject(new Error('fake persist() rejected'));
        case 'never':
          return new Promise<boolean>(() => {});
        default:
          return Promise.resolve(false);
      }
    };
  }
  return manager;
}

// ---------------------------------------------------------------------------------------------
// Clock and timers
// ---------------------------------------------------------------------------------------------

export class FakeClock {
  private nowMs: number;
  private nextId = 1;
  private timers = new Map<number, { at: number; fn: () => void }>();

  constructor(start = 0) {
    this.nowMs = start;
  }

  now = (): number => this.nowMs;

  setTimeout = (fn: () => void, ms: number): number => {
    const id = this.nextId++;
    this.timers.set(id, { at: this.nowMs + Math.max(0, ms), fn });
    return id;
  };

  clearTimeout = (id: number): void => {
    this.timers.delete(id);
  };

  setInterval = missing('setInterval');

  get pending(): number {
    return this.timers.size;
  }

  /** Move time forward and run every due timer in time order (ties in creation order). */
  advance(ms: number): void {
    const target = this.nowMs + ms;
    for (;;) {
      let nextId: number | null = null;
      let nextAt = Infinity;
      for (const [id, t] of this.timers) {
        if (t.at <= target && t.at < nextAt) {
          nextAt = t.at;
          nextId = id;
        }
      }
      if (nextId === null) break;
      const t = this.timers.get(nextId)!;
      this.timers.delete(nextId);
      this.nowMs = Math.max(this.nowMs, t.at);
      t.fn();
    }
    this.nowMs = target;
  }
}

/** Lets pending promise callbacks run. */
export async function flushPromises(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}
