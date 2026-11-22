// Shared setup for the pass property tests (task 9.8). Test alerts only.
// Builds a controller over the fakes, with a link that can really play (unlike FakeListenLink),
// a loader that can hold and fail, and one clock that moves the controller and the timers together.
import { stringsEn } from '../../src/broadcast/strings.en';
import { createListenController, type ListenController } from '../../src/listen/controller';
import { alertKey } from '../../src/listen/history';
import { serializeHistory } from '../../src/listen/history-store';
import { applyPayload, initialModel } from '../../src/listen/model';
import type { SoundLinkLoader } from '../../src/listen/providers';
import type { Alert } from '../../src/message-code';
import type { AudioResult, LoadResult } from '../../src/sound-link';
import { encodeOrThrow } from '../message-code/generators';
import {
  FakeAudioHost,
  FakeAudioInput,
  FakeIntervalTimers,
  FakeListenClock,
  FakeListenLink,
  FakeListenStorage,
  FakePageVisibility,
  FakePlayer,
  FakeTimers,
  FakeWakeLock,
  flushPromises,
} from './fakes';

/** Load done at t=0: play 0-1000, gap 1000-2000, play 2000-3000, guard 3000-4000. */
export const PASS_END_MS = 4000;

export const NOW = 29_000_000 * 60000 + 60_000;

export function testAlert(over: Partial<Alert> = {}): Alert {
  return {
    test: true,
    passedOn: false,
    hopCount: 0,
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
    ...over,
  };
}

/** A link whose bytesToAudio works: one second of silence at its own rate. */
export class PlayableLink extends FakeListenLink {
  override bytesToAudio(): AudioResult {
    return { ok: true, samples: new Float32Array(this.sampleRate) };
  }
}

/** A loader that records calls, can hold, and can fail. */
export class HoldableLoader {
  readonly rates: number[] = [];
  readonly links: PlayableLink[] = [];
  failWith: 'engine-load-failed' | null = null;
  hold = false;
  private pending: Array<() => void> = [];

  readonly load: SoundLinkLoader = (sampleRate: number) => {
    this.rates.push(sampleRate);
    if (this.hold) {
      return new Promise<LoadResult>((resolve) => this.pending.push(() => resolve(this.answer(sampleRate))));
    }
    return Promise.resolve(this.answer(sampleRate));
  };

  get loadCalls(): number {
    return this.rates.length;
  }

  releaseLoad(): void {
    const waiting = this.pending;
    this.pending = [];
    for (const run of waiting) run();
  }

  private answer(sampleRate: number): LoadResult {
    if (this.failWith) return { ok: false, reason: this.failWith };
    const link = new PlayableLink(sampleRate);
    this.links.push(link);
    return { ok: true, link };
  }
}

/** Storage text for a history that already holds these payloads, heard at NOW. */
export function seedHistory(payloads: Uint8Array[]): string {
  let m = initialModel([]);
  for (const p of payloads) m = applyPayload(m, p, NOW);
  return serializeHistory(m.history);
}

export interface PropSetup {
  ctl: ListenController;
  clock: FakeListenClock;
  timeouts: FakeTimers;
  audio: FakeAudioInput;
  loader: HoldableLoader;
  storage: FakeListenStorage;
  /** Moves the page clock and the one-shot timers together and lets promises settle. */
  advance(ms: number): Promise<void>;
}

export function setupProp(opts: { seed?: Uint8Array[]; micRate?: number } = {}): PropSetup {
  const clock = new FakeListenClock(NOW);
  const intervals = new FakeIntervalTimers(clock);
  const audio = new FakeAudioInput();
  if (opts.micRate !== undefined) audio.sampleRate = opts.micRate;
  const loader = new HoldableLoader();
  const storage = new FakeListenStorage(opts.seed ? seedHistory(opts.seed) : null);
  const timeouts = new FakeTimers();
  const host = new FakeAudioHost(new FakePlayer(timeouts, 'timers'));
  const ctl = createListenController({
    clock,
    timers: intervals,
    audio,
    loadLink: loader.load,
    storage,
    wake: new FakeWakeLock(),
    visibility: new FakePageVisibility(true),
    host,
    timeouts,
    strings: stringsEn,
  });
  return {
    ctl,
    clock,
    timeouts,
    audio,
    loader,
    storage,
    async advance(ms: number) {
      if (ms > 0) clock.advance(ms);
      await timeouts.advanceAsync(ms);
    },
  };
}

export async function startSession(s: PropSetup): Promise<void> {
  await s.ctl.tapStart();
  await flushPromises();
}

/** Queues a payload on the link's newest listener and pushes one microphone block. */
export function hearBlock(s: PropSetup, link: PlayableLink, bytes: Uint8Array | null): void {
  if (bytes) link.lastListener!.queuePayloads(bytes);
  s.audio.lastHandle!.pushBlock(new Float32Array(128));
}

export const keyOf = (a: Alert): string => alertKey(a);
export const bytesOf = (a: Alert): Uint8Array => encodeOrThrow(a);
export { flushPromises };
