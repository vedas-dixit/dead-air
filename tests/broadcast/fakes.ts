// Fakes for the Broadcast page tests. Deterministic: no real timers, no Date.now.
// Each fake implements an interface from src/broadcast/providers.ts (or station-store.ts,
// or the types in src/sound-link) and records what was done to it.
import type { KeyValueStorage } from '../../src/broadcast/station-store';
import type {
  AudioHost,
  Clock,
  Downloader,
  GeolocationProvider,
  LocationFailure,
  Player,
  Position,
  Timers,
  WakeLockHandle,
  WakeLockProvider,
} from '../../src/broadcast/providers';
import type {
  AudioResult,
  FeedResult,
  Listener,
  ListenerCreateResult,
  SoundLink,
  SoundMode,
} from '../../src/sound-link';

/** Lets pending promise callbacks run. Uses only microtasks, never a real timer. */
export async function flushPromises(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}

// ---------------------------------------------------------------- clock and timers

export class FakeClock implements Clock {
  private ms: number;
  constructor(startMs = 0) {
    this.ms = startMs;
  }
  now(): number {
    return this.ms;
  }
  set(ms: number): void {
    this.ms = ms;
  }
  advance(ms: number): void {
    this.ms += ms;
  }
}

interface PendingTimer {
  id: number;
  at: number;
  seq: number;
  fn: () => void;
}

/** Timers that run only when the test advances them. Moving them also moves the clock. */
export class FakeTimers implements Timers {
  private nextId = 1;
  private seq = 0;
  private pending: PendingTimer[] = [];
  setCalls = 0;
  clearCalls = 0;

  constructor(readonly clock: FakeClock = new FakeClock()) {}

  setTimeout(fn: () => void, ms: number): unknown {
    this.setCalls++;
    const id = this.nextId++;
    this.pending.push({ id, at: this.clock.now() + Math.max(0, ms), seq: this.seq++, fn });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.clearCalls++;
    this.pending = this.pending.filter((t) => t.id !== handle);
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  /** Milliseconds until the next timer is due, or null when none. */
  nextDueIn(): number | null {
    if (this.pending.length === 0) return null;
    return Math.max(0, Math.min(...this.pending.map((t) => t.at)) - this.clock.now());
  }

  private takeNext(limit: number): PendingTimer | null {
    let best: PendingTimer | null = null;
    for (const t of this.pending) {
      if (t.at > limit) continue;
      if (best === null || t.at < best.at || (t.at === best.at && t.seq < best.seq)) best = t;
    }
    if (best) this.pending = this.pending.filter((t) => t !== best);
    return best;
  }

  /** Moves time forward and runs every timer that falls due, in order. Timers set by callbacks run too. */
  advance(ms: number): void {
    const target = this.clock.now() + ms;
    for (let t = this.takeNext(target); t; t = this.takeNext(target)) {
      if (t.at > this.clock.now()) this.clock.set(t.at);
      t.fn();
    }
    this.clock.set(target);
  }

  /** Like advance, but lets promise callbacks run after each timer. Use when code awaits between timers. */
  async advanceAsync(ms: number): Promise<void> {
    const target = this.clock.now() + ms;
    await flushPromises();
    for (let t = this.takeNext(target); t; t = this.takeNext(target)) {
      if (t.at > this.clock.now()) this.clock.set(t.at);
      t.fn();
      await flushPromises();
    }
    this.clock.set(target);
    await flushPromises();
  }
}

// ---------------------------------------------------------------- storage

export class FakeStorage implements KeyValueStorage {
  readonly items = new Map<string, string>();
  /** Every successful or attempted write, in order. */
  readonly writes: Array<{ key: string; value: string }> = [];
  getCalls = 0;
  throwOnGet = false;
  throwOnSet = false;

  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.items.set(k, v);
  }

  getItem(key: string): string | null {
    this.getCalls++;
    if (this.throwOnGet) throw new Error('storage read blocked');
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.writes.push({ key, value });
    if (this.throwOnSet) throw new Error('storage full');
    this.items.set(key, value);
  }

  get keys(): string[] {
    return [...this.items.keys()];
  }
}

// ---------------------------------------------------------------- player and audio host

export type PlayerMode = 'manual' | 'timers';

export interface PlayRecord {
  samples: Float32Array;
  sampleRate: number;
  /** Clock time when play() was called. */
  at: number;
}

