// Task 3.5 of listen-grille-band-level. Behavior tests for bandPowerDb and bandLevel.
// All audio is a TEST alert or synthetic sound, built in memory. Nothing is written or sent.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { alphaDown, alphaUp, bandLevel, bandPowerDb } from '../../src/listen/level';
import type { LevelState } from '../../src/listen/level';
import { CAP_DB, LINK_BAND, MIN_LIT_DOTS, TAU_DOWN, TAU_UP, BACKGROUND_FLOOR_DB } from '../../src/listen/level-band';
import { litCount } from '../../src/shared/ui/grille-layout';
import { stringsEn } from '../../src/broadcast/strings.en';
import { createListenController } from '../../src/listen/controller';
import { encodeOrThrow } from '../message-code/generators';
import type { Alert } from '../../src/message-code';
import {
  FakeAudioInput,
  FakeIntervalTimers,
  FakeListenClock,
  FakeListenStorage,
  FakePageVisibility,
  makeFakeHost,
  makeFakeTimeouts,
  FakeSoundLinkLoader,
  FakeWakeLock,
  flushPromises,
} from './fakes';
import {
  BLOCK,
  RATE,
  backToBack,
  concat,
  mean,
  mix,
  run,
  scaled,
  testBroadcast,
  thump,
  toBlocks,
  tone,
  whiteNoise,
} from './level-band.helpers';

const CENTRE = (LINK_BAND.lowestHz + LINK_BAND.highestHz) / 2;
const rep = (b: Float32Array, n: number): Float32Array[] => Array.from({ length: n }, () => b);
const blocksFor = (seconds: number, len = BLOCK, rate = RATE) => Math.round((seconds * rate) / len);

describe('bandPowerDb', () => {
  it('a tone at the band centre is far higher than the same tone at 70 Hz', () => {
    const inBand = bandPowerDb(tone(CENTRE, 0.1), RATE) as number;
    const low = bandPowerDb(tone(70, 0.1), RATE) as number;
    expect(inBand - low, `in ${inBand} low ${low}`).toBeGreaterThan(40);
  });

  it('tones at the lower and upper edge of LINK_BAND are counted', () => {
    const centre = bandPowerDb(tone(CENTRE, 0.1), RATE) as number;
    const silence = bandPowerDb(new Float32Array(BLOCK), RATE) as number;
    for (const hz of [LINK_BAND.lowestHz, LINK_BAND.highestHz]) {
      const db = bandPowerDb(tone(hz, 0.1), RATE) as number;
      expect(db, `${hz} Hz: ${db}, centre ${centre}`).toBeGreaterThan(centre - 10);
      expect(db - silence).toBeGreaterThan(60);
    }
  });

  it('a tone one octave below the band is far lower than one inside it', () => {
    const inside = bandPowerDb(tone(LINK_BAND.lowestHz, 0.1), RATE) as number;
    const below = bandPowerDb(tone(LINK_BAND.lowestHz / 2, 0.1), RATE) as number;
    expect(inside - below, `inside ${inside}, below ${below}`).toBeGreaterThan(30);
  });
});

describe('bandLevel steps', () => {
  const quiet = tone(3000, 0.01);
  const loud = tone(3000, 0.1); // +20 dB

  it('a +20 dB step lights part of the grille and is still lit after 14 s', () => {
    const r = run([quiet, ...rep(loud, blocksFor(14))]);
    expect(r.lit[0]).toBe(0);
    expect(r.lit[1]).toBeGreaterThan(0);
    expect(r.lit[r.lit.length - 1], `level at end ${r.levels[r.levels.length - 1]}`).toBeGreaterThan(0);
    expect(r.levels[r.levels.length - 1]!).toBeLessThan(1);
  });

  it('after a 20 dB step down in the room, the background follows within about 5 s', () => {
    const target = bandPowerDb(quiet, RATE) as number;
    const r = run([loud, ...rep(quiet, blocksFor(5))]);
    const bg = r.background[r.background.length - 1]!;
    expect(bg - target, `background ${bg}, quiet ${target}`).toBeLessThan(0.5);
  });

  it('a rise of 3 dB, below the gate, gives 0', () => {
    const r = run([quiet, ...rep(scaled(quiet, 1.4125), blocksFor(20))]);
    expect(Math.max(...r.lit)).toBe(0);
    expect(Math.max(...r.levels)).toBe(0);
  });
});

