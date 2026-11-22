// Helpers for tests/listen/controller-pass.test.ts. Test alerts only (test: true).
import { stringsEn } from '../../src/broadcast/strings.en';
import { createListenController } from '../../src/listen/controller';
import { alertKey, recordHeard } from '../../src/listen/history';
import type { History } from '../../src/listen/history';
import { serializeHistory } from '../../src/listen/history-store';
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

export const T = stringsEn.text;

export const SENT_MINUTE = 29_000_000;
export const NOW = SENT_MINUTE * 60000 + 60_000;
/** Validity is 8 steps of 15 minutes = 120 minutes. */
export const EXPIRED_NOW = (SENT_MINUTE + 125) * 60000;

export function testAlert(over: Partial<Alert> = {}): Alert {
  return {
    test: true,
    passedOn: false,
    hopCount: 0,
    event: 'flood',
    urgency: 'immediate',
    severity: 'severe',
    action: 'evacuate',
    sentMinute: SENT_MINUTE,
    validSteps: 8,
    latitude: null,
    longitude: null,
    stationId: 7,
    counter: 1,
    placeName: 'Test Town',
    ...over,
  };
}

/** A link whose bytesToAudio returns samples, so a Copy can be played. */
export class PassLink extends FakeListenLink {
  readonly encoded: Uint8Array[] = [];
  audioFail = false;
  constructor(
    sampleRate: number,
    private readonly onEncode?: () => void,
  ) {
    super(sampleRate);
  }
  override bytesToAudio(bytes?: unknown): AudioResult {
    this.encoded.push(Uint8Array.from(bytes as Uint8Array));
    this.onEncode?.();
    if (this.audioFail) return { ok: false, reason: 'engine-error' };
    return { ok: true, samples: new Float32Array(480).fill(0.1) };
  }
}

/** A loader that builds PassLinks. Records rates, holds on request, and fails on request. */
export class PassLoader {
  readonly rates: number[] = [];
  readonly links: PassLink[] = [];
  /** host.unlockCalls seen at each load, to prove unlock came first. */
  readonly unlockCallsAtLoad: number[] = [];
  failWith: Extract<LoadResult, { ok: false }>['reason'] | null = null;
  hold = false;
  audioFail = false;
  private pending: Array<() => void> = [];

  constructor(private readonly host: FakeAudioHost) {}

  readonly load = (sampleRate: number): Promise<LoadResult> => {
    this.rates.push(sampleRate);
    this.unlockCallsAtLoad.push(this.host.unlockCalls);
    const answer = (): LoadResult => {
      if (this.failWith) return { ok: false, reason: this.failWith };
      const link = new PassLink(sampleRate);
      link.audioFail = this.audioFail;
      this.links.push(link);
      return { ok: true, link };
    };
    if (this.hold) return new Promise((resolve) => this.pending.push(() => resolve(answer())));
    return Promise.resolve(answer());
  };

  get loadCalls(): number {
    return this.rates.length;
  }
  get lastLink(): PassLink {
    return this.links[this.links.length - 1]!;
  }
  release(): void {
    const waiting = this.pending;
    this.pending = [];
    for (const run of waiting) run();
  }
}

export function historyOf(alerts: Alert[], nowMs: number): History {
  let h: History = [];
  for (const a of alerts) h = recordHeard(h, encodeOrThrow(a), a, nowMs);
  return h;
}

export interface PassSetupOptions {
  alerts?: Alert[];
  /** The History starts empty when false. */
  preload?: boolean;
}

export function setupPass(opts: PassSetupOptions = {}) {
  const alerts = opts.alerts ?? [testAlert()];
  const clock = new FakeListenClock(NOW);
  const timers = new FakeIntervalTimers(clock);
  const timeouts = new FakeTimers();
  const player = new FakePlayer(timeouts, 'manual');
  const host = new FakeAudioHost(player);
  const audio = new FakeAudioInput();
  const loader = new PassLoader(host);
  const storage = new FakeListenStorage(
    opts.preload === false ? null : serializeHistory(historyOf(alerts, NOW)),
  );
  const visibility = new FakePageVisibility(true);
  const ctl = createListenController({
    clock,
    timers,
    audio,
    loadLink: loader.load,
    storage,
    wake: new FakeWakeLock(),
    visibility,
    host,
    timeouts,
    strings: stringsEn,
  });
  const key = alertKey(alerts[0]!);
  const seen = new Set<string>();
  ctl.subscribe((ui) => {
    if (ui.pass.errorText) seen.add(ui.pass.errorText);
  });

  /** Moves the page clock and the one-shot timers together. */
  function elapse(ms: number): void {
    clock.advance(ms);
    timeouts.advance(ms);
  }

  return { ctl, clock, timers, timeouts, player, host, audio, loader, storage, visibility, key, seen, elapse };
}

export type PassSetup = ReturnType<typeof setupPass>;

export async function startSession(s: PassSetup): Promise<void> {
  await s.ctl.tapStart();
  await flushPromises();
}

/** Taps Pass it on and lets the load finish. The first Play is pending afterwards. */
export async function tapPassAndPlay(s: PassSetup): Promise<void> {
  void s.ctl.tapPass(s.key);
  await flushPromises();
}

/** Finish the first Play, wait the gap, finish the second Play. The guard is then running. */
export async function finishBothPlays(s: PassSetup): Promise<void> {
  s.player.finishCurrent();
  await flushPromises();
  s.elapse(1000);
  await flushPromises();
  s.player.finishCurrent();
  await flushPromises();
}

/** Let the 1000 ms Echo_Guard run out. */
export async function endGuard(s: PassSetup): Promise<void> {
  s.elapse(1000);
  await flushPromises();
}

export { flushPromises };
