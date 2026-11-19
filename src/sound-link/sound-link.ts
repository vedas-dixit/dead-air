// The Sound Link: wraps ggwave. One link owns one engine, one encoder instance and its listeners.
import ggwaveFactory from 'ggwave';
import type { GgwaveEngine } from 'ggwave';
import {
  DEFAULT_SAMPLE_RATE,
  MAX_PAYLOAD_BYTES,
  MIN_PAYLOAD_BYTES,
  MODE,
  OUTPUT_VOLUME,
  frameSize,
  isValidSampleRate,
} from './constants';
import { createListenerObject } from './listener';
import type {
  AudioResult,
  Listener,
  ListenerCreateResult,
  LoadResult,
  SoundLink,
  SoundLinkOptions,
  SoundMode,
} from './types';

const MODES: readonly SoundMode[] = ['AUDIBLE_NORMAL', 'AUDIBLE_FAST', 'AUDIBLE_FASTEST'];
const RX_PROTOCOL_NAMES = [
  'AUDIBLE_NORMAL',
  'AUDIBLE_FAST',
  'AUDIBLE_FASTEST',
  'ULTRASOUND_NORMAL',
  'ULTRASOUND_FAST',
  'ULTRASOUND_FASTEST',
  'DT_NORMAL',
  'DT_FAST',
  'DT_FASTEST',
];

/** Builds a link on any object with the ggwave interface. Tests pass a fake engine here. */
export function createSoundLinkWithEngine(engine: GgwaveEngine, options: SoundLinkOptions = {}): LoadResult {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const mode = options.mode ?? MODE;
  if (!isValidSampleRate(sampleRate)) return { ok: false, reason: 'bad-sample-rate' };
  if (!MODES.includes(mode)) return { ok: false, reason: 'bad-mode' };

  try {
    engine.disableLog();
    // Listen to the one mode in use only.
    for (const name of RX_PROTOCOL_NAMES) {
      const id = engine.ProtocolId[`GGWAVE_PROTOCOL_${name}`];
      if (id !== undefined) engine.rxToggleProtocol(id, name === mode ? 1 : 0);
    }
  } catch {
    return { ok: false, reason: 'engine-load-failed' };
  }
  const protocolId = engine.ProtocolId[`GGWAVE_PROTOCOL_${mode}`];
  if (protocolId === undefined) return { ok: false, reason: 'bad-mode' };

  const makeInstance = (): number => {
    const parameters = engine.getDefaultParameters();
    parameters.sampleRateInp = sampleRate;
    parameters.sampleRateOut = sampleRate;
    return engine.init(parameters);
  };

  let disposed = false;
  let encoderFailed = false;
  let encoderInstance = -1;
  const listeners = new Set<Listener>();
  const frameSamples = frameSize(sampleRate);

  const link: SoundLink = {
    sampleRate,
    mode,
    frameSize: frameSamples,

    bytesToAudio(bytes: unknown): AudioResult {
      if (disposed) return { ok: false, reason: 'disposed' };
      if (!(bytes instanceof Uint8Array)) return { ok: false, reason: 'not-bytes' };
      if (bytes.length < MIN_PAYLOAD_BYTES) return { ok: false, reason: 'too-short' };
      if (bytes.length > MAX_PAYLOAD_BYTES) return { ok: false, reason: 'too-long' };
      if (encoderFailed) return { ok: false, reason: 'engine-error' };
      try {
        if (encoderInstance < 0) {
          encoderInstance = makeInstance();
          if (encoderInstance < 0) {
            encoderFailed = true;
            return { ok: false, reason: 'engine-error' };
          }
        }
        // ggwave gets the bytes, never a string, so every byte value is carried unchanged.
        const view = engine.encode(encoderInstance, bytes.slice(), protocolId, OUTPUT_VOLUME);
        // `view` points into a buffer that the next call overwrites. Copy it.
        const copy = new Uint8Array(view.byteLength);
        copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
        return { ok: true, samples: new Float32Array(copy.buffer) };
      } catch {
        encoderFailed = true;
        return { ok: false, reason: 'engine-error' };
      }
    },

    createListener(): ListenerCreateResult {
      if (disposed) return { ok: false, reason: 'disposed' };
      let instance: number;
      try {
        instance = makeInstance();
      } catch {
        return { ok: false, reason: 'engine-error' };
      }
      if (instance < 0) return { ok: false, reason: 'no-free-instance' };
      const listener = createListenerObject(engine, instance, frameSamples, {
        makeInstance,
        freeInstance: (i) => engine.free(i),
        onDispose: (l) => listeners.delete(l),
      });
      listeners.add(listener);
      return { ok: true, listener };
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      for (const listener of [...listeners]) listener.dispose();
      if (encoderInstance >= 0) engine.free(encoderInstance);
      encoderInstance = -1;
    },
  };
  return { ok: true, link };
}

/** Loads the bundled ggwave and makes a link. Never rejects. Makes no network request. */
export async function loadSoundLink(options: SoundLinkOptions = {}): Promise<LoadResult> {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  if (!isValidSampleRate(sampleRate)) return { ok: false, reason: 'bad-sample-rate' };
  let engine: GgwaveEngine;
  try {
    // print and printErr stop ggwave from writing buffer sizes or decoded text to the console.
    engine = await ggwaveFactory({ print: () => {}, printErr: () => {} });
  } catch {
    return { ok: false, reason: 'engine-load-failed' };
  }
  return createSoundLinkWithEngine(engine, options);
}