describe('settling time is in seconds, not blocks', () => {
  it('the same 20 dB fall settles in about the same time at block lengths 512, 1024 and 4096', () => {
    const times = [512, 1024, 4096].map((len) => {
      const quiet = tone(3000, 0.01, len);
      const target = bandPowerDb(quiet, RATE) as number;
      let state: LevelState = bandLevel({ backgroundDb: null }, tone(3000, 0.1, len), RATE).state;
      let n = 0;
      while ((state.backgroundDb as number) - target > 1 && n < 100000) {
        state = bandLevel(state, quiet, RATE).state;
        n++;
      }
      return (n * len) / RATE;
    });
    const expected = TAU_DOWN * Math.log(20);
    for (const t of times) expect(Math.abs(t - expected), `times ${times.join(', ')}`).toBeLessThan(0.2);
  });
});

describe('the background floor', () => {
  it('a run of digital silence followed by room noise does not leave the grille lit for more than a few seconds', () => {
    const silence = rep(new Float32Array(BLOCK), blocksFor(60));
    const room = toBlocks(whiteNoise(120, 0.003, 11));
    const r = run([...silence, ...room]);
    const after = r.lit.slice(silence.length);
    const litSeconds = (after.filter((n) => n > 0).length * BLOCK) / RATE;
    expect(litSeconds, `lit for ${litSeconds.toFixed(1)} s of 120 s (floor ${BACKGROUND_FLOOR_DB} dB)`).toBeLessThanOrEqual(5);
  });
});

describe('a thump does not drag the background up', () => {
  it('a 70 Hz thump of peak 0.9 during steady room noise moves the background by no more than the cap allows', () => {
    const roomLen = 6 * RATE;
    const room = whiteNoise(7, 0.003, 5);
    const withThump = mix(room, thump(), roomLen);
    const blocks = toBlocks(withThump);
    const start = Math.floor(roomLen / BLOCK);
    const r = run(blocks);
    const span = 0.5; // seconds from just before the thump to just after it
    const n = Math.ceil((span * RATE) / BLOCK);
    const before = r.background[start - 1]!;
    const after = r.background[start - 1 + n]!;
    expect(after - before, `before ${before}, after ${after}`).toBeLessThanOrEqual(((n * BLOCK) / RATE / TAU_UP) * CAP_DB + 0.05);
  });
});