/**
 * 'manual': each play() stays pending until the test calls finishCurrent().
 * 'timers': each play() resolves after its real duration on the fake timers.
 * stop() resolves the pending play, as the Player contract says.
 */
export class FakePlayer implements Player {
  readonly plays: PlayRecord[] = [];
  stopCalls = 0;
  mode: PlayerMode;
  /** When set, the next play() rejects with this error (once). */
  failNext: Error | null = null;
  /** When true every play() rejects. */
  failAlways: Error | null = null;
  private current: { resolve: () => void; timer: unknown } | null = null;

  constructor(
    private readonly timers: FakeTimers,
    mode: PlayerMode = 'manual',
  ) {
    this.mode = mode;
  }

  get playCalls(): number {
    return this.plays.length;
  }
  get playing(): boolean {
    return this.current !== null;
  }
  get lastSamples(): Float32Array | null {
    return this.plays.length ? this.plays[this.plays.length - 1]!.samples : null;
  }

  play(samples: Float32Array, sampleRate: number): Promise<void> {
    this.plays.push({ samples, sampleRate, at: this.timers.clock.now() });
    const error = this.failAlways ?? this.failNext;
    this.failNext = null;
    if (error) return Promise.reject(error);
    return new Promise<void>((resolve) => {
      const entry = { resolve, timer: null as unknown };
      this.current = entry;
      if (this.mode === 'timers') {
        const ms = Math.round((samples.length / sampleRate) * 1000);
        entry.timer = this.timers.setTimeout(() => this.finishCurrent(), ms);
      }
    });
  }

  /** Ends the pending play as if the sound reached its end. */
  finishCurrent(): void {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    if (cur.timer !== null) this.timers.clearTimeout(cur.timer);
    cur.resolve();
  }

  stop(): void {
    this.stopCalls++;
    this.finishCurrent();
  }
}

export class FakeAudioHost implements AudioHost {
  unlockCalls = 0;
  readonly player: FakePlayer;
  refuse = false;
  /** When set, unlock() rejects instead of resolving. */
  throwOnUnlock: Error | null = null;

  constructor(player: FakePlayer) {
    this.player = player;
  }

  unlock(): Promise<boolean> {
    this.unlockCalls++;
    if (this.throwOnUnlock) return Promise.reject(this.throwOnUnlock);
    return Promise.resolve(!this.refuse);
  }
}

// ---------------------------------------------------------------- geolocation

export type FakeGeoAnswer =
  | { ok: true; position: Position }
  | { ok: false; reason: LocationFailure };

export class FakeGeolocation implements GeolocationProvider {
  availabilityCalls = 0;
  getPositionCalls = 0;
  readonly timeouts: number[] = [];
  available: { ok: true } | { ok: false; reason: 'no-api' | 'insecure' } = { ok: true };
  answer: FakeGeoAnswer = { ok: true, position: { latitude: 12.9716, longitude: 77.5946 } };

  availability(): { ok: true } | { ok: false; reason: 'no-api' | 'insecure' } {
    this.availabilityCalls++;
    return this.available;
  }

  getPosition(timeoutMs: number): Promise<FakeGeoAnswer> {
    this.getPositionCalls++;
    this.timeouts.push(timeoutMs);
    return Promise.resolve(this.answer);
  }
}

// ---------------------------------------------------------------- wake lock

export class FakeWakeLockHandle implements WakeLockHandle {
  releaseCalls = 0;
  released = false;
  private callbacks: Array<() => void> = [];

  release(): Promise<void> {
    this.releaseCalls++;
    this.fireRelease();
    return Promise.resolve();
  }

  onRelease(cb: () => void): void {
    this.callbacks.push(cb);
  }

  /** Marks the lock released and tells listeners. Both release() and the browser go through here. */
  fireRelease(): void {
    if (this.released) return;
    this.released = true;
    for (const cb of this.callbacks) cb();
  }
}

export class FakeWakeLock implements WakeLockProvider {
  /** False models a browser with no wake lock. */
  supported: boolean;
  /** When true, request() resolves null. */
  refuse = false;
  /** When set, request() rejects. */
  throwOnRequest: Error | null = null;
  requestCalls = 0;
  readonly handles: FakeWakeLockHandle[] = [];

