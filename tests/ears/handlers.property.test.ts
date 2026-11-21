// Tasks 9.2 to 9.7. Properties 8 (handler level), 9 (second half), 11, 12, 13, 14 and 20.
// Properties 11, 12 and 20 run the real ggwave engine, so they use fewer runs and long timeouts.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { dirname, join, sep } from 'node:path';
import { readFileSync } from 'node:fs';
import { audioToWav } from '../../src/sound-link';
import { composeBroadcastAudio } from '../../src/broadcast/compose';
import { prepareAlert } from '../../tools/ears/alert-input';
import { createHandlers } from '../../tools/ears/handlers';
import type { Deps } from '../../tools/ears/handlers';
import { toolError } from '../../tools/ears/errors';
import { readWav } from '../../tools/ears/wav-reader';
import {
  invalidAlertArb, nonObjectArb, nonTestInputArb, sampleRateArb, smallTestAlertArb, validTestInputArb,
} from './generators';
import { NOW, NOW_MINUTE, listDir, makeTempDir, realGetLink, realHandlers, removeDir } from './helpers';

let outDir: string;
beforeAll(() => {
  outDir = makeTempDir();
});
afterAll(() => removeDir(outDir));

/** Deps whose every dependency fails the test if it is touched. */
function forbiddenDeps(): { deps: Deps; touched: string[] } {
  const touched: string[] = [];
  const deps: Deps = {
    now: () => NOW,
    getLink: async () => {
      touched.push('getLink');
      return toolError('sound-link-unavailable', 'forbidden in this test');
    },
    outDir: '/nonexistent-ears-test-dir',
    files: {
      readFile: () => { touched.push('readFile'); throw new Error('forbidden'); },
      fileSize: () => { touched.push('fileSize'); return 'missing'; },
      ensureDir: () => { touched.push('ensureDir'); throw new Error('forbidden'); },
      writeAtomic: () => { touched.push('writeAtomic'); throw new Error('forbidden'); },
    },
  };
  return { deps, touched };
}

const timeout = 120000;

describe('make_broadcast properties', () => {
  // Feature: kiro-ears, Property 11: make_broadcast output decodes to the alert
  // numRuns is 15 because each run encodes and decodes about 10 seconds of audio with ggwave.
  it('Property 11: the file decodes to the sent alert', async () => {
    const h = realHandlers(outDir);
    await fc.assert(
      fc.asyncProperty(validTestInputArb, sampleRateArb, async (input, rate) => {
        const made = await h.makeBroadcast({ alert: input, sampleRate: rate });
        expect(made.ok).toBe(true);
        if (!made.ok) return;
        expect(dirname(made.path)).toBe(outDir);
        expect(made.messageBytes).toBeGreaterThanOrEqual(21);
        expect(made.messageBytes).toBeLessThanOrEqual(40);
        const wav = readWav(readFileSync(made.path));
        expect(wav.ok).toBe(true);
        if (!wav.ok) return;
        expect(made.seconds).toBe(Math.round((wav.samples.length / rate) * 100) / 100);
        const heard = await h.hearWav({ path: made.path });
        expect(heard.ok).toBe(true);
        if (!heard.ok) return;
        expect(heard.heard).toBeGreaterThanOrEqual(1);
        for (const p of heard.payloads) {
          expect(p.check).toBe('passed');
          expect(p.alert).toEqual({ ...input, sentMinute: NOW_MINUTE });
        }
      }),
      { numRuns: 15 },
    );
  }, timeout);

  // Feature: kiro-ears, Property 12: make_broadcast is deterministic and matches the page
  it('Property 12: same alert, same file, same samples as the page', async () => {
    const h = realHandlers(outDir);
    await fc.assert(
      fc.asyncProperty(validTestInputArb, sampleRateArb, async (input, rate) => {
        const a = await h.makeBroadcast({ alert: input, sampleRate: rate });
        const b = await h.makeBroadcast({ alert: input, sampleRate: rate });
        expect(a.ok && b.ok).toBe(true);
        if (!(a.ok && b.ok)) return;
        expect(a.path).toBe(b.path);
        const bytesA = readFileSync(a.path);
        expect(Array.from(readFileSync(b.path))).toEqual(Array.from(bytesA));

        // What the Broadcast page writes: compose(bytesToAudio(bytes)), then audioToWav.
        const prepared = prepareAlert(input, NOW);
        const got = await realGetLink(rate);
        expect(prepared.ok && got.ok).toBe(true);
        if (!(prepared.ok && got.ok)) return;
        const audio = got.link.bytesToAudio(prepared.bytes);
        expect(audio.ok).toBe(true);
        if (!audio.ok) return;
        const expected = audioToWav(composeBroadcastAudio(audio.samples, rate), rate);
        expect(expected.ok && Array.from(expected.wav)).toEqual(Array.from(bytesA));
      }),
      { numRuns: 15 },
    );
  }, timeout);

  // Feature: kiro-ears, Property 13: The caller cannot choose where a file goes
  it('Property 13: the path is always a direct child of the Output_Directory', async () => {
    const dir = makeTempDir();
    try {
      const h = realHandlers(dir);
      const hostile = fc.constantFrom('../evil.wav', '/tmp/evil.wav', 'a/b/c.wav', '..', '..\\x', '');
      await fc.assert(
        fc.asyncProperty(validTestInputArb, hostile, hostile, hostile, async (input, p, f, o) => {
          const r = await h.makeBroadcast({ alert: input, path: p, fileName: f, outDir: o, outputPath: p });
          expect(r.ok).toBe(true);
          if (!r.ok) return;
          expect(r.path.startsWith(dir + sep)).toBe(true);
          const rel = r.path.slice(dir.length + 1);
          expect(rel).toMatch(/^dead-air-[0-9a-f]{16}\.wav$/);
          expect(rel.includes(sep)).toBe(false);
          expect(listDir(dir).every((n) => /^dead-air-[0-9a-f]{16}\.wav$/.test(n))).toBe(true);
        }),
        { numRuns: 12 },
      );
    } finally {
      removeDir(dir);
    }
  }, timeout);
});