describe('integration with the TEST broadcast', () => {
  it('a quiet broadcast lights more dots than a 70 Hz thump of peak 0.9 over the same room', async () => {
    const base = await testBroadcast();
    const lead = 141 * BLOCK;
    const room = whiteNoise(3 + 8, 0.002, 21);
    const pad = (s: Float32Array) => concat(new Float32Array(lead), s);
    const withBroadcast = run(toBlocks(mix(room, pad(scaled(base, 0.02)))));
    const withThump = run(toBlocks(mix(room, pad(thump()))));
    const b = Math.max(...withBroadcast.lit);
    const t = Math.max(...withThump.lit);
    expect(b, `broadcast max dots ${b}, thump max dots ${t}`).toBeGreaterThan(t);
  }, 60000);

  it.each([0.02, 0.2])('back-to-back broadcast at gain %s stays lit for the whole window', async (gain) => {
    const bb = await backToBack(gain, 0.002, 3);
    const r = run(bb.blocks);
    const lit = bb.window.map((i) => r.lit[i]!);
    const min = Math.min(...lit);
    const at = bb.window[lit.indexOf(min)]! - bb.lead;
    expect(min, `gain ${gain}: fewest dots ${min} at block ${at} of the broadcast; MIN_LIT_DOTS ${MIN_LIT_DOTS}`).toBeGreaterThan(0);
    expect(min, `gain ${gain}: fewest dots ${min} at block ${at}`).toBeGreaterThanOrEqual(MIN_LIT_DOTS);
    const play1 = bb.window.filter((i) => i < bb.lead + bb.playBlocks).map((i) => r.lit[i]!);
    const play2 = bb.window.filter((i) => i >= bb.lead + bb.playBlocks).map((i) => r.lit[i]!);
    expect(mean(play2), `play 1 mean ${mean(play1).toFixed(2)}, play 2 mean ${mean(play2).toFixed(2)}`).toBeGreaterThanOrEqual(
      0.7 * mean(play1),
    );
  }, 60000);

  it('silence and steady noise light no dot at any block after warm-up', () => {
    expect(Math.max(...run(rep(new Float32Array(BLOCK), 300)).lit)).toBe(0);
    const r = run(toBlocks(whiteNoise(30, 0.05, 9)));
    expect(Math.max(...r.lit.slice(blocksFor(5)))).toBe(0);
  });

  it('the decoder still gets the broadcast blocks and the same alert reaches the history', async () => {
    const base = await testBroadcast();
    const sig = mix(whiteNoise(8, 0.002, 4), scaled(base, 0.05), 2 * RATE);
    const blocks = toBlocks(sig);
    const alert: Alert = {
      test: true, passedOn: false, hopCount: 0, event: 'flood', urgency: 'immediate', severity: 'severe', action: 'evacuate',
      sentMinute: 29_000_000, validSteps: 8, latitude: null, longitude: null, stationId: 7, counter: 1, placeName: 'Test Town',
    };
    const clock = new FakeListenClock(29_000_000 * 60000 + 60_000);
    const audio = new FakeAudioInput();
    const loader = new FakeSoundLinkLoader();
    const ctl = createListenController({
      clock, timers: new FakeIntervalTimers(clock), audio, loadLink: loader.load, storage: new FakeListenStorage(),
      wake: new FakeWakeLock(), visibility: new FakePageVisibility(true), host: makeFakeHost(), timeouts: makeFakeTimeouts(), strings: stringsEn,
    });
    await ctl.tapStart();
    await flushPromises();
    const listener = loader.lastLink!.lastListener!;
    let maxLevel = 0;
    blocks.forEach((b, i) => {
      if (i === 200) listener.queuePayloads(encodeOrThrow(alert));
      audio.lastHandle!.pushBlock(b);
      maxLevel = Math.max(maxLevel, ctl.snapshot().level);
    });
    expect(listener.feedCalls).toBe(blocks.length);
    blocks.forEach((b, i) => expect(listener.fed[i]).toBe(b));
    expect(ctl.snapshot().cards.length).toBe(1);
    expect(maxLevel).toBeGreaterThan(0);
  }, 60000);
});

