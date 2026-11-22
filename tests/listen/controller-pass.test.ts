// Pass it on: controller flow examples. Test alerts only (test: true).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SAMPLE_RATE } from '../../src/sound-link/constants';
import { encodeOrThrow } from '../message-code/generators';
import {
  EXPIRED_NOW,
  NOW,
  T,
  endGuard,
  finishBothPlays,
  flushPromises,
  setupPass,
  startSession,
  tapPassAndPlay,
  testAlert,
} from './controller-pass-flow.helpers';
import type { PassSetup } from './controller-pass-flow.helpers';

const hook = vi.hoisted(() => ({ forceMismatch: false }));

vi.mock('../../src/listen/pass', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/listen/pass')>();
  return {
    ...actual,
    prepareCopy: (entry: Parameters<typeof actual.prepareCopy>[0], nowMs: number) =>
      hook.forceMismatch
        ? { ok: false as const, reason: 'self-check-failed' as const }
        : actual.prepareCopy(entry, nowMs),
  };
});

beforeEach(() => {
  hook.forceMismatch = false;
});

const START_REASON = T['listen.pass.start-reason'];
const ERR = {
  load: T['listen.pass.err.load'],
  notCurrent: T['listen.pass.err.not-current'],
  expiredMid: T['listen.pass.err.expired-mid'],
  failed: T['listen.pass.err.failed'],
  audio: T['listen.pass.err.audio'],
};

const ui = (s: PassSetup) => s.ctl.snapshot();

function expectIdleAndStartEnabled(s: PassSetup): void {
  expect(ui(s).pass.phase).toBe('idle');
  expect(ui(s).pass.start.enabled).toBe(true);
  expect(ui(s).pass.start.reasonText).toBeNull();
}

describe('tap flow', () => {
  it('calls unlock inside the tap and before loadLink', async () => {
    const s = setupPass();
    void s.ctl.tapPass(s.key);
    expect(s.host.unlockCalls).toBe(1);
    expect(s.loader.loadCalls).toBe(0);
    await flushPromises();
    expect(s.loader.unlockCallsAtLoad).toEqual([1]);
  });

  it('loads a missing link once and plays the Copy', async () => {
    const s = setupPass();
    await tapPassAndPlay(s);
    expect(s.loader.rates).toEqual([DEFAULT_SAMPLE_RATE]);
    expect(s.player.playCalls).toBe(1);
    expect(ui(s).pass.phase).toBe('playing');
    expect(ui(s).pass.statusText).toBe(T['listen.pass.playing']);
  });

  it('reuses the link on a second tap', async () => {
    const s = setupPass();
    await tapPassAndPlay(s);
    await finishBothPlays(s);
    await endGuard(s);
    await tapPassAndPlay(s);
    expect(s.loader.loadCalls).toBe(1);
    expect(s.host.unlockCalls).toBe(2);
    expect(s.player.playCalls).toBe(3);
  });

  it('shows err.audio when unlock fails and keeps the button enabled', async () => {
    for (const mode of ['refuse', 'throw'] as const) {
      const s = setupPass();
      if (mode === 'refuse') s.host.refuse = true;
      else s.host.throwOnUnlock = new Error('no audio');
      await tapPassAndPlay(s);
      expect(ui(s).pass.errorText).toBe(ERR.audio);
      expect(ui(s).cards[0]!.passButton!.enabled).toBe(true);
      expect(s.loader.loadCalls).toBe(0);
      expect(s.player.playCalls).toBe(0);
      expectIdleAndStartEnabled(s);
    }
  });
});

describe('retry', () => {
  it('shows err.load, keeps the button enabled, then retries with unlock and loadLink', async () => {
    const s = setupPass();
    s.loader.failWith = 'engine-load-failed';
    await tapPassAndPlay(s);
    expect(ui(s).pass.errorText).toBe(ERR.load);
    expect(ui(s).cards[0]!.passButton!.enabled).toBe(true);
    expectIdleAndStartEnabled(s);
    expect(s.player.playCalls).toBe(0);

    s.loader.failWith = null;
    s.loader.hold = true;
    void s.ctl.tapPass(s.key);
    expect(s.host.unlockCalls).toBe(2);
    await flushPromises();
    expect(s.loader.loadCalls).toBe(2);
    expect(ui(s).pass.errorText).toBeNull(); // cleared when the load starts
    s.loader.release();
    await flushPromises();
    expect(ui(s).pass.errorText).toBeNull();
    expect(ui(s).pass.phase).toBe('playing');
    expect(s.player.playCalls).toBe(1);
  });

  it('has no Try again button or key', async () => {
    const s = setupPass();
    s.loader.failWith = 'engine-load-failed';
    await tapPassAndPlay(s);
    const view = JSON.stringify(ui(s));
    expect(view).not.toMatch(/Try again/);
    expect(Object.keys(T).filter((k) => /^listen\.pass\..*(retry|again)/.test(k))).toEqual([]);
  });
});