  constructor(supported = true) {
    this.supported = supported;
  }

  request(): Promise<WakeLockHandle | null> {
    this.requestCalls++;
    if (this.throwOnRequest) return Promise.reject(this.throwOnRequest);
    if (!this.supported || this.refuse) return Promise.resolve(null);
    const handle = new FakeWakeLockHandle();
    this.handles.push(handle);
    return Promise.resolve(handle);
  }

  /** Releases made by the page (release() calls). */
  get releaseCalls(): number {
    return this.handles.reduce((n, h) => n + h.releaseCalls, 0);
  }
  /** Handles that are still held. */
  get activeCount(): number {
    return this.handles.filter((h) => !h.released).length;
  }
  /** The browser drops the lock, as it does when the tab is hidden. */
  releaseByBrowser(): void {
    for (const h of this.handles) h.fireRelease();
  }
}

// ---------------------------------------------------------------- downloader

export class FakeDownloader implements Downloader {
  readonly saves: Array<{ bytes: Uint8Array; fileName: string }> = [];
  throwOnSave: Error | null = null;

  save(bytes: Uint8Array, fileName: string): void {
    if (this.throwOnSave) throw this.throwOnSave;
    this.saves.push({ bytes, fileName });
  }
  get saveCalls(): number {
    return this.saves.length;
  }
}

// ---------------------------------------------------------------- sound link and listener

/** What the fake listener reports after it has been fed the whole sound. */
export type ListenerBehavior =
  | { kind: 'echo' } // exactly one payload equal to the bytes given to bytesToAudio
  | { kind: 'none' } // no payload
  | { kind: 'many' } // the right payload twice
  | { kind: 'changed'; index: number; xor?: number } // one payload with one byte changed
  | { kind: 'payloads'; payloads: Uint8Array[] } // exactly these payloads
  | { kind: 'feed-fail'; reason?: 'not-float32' | 'not-finite' | 'engine-error' | 'disposed' }
  | { kind: 'throw' }; // feed() throws

export interface FakeLinkOptions {
  sampleRate?: number;
  /** Samples per fake sound, in seconds of audio. Default 1. */
  audioSeconds?: number;
  behavior?: ListenerBehavior;
  /** bytesToAudio returns this failure. */
  audioFail?: Extract<AudioResult, { ok: false }>['reason'];
  /** createListener returns this failure. */
  createFail?: Extract<ListenerCreateResult, { ok: false }>['reason'];
  /** When given, the link delegates audio and decoding to this real link. Behavior still applies to payloads. */
  real?: SoundLink;
}

function changeByte(payload: Uint8Array, index: number, xor: number): Uint8Array {
  const copy = Uint8Array.from(payload);
  if (copy.length > 0) {
    const i = ((index % copy.length) + copy.length) % copy.length;
    copy[i] = copy[i]! ^ (xor === 0 ? 1 : xor & 0xff);
  }
  return copy;
}

export class FakeListener implements Listener {
  feedCalls = 0;
  resetCalls = 0;
  disposeCalls = 0;
  disposed = false;
  fedSamples = 0;
  private emitted = false;
  private readonly inner: Listener | null;

  constructor(
    private readonly link: FakeLink,
    inner: Listener | null,
  ) {
    this.inner = inner;
  }

  feed(samples: unknown): FeedResult {
    this.feedCalls++;
    const behavior = this.link.behavior;
    if (this.disposed) return { ok: false, reason: 'disposed' };
    if (behavior.kind === 'throw') throw new Error('listener threw');
    if (behavior.kind === 'feed-fail') {
      return { ok: false, reason: behavior.reason ?? 'engine-error' };
    }
    const length = (samples as { length?: number } | null)?.length ?? 0;
    this.fedSamples += length;

    // Real mode: the engine reports what it heard, then the behavior reshapes it.
    let heard: Uint8Array[];
    if (this.inner) {
      const r = this.inner.feed(samples);
      if (!r.ok) return r;
      heard = r.payloads;
    } else {
      const due = !this.emitted && this.fedSamples >= this.link.lastAudioLength;
      if (due) this.emitted = true;
      heard = due && this.link.lastBytes ? [Uint8Array.from(this.link.lastBytes)] : [];
    }
    return { ok: true, payloads: this.shape(heard) };
  }

