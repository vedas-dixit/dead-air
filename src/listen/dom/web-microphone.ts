// The real AudioInput. The only file that touches AudioContext, getUserMedia,
// createMediaStreamSource and createScriptProcessor. Samples are copied per block,
// handed to the caller and never stored or logged here.

import { DEFAULT_SAMPLE_RATE } from '../../sound-link/constants';
import type { AudioHandle, AudioInput, MicFailure } from '../providers';

type ContextCtor = new (options?: AudioContextOptions) => AudioContext;

const BLOCK_SIZE = 1024;

function findContextCtor(): ContextCtor | null {
  const w = globalThis as unknown as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function mapMicError(err: unknown): MicFailure {
  const name = (err as { name?: unknown } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'refused';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-device';
  return 'other';
}

export function createWebMicrophone(): AudioInput {
  return {
    async open() {
      // Everything created so far, so a failure can clean it all up.
      let ctx: AudioContext | null = null;
      let stream: MediaStream | null = null;
      let source: MediaStreamAudioSourceNode | null = null;
      let processor: ScriptProcessorNode | null = null;

      const cleanup = (): void => {
        if (processor !== null) {
          processor.onaudioprocess = null;
          try {
            processor.disconnect();
          } catch {
            // already disconnected
          }
        }
        if (source !== null) {
          try {
            source.disconnect();
          } catch {
            // already disconnected
          }
        }
        if (stream !== null) {
          for (const track of stream.getTracks()) {
            try {
              track.stop();
            } catch {
              // already stopped
            }
          }
        }
        if (ctx !== null && ctx.state !== 'closed') {
          ctx.close().catch(() => undefined);
        }
        processor = null;
        source = null;
        stream = null;
        ctx = null;
      };

      // Create the context synchronously, before any await, so it stays inside the tap.
      try {
        const Ctor = findContextCtor();
        if (Ctor === null) return { ok: false as const, reason: 'audio' as const };
        try {
          ctx = new Ctor({ sampleRate: DEFAULT_SAMPLE_RATE });
        } catch {
          ctx = new Ctor();
        }
      } catch {
        cleanup();
        return { ok: false as const, reason: 'audio' as const };
      }
      const context: AudioContext = ctx;

      try {
        if (context.state === 'suspended') await context.resume();
        if ((context.state as string) === 'closed') throw new Error('closed');
      } catch {
        cleanup();
        return { ok: false as const, reason: 'audio' as const };
      }

      const devices = (globalThis.navigator as Navigator | undefined)?.mediaDevices;
      if (globalThis.isSecureContext !== true || !devices || typeof devices.getUserMedia !== 'function') {
        cleanup();
        return { ok: false as const, reason: 'unsupported' as const };
      }

      try {
        stream = await devices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
      } catch (err) {
        cleanup();
        return { ok: false as const, reason: mapMicError(err) };
      }
      const mic: MediaStream = stream;

      try {
        source = context.createMediaStreamSource(mic);
        processor = context.createScriptProcessor(BLOCK_SIZE, 1, 1);
      } catch {
        cleanup();
        return { ok: false as const, reason: 'audio' as const };
      }
      const src: MediaStreamAudioSourceNode = source;
      const proc: ScriptProcessorNode = processor;

      let closed = false;
      const handle: AudioHandle = {
        sampleRate: context.sampleRate,
        start(onBlock, onLost) {
          if (closed) return;
          proc.onaudioprocess = (event: AudioProcessingEvent): void => {
            onBlock(new Float32Array(event.inputBuffer.getChannelData(0)));
          };
          for (const track of mic.getTracks()) {
            track.addEventListener('ended', () => {
              if (!closed) onLost();
            });
          }
          // The output buffer is never written, so nothing audible is played.
          src.connect(proc);
          proc.connect(context.destination);
        },
        close() {
          if (closed) return;
          closed = true;
          cleanup();
        },
      };
      return { ok: true as const, handle };
    },
  };
}
