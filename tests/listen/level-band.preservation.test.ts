// Task 2 of listen-grille-band-level. Preservation tests, written on UNFIXED code.
// They pass before the fix and must pass after it (re-run in task 3.9).
// Observed on unfixed code: the decoder gets the very same Float32Array object, the grille lights
// from the centre outwards, the meter is 0 unless running, empty and NaN blocks give level 0.
// Only TEST alerts. Audio stays in memory and is never written anywhere.
// **Validates: Requirements 3.1, 3.2, 3.5, 3.6, 3.7, 3.8**
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { bandLevel, INITIAL_LEVEL_STATE } from '../../src/listen/level';
import { stringsEn } from '../../src/broadcast/strings.en';
import { createListenController } from '../../src/listen/controller';
import { buildListenUi } from '../../src/listen/ui-state';
import type { Phase } from '../../src/listen/ui-state';
import { initialModel } from '../../src/listen/model';
import { GRILLE_DOTS, grilleDots, litCount } from '../../src/shared/ui/grille-layout';
import type { Alert } from '../../src/message-code';
import { encodeOrThrow } from '../message-code/generators';
import {
  FakeAudioInput,
  FakeIntervalTimers,
  FakeListenClock,
  FakeListenStorage,
  FakePageVisibility,
  FakeSoundLinkLoader,
  FakeWakeLock,
  flushPromises,
} from './fakes';

/**
 * The one function to repoint in task 3.9 when the level call changes. It must return a number
 * and must not throw.
 */
function levelCall(samples: Float32Array): number {
  return bandLevel(INITIAL_LEVEL_STATE, samples, 48000).level;
}

const NOW = 29_000_000 * 60000 + 60_000;

function testAlert(): Alert {
  return {
    test: true,
    passedOn: false,
    event: 'flood',
    urgency: 'immediate',
    severity: 'severe',
    action: 'evacuate',
    sentMinute: 29_000_000,
    validSteps: 8,
    latitude: null,
    longitude: null,
    stationId: 7,
    counter: 1,
    placeName: 'Test Town',
  };
}

function setup(extraDeps: Record<string, unknown> = {}) {
  const clock = new FakeListenClock(NOW);
  const timers = new FakeIntervalTimers(clock);
  const audio = new FakeAudioInput();
  const loader = new FakeSoundLinkLoader();
  const storage = new FakeListenStorage();
  const ctl = createListenController({
    clock,
    timers,
    audio,
    loadLink: loader.load,
    storage,
    wake: new FakeWakeLock(),
    visibility: new FakePageVisibility(true),
    strings: stringsEn,
    ...extraDeps,
  });
  return { ctl, audio, loader };
}

async function start(s: ReturnType<typeof setup>): Promise<void> {
  await s.ctl.tapStart();
  await flushPromises();
}

function noiseBlock(seed: number, length = 1024, peak = 0.3): Float32Array {
  let x = seed >>> 0 || 1;
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    out[i] = ((x / 4294967296) * 2 - 1) * peak;
  }
  return out;
}

describe('3.1 the decoder gets the same block, and the same alert reaches the history', () => {
  it('passes the same object with the same contents for a run of blocks', async () => {
    const s = setup();
    await start(s);
    const listener = s.loader.lastLink!.lastListener!;
    const handle = s.audio.lastHandle!;
    const blocks = Array.from({ length: 12 }, (_, i) => noiseBlock(i + 1));
    const copies = blocks.map((b) => Float32Array.from(b));
    for (const b of blocks) handle.pushBlock(b);
    expect(listener.feedCalls).toBe(blocks.length);
    blocks.forEach((b, i) => {
      expect(listener.fed[i]).toBe(b); // same object
      expect(Array.from(listener.fed[i] as Float32Array)).toEqual(Array.from(copies[i]!)); // untouched
    });
  });

  it('the same TEST alert reaches the history for TEST broadcast blocks', async () => {
    const s = setup();
    await start(s);
    const listener = s.loader.lastLink!.lastListener!;
    listener.queuePayloads(encodeOrThrow(testAlert()));
    s.audio.lastHandle!.pushBlock(noiseBlock(99));
    const ui = s.ctl.snapshot();
    expect(ui.cards.length).toBe(1);
    expect(ui.cards[0]!.testBanner).toBe(stringsEn.text['test.banner']);
  });

  it('a block that fails to decode is discarded and the Session keeps running', async () => {
    const s = setup();
    await start(s);
    const listener = s.loader.lastLink!.lastListener!;
    listener.failWith = 'disposed';
    s.audio.lastHandle!.pushBlock(noiseBlock(5));
    expect(s.ctl.snapshot().running).toBe(true);
    expect(s.ctl.snapshot().cards.length).toBe(0);
  });
});

describe('3.2 the grille lights from the centre outwards', () => {
  it('has 37 dots, with distance from the centre never decreasing by index', () => {
    const dots = grilleDots();
    expect(dots.length).toBe(GRILLE_DOTS);
    const dist = dots.map((d) => Math.hypot(d.x - 50, d.y - 50));
    for (let i = 1; i < dist.length; i++) expect(dist[i]!).toBeGreaterThanOrEqual(dist[i - 1]! - 0.02);
  });
  it('litCount is 0 at 0 percent, all dots at 100 percent, and never decreases', () => {
    expect(litCount(0)).toBe(0);
    expect(litCount(100)).toBe(GRILLE_DOTS);
    let prev = 0;
    for (let p = 0; p <= 100; p++) {
      const n = litCount(p);
      expect(n).toBeGreaterThanOrEqual(prev);
      prev = n;
    }
  });
});

