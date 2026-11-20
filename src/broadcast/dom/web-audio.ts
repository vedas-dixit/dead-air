// The real AudioHost and Player. The AudioContext is created only inside unlock(),
// which the controller calls from the Go on air tap. Nothing here runs at load.

import { DEFAULT_SAMPLE_RATE } from '../../sound-link/constants';
import type { AudioHost, Player } from '../providers';

type ContextCtor = new (options?: AudioContextOptions) => AudioContext;

function findContextCtor(): ContextCtor | null {
  const w = globalThis as unknown as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export function createWebAudioHost(): AudioHost {
  let ctx: AudioContext | null = null;
  let current: { source: AudioBufferSourceNode; finish: () => void } | null = null;

  const player: Player = {
    play(samples: Float32Array, sampleRate: number): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (ctx === null) {
          reject(new Error('Audio is not unlocked'));
          return;
        }
        try {
          const buffer = ctx.createBuffer(1, samples.length, sampleRate);
          buffer.copyToChannel(new Float32Array(samples), 0);
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          let done = false;
          const finish = (): void => {
            if (done) return;
            done = true;
            if (current !== null && current.source === source) current = null;
            try {
              source.disconnect();
            } catch {
              // already disconnected
            }
            resolve();
          };
          source.addEventListener('ended', finish);
          current = { source, finish };
          source.start();
        } catch (err) {
          current = null;
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });
    },

    stop(): void {
      const running = current;
      if (running === null) return;
      try {
        running.source.stop();
      } catch {
        // not started or already stopped
      }
      running.finish();
    },
  };

  async function unlock(): Promise<boolean> {
    try {
      if (ctx === null || ctx.state === 'closed') {
        const Ctor = findContextCtor();
        if (Ctor === null) return false;
        try {
          ctx = new Ctor({ sampleRate: DEFAULT_SAMPLE_RATE });
        } catch {
          ctx = new Ctor();
        }
      }
      if (ctx.state === 'suspended') await ctx.resume();
      return (ctx.state as string) !== 'closed';
    } catch {
      return false;
    }
  }

  return { unlock, player };
}
