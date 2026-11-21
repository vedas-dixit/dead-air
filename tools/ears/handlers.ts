// The three tool handlers. Plain functions: no MCP code, no direct clock, disk or Sound Link use.
import { composeBroadcastAudio } from '../../src/broadcast/compose';
import { checkExpiry } from '../../src/message-code';
import type { ExpiryStatus } from '../../src/message-code';
import { audioToWav, MAX_SAMPLE_RATE, MIN_SAMPLE_RATE, DEFAULT_SAMPLE_RATE } from '../../src/sound-link';
import type { SoundLink } from '../../src/sound-link';
import { join } from 'node:path';
import { prepareAlert } from './alert-input';
import { toolError } from './errors';
import type { Outcome } from './errors';
import { hearSamples, STATUS_TEXT } from './hear';
import type { PayloadReport } from './hear';
import { MAX_SEED, addWhiteNoise, appendTailSilence, deriveTrySeed } from './noise';
import { fileNameFor } from './output-files';
import type { FileOps } from './output-files';
import { classifyTry, tally } from './round-trip-core';
import type { TryOutcome, TryResult } from './round-trip-core';
import { readWav } from './wav-reader';

export const MAX_WAV_BYTES = 20 * 1024 * 1024;
export const MAX_TRIES = 200;
export const DEFAULT_TRIES = 20;

/** A TEST alert. The tool descriptions show it, and the tests encode it. */
export const SAMPLE_ALERT = {
  test: true,
  passedOn: false,
  event: 'flood',
  urgency: 'immediate',
  severity: 'severe',
  action: 'evacuate',
  validSteps: 24,
  latitude: 129716,
  longitude: 775946,
  stationId: 1234,
  counter: 1,
  placeName: 'Riverside ward 4',
} as const;

export interface Deps {
  readonly now: () => number;
  readonly getLink: (sampleRate: number) => Promise<Outcome<{ link: SoundLink }>>;
  readonly outDir: string;
  readonly files: FileOps;
}

export interface MakeBroadcastResult {
  readonly path: string;
  readonly seconds: number;
  readonly sampleRate: number;
  readonly messageBytes: number;
}
export interface HearWavResult {
  readonly heard: number;
  readonly summary: string;
  readonly sampleRate: number;
  readonly noise?: { readonly db: number; readonly seed: number };
  readonly payloads: PayloadReport[];
}
export interface RoundTripResult {
  readonly noiseDb: number;
  readonly tries: number;
  readonly seed: number;
  readonly sampleRate: number;
  readonly counts: Record<TryOutcome, number>;
  readonly successes: number;
  readonly failures: number;
  readonly bothPlaysHeardTries: number;
  readonly wrongAlertFields: string[];
  readonly sentStatus: ExpiryStatus;
  readonly sentStatusText: string;
}

