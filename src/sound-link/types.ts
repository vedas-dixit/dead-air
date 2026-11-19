export type SoundMode = 'AUDIBLE_NORMAL' | 'AUDIBLE_FAST' | 'AUDIBLE_FASTEST';

export interface SoundLinkOptions {
  /** Whole number from 16000 to 96000. Default 48000. */
  sampleRate?: number;
  /** Default is MODE. */
  mode?: SoundMode;
}

export type LoadResult =
  | { ok: true; link: SoundLink }
  | { ok: false; reason: 'bad-sample-rate' | 'bad-mode' | 'engine-load-failed' };

export type AudioResult =
  | { ok: true; samples: Float32Array }
  | { ok: false; reason: 'not-bytes' | 'too-short' | 'too-long' | 'engine-error' | 'disposed' };

export type ListenerCreateResult =
  | { ok: true; listener: Listener }
  | { ok: false; reason: 'no-free-instance' | 'engine-error' | 'disposed' };

/** Payloads are untrusted. Only the Message Code check may accept them. */
export type FeedResult =
  | { ok: true; payloads: Uint8Array[] }
  | { ok: false; reason: 'not-float32' | 'not-finite' | 'engine-error' | 'disposed' };

export type WavResult =
  | { ok: true; wav: Uint8Array }
  | { ok: false; reason: 'not-float32' | 'empty' | 'not-finite' | 'bad-sample-rate' };

export interface Listener {
  /** Takes microphone samples at the link's sample rate, of any length. Returns every payload heard. */
  feed(samples: unknown): FeedResult;
  /** Drops the partial frame and ggwave's partial decode state. */
  reset(): void;
  /** Frees the ggwave instance. Later calls return `disposed`. */
  dispose(): void;
}

export interface SoundLink {
  readonly sampleRate: number;
  readonly mode: SoundMode;
  readonly frameSize: number;
  /** Takes 21 to 40 bytes and returns audio samples ready to play. */
  bytesToAudio(bytes: unknown): AudioResult;
  createListener(): ListenerCreateResult;
  /** Frees the encoder and every listener. */
  dispose(): void;
}