describe('parameter validation properties', () => {
  const badRate = fc.constantFrom<unknown>(15999, 96001, 1.5, '48000', Number.NaN, null, -1, Infinity, true);
  const badNoise = fc.constantFrom<unknown>(61, -61, Number.NaN, Infinity, -Infinity, '5', null, true, {});
  const badTries = fc.constantFrom<unknown>(0, 201, 1.5, '3', Number.NaN, null, -1, Infinity, true);
  const goodAlert = { ...({} as object), test: true, passedOn: false, event: 'flood', urgency: 'immediate', severity: 'severe', action: 'evacuate', validSteps: 24, latitude: null, longitude: null, stationId: 1, counter: 1, placeName: 'x' };

  // Feature: kiro-ears, Property 14: Out-of-range parameters are rejected with their own reason
  it('Property 14: each bad value gets its own reason and touches nothing', async () => {
    await fc.assert(
      fc.asyncProperty(badRate, badNoise, badTries, async (rate, noise, tries) => {
        const { deps, touched } = forbiddenDeps();
        const h = createHandlers(deps);
        const a = await h.makeBroadcast({ alert: goodAlert, sampleRate: rate });
        expect(!a.ok && a.reason).toBe('bad-sample-rate');
        const b = await h.roundTrip({ alert: goodAlert, noiseDb: 0, sampleRate: rate });
        expect(!b.ok && b.reason).toBe('bad-sample-rate');
        const c = await h.roundTrip({ alert: goodAlert, noiseDb: noise });
        expect(!c.ok && c.reason).toBe('bad-noise-level');
        const d = await h.hearWav({ path: '/x.wav', noiseDb: noise });
        expect(!d.ok && d.reason).toBe('bad-noise-level');
        const e = await h.roundTrip({ alert: goodAlert, noiseDb: 0, tries });
        expect(!e.ok && e.reason).toBe('bad-tries');
        expect(touched).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it('Property 14 (other half): in-range values never give a range reason', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 16000, max: 96000 }),
        fc.double({ min: -60, max: 60, noNaN: true }),
        fc.integer({ min: 1, max: 200 }),
        async (rate, noise, tries) => {
          const { deps } = forbiddenDeps();
          const h = createHandlers(deps);
          const a = await h.makeBroadcast({ alert: goodAlert, sampleRate: rate });
          const b = await h.roundTrip({ alert: goodAlert, noiseDb: noise, tries, sampleRate: rate });
          for (const r of [a, b]) {
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.reason).toBe('sound-link-unavailable');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('round_trip properties', () => {
  // Feature: kiro-ears, Property 20: round_trip is repeatable
  // numRuns is 6 and N is at most 3, because each try decodes about 12 seconds of audio.
  it('Property 20: same inputs, same result', async () => {
    const h = realHandlers(outDir);
    await fc.assert(
      fc.asyncProperty(
        smallTestAlertArb,
        fc.integer({ min: -20, max: 20 }),
        fc.integer({ min: 0, max: 4294967295 }),
        sampleRateArb,
        fc.integer({ min: 1, max: 3 }),
        async (alert, noiseDb, seed, sampleRate, tries) => {
          const { sentMinute: _s, ...input } = alert;
          void _s;
          const args = { alert: input, noiseDb, seed, sampleRate, tries };
          const a = await h.roundTrip(args);
          const b = await h.roundTrip(args);
          expect(a.ok).toBe(true);
          expect(b).toEqual(a);
        },
      ),
      { numRuns: 6 },
    );
  }, timeout);
});

describe('TEST rule at handler level', () => {
  // Feature: kiro-ears, Property 8: Only TEST alerts, only objects (handler level)
  it('Property 8: rejected input touches nothing and writes nothing', async () => {
    const dir = makeTempDir();
    try {
      await fc.assert(
        fc.asyncProperty(nonObjectArb, nonTestInputArb, async (bad, nonTest) => {
          const { deps, touched } = forbiddenDeps();
          const h = createHandlers({ ...deps, outDir: dir });
          const before = listDir(dir);
          for (const input of [bad, nonTest]) {
            const a = await h.makeBroadcast({ alert: input });
            const b = await h.roundTrip({ alert: input, noiseDb: 0 });
            const expected = input === bad ? 'invalid-input-type' : 'not-a-test-alert';
            expect(!a.ok && a.reason).toBe(expected);
            expect(!b.ok && b.reason).toBe(expected);
          }
          expect(touched).toEqual([]);
          expect(listDir(dir)).toEqual(before);
        }),
        { numRuns: 100 },
      );
    } finally {
      removeDir(dir);
    }
  });

  // Feature: kiro-ears, Property 9: Alert rejections name the field (no file written)
  it('Property 9: a rejected field is named and no file is written', async () => {
    const dir = makeTempDir();
    try {
      await fc.assert(
        fc.asyncProperty(invalidAlertArb, async (c) => {
          const { deps, touched } = forbiddenDeps();
          const r = await createHandlers({ ...deps, outDir: dir }).makeBroadcast({ alert: c.input });
          expect(r.ok).toBe(false);
          if (!r.ok) expect(r.field).toBe(c.field);
          expect(touched).toEqual([]);
          expect(listDir(dir)).toEqual([]);
        }),
        { numRuns: 100 },
      );
    } finally {
      removeDir(dir);
    }
  });
});

void join;
