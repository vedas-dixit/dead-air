// Tasks 9.8 and 9.9. Example tests for tool results, promises, errors, call counts and timing.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeAlert } from '../../src/message-code';
import type { Alert } from '../../src/message-code';
import { audioToWav } from '../../src/sound-link';
import type { SoundLink } from '../../src/sound-link';
import { composeBroadcastAudio } from '../../src/broadcast/compose';
import { prepareAlert } from '../../tools/ears/alert-input';
import { createHandlers, SAMPLE_ALERT } from '../../tools/ears/handlers';
import { addWhiteNoise, appendTailSilence } from '../../tools/ears/noise';
import { createFileOps } from '../../tools/ears/output-files';
import { buildWav } from './generators';
import { NOW, NOW_MINUTE, listDir, makeTempDir, realDeps, realGetLink, realHandlers, removeDir } from './helpers';

let dir: string;
beforeAll(() => {
  dir = makeTempDir();
});
afterAll(() => removeDir(dir));

const timeout = 120000;

async function wavOfBytes(bytes: Uint8Array, rate = 48000): Promise<Uint8Array> {
  const got = await realGetLink(rate);
  if (!got.ok) throw new Error('no link');
  const audio = got.link.bytesToAudio(bytes);
  if (!audio.ok) throw new Error('no audio');
  const wav = audioToWav(composeBroadcastAudio(audio.samples, rate), rate);
  if (!wav.ok) throw new Error('no wav');
  return wav.wav;
}
function write(name: string, bytes: Uint8Array): string {
  const path = join(dir, name);
  writeFileSync(path, bytes);
  return path;
}

describe('the three tools on the sample alert at 60 dB', () => {
  it('make_broadcast, hear_wav and round_trip agree', async () => {
    const h = realHandlers(dir);
    const made = await h.makeBroadcast({ alert: SAMPLE_ALERT });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(made.sampleRate).toBe(48000);
    expect(made.seconds).toBeGreaterThan(5);

    const heard = await h.hearWav({ path: made.path, noiseDb: 60 });
    expect(heard.ok).toBe(true);
    if (!heard.ok) return;
    expect(heard.heard).toBe(2);
    expect(heard.payloads.every((p) => p.check === 'passed' && p.alert?.test === true)).toBe(true);
    expect(heard.payloads[0]!.alert).toEqual({ ...SAMPLE_ALERT, sentMinute: NOW_MINUTE });
    expect(heard.payloads[0]!.statusText).toBe('current');
    expect(heard.noise).toEqual({ db: 60, seed: 1 });

    const rt = await h.roundTrip({ alert: SAMPLE_ALERT, noiseDb: 60, tries: 3 });
    expect(rt.ok).toBe(true);
    if (!rt.ok) return;
    expect(rt.counts).toEqual({ ok: 3, 'wrong-alert': 0, 'check-failed': 0, 'nothing-heard': 0 });
    expect(rt.successes).toBe(3);
    expect(rt.failures).toBe(0);
    expect(rt.bothPlaysHeardTries).toBe(3);
    expect(rt.seed).toBe(1);
    expect(rt.noiseDb).toBe(60);
  }, timeout);

  it('60 dB noise decodes to the same payload as the clean clip (6.7)', async () => {
    const prepared = prepareAlert(SAMPLE_ALERT, NOW);
    const got = await realGetLink(48000);
    expect(prepared.ok && got.ok).toBe(true);
    if (!(prepared.ok && got.ok)) return;
    const audio = got.link.bytesToAudio(prepared.bytes);
    if (!audio.ok) throw new Error('audio');
    const clip = appendTailSilence(composeBroadcastAudio(audio.samples, 48000), 48000);
    const noisy = addWhiteNoise(clip, clip.length - 96000, 60, 1);
    if (!noisy.ok) throw new Error('noise');
    for (const samples of [clip, noisy.samples]) {
      const l = got.link.createListener();
      if (!l.ok) throw new Error('listener');
      const fed = l.listener.feed(samples);
      l.listener.dispose();
      expect(fed.ok).toBe(true);
      if (fed.ok) {
        expect(fed.payloads.length).toBe(2);
        for (const p of fed.payloads) expect(Array.from(p)).toEqual(Array.from(prepared.bytes));
      }
    }
  }, timeout);
});

