// The Listener: collects samples into whole frames, gives them to ggwave, copies out every payload.
import type { GgwaveEngine } from 'ggwave';
import type { FeedResult, Listener } from './types';

export interface ListenerHooks {
  /** Makes a new ggwave instance, or returns -1 if there is no room. */
  makeInstance(): number;
  freeInstance(instance: number): void;
  /** Called when the listener frees itself, so the link stops counting it. */
  onDispose(listener: Listener): void;
}

export function createListenerObject(
  engine: GgwaveEngine,
  firstInstance: number,
  frameSamples: number,
  hooks: ListenerHooks,
): Listener {
  let instance = firstInstance;
  let state: 'open' | 'failed' | 'disposed' = 'open';
  const frame = new Float32Array(frameSamples);
  const frameBytes = new Int8Array(frame.buffer);
  let filled = 0;

  const listener: Listener = {
    feed(samples: unknown): FeedResult {
      if (state === 'disposed') return { ok: false, reason: 'disposed' };
      if (state === 'failed') return { ok: false, reason: 'engine-error' };
      if (!(samples instanceof Float32Array)) return { ok: false, reason: 'not-float32' };
      // Check everything before copying anything, so a bad value leaves the listener unchanged.
      for (let i = 0; i < samples.length; i++) {
        if (!Number.isFinite(samples[i])) return { ok: false, reason: 'not-finite' };
      }
      const payloads: Uint8Array[] = [];
      try {
        for (let i = 0; i < samples.length; i++) {
          frame[filled++] = samples[i]!;
          if (filled === frameSamples) {
            filled = 0;
            const heard = engine.decode(instance, frameBytes);
            if (heard && heard.length > 0) {
              // Copy out of ggwave's shared buffer. Bytes are returned as they are.
              payloads.push(new Uint8Array(heard.buffer, heard.byteOffset, heard.length).slice());
            }
          }
        }
      } catch {
        state = 'failed';
        filled = 0;
        frame.fill(0);
        return { ok: false, reason: 'engine-error' };
      }
      return { ok: true, payloads };
    },

    reset(): void {
      if (state === 'disposed') return;
      filled = 0;
      frame.fill(0);
      // A fresh ggwave instance is the only way to clear its partial decode state.
      if (instance >= 0) hooks.freeInstance(instance);
      instance = -1;
      const fresh = hooks.makeInstance();
      if (fresh < 0) {
        state = 'failed';
        return;
      }
      instance = fresh;
      state = 'open';
    },

    dispose(): void {
      if (state === 'disposed') return;
      if (instance >= 0) hooks.freeInstance(instance);
      instance = -1;
      state = 'disposed';
      filled = 0;
      frame.fill(0);
      hooks.onDispose(listener);
    },
  };
  return listener;
}
