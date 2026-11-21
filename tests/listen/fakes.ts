// Fakes for the Listen page tests. Deterministic: no real timers, no Date.now, no audio.
// Each fake implements an interface from src/listen/providers.ts (or the sound-link types)
// and records what was done to it, so tests can drive blocks, failures and visibility.
import type {
  AudioHandle,
  AudioInput,
  IntervalTimers,
  ListenClock,
  MicFailure,
  PageVisibility,
  SoundLinkLoader,
  StorageProvider,
} from '../../src/listen/providers';
import type {
  FeedResult,
  Listener,
  ListenerCreateResult,
  LoadResult,
  SoundLink,
  SoundMode,
  AudioResult,
} from '../../src/sound-link';

// The Broadcast wake lock fake already implements WakeLockProvider, which Listen reuses.
export { FakeWakeLock, FakeWakeLockHandle, flushPromises } from '../broadcast/fakes';

// ---------------------------------------------------------------- clock and timers

export class FakeListenClock implements ListenClock {
  constructor(
    private ms = 0,
    private offset = 0,
  ) {}
  now(): number {
    return this.ms;
  }
  offsetMinutes(): number {
    return this.offset;
  }
  set(ms: number): void {
    this.ms = ms;
  }
  advance(ms: number): void {
    this.ms += ms;
  }
  setOffset(minutes: number): void {
    this.offset = minutes;
  }
}

interface Interval {
  id: number;
  every: number;
  next: number;
  fn: () => void;
}

/** Intervals that run only when the test advances them. Advancing also moves the clock. */
export class FakeIntervalTimers implements IntervalTimers {
  private nextId = 1;
  private active: Interval[] = [];
  setCalls = 0;
  clearCalls = 0;

  constructor(readonly clock: FakeListenClock = new FakeListenClock()) {}

  setInterval(fn: () => void, ms: number): unknown {
    this.setCalls++;
    const every = Math.max(1, ms);
    const id = this.nextId++;
    this.active.push({ id, every, next: this.clock.now() + every, fn });
    return id;
  }

  clearInterval(handle: unknown): void {
    this.clearCalls++;
    this.active = this.active.filter((t) => t.id !== handle);
  }

  get activeCount(): number {
    return this.active.length;
  }

  /** Moves time forward and runs every interval that falls due, in time order. */
  advance(ms: number): void {
    const target = this.clock.now() + ms;
    for (;;) {
      let due: Interval | null = null;
      for (const t of this.active) {
        if (t.next <= target && (due === null || t.next < due.next)) due = t;
      }
      if (!due) break;
      if (due.next > this.clock.now()) this.clock.set(due.next);
      due.next += due.every;
      due.fn();
    }
    this.clock.set(target);
  }
}

// ---------------------------------------------------------------- microphone

export class FakeAudioHandle implements AudioHandle {
  startCalls = 0;
  closeCalls = 0;
  closed = false;
  private onBlock: ((samples: Float32Array) => void) | null = null;
  private onLost: (() => void) | null = null;
  /** Every block pushed while open, as given to the page. Test-only record. */
  readonly pushed: Float32Array[] = [];

  constructor(readonly sampleRate: number = 48000) {}

  get started(): boolean {
    return this.onBlock !== null;
  }

  start(onBlock: (samples: Float32Array) => void, onLost: () => void): void {
    this.startCalls++;
    this.onBlock = onBlock;
    this.onLost = onLost;
  }

  close(): void {
    this.closeCalls++;
    this.closed = true;
    this.onBlock = null;
    this.onLost = null;
  }

  /** Delivers one block. Does nothing after close(), as a real closed context would. */
  pushBlock(samples: Float32Array): void {
    if (this.closed || !this.onBlock) return;
    this.pushed.push(samples);
    this.onBlock(samples);
  }

  /** The microphone stops by itself, for example the track ends. Does nothing after close(). */
  lose(): void {
    if (this.closed || !this.onLost) return;
    this.onLost();
  }
}

export type OpenAnswer = { ok: true; handle: AudioHandle } | { ok: false; reason: MicFailure };

export class FakeAudioInput implements AudioInput {
  openCalls = 0;
  readonly handles: FakeAudioHandle[] = [];
  /** Sample rate given to each new handle. */
  sampleRate = 48000;
  /** When set, open() fails with this reason. */
  failWith: MicFailure | null = null;
  /** When set, open() rejects. */
  throwOnOpen: Error | null = null;
  private pending: Array<(a: OpenAnswer) => void> = [];
  /** When true, open() stays pending until releaseOpen() is called. */
  hold = false;

  open(): Promise<OpenAnswer> {
    this.openCalls++;
    if (this.throwOnOpen) return Promise.reject(this.throwOnOpen);
    if (this.hold) {
      return new Promise<OpenAnswer>((resolve) => this.pending.push(resolve));
    }
    return Promise.resolve(this.answer());
  }

  get holding(): number {
    return this.pending.length;
  }

  /** Answers every held open() call. */
  releaseOpen(): void {
    const waiting = this.pending;
    this.pending = [];
    for (const resolve of waiting) resolve(this.answer());
  }

  get lastHandle(): FakeAudioHandle | null {
    return this.handles.length ? this.handles[this.handles.length - 1]! : null;
  }

  /** Handles that were opened and not closed. */
  get openHandles(): FakeAudioHandle[] {
    return this.handles.filter((h) => !h.closed);
  }