describe('promises', () => {
  it('a changed message byte gives check-failed and no alert fields (promise 1)', async () => {
    const prepared = prepareAlert(SAMPLE_ALERT, NOW);
    if (!prepared.ok) throw new Error('prepare');
    const bad = prepared.bytes.slice();
    bad[10] = bad[10]! ^ 0x55;
    const path = write('changed-byte.wav', await wavOfBytes(bad));
    const r = await realHandlers(dir).hearWav({ path });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.heard).toBeGreaterThanOrEqual(1);
    for (const p of r.payloads) {
      expect(p.check).toBe('failed');
      expect(p.reason).toBe('bad-check');
      for (const key of ['alert', 'sentUtc', 'status', 'statusText']) expect(key in p).toBe(false);
    }
    expect(JSON.stringify(r)).not.toContain('Riverside');
  }, timeout);

  it('an expired TEST alert is reported as not current (promise 2)', async () => {
    const old = { ...SAMPLE_ALERT, sentMinute: NOW_MINUTE - 3 * 24 * 60, validSteps: 1 };
    const r = await realHandlers(dir).roundTrip({ alert: old, noiseDb: 60, tries: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.counts.ok).toBe(3);
    expect(r.sentStatus).toBe('expired');
    expect(r.sentStatusText).toBe('EXPIRED, not current');
    const made = await realHandlers(dir).makeBroadcast({ alert: old });
    if (!made.ok) throw new Error('make');
    const heard = await realHandlers(dir).hearWav({ path: made.path });
    expect(heard.ok && heard.payloads[0]!.statusText).toBe('EXPIRED, not current');
    expect(heard.ok && heard.payloads[0]!.status).toBe('expired');
  }, timeout);

  it('a test:false alert is reported like any other (4.14)', async () => {
    const enc = encodeAlert({ ...SAMPLE_ALERT, test: false, sentMinute: NOW_MINUTE } as unknown as Alert);
    if (!enc.ok) throw new Error('encode');
    const path = write('non-test.wav', await wavOfBytes(enc.bytes));
    const r = await realHandlers(dir).hearWav({ path });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.heard).toBe(2);
      expect(r.payloads[0]!.check).toBe('passed');
      expect(r.payloads[0]!.alert?.test).toBe(false);
    }
  }, timeout);
});

describe('hear_wav inputs', () => {
  it('silence gives heard 0 and "nothing heard", not an error', async () => {
    const wav = audioToWav(new Float32Array(48000), 48000);
    if (!wav.ok) throw new Error('wav');
    const r = await realHandlers(dir).hearWav({ path: write('silence.wav', wav.wav) });
    expect(r).toMatchObject({ ok: true, heard: 0, summary: 'nothing heard', payloads: [] });
  });

  it('silence with noise gives silent-signal', async () => {
    const r = await realHandlers(dir).hearWav({ path: join(dir, 'silence.wav'), noiseDb: 0 });
    expect(!r.ok && r.reason).toBe('silent-signal');
  });

  it('file errors', async () => {
    const h = realHandlers(dir);
    expect((await h.hearWav({ path: join(dir, 'missing.wav') }))).toMatchObject({ ok: false, reason: 'file-not-found' });
    expect((await h.hearWav({ path: dir }))).toMatchObject({ ok: false, reason: 'file-unreadable' });
    expect((await h.hearWav({ path: write('t.txt', Uint8Array.from([...'hello world, plain text'].map((c) => c.charCodeAt(0)))) }))).toMatchObject({ ok: false, reason: 'not-wav' });
    expect((await h.hearWav({ path: write('8bit.wav', buildWav({ rate: 48000, channels: 1, bits: 8, pcm: [1, 2] })) }))).toMatchObject({ ok: false, reason: 'unsupported-wav' });
    expect((await h.hearWav({ path: write('3ch.wav', buildWav({ rate: 48000, channels: 3, pcm: [1, 2, 3] })) }))).toMatchObject({ ok: false, reason: 'unsupported-wav' });
    const big = createHandlers(realDeps(dir, { files: { ...createFileOps(), fileSize: () => 21_000_000 } }));
    expect((await big.hearWav({ path: 'whatever.wav' }))).toMatchObject({ ok: false, reason: 'file-too-large' });
    expect((await h.hearWav({ path: 5 }))).toMatchObject({ ok: false, reason: 'file-not-found' });
    expect((await h.hearWav('x'))).toMatchObject({ ok: false, reason: 'invalid-input-type' });
    expect((await h.hearWav({ path: join(dir, 'silence.wav'), seed: -1 }))).toMatchObject({ ok: false, reason: 'bad-seed' });
  });

  it('mono and stereo files at 44100 and 16000 Hz decode with the file rate', async () => {
    const prepared = prepareAlert(SAMPLE_ALERT, NOW);
    if (!prepared.ok) throw new Error('prepare');
    for (const rate of [44100, 16000]) {
      const got = await realGetLink(rate);
      if (!got.ok) throw new Error('link');
      const audio = got.link.bytesToAudio(prepared.bytes);
      if (!audio.ok) throw new Error('audio');
      const mono = audioToWav(audio.samples, rate);
      if (!mono.ok) throw new Error('wav');
      const pcm: number[] = [];
      for (const s of audio.samples) {
        const v = Math.round(s < 0 ? s * 32768 : s * 32767);
        pcm.push(v, v);
      }
      const h = realHandlers(dir);
      const m = await h.hearWav({ path: write(`mono-${rate}.wav`, mono.wav) });
      const s = await h.hearWav({ path: write(`stereo-${rate}.wav`, buildWav({ rate, channels: 2, pcm })) });
      for (const r of [m, s]) {
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(r.sampleRate).toBe(rate);
          expect(r.heard).toBe(1);
          expect(r.payloads[0]!.alert).toEqual({ ...SAMPLE_ALERT, sentMinute: NOW_MINUTE });
        }
      }
    }
  }, timeout);
});