describe('3.5 and 3.6 the meter value and its text', () => {
  const model = initialModel([]);
  const base = { model, notice: 'none' as const, historyKept: true, nowMs: NOW, offsetMinutes: 0, strings: stringsEn };

  it.each<Phase>(['idle', 'starting'])('reports level 0 when the phase is %s', (phase) => {
    const ui = buildListenUi({ ...base, phase, level: 0.8 });
    expect(ui.level).toBe(0);
    expect(ui.levelLabel).toBe('Sound level 0 percent');
  });

  it('reports level 0 after a Session is stopped', async () => {
    const s = setup();
    await start(s);
    s.audio.lastHandle!.pushBlock(noiseBlock(3, 1024, 0.9));
    s.ctl.tapStop();
    expect(s.ctl.snapshot().running).toBe(false);
    expect(s.ctl.snapshot().level).toBe(0);
  });

  it('while running the level is clamped to 0..1 and the label uses listen.level.label', () => {
    const half = buildListenUi({ ...base, phase: 'running', level: 0.5 });
    expect(half.level).toBe(0.5);
    expect(half.levelLabel).toBe('Sound level 50 percent');
    expect(buildListenUi({ ...base, phase: 'running', level: 7 }).level).toBe(1);
    expect(buildListenUi({ ...base, phase: 'running', level: NaN }).level).toBe(0);
    expect(buildListenUi({ ...base, phase: 'running', level: -1 }).level).toBe(0);
  });

  it('the Listen page keeps role="meter" on the level element', async () => {
    const html = (await import('../../listen/index.html?raw')).default;
    expect(html).toMatch(/id="level-meter"[^>]*role="meter"|role="meter"[^>]*id="level-meter"/);
  });
});

describe('3.8 empty and NaN blocks', () => {
  it('give level 0 and do not throw', () => {
    expect(levelCall(new Float32Array(0))).toBe(0);
    expect(levelCall(new Float32Array(1024).fill(NaN))).toBe(0);
    expect(levelCall(new Float32Array(1024))).toBe(0);
  });

  it('through the controller, an empty and a NaN block keep the level at 0 and the Session running', async () => {
    const s = setup();
    await start(s);
    const handle = s.audio.lastHandle!;
    handle.pushBlock(new Float32Array(0));
    expect(s.ctl.snapshot().level).toBe(0);
    handle.pushBlock(new Float32Array(1024).fill(NaN));
    expect(s.ctl.snapshot().level).toBe(0);
    expect(s.ctl.snapshot().running).toBe(true);
  });
});

describe('Property 4 shape: the level call never changes the samples and never throws', () => {
  it('holds for any block of 0 to 8192 floats, including NaN and Infinity', () => {
    fc.assert(
      fc.property(
        fc.float32Array({ maxLength: 8192, noNaN: false, noDefaultInfinity: false }),
        (block) => {
          const before = new Uint32Array(block.buffer.slice(block.byteOffset, block.byteOffset + block.byteLength));
          let result = NaN;
          expect(() => {
            result = levelCall(block);
          }).not.toThrow();
          expect(Number.isFinite(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(1);
          const after = new Uint32Array(block.buffer, block.byteOffset, block.length);
          expect(Array.from(after)).toEqual(Array.from(before)); // bit for bit, NaN payloads included
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('3.1 a throwing level function does not stop the decoder (enabled in task 3.4)', () => {
  // The controller takes an optional `levelFn` dependency (default bandLevel).
  it('still calls listener.feed for every block, keeps the last level, and keeps running', async () => {
    const throwingLevel = (): never => {
      throw new Error('level threw');
    };
    const s = setup({ levelFn: throwingLevel });
    await start(s);
    const listener = s.loader.lastLink!.lastListener!;
    listener.queuePayloads(encodeOrThrow(testAlert()));
    const blocks = [noiseBlock(1), noiseBlock(2), noiseBlock(3)];
    for (const b of blocks) s.audio.lastHandle!.pushBlock(b);
    expect(listener.feedCalls).toBe(blocks.length);
    blocks.forEach((b, i) => expect(listener.fed[i]).toBe(b));
    expect(s.ctl.snapshot().running).toBe(true);
    expect(s.ctl.snapshot().cards.length).toBe(1);
    expect(s.ctl.snapshot().level).toBe(0);
  });
});

describe('3.4 a second session warms up from level 0', () => {
  it('resets the level state in endSession, so the first block of the next session gives 0', async () => {
    const s = setup();
    await start(s);
    for (let i = 0; i < 20; i++) s.audio.lastHandle!.pushBlock(noiseBlock(7, 1024, 0.001));
    s.audio.lastHandle!.pushBlock(noiseBlock(8, 1024, 0.5));
    expect(s.ctl.snapshot().level).toBeGreaterThan(0); // warmed up, then a jump above the room
    s.ctl.tapStop();
    expect(s.ctl.snapshot().level).toBe(0);
    await start(s);
    s.audio.lastHandle!.pushBlock(noiseBlock(8, 1024, 0.5)); // warm-up block of the new session
    expect(s.ctl.snapshot().level).toBe(0);
  });
});