  private answer(): OpenAnswer {
    if (this.failWith) return { ok: false, reason: this.failWith };
    const handle = new FakeAudioHandle(this.sampleRate);
    this.handles.push(handle);
    return { ok: true, handle };
  }
}

// ---------------------------------------------------------------- storage

export class FakeListenStorage implements StorageProvider {
  /** The stored text, or null. */
  value: string | null;
  available: boolean;
  /** Every write attempted, in order. */
  readonly writes: string[] = [];
  readCalls = 0;
  removeCalls = 0;
  failWrites = false;
  failRemove = false;

  constructor(initial: string | null = null, available = true) {
    this.value = initial;
    this.available = available;
  }

  read(): string | null {
    this.readCalls++;
    return this.available ? this.value : null;
  }

  write(text: string): boolean {
    this.writes.push(text);
    if (!this.available || this.failWrites) return false;
    this.value = text;
    return true;
  }

  remove(): boolean {
    this.removeCalls++;
    if (!this.available || this.failRemove) return false;
    this.value = null;
    return true;
  }
}

// ---------------------------------------------------------------- visibility

export class FakePageVisibility implements PageVisibility {
  constructor(public visible = true) {}
  isVisible(): boolean {
    return this.visible;
  }
}

// ---------------------------------------------------------------- sound link and listener

export type ListenFeedFailure = Extract<FeedResult, { ok: false }>['reason'];

/** A listener the test drives: queue payloads, and the next feed() returns them. */
export class FakeListenListener implements Listener {
  feedCalls = 0;
  resetCalls = 0;
  disposeCalls = 0;
  disposed = false;
  /** Every block given to feed(), as received. */
  readonly fed: unknown[] = [];
  private queued: Uint8Array[] = [];
  /** When set, feed() returns this failure. */
  failWith: ListenFeedFailure | null = null;
  /** When true, feed() throws. */
  throwOnFeed = false;

  constructor(private readonly link: FakeListenLink) {}

  /** The next feed() returns these payloads (copies). */
  queuePayloads(...payloads: Uint8Array[]): void {
    this.queued.push(...payloads.map((p) => Uint8Array.from(p)));
  }

  feed(samples: unknown): FeedResult {
    this.feedCalls++;
    this.fed.push(samples);
    if (this.disposed) return { ok: false, reason: 'disposed' };
    if (this.throwOnFeed) throw new Error('listener threw');
    if (this.failWith) return { ok: false, reason: this.failWith };
    const payloads = this.queued;
    this.queued = [];
    return { ok: true, payloads };
  }

  reset(): void {
    this.resetCalls++;
  }

  dispose(): void {
    this.disposeCalls++;
    if (this.disposed) return;
    this.disposed = true;
    this.link.openListeners--;
  }
}

export class FakeListenLink implements SoundLink {
  readonly mode: SoundMode = 'AUDIBLE_FAST';
  readonly frameSize = 1024;
  createListenerCalls = 0;
  disposeCalls = 0;
  /** Listeners created and not yet disposed. */
  openListeners = 0;
  readonly listeners: FakeListenListener[] = [];
  createFail: Extract<ListenerCreateResult, { ok: false }>['reason'] | null = null;

  constructor(readonly sampleRate: number) {}

  get lastListener(): FakeListenListener | null {
    return this.listeners.length ? this.listeners[this.listeners.length - 1]! : null;
  }

  bytesToAudio(): AudioResult {
    // The Listen page never plays sound.
    return { ok: false, reason: 'engine-error' };
  }

  createListener(): ListenerCreateResult {
    this.createListenerCalls++;
    if (this.createFail) return { ok: false, reason: this.createFail };
    const listener = new FakeListenListener(this);
    this.listeners.push(listener);
    this.openListeners++;
    return { ok: true, listener };
  }

  dispose(): void {
    this.disposeCalls++;
  }
}

/** A SoundLinkLoader the test controls. Records the rates it was asked for. */
export class FakeSoundLinkLoader {
  /** Sample rate of every call, in order. */
  readonly rates: number[] = [];
  readonly links: FakeListenLink[] = [];
  /** When set, the loader answers with this failure. */
  failWith: Extract<LoadResult, { ok: false }>['reason'] | null = null;
  /** When set, the loader rejects. */
  throwOnLoad: Error | null = null;
  /** When true, calls stay pending until releaseLoad(). */
  hold = false;
  private pending: Array<() => void> = [];

  /** Pass this to the controller as `loadLink`. */
  readonly load: SoundLinkLoader = (sampleRate: number) => {
    this.rates.push(sampleRate);
    if (this.throwOnLoad) return Promise.reject(this.throwOnLoad);
    if (this.hold) {
      return new Promise<LoadResult>((resolve) => this.pending.push(() => resolve(this.answer(sampleRate))));
    }
    return Promise.resolve(this.answer(sampleRate));
  };

  get loadCalls(): number {
    return this.rates.length;
  }

  get lastLink(): FakeListenLink | null {
    return this.links.length ? this.links[this.links.length - 1]! : null;
  }

  releaseLoad(): void {
    const waiting = this.pending;
    this.pending = [];
    for (const run of waiting) run();
  }

  private answer(sampleRate: number): LoadResult {
    if (this.failWith) return { ok: false, reason: this.failWith };
    const link = new FakeListenLink(sampleRate);
    this.links.push(link);
    return { ok: true, link };
  }
}