describe('properties', () => {
  // Feature: listen-grille-band-level, Property 1
  it('Property 1: a broadcast at gain 0.005 to 0.2 lights more dots than the 0.9 thump', async () => {
    const base = await testBroadcast();
    const lead = 141 * BLOCK;
    const room = whiteNoise(3 + 8, 0.002, 21);
    const withThump = run(toBlocks(mix(room, concat(new Float32Array(lead), thump()))));
    const t = Math.max(...withThump.lit);
    await fc.assert(
      fc.asyncProperty(fc.double({ min: 0.005, max: 0.2, noNaN: true }), async (gain) => {
        const r = run(toBlocks(mix(room, concat(new Float32Array(lead), scaled(base, gain)))));
        const b = Math.max(...r.lit);
        expect(b, `gain ${gain}: broadcast ${b} dots, thump ${t} dots`).toBeGreaterThan(t);
      }),
      { numRuns: 10 },
    );
  }, 120000);

  // Feature: listen-grille-band-level, Property 1
  it('Property 1: steady white noise from 0.001 to 0.3 lights nothing from 10 s on', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.001, max: 0.3, noNaN: true }), (peak) => {
        const r = run(toBlocks(whiteNoise(25, peak, 77)));
        const after = r.levels.slice(blocksFor(10));
        expect(Math.max(...after), `peak ${peak}`).toBe(0);
      }),
      { numRuns: 10 },
    );
  });

  // Feature: listen-grille-band-level, Property 5
  // Domain (task 3.6): gain 0.01 to 0.2, room 0.002 to 0.02, and the room never louder than an eighth of the gain,
  // so the broadcast is at least about 15 dB over the room in the band ("over a quiet room", design). Outside it the
  // meter cannot work: BACKGROUND_FLOOR_DB (-55 dB, a few dB under the quietest real room, about -52 dB) treats a
  // room quieter than that as -55 dB, and a broadcast less than about 15 dB over the room dips under GATE_DB (at a fifth, 11 dB, the fewest dots over 120 runs was 1 to 3).
  // Gain 0.005 over a room of peak 0.001 (-57 dB) is decodable (round_trip) but lights the grille only in places.
  it('Property 5: back-to-back play at gain 0.01 to 0.2 over a quiet room stays lit for every block of the window', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.double({ min: 0.01, max: 0.2, noNaN: true }),
        fc.double({ min: 0.002, max: 0.02, noNaN: true }),
        fc.integer({ min: 1, max: 100000 }),
        async (gain, room, seed) => {
          const roomPeak = Math.min(room, gain / 8);
          const bb = await backToBack(gain, roomPeak, seed);
          const r = run(bb.blocks);
          const lit = bb.window.map((i) => r.lit[i]!);
          const min = Math.min(...lit);
          const at = bb.window[lit.indexOf(min)]! - bb.lead;
          expect(min, `gain ${gain}, room ${roomPeak}, seed ${seed}: fewest dots ${min} at block ${at}`).toBeGreaterThanOrEqual(
            Math.max(1, MIN_LIT_DOTS),
          );
        },
      ),
      { numRuns: 8 },
    );
  }, 180000);

  // Feature: listen-grille-band-level, Property 5
  it('Property 5: 0 < alphaUp < alphaDown < 1 for any block length and sample rate', () => {
    fc.assert(
      fc.property(fc.integer({ min: 256, max: 8192 }), fc.integer({ min: 16000, max: 96000 }), (len, rate) => {
        const s = len / rate;
        expect(alphaUp(s)).toBeGreaterThan(0);
        expect(alphaUp(s)).toBeLessThan(alphaDown(s));
        expect(alphaDown(s)).toBeLessThan(1);
      }),
    );
  });

  // Feature: listen-grille-band-level, Property 5
  it('Property 5: held d dB above the background for T s, the background rises by at most min(d, T/TAU_UP*CAP_DB)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 256, max: 8192 }),
        fc.integer({ min: 16000, max: 96000 }),
        fc.double({ min: 1, max: 40, noNaN: true }),
        fc.double({ min: 1, max: 60, noNaN: true }),
        (len, rate, d, T) => {
          const block = tone(3000, 0.5, len, rate);
          const p = bandPowerDb(block, rate) as number;
          const start = p - d;
          let state: LevelState = { backgroundDb: start };
          const n = Math.max(1, Math.round((T * rate) / len));
          for (let i = 0; i < n; i++) state = bandLevel(state, block, rate).state;
          const rise = (state.backgroundDb as number) - start;
          const bound = Math.min(d, (((n * len) / rate) / TAU_UP) * CAP_DB) + 0.05;
          expect(rise, `len ${len} rate ${rate} d ${d} T ${T}`).toBeLessThanOrEqual(bound);
        },
      ),
      { numRuns: 10 },
    );
  });

  // Feature: listen-grille-band-level, Property 5
  it('Property 5: held below the background, the gap decays by exp(-T/TAU_DOWN)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 256, max: 8192 }),
        fc.integer({ min: 16000, max: 96000 }),
        fc.double({ min: 3, max: 40, noNaN: true }),
        fc.double({ min: 0.3, max: 8, noNaN: true }),
        (len, rate, gap, T) => {
          const block = tone(3000, 0.5, len, rate);
          const p = bandPowerDb(block, rate) as number;
          let state: LevelState = { backgroundDb: p + gap };
          const n = Math.max(1, Math.round((T * rate) / len));
          for (let i = 0; i < n; i++) state = bandLevel(state, block, rate).state;
          const left = (state.backgroundDb as number) - p;
          const expected = gap * Math.exp(-((n * len) / rate) / TAU_DOWN);
          const atFloor = (state.backgroundDb as number) <= BACKGROUND_FLOOR_DB + 1e-9;
          expect(atFloor || Math.abs(left - expected) < 0.02, `len ${len} rate ${rate} gap ${gap} T ${T}: left ${left}, expected ${expected}`).toBe(true);
        },
      ),
      { numRuns: 20 },
    );
  });

  // Feature: listen-grille-band-level, Property 1
  it('scaling the broadcast and the room by the same factor gives the same level', async () => {
    const base = await testBroadcast();
    const lead = 141 * BLOCK;
    const room = whiteNoise(3 + 8, 0.01, 31);
    const sig = concat(new Float32Array(lead), scaled(base, 0.1));
    const ref = run(toBlocks(mix(room, sig))).levels;
    fc.assert(
      fc.property(fc.double({ min: 0.2, max: 1, noNaN: true }), (k) => {
        const r = run(toBlocks(scaled(mix(room, sig), k))).levels;
        let worst = 0;
        r.forEach((v, i) => (worst = Math.max(worst, Math.abs(v - ref[i]!))));
        expect(worst, `factor ${k}`).toBeLessThan(0.01);
      }),
      { numRuns: 5 },
    );
  }, 60000);
});

