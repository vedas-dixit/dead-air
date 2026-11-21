// Small interfaces for everything the Listen controller gets from outside.
// Types only. No browser API, so this compiles without the DOM library.
// The real versions live in dom/. Tests pass fakes.
import type { LoadResult } from '../sound-link';

export interface ListenClock {
  /** Epoch milliseconds. */
  now(): number;
  /** -new Date().getTimezoneOffset() in the DOM layer. */
  offsetMinutes(): number;
}

export interface IntervalTimers {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export type MicFailure =
  | 'refused' // NotAllowedError, SecurityError
  | 'no-device' // NotFoundError, OverconstrainedError
  | 'unsupported' // no mediaDevices, or not a secure context
  | 'audio' // AudioContext missing, could not be created or resumed
  | 'other';

export interface AudioHandle {
  readonly sampleRate: number; // context.sampleRate
  /** Starts delivering blocks. Each block is a fresh Float32Array the caller may keep. */
  start(onBlock: (samples: Float32Array) => void, onLost: () => void): void;
  /** Stops every track, disconnects the nodes, closes the context. Safe to call twice. */
  close(): void;
}

export interface AudioInput {
  /** Creates or resumes the AudioContext first, then asks for the microphone. */
  open(): Promise<{ ok: true; handle: AudioHandle } | { ok: false; reason: MicFailure }>;
}

export interface StorageProvider {
  /** Null when nothing is stored or storage is unavailable. Never throws. */
  read(): string | null;
  /** False when the write failed. Never throws. */
  write(text: string): boolean;
  /** False when the removal failed. Never throws. */
  remove(): boolean;
  readonly available: boolean;
}

export interface PageVisibility {
  isVisible(): boolean;
}

export type SoundLinkLoader = (sampleRate: number) => Promise<LoadResult>; // wraps loadSoundLink