  private shape(heard: Uint8Array[]): Uint8Array[] {
    const b = this.link.behavior;
    switch (b.kind) {
      case 'none':
        return [];
      case 'many':
        return heard.length ? [heard[0]!, Uint8Array.from(heard[0]!)] : [];
      case 'changed':
        return heard.map((p) => changeByte(p, b.index, b.xor ?? 1));
      case 'payloads': {
        // Released once, when the real or fake sound has been heard in full.
        if (heard.length === 0 || this.link.payloadsGiven) return [];
        this.link.payloadsGiven = true;
        return b.payloads.map((p) => Uint8Array.from(p));
      }
      default:
        return heard;
    }
  }

  reset(): void {
    this.resetCalls++;
    this.inner?.reset();
  }

  dispose(): void {
    this.disposeCalls++;
    if (this.disposed) return;
    this.disposed = true;
    this.inner?.dispose();
    this.link.openListeners--;
  }
}

export class FakeLink implements SoundLink {
  readonly sampleRate: number;
  readonly mode: SoundMode = 'AUDIBLE_FAST';
  readonly frameSize = 1024;
  behavior: ListenerBehavior;
  audioFail: FakeLinkOptions['audioFail'];
  createFail: FakeLinkOptions['createFail'];
  readonly real: SoundLink | null;
  private readonly audioSeconds: number;

  bytesToAudioCalls = 0;
  createListenerCalls = 0;
  /** Listeners created and not yet disposed. */
  openListeners = 0;
  maxOpenListeners = 0;
  readonly listeners: FakeListener[] = [];
  readonly audioInputs: unknown[] = [];
  lastBytes: Uint8Array | null = null;
  lastAudioLength = 0;
  /** Used by the 'payloads' behavior so it reports once. */
  payloadsGiven = false;
  disposeCalls = 0;

  constructor(options: FakeLinkOptions = {}) {
    this.real = options.real ?? null;
    this.sampleRate = options.sampleRate ?? this.real?.sampleRate ?? 48000;
    this.audioSeconds = options.audioSeconds ?? 1;
    this.behavior = options.behavior ?? { kind: 'echo' };
    this.audioFail = options.audioFail;
    this.createFail = options.createFail;
  }

  bytesToAudio(bytes: unknown): AudioResult {
    this.bytesToAudioCalls++;
    this.audioInputs.push(bytes);
    if (this.audioFail) return { ok: false, reason: this.audioFail };
    if (this.real) {
      const r = this.real.bytesToAudio(bytes);
      if (r.ok && bytes instanceof Uint8Array) {
        this.lastBytes = Uint8Array.from(bytes);
        this.lastAudioLength = r.samples.length;
        this.payloadsGiven = false;
      }
      return r;
    }
    if (!(bytes instanceof Uint8Array)) return { ok: false, reason: 'not-bytes' };
    if (bytes.length < 21) return { ok: false, reason: 'too-short' };
    if (bytes.length > 40) return { ok: false, reason: 'too-long' };
    this.lastBytes = Uint8Array.from(bytes);
    this.payloadsGiven = false;
    // Deterministic samples: a ramp scaled by the first byte. Not real sound.
    const n = Math.round(this.audioSeconds * this.sampleRate);
    const samples = new Float32Array(n);
    for (let i = 0; i < n; i++) samples[i] = ((i % 100) / 100 - 0.5) * 0.5;
    this.lastAudioLength = n;
    return { ok: true, samples };
  }

  createListener(): ListenerCreateResult {
    this.createListenerCalls++;
    if (this.createFail) return { ok: false, reason: this.createFail };
    let inner: Listener | null = null;
    if (this.real) {
      const r = this.real.createListener();
      if (!r.ok) return r;
      inner = r.listener;
    }
    const listener = new FakeListener(this, inner);
    this.listeners.push(listener);
    this.openListeners++;
    this.maxOpenListeners = Math.max(this.maxOpenListeners, this.openListeners);
    return { ok: true, listener };
  }

  dispose(): void {
    this.disposeCalls++;
    this.real?.dispose();
  }
}

/** A fake link that runs the real sound path and records listeners. Behavior defaults to 'echo' (real decode). */
export function wrapRealLink(real: SoundLink, options: Omit<FakeLinkOptions, 'real'> = {}): FakeLink {
  return new FakeLink({ ...options, real });
}