describe('Play_Link_Function and link reload', () => {
  it('calls loadLink zero times during play', async () => {
    const s = setupPass();
    await tapPassAndPlay(s);
    const afterLoad = s.loader.loadCalls;
    await finishBothPlays(s);
    await endGuard(s);
    expect(afterLoad).toBe(1);
    expect(s.loader.loadCalls).toBe(afterLoad);
  });

  it('keeps a link at the same rate on a Session start', async () => {
    const s = setupPass();
    await startSession(s);
    s.ctl.tapStop();
    await startSession(s);
    expect(s.loader.loadCalls).toBe(1);
    expect(s.loader.links[0]!.disposeCalls).toBe(0);
    expect(s.loader.links[0]!.createListenerCalls).toBe(2);
  });

  it('disposes a link at another rate and loads once at the microphone rate', async () => {
    const s = setupPass();
    await startSession(s);
    s.ctl.tapStop();
    s.audio.sampleRate = 44100;
    await startSession(s);
    expect(s.loader.rates).toEqual([48000, 44100]);
    expect(s.loader.links[0]!.disposeCalls).toBe(1);
    expect(s.loader.links[1]!.disposeCalls).toBe(0);
  });

  it('loads once at the microphone rate when no link is loaded', async () => {
    const s = setupPass();
    s.audio.sampleRate = 44100;
    await startSession(s);
    expect(s.loader.rates).toEqual([44100]);
  });

  it('never disposes or reloads a loaded link on tapPass, whatever its rate', async () => {
    const s = setupPass();
    s.audio.sampleRate = 44100;
    await startSession(s);
    s.ctl.tapStop();
    await tapPassAndPlay(s);
    expect(s.loader.loadCalls).toBe(1);
    expect(s.loader.links[0]!.disposeCalls).toBe(0);
    expect(s.player.plays[0]!.sampleRate).toBe(44100);
  });

  it('a tap on Start during a load, a Copy or the guard never reaches ensureLink', async () => {
    const s = setupPass();
    s.audio.sampleRate = 44100;
    await startSession(s);
    s.ctl.tapStop();
    s.audio.sampleRate = 48000; // a reload would be needed if ensureLink ran
    const opens = s.audio.openCalls;

    const staleLink = s.loader.links[0]!;
    await tapPassAndPlay(s);
    await s.ctl.tapStart(); // during the Copy
    expect(s.audio.openCalls).toBe(opens);
    await finishBothPlays(s);
    await s.ctl.tapStart(); // during the guard
    expect(s.audio.openCalls).toBe(opens);
    expect(staleLink.disposeCalls).toBe(0);
    expect(s.loader.loadCalls).toBe(1);
    await endGuard(s);
  });

  it('a tap on Start during a load never reaches ensureLink', async () => {
    const s = setupPass();
    s.loader.hold = true;
    void s.ctl.tapPass(s.key);
    await flushPromises();
    expect(ui(s).pass.phase).toBe('loading');
    await s.ctl.tapStart();
    expect(s.audio.openCalls).toBe(0);
    expect(s.loader.loadCalls).toBe(1);
    expect(ui(s).running).toBe(false);
    s.loader.release();
    await flushPromises();
  });
});