describe('call counts, files and timing', () => {
  it('round_trip makes the clean audio once, writes nothing (5.5, 5.13)', async () => {
    const quiet = makeTempDir();
    try {
      let calls = 0;
      const counting = async (rate: number) => {
        const got = await realGetLink(rate);
        if (!got.ok) return got;
        const link = got.link;
        const proxy: SoundLink = { ...link, bytesToAudio: (b) => { calls += 1; return link.bytesToAudio(b); }, createListener: () => link.createListener() };
        return { ok: true as const, link: proxy };
      };
      const before = listDir(quiet);
      const r = await createHandlers(realDeps(quiet, { getLink: counting })).roundTrip({ alert: SAMPLE_ALERT, noiseDb: 60, tries: 4 });
      expect(r.ok).toBe(true);
      expect(calls).toBe(1);
      expect(listDir(quiet)).toEqual(before);
    } finally {
      removeDir(quiet);
    }
  }, timeout);

  it('make_broadcast creates a missing Output_Directory (3.4)', async () => {
    const nested = join(dir, 'new', 'nested');
    const r = await realHandlers(nested).makeBroadcast({ alert: SAMPLE_ALERT });
    expect(r.ok).toBe(true);
    expect(readdirSync(nested).length).toBe(1);
  });

  it('make_broadcast returns write-failed with no path and no leftover file (3.9)', async () => {
    const failing = makeTempDir();
    try {
      const files = { ...createFileOps(), writeAtomic: () => { throw new Error('disk full'); } };
      const r = await createHandlers(realDeps(failing, { files })).makeBroadcast({ alert: SAMPLE_ALERT });
      expect(r).toMatchObject({ ok: false, reason: 'write-failed' });
      expect('path' in r).toBe(false);
      expect(listDir(failing)).toEqual([]);
    } finally {
      removeDir(failing);
    }
  });

  it('round_trip N = 20 at 0 dB finishes in under 60 seconds (5.14)', async () => {
    await realGetLink(48000);
    const start = Date.now();
    const r = await realHandlers(dir).roundTrip({ alert: SAMPLE_ALERT, noiseDb: 0, tries: 20 });
    const elapsed = Date.now() - start;
    expect(r.ok).toBe(true);
    expect(elapsed).toBeLessThan(60000);
    if (r.ok) {
      const sum = Object.values(r.counts).reduce((a, b) => a + b, 0);
      expect(sum).toBe(20);
    }
  }, timeout);

  it('SAMPLE_ALERT encodes without error (2.6)', () => {
    expect(prepareAlert(SAMPLE_ALERT, NOW).ok).toBe(true);
    expect(SAMPLE_ALERT.test).toBe(true);
  });

  it('no tools/ears source imports a network module (1.3)', () => {
    const names = readdirSync('tools/ears').filter((n) => n.endsWith('.ts'));
    expect(names.length).toBeGreaterThan(5);
    for (const n of names) {
      const text = readFileSync(join('tools/ears', n), 'utf8');
      expect(text, n).not.toMatch(/node:(net|http|https|http2|dgram|tls|dns)\b/);
    }
  });
});
