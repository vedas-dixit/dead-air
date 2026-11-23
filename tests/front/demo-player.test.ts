// Example tests for the Demo_Player, with fakes for the clock, timers, audio and sound link.
// Requirements 4.1, 4.4, 4.5, 4.7, 4.9.
import { describe, expect, it } from 'vitest';
import type { LinkLike } from '../../src/broadcast/index';
import { createDemo } from '../../src/front/demo-player';
import type { DemoState } from '../../src/front/demo-player';
import { buildDemoAlert } from '../../src/front/demo-alert';
import { encodeAlert } from '../../src/message-code/index';

const NOW = 1_800_000_000_000;
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** A link that returns the bytes it was given, so the real Self_Check passes. */
function fakeLink(opts: { audioFails?: boolean } = {}): LinkLike {
  let last: Uint8Array | null = null;
  return {
    sampleRate: 48000,
    bytesToAudio(bytes: unknown) {
      if (opts.audioFails) return { ok: false, reason: 'engine-error' } as const;
      last = bytes as Uint8Array;
      return { ok: true, samples: new Float32Array(480) } as const;
    },
    createListener() {
      let delivered = false;
      return {
        ok: true,
        listener: {
          feed: () => {
            if (delivered || last === null) return { ok: true, payloads: [] };
            delivered = true;
            return { ok: true, payloads: [last] };
          },
          reset: () => undefined,
          dispose: () => undefined,
        },
      } as ReturnType<LinkLike['createListener']>;
    },
  };
}

function setup(opts: { loads?: Array<LinkLike | null | 'throw'>; unlockOk?: boolean } = {}) {
  const log: string[] = [];
  const states: DemoState[] = [];
  const plays: Array<() => void> = [];
  const pendingTimers: Array<{ fn: () => void; ms: number }> = [];
  const gaps: number[] = [];
  const loads = [...(opts.loads ?? [fakeLink()])];
  let loadCalls = 0;
  let playCalls = 0;
  let stopCalls = 0;

  const demo = createDemo({
    clock: { now: () => NOW },
    timers: {
      setTimeout: (fn, ms) => {
        gaps.push(ms);
        pendingTimers.push({ fn, ms });
        return pendingTimers.length - 1;
      },
      clearTimeout: () => undefined,
    },
    audio: {
      unlock: () => {
        log.push('unlock');
        return Promise.resolve(opts.unlockOk ?? true);
      },
      player: {
        play: () => {
          playCalls++;
          log.push('play');
          return new Promise<void>((resolve) => plays.push(resolve));
        },
        stop: () => {
          stopCalls++;
          for (const p of plays) p();
        },
      },
    },
    loadLink: async () => {
      loadCalls++;
      log.push('load');
      const next = loads.length > 1 ? loads.shift()! : loads[0];
      if (next === 'throw') throw new Error('no link');
      return next;
    },
    onState: (s) => states.push(s),
  });

  return {
    demo,
    log,
    states,
    gaps,
    plays,
    pendingTimers,
    counts: () => ({ loadCalls, playCalls, stopCalls }),
  };
}

describe('Demo_Player', () => {
  it('has a demo alert that the fake link can carry', () => {
    const alert = buildDemoAlert(NOW);
    expect(alert).not.toBeNull();
    expect(encodeAlert(alert!).ok).toBe(true);
  });

  it('calls unlock inside tap, before the first await', () => {
    const t = setup();
    t.demo.tap();
    // No microtask has run yet: unlock is already done, the link is not loaded.
    expect(t.log[0]).toBe('unlock');
  });

  it('does not load the link before the first tap', async () => {
    const t = setup();
    await flush();
    expect(t.counts().loadCalls).toBe(0);
    expect(t.demo.state()).toEqual({ kind: 'idle' });
    t.demo.tap();
    await flush();
    expect(t.counts().loadCalls).toBe(1);
  });

  it('goes idle, loading, playing, idle', async () => {
    const t = setup();
    t.demo.tap();
    expect(t.demo.state().kind).toBe('loading');
    await flush();
    expect(t.demo.state().kind).toBe('playing');
    t.plays[0]!();
    await flush();
    t.pendingTimers[0]!.fn();
    await flush();
    t.plays[1]!();
    await flush();
    expect(t.states.map((s) => s.kind)).toEqual(['loading', 'playing', 'idle']);
  });

  it('plays the sound twice with a 1 second gap', async () => {
    const t = setup();
    t.demo.tap();
    await flush();
    t.plays[0]!();
    await flush();
    expect(t.gaps).toEqual([1000]);
    expect(t.counts().playCalls).toBe(1);
    t.pendingTimers[0]!.fn();
    await flush();
    expect(t.counts().playCalls).toBe(2);
  });

  it('stop returns to idle and silences the sound', async () => {
    const t = setup();
    t.demo.tap();
    await flush();
    expect(t.demo.state().kind).toBe('playing');
    t.demo.stop();
    await flush();
    expect(t.demo.state()).toEqual({ kind: 'idle' });
    expect(t.counts().stopCalls).toBe(1);
    expect(t.counts().playCalls).toBe(1);
  });

  it('keeps the button pressable after a load failure and retries on the next tap', async () => {
    const t = setup({ loads: [null, fakeLink()] });
    t.demo.tap();
    await flush();
    expect(t.demo.state()).toEqual({ kind: 'failed', reason: 'load' });
    t.demo.tap(); // a failed state accepts a new tap
    expect(t.demo.state().kind).toBe('loading');
    await flush();
    expect(t.counts().loadCalls).toBe(2);
    expect(t.demo.state().kind).toBe('playing');
  });

  it('treats a throwing loader as a load failure', async () => {
    const t = setup({ loads: ['throw'] });
    t.demo.tap();
    await flush();
    expect(t.demo.state()).toEqual({ kind: 'failed', reason: 'load' });
  });

  it('plays nothing when runBuild fails', async () => {
    const t = setup({ loads: [fakeLink({ audioFails: true })] });
    t.demo.tap();
    await flush();
    expect(t.demo.state()).toEqual({ kind: 'failed', reason: 'build' });
    expect(t.counts().playCalls).toBe(0);
  });
});
