// Demo player for the front page. A small state machine with injected deps, no browser API.
// It never uses the microphone, never records audio and never sends anything (promise 5, 4.10, 4.11).
// Direct module imports, not the broadcast barrel: the barrel pulls the Broadcast controller,
// which shares a chunk with the sound engine and would make the front page load it at once.
import { runBroadcast } from '../broadcast/broadcast-run';
import { runBuild } from '../broadcast/build';
import type { LinkLike } from '../broadcast/build';
import type { AudioHost, Clock, Timers } from '../broadcast/providers';
import { buildDemoAlert } from './demo-alert';

type BroadcastRunLike = ReturnType<typeof runBroadcast>;

export type DemoState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'playing' }
  | { kind: 'failed'; reason: 'load' | 'build' | 'audio' | 'clock' };

export interface DemoDeps {
  clock: Clock;
  timers: Timers;
  audio: AudioHost;
  /** Loads the sound link. Null when it cannot be loaded. */
  loadLink: () => Promise<LinkLike | null>;
  onState: (s: DemoState) => void;
}

export interface Demo {
  tap(): void;
  stop(): void;
  state(): DemoState;
}

export function createDemo(deps: DemoDeps): Demo {
  let current: DemoState = { kind: 'idle' };
  let link: LinkLike | null = null; // cached after the first success
  let generation = 0; // changes on stop(), so a stale tap can tell it was cancelled
  let run: BroadcastRunLike | null = null;

  const set = (s: DemoState): void => {
    current = s;
    deps.onState(s);
  };

  const flow = async (gen: number, unlocked: Promise<boolean>): Promise<void> => {
    const cancelled = (): boolean => gen !== generation;

    if (link === null) {
      let loaded: LinkLike | null = null;
      try {
        loaded = await deps.loadLink();
      } catch {
        loaded = null;
      }
      if (cancelled()) return;
      if (loaded === null) return set({ kind: 'failed', reason: 'load' });
      link = loaded;
    }

    const alert = buildDemoAlert(deps.clock.now());
    if (alert === null) return set({ kind: 'failed', reason: 'clock' });

    let built;
    try {
      built = runBuild(link, alert, false);
    } catch {
      return set({ kind: 'failed', reason: 'build' });
    }
    if (!built.ok) return set({ kind: 'failed', reason: 'build' });

    let ok = false;
    try {
      ok = await unlocked;
    } catch {
      ok = false;
    }
    if (cancelled()) return;
    if (!ok) return set({ kind: 'failed', reason: 'audio' });

    const started = runBroadcast(deps.audio.player, deps.timers, built.build);
    run = started;
    set({ kind: 'playing' });
    const result = await started.done;
    if (run === started) run = null;
    if (cancelled()) return;
    set(result.status === 'failed' ? { kind: 'failed', reason: 'audio' } : { kind: 'idle' });
  };

  return {
    tap(): void {
      if (current.kind === 'loading' || current.kind === 'playing') return;
      const gen = ++generation;
      set({ kind: 'loading' });
      // Called inside the tap, before any await (4.1).
      let unlocked: Promise<boolean>;
      try {
        unlocked = Promise.resolve(deps.audio.unlock());
      } catch {
        unlocked = Promise.resolve(false);
      }
      void flow(gen, unlocked);
    },

    stop(): void {
      if (current.kind !== 'loading' && current.kind !== 'playing') return;
      generation++;
      const r = run;
      run = null;
      if (r) r.stop();
      set({ kind: 'idle' });
    },

    state(): DemoState {
      return current;
    },
  };
}