export interface Handlers {
  makeBroadcast(args: unknown): Promise<Outcome<MakeBroadcastResult>>;
  hearWav(args: unknown): Promise<Outcome<HearWavResult>>;
  roundTrip(args: unknown): Promise<Outcome<RoundTripResult>>;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isValidRate(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= MIN_SAMPLE_RATE && v <= MAX_SAMPLE_RATE;
}
const round2 = (n: number): number => Math.round(n * 100) / 100;

const notObject = () => toolError('invalid-input-type', 'The arguments must be a JSON object.');
const badRate = () => toolError('bad-sample-rate', `sampleRate must be a whole number from ${MIN_SAMPLE_RATE} to ${MAX_SAMPLE_RATE}.`);
const badNoise = () => toolError('bad-noise-level', 'noiseDb must be a finite number from -60 to 60.');
const badSeed = () => toolError('bad-seed', `seed must be a whole number from 0 to ${MAX_SEED}.`);

function rateOf(args: Record<string, unknown>): number | null {
  if (args.sampleRate === undefined) return DEFAULT_SAMPLE_RATE;
  return isValidRate(args.sampleRate) ? args.sampleRate : null;
}
function noiseOf(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= -60 && v <= 60 ? v : null;
}
function seedOf(v: unknown, fallback: number): number | null {
  if (v === undefined) return fallback;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_SEED ? v : null;
}

export function createHandlers(deps: Deps): Handlers {
  return {
    async makeBroadcast(args) {
      if (!isObject(args)) return notObject();
      const rate = rateOf(args);
      if (rate === null) return badRate();
      const prepared = prepareAlert(args.alert, deps.now());
      if (!prepared.ok) return prepared;
      const got = await deps.getLink(rate);
      if (!got.ok) return got;
      const audio = got.link.bytesToAudio(prepared.bytes);
      if (!audio.ok) return toolError('engine-error', `The encoder failed: ${audio.reason}.`);
      const composed = composeBroadcastAudio(audio.samples, rate);
      const wav = audioToWav(composed, rate);
      if (!wav.ok) return toolError('engine-error', `The WAV writer failed: ${wav.reason}.`);
      const name = fileNameFor(wav.wav);
      try {
        deps.files.ensureDir(deps.outDir);
        deps.files.writeAtomic(deps.outDir, name, wav.wav);
      } catch {
        return toolError('write-failed', 'The file could not be written.');
      }
      return {
        ok: true,
        path: join(deps.outDir, name),
        seconds: round2(composed.length / rate),
        sampleRate: rate,
        messageBytes: prepared.bytes.length,
      };
    },

    async hearWav(args) {
      if (!isObject(args)) return notObject();
      if (typeof args.path !== 'string' || args.path.length === 0) {
        return toolError('file-not-found', 'path must be a non-empty string.');
      }
      let noiseDb: number | null = null;
      if (args.noiseDb !== undefined) {
        noiseDb = noiseOf(args.noiseDb);
        if (noiseDb === null) return badNoise();
      }
      const seed = seedOf(args.seed, 1);
      if (seed === null) return badSeed();

      const size = deps.files.fileSize(args.path);
      if (size === 'missing') return toolError('file-not-found', 'No file at that path.');
      if (size === 'not-a-file') return toolError('file-unreadable', 'That path is not a file.');
      if (size > MAX_WAV_BYTES) return toolError('file-too-large', 'The file is larger than 20 MB.');
      let bytes: Uint8Array;
      try {
        bytes = deps.files.readFile(args.path);
      } catch {
        return toolError('file-unreadable', 'The file could not be read.');
      }
      const wav = readWav(bytes);
      if (!wav.ok) {
        return toolError(wav.reason, wav.reason === 'not-wav' ? 'The file is not a WAV file.' : 'Only 16-bit PCM WAV, 1 or 2 channels, 16000 to 96000 Hz is supported.');
      }
      const got = await deps.getLink(wav.sampleRate);
      if (!got.ok) return got;

      let clip = appendTailSilence(wav.samples, wav.sampleRate);
      if (noiseDb !== null) {
        const noisy = addWhiteNoise(clip, wav.samples.length, noiseDb, seed);
        if (!noisy.ok) return toolError('silent-signal', 'The file is silent or too quiet, so noise at a signal-to-noise ratio is undefined.');
        clip = noisy.samples;
      }
      const heard = hearSamples(got.link, clip, deps.now());
      if (!heard.ok) return toolError('engine-error', 'The decoder failed.');
      return {
        ok: true,
        heard: heard.payloads.length,
        summary: heard.payloads.length === 0 ? 'nothing heard' : `${heard.payloads.length} payload(s) heard`,
        sampleRate: wav.sampleRate,
        ...(noiseDb === null ? {} : { noise: { db: noiseDb, seed } }),
        payloads: heard.payloads,
      };
    },

    async roundTrip(args) {
      if (!isObject(args)) return notObject();
      const rate = rateOf(args);
      if (rate === null) return badRate();
      const noiseDb = noiseOf(args.noiseDb);
      if (noiseDb === null) return badNoise();
      const tries = args.tries === undefined ? DEFAULT_TRIES : args.tries;
      if (typeof tries !== 'number' || !Number.isInteger(tries) || tries < 1 || tries > MAX_TRIES) {
        return toolError('bad-tries', `tries must be a whole number from 1 to ${MAX_TRIES}.`);
      }
      const seed = seedOf(args.seed, 1);
      if (seed === null) return badSeed();
      const nowMs = deps.now();
      const prepared = prepareAlert(args.alert, nowMs);
      if (!prepared.ok) return prepared;
      const got = await deps.getLink(rate);
      if (!got.ok) return got;

      // Encode and make the clean audio once. Every try reuses it.
      const audio = got.link.bytesToAudio(prepared.bytes);
      if (!audio.ok) return toolError('engine-error', `The encoder failed: ${audio.reason}.`);
      const clean = composeBroadcastAudio(audio.samples, rate);
      const clip = appendTailSilence(clean, rate);

      const results: TryResult[] = [];
      const wrongFields = new Set<string>();
      for (let i = 0; i < tries; i++) {
        const noisy = addWhiteNoise(clip, clean.length, noiseDb, deriveTrySeed(seed, i));
        if (!noisy.ok) return toolError('silent-signal', 'The clean audio is silent or too quiet.');
        const heard = hearSamples(got.link, noisy.samples, nowMs);
        if (!heard.ok) return toolError('engine-error', 'The decoder failed.');
        const result = classifyTry(prepared.alert, heard.payloads);
        for (const f of result.differingFields) wrongFields.add(f);
        results.push(result);
      }
      const t = tally(results);
      const status = checkExpiry(prepared.alert, nowMs).status;
      return {
        ok: true,
        noiseDb,
        tries,
        seed,
        sampleRate: rate,
        counts: t.counts,
        successes: t.successes,
        failures: t.failures,
        bothPlaysHeardTries: t.bothPlaysHeardTries,
        wrongAlertFields: [...wrongFields],
        sentStatus: status,
        sentStatusText: STATUS_TEXT[status],
      };
    },
  };
}