describe('Start_Button states', () => {
  it('is disabled with the reason from the tap through the guard, then enabled', async () => {
    const s = setupPass();
    expectIdleAndStartEnabled(s);
    s.loader.hold = true;
    void s.ctl.tapPass(s.key);
    expect(ui(s).pass.start).toEqual({ enabled: false, reasonText: START_REASON });
    await flushPromises();
    expect(ui(s).pass.start.enabled).toBe(false); // during the load
    s.loader.release();
    await flushPromises();
    expect(ui(s).pass.start).toEqual({ enabled: false, reasonText: START_REASON }); // first Play
    s.player.finishCurrent();
    await flushPromises();
    expect(ui(s).pass.start.enabled).toBe(false); // the gap
    s.elapse(1000);
    await flushPromises();
    expect(ui(s).pass.start.enabled).toBe(false); // second Play
    s.player.finishCurrent();
    await flushPromises();
    expect(ui(s).pass.start).toEqual({ enabled: false, reasonText: START_REASON }); // guard
    s.elapse(999);
    expect(ui(s).pass.start.enabled).toBe(false);
    s.elapse(1);
    expectIdleAndStartEnabled(s);
  });

  it('is enabled at once when the tap fails before any sound', async () => {
    const s = setupPass();
    s.host.refuse = true;
    await tapPassAndPlay(s);
    expectIdleAndStartEnabled(s);
    const l = setupPass();
    l.loader.failWith = 'bad-mode';
    await tapPassAndPlay(l);
    expectIdleAndStartEnabled(l);
  });

  it('starts no Session and leaves the microphone alone when tapped during a pass', async () => {
    const s = setupPass();
    await tapPassAndPlay(s);
    await s.ctl.tapStart();
    expect(s.audio.openCalls).toBe(0);
    expect(ui(s).running).toBe(false);
    expect(ui(s).starting).toBe(false);
    await finishBothPlays(s);
    await s.ctl.tapStart();
    expect(s.audio.openCalls).toBe(0);
    await endGuard(s);
  });
});

describe('Listening_Pause', () => {
  it('resets the listener before the first Play and after the guard', async () => {
    const s = setupPass();
    await startSession(s);
    const listener = s.loader.lastLink.lastListener!;
    expect(listener.resetCalls).toBe(0);
    await tapPassAndPlay(s);
    expect(s.player.playCalls).toBe(1);
    expect(listener.resetCalls).toBe(1);
    await finishBothPlays(s);
    expect(listener.resetCalls).toBe(1);
    await endGuard(s);
    expect(listener.resetCalls).toBe(2);
  });

  it('drops blocks for the pause plus 1000 ms and feeds them again after', async () => {
    const s = setupPass();
    await startSession(s);
    const link = s.loader.lastLink;
    const listener = link.lastListener!;
    const handle = s.audio.lastHandle!;
    await tapPassAndPlay(s);

    listener.queuePayloads(encodeOrThrow(testAlert({ counter: 2 })));
    handle.pushBlock(new Float32Array(128));
    expect(listener.feedCalls).toBe(0);
    await finishBothPlays(s);
    s.elapse(999);
    handle.pushBlock(new Float32Array(128));
    expect(listener.feedCalls).toBe(0);
    expect(ui(s).cards).toHaveLength(1);
    s.elapse(1);
    await flushPromises();
    handle.pushBlock(new Float32Array(128));
    expect(listener.feedCalls).toBe(1);
    expect(ui(s).cards).toHaveLength(2);
  });

  it('starts no Session when none was running', async () => {
    const s = setupPass();
    await tapPassAndPlay(s);
    await finishBothPlays(s);
    await endGuard(s);
    expect(s.audio.openCalls).toBe(0);
    expect(ui(s).running).toBe(false);
    expect(ui(s).state).toBe('not-listening');
  });

  it('tapStop during the pause ends the Session and does not resume', async () => {
    const s = setupPass();
    await startSession(s);
    const handle = s.audio.lastHandle!;
    await tapPassAndPlay(s);
    s.ctl.tapStop();
    await flushPromises();
    expect(ui(s).running).toBe(false);
    expect(handle.closed).toBe(true);
    expect(s.player.stopCalls).toBeGreaterThan(0);
    expectIdleAndStartEnabled(s);
    s.elapse(5000);
    await flushPromises();
    expect(s.audio.openCalls).toBe(1);
    expect(ui(s).running).toBe(false);
    expect(ui(s).state).toBe('not-listening');
  });

  it('stops the run and ends the Session when the page is hidden', async () => {
    const s = setupPass();
    await startSession(s);
    const handle = s.audio.lastHandle!;
    await tapPassAndPlay(s);
    s.visibility.visible = false;
    await s.ctl.visibilityChanged(false);
    await flushPromises();
    expect(s.player.stopCalls).toBeGreaterThan(0);
    expect(handle.closed).toBe(true);
    expect(ui(s).running).toBe(false);
    expect(ui(s).pass.start.enabled).toBe(false); // the guard still runs
    s.elapse(1000);
    expectIdleAndStartEnabled(s);
    expect(s.player.playCalls).toBe(1);
  });

  it('lets the run end when the microphone is lost, with no reset after the guard', async () => {
    const s = setupPass();
    await startSession(s);
    const listener = s.loader.lastLink.lastListener!;
    await tapPassAndPlay(s);
    s.audio.lastHandle!.lose();
    expect(ui(s).running).toBe(false);
    expect(ui(s).pass.phase).toBe('playing');
    await finishBothPlays(s);
    expect(s.player.playCalls).toBe(2);
    await endGuard(s);
    expectIdleAndStartEnabled(s);
    expect(listener.resetCalls).toBe(1);
  });

  it('excludes the pause from the Dead_Air_Window and leaves lastHeardMs alone', async () => {
    const s = setupPass();
    await startSession(s);
    s.clock.advance(60_000);
    await tapPassAndPlay(s);
    s.clock.advance(60_000); // long pause
    expect(ui(s).state).toBe('paused');
    await finishBothPlays(s);
    await endGuard(s);
    // 122 s since the start, 62 s of it paused: 60 s of listening.
    expect(ui(s).state).toBe('listening');
    s.clock.advance(31_000);
    expect(ui(s).state).toBe('dead-air');
    const minutes = Math.floor((s.clock.now() - NOW) / 60_000);
    expect(ui(s).stateText).toBe(T['listen.state.dead.last'].replace('{minutes}', String(minutes)));
  });

  it('shows listen.pass.paused and not Dead air while paused', async () => {
    const s = setupPass();
    await startSession(s);
    await tapPassAndPlay(s);
    s.clock.advance(10 * 60_000);
    expect(ui(s).state).toBe('paused');
    expect(ui(s).stateText).toBe(T['listen.pass.paused']);
    expect(ui(s).stateText).not.toMatch(/Dead air/);
    await finishBothPlays(s);
    expect(ui(s).stateText).toBe(T['listen.pass.paused']); // the guard is still a pause
    await endGuard(s);
  });
});

