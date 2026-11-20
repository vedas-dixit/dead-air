// Small interfaces for everything the Broadcast controller gets from outside.
// Types only. No browser API, so this compiles without the DOM library.
// The real versions live in dom/. Tests pass fakes.

/** Epoch milliseconds from the device clock. */
export interface Clock {
  now(): number;
}

export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface Player {
  /** Resolves at the end of the sound, or when stop() is called. Rejects on a playback error. */
  play(samples: Float32Array, sampleRate: number): Promise<void>;
  /** Silences within 0.25 s and makes the pending play() resolve. */
  stop(): void;
}

export interface AudioHost {
  /** Creates or resumes the audio context. Called inside the tap. False when it cannot. */
  unlock(): Promise<boolean>;
  readonly player: Player;
}

export type Position = { latitude: number; longitude: number };
export type LocationFailure = 'refused' | 'unavailable' | 'timeout' | 'no-api';

export interface GeolocationProvider {
  /** Read once at page start. Does not ask for permission. */
  availability(): { ok: true } | { ok: false; reason: 'no-api' | 'insecure' };
  getPosition(
    timeoutMs: number,
  ): Promise<{ ok: true; position: Position } | { ok: false; reason: LocationFailure }>;
}

export interface WakeLockHandle {
  release(): Promise<void>;
  onRelease(cb: () => void): void;
}

export interface WakeLockProvider {
  readonly supported: boolean;
  /** Null when refused. */
  request(): Promise<WakeLockHandle | null>;
}

export interface Downloader {
  save(bytes: Uint8Array, fileName: string): void;
}