describe('meter value and source checks', () => {
  it('aria-valuenow follows the new level', async () => {
    // Loaded by a computed path: src/shared/ui/dom is DOM code, outside the DOM-free tsconfig.json program.
    const grillePath = '../../src/shared/ui/dom/grille';
    const { createGrille } = (await import(/* @vite-ignore */ grillePath)) as { createGrille: (...a: any[]) => { draw(n: number): void } };
    const attrs: Record<string, string> = {};
    const el = (): any => ({
      className: '', style: {}, children: [] as unknown[],
      setAttribute() {}, appendChild() {},
    });
    const doc = { createElement: el } as unknown;
    const root = { setAttribute: (k: string, v: string) => (attrs[k] = v), replaceChildren() {} } as unknown;
    const g = createGrille(doc, root, { now: () => 0, setTimer: () => 0, clearTimer: () => {}, reducedMotion: () => false });
    const quiet = tone(3000, 0.01);
    const r = run([quiet, tone(3000, 0.1)]);
    g.draw(Math.round(r.levels[1]! * 100));
    expect(attrs['aria-valuenow']).toBe(String(Math.round(r.levels[1]! * 100)));
    expect(Number(attrs['aria-valuenow'])).toBeGreaterThan(0);
    g.draw(Math.round(r.levels[0]! * 100));
    expect(attrs['aria-valuenow']).toBe('0');
    expect(litCount(0)).toBe(0);
  });

  it('level.ts and level-band.ts use no fetch and import nothing from a URL', () => {
    for (const f of ['src/listen/level.ts', 'src/listen/level-band.ts']) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|https?:\/\//);
      expect(src, f).not.toMatch(/from\s+['"]https?:/);
    }
  });
});