describe('Volume_Reminder', () => {
  it('shows only while playing and goes away at the end of the second Play', async () => {
    const s = setupPass();
    expect(ui(s).pass.volumeText).toBeNull();
    s.loader.hold = true;
    void s.ctl.tapPass(s.key);
    await flushPromises();
    expect(ui(s).pass.volumeText).toBeNull(); // loading
    s.loader.release();
    await flushPromises();
    expect(ui(s).pass.volumeText).toBe(T['listen.pass.volume']);
    s.player.finishCurrent();
    await flushPromises();
    expect(ui(s).pass.volumeText).toBe(T['listen.pass.volume']); // the gap
    s.elapse(1000);
    await flushPromises();
    s.player.finishCurrent();
    await flushPromises();
    expect(ui(s).pass.volumeText).toBeNull();
    expect(ui(s).pass.stopVisible).toBe(false);
    await endGuard(s);
  });

  it('is removed on the Stop control', async () => {
    const s = setupPass();
    await tapPassAndPlay(s);
    expect(ui(s).pass.stopVisible).toBe(true);
    s.ctl.tapPassStop();
    await flushPromises();
    expect(ui(s).pass.volumeText).toBeNull();
    await endGuard(s);
  });

  it('is removed on Stop listening and on a cancel between the Plays', async () => {
    const s = setupPass();
    await startSession(s);
    await tapPassAndPlay(s);
    s.ctl.tapStop();
    expect(ui(s).pass.volumeText).toBeNull();

    const c = setupPass();
    await tapPassAndPlay(c);
    c.player.finishCurrent();
    await flushPromises();
    c.clock.set(EXPIRED_NOW);
    c.timeouts.advance(1000);
    await flushPromises();
    expect(ui(c).pass.volumeText).toBeNull();
  });
});

describe('expiry gates', () => {
  it('gives err.not-current with no sound when the alert expires before it is ready', async () => {
    const s = setupPass();
    s.loader.hold = true;
    void s.ctl.tapPass(s.key);
    await flushPromises();
    s.clock.set(EXPIRED_NOW);
    s.loader.release();
    await flushPromises();
    expect(ui(s).pass.errorText).toBe(ERR.notCurrent);
    expect(s.player.playCalls).toBe(0);
    expect(s.loader.lastLink.encoded).toHaveLength(0);
    expectIdleAndStartEnabled(s);
  });

  it('gives err.expired-mid and cancels the second Play when the alert expires between Plays', async () => {
    const s = setupPass();
    await tapPassAndPlay(s);
    s.player.finishCurrent();
    await flushPromises();
    s.clock.set(EXPIRED_NOW);
    s.timeouts.advance(1000);
    await flushPromises();
    expect(s.player.playCalls).toBe(1);
    expect(ui(s).pass.errorText).toBe(ERR.expiredMid);
  });
});

describe('Failure_Line keys', () => {
  function expectFailure(s: PassSetup, expected: string): void {
    expect(ui(s).pass.errorText).toBe(expected);
    expect([...s.seen]).toEqual([expected]);
    expect(ui(s).cards).toHaveLength(1);
    expect(s.storage.writes).toHaveLength(0); // the History is unchanged
    expect(s.ctl.spokenText(s.key)).not.toBeNull();
    expectIdleAndStartEnabled(s);
  }

  it('err.load', async () => {
    const s = setupPass();
    s.loader.failWith = 'engine-load-failed';
    await tapPassAndPlay(s);
    expectFailure(s, ERR.load);
  });

  it('err.not-current', async () => {
    const s = setupPass();
    s.clock.set(EXPIRED_NOW);
    await tapPassAndPlay(s);
    expect(s.player.playCalls).toBe(0);
    expectFailure(s, ERR.notCurrent);
  });

  it('err.expired-mid', async () => {
    const s = setupPass();
    await tapPassAndPlay(s);
    s.player.finishCurrent();
    await flushPromises();
    s.clock.set(EXPIRED_NOW);
    s.timeouts.advance(1000);
    await flushPromises();
    await endGuard(s);
    expectFailure(s, ERR.expiredMid);
  });

  it('err.failed', async () => {
    const s = setupPass();
    s.loader.audioFail = true; // bytesToAudio rejects
    await tapPassAndPlay(s);
    expectFailure(s, ERR.failed);
  });

  it('err.audio', async () => {
    const s = setupPass();
    s.host.refuse = true;
    await tapPassAndPlay(s);
    expectFailure(s, ERR.audio);
  });

  it('shows err.failed for a forced self-check mismatch', async () => {
    hook.forceMismatch = true;
    const s = setupPass();
    await tapPassAndPlay(s);
    expect(s.player.playCalls).toBe(0);
    expectFailure(s, ERR.failed);
  });

  it('shows err.failed when the player rejects', async () => {
    const s = setupPass();
    s.player.failNext = new Error('speaker');
    await tapPassAndPlay(s);
    await endGuard(s);
    expectFailure(s, ERR.failed);
  });

  it('never shows another error key, and err.check does not exist', () => {
    expect(Object.keys(T).filter((k) => k.startsWith('listen.pass.err.')).sort()).toEqual(
      ['audio', 'expired-mid', 'failed', 'load', 'not-current'].map((k) => `listen.pass.err.${k}`),
    );
    for (const file of ['src/listen/controller.ts', 'src/listen/ui-state.ts']) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/err\.check/);
    }
  });

  it('a clean pass shows no Failure_Line at all', async () => {
    const s = setupPass();
    await tapPassAndPlay(s);
    await finishBothPlays(s);
    await endGuard(s);
    expect(s.seen.size).toBe(0);
    expect(ui(s).pass.errorText).toBeNull();
  });
});

describe('a copy plays only after a tap', () => {
  it('plays nothing on page load, on a received alert, on timers or on visibility', async () => {
    const s = setupPass({ preload: false });
    await flushPromises();
    await startSession(s);
    s.loader.lastLink.lastListener!.queuePayloads(encodeOrThrow(testAlert()));
    s.audio.lastHandle!.pushBlock(new Float32Array(128));
    expect(ui(s).cards).toHaveLength(1);
    s.timers.advance(10 * 60_000);
    s.elapse(10 * 60_000);
    s.ctl.tick();
    await s.ctl.visibilityChanged(false);
    await s.ctl.visibilityChanged(true);
    await flushPromises();
    expect(s.player.playCalls).toBe(0);
    expect(s.host.unlockCalls).toBe(0);
    expect(s.loader.links.every((l) => l.encoded.length === 0)).toBe(true);
  });
});
