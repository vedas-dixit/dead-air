// Controller tests: visibility, Hidden_Resume, wake lock, mic loss, tick. Test alerts only.
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { createListenController } from '../../src/listen/controller';
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

const T = stringsEn.text;
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

function setup(wake: FakeWakeLock = new FakeWakeLock()) {
  const clock = new FakeListenClock(NOW);
  const timers = new FakeIntervalTimers(clock);
  const audio = new FakeAudioInput();
  const loader = new FakeSoundLinkLoader();
  const visibility = new FakePageVisibility(true);
  const ctl = createListenController({
    clock,
    timers,
    audio,
    loadLink: loader.load,
    storage: new FakeListenStorage(),
    wake,
    visibility,
    strings: stringsEn,
  });
  return { ctl, clock, audio, loader, wake, visibility };
}
type Setup = ReturnType<typeof setup>;

async function start(s: Setup): Promise<void> {
  await s.ctl.tapStart();
  await flushPromises();
}

async function hide(s: Setup): Promise<void> {
  s.visibility.visible = false;
  await s.ctl.visibilityChanged(false);
  await flushPromises();
}

async function show(s: Setup): Promise<void> {
  s.visibility.visible = true;
  await s.ctl.visibilityChanged(true);
  await flushPromises();
}

function loud(): Float32Array {
  return new Float32Array(128).fill(0.5);
}

describe('hide and show', () => {
  it('hide ends the Session and releases the microphone, listener and wake lock', async () => {
    const s = setup();
    await start(s);
    await hide(s);
    expect(s.audio.handles[0]!.closed).toBe(true);
    expect(s.loader.lastLink!.openListeners).toBe(0);
    expect(s.wake.activeCount).toBe(0);
    expect(s.ctl.snapshot().running).toBe(false);
    expect(s.ctl.snapshot().errorText).toBeNull();
  });

  it('show after hide resumes with a new handle and Listener', async () => {
    const s = setup();
    await start(s);
    await hide(s);
    await show(s);
    expect(s.audio.handles.length).toBe(2);
    expect(s.audio.openHandles.length).toBe(1);
    expect(s.loader.lastLink!.openListeners).toBe(1);
    expect(s.ctl.snapshot().running).toBe(true);
    expect(s.ctl.snapshot().errorText).toBeNull();
    expect(s.wake.activeCount).toBe(1);
  });

  it('show without intent does nothing', async () => {
    const s = setup();
    await show(s);
    expect(s.audio.openCalls).toBe(0);
    await start(s);
    s.ctl.tapStop();
    await hide(s);
    await show(s);
    expect(s.audio.openCalls).toBe(1);
    expect(s.ctl.snapshot().running).toBe(false);
  });

  it('a visibility change during a start is ignored', async () => {
    const s = setup();
    s.audio.hold = true;
    const p = s.ctl.tapStart();
    await hide(s);
    expect(s.ctl.snapshot().starting).toBe(true);
    await show(s);
    expect(s.audio.openCalls).toBe(1);
    s.audio.releaseOpen();
    await p;
    await flushPromises();
    expect(s.ctl.snapshot().running).toBe(true);
    expect(s.audio.handles.length).toBe(1);
  });
});

describe('failed resume', () => {
  it('shows the Hidden_Stop_Notice when the microphone is refused', async () => {
    const s = setup();
    await start(s);
    await hide(s);
    s.audio.failWith = 'refused';
    await show(s);
    expect(s.ctl.snapshot().errorText).toBe(T['listen.hidden-stop']);
    expect(s.ctl.snapshot().running).toBe(false);
    expect(s.audio.openHandles.length).toBe(0);
  });

  it('closes what it opened when the Listener cannot be created', async () => {
    const s = setup();
    await start(s);
    await hide(s);
    s.loader.lastLink!.createFail = 'engine-error';
    await show(s);
    expect(s.ctl.snapshot().errorText).toBe(T['listen.hidden-stop']);
    expect(s.audio.handles[1]!.closed).toBe(true);
    expect(s.audio.openHandles.length).toBe(0);
    expect(s.loader.lastLink!.openListeners).toBe(0);
  });

  it('Start after a failed resume removes the notice', async () => {
    const s = setup();
    await start(s);
    await hide(s);
    s.audio.failWith = 'refused';
    await show(s);
    expect(s.ctl.snapshot().errorText).not.toBeNull();
    s.audio.failWith = null;
    s.audio.hold = true;
    const p = s.ctl.tapStart();
    expect(s.ctl.snapshot().errorText).toBeNull();
    s.audio.releaseOpen();
    await p;
    await flushPromises();
    expect(s.ctl.snapshot().errorText).toBeNull();
    expect(s.ctl.snapshot().running).toBe(true);
  });
});

describe('wake lock', () => {
  async function runningWith(wake: FakeWakeLock) {
    const s = setup(wake);
    await start(s);
    s.audio.lastHandle!.pushBlock(loud());
    return s;
  }

  it('unsupported: the Session runs and the state line and meter are unchanged', async () => {
    const withLock = await runningWith(new FakeWakeLock(true));
    const without = await runningWith(new FakeWakeLock(false));
    expect(without.wake.requestCalls).toBe(0);
    expect(without.ctl.snapshot().running).toBe(true);
    expect(without.ctl.snapshot().stateText).toBe(withLock.ctl.snapshot().stateText);
    expect(without.ctl.snapshot().level).toBe(withLock.ctl.snapshot().level);
    expect(without.ctl.snapshot().errorText).toBeNull();
  });

  it('refused or throwing: the Session runs and the state line and meter are unchanged', async () => {
    const base = await runningWith(new FakeWakeLock(true));
    const refuse = new FakeWakeLock(true);
    refuse.refuse = true;
    const thrower = new FakeWakeLock(true);
    thrower.throwOnRequest = new Error('no');
    for (const wake of [refuse, thrower]) {
      const s = await runningWith(wake);
      expect(wake.requestCalls).toBe(1);
      expect(s.ctl.snapshot().running).toBe(true);
      expect(s.ctl.snapshot().stateText).toBe(base.ctl.snapshot().stateText);
      expect(s.ctl.snapshot().level).toBe(base.ctl.snapshot().level);
      expect(s.ctl.snapshot().errorText).toBeNull();
    }
  });

  it('released by the browser then visible again: asks again and the Session continues', async () => {
    const s = await runningWith(new FakeWakeLock(true));
    const before = s.ctl.snapshot();
    // Release only the held lock. releaseByBrowser() would also drop the re-requested one,
    // because the fake appends it to the list while the loop runs.
    s.wake.handles[0]!.fireRelease();
    await flushPromises();
    expect(s.wake.requestCalls).toBe(2);
    expect(s.wake.activeCount).toBe(1);
    const after = s.ctl.snapshot();
    expect(after.running).toBe(true);
    expect(after.stateText).toBe(before.stateText);
    expect(after.level).toBe(before.level);
    expect(s.audio.handles.length).toBe(1);
  });

  it('released while the page is hidden: no request until visible again', async () => {
    const s = await runningWith(new FakeWakeLock(true));
    s.visibility.visible = false;
    s.wake.releaseByBrowser();
    await flushPromises();
    expect(s.wake.requestCalls).toBe(1);
    expect(s.ctl.snapshot().running).toBe(true);
    await show(s);
    expect(s.wake.requestCalls).toBe(2);
    expect(s.wake.activeCount).toBe(1);
    expect(s.ctl.snapshot().running).toBe(true);
  });
});

describe('mic loss', () => {
  it('sets intent false so the next show does not resume', async () => {
    const s = setup();
    await start(s);
    s.audio.lastHandle!.lose();
    await flushPromises();
    expect(s.ctl.snapshot().errorText).toBe(T['listen.mic.stopped']);
    await hide(s);
    await show(s);
    expect(s.audio.openCalls).toBe(1);
    expect(s.ctl.snapshot().running).toBe(false);
  });
});

describe('tick', () => {
  it('rebuilds cards with the current time so an expired alert shows Expired', async () => {
    const s = setup();
    await start(s);
    s.loader.lastLink!.lastListener!.queuePayloads(encodeOrThrow(testAlert()));
    s.audio.lastHandle!.pushBlock(loud());
    expect(s.ctl.snapshot().cards[0]!.expiryStatus).toBe('current');
    expect(s.ctl.snapshot().cards[0]!.testBanner).toBe(T['test.banner']);

    const seen: Array<ReturnType<typeof s.ctl.snapshot>> = [];
    s.ctl.subscribe((ui) => seen.push(ui));
    s.clock.advance(24 * 60 * 60 * 1000);
    s.ctl.tick();

    expect(seen.length).toBe(1);
    const card = seen[0]!.cards[0]!;
    expect(card.expiryStatus).toBe('expired');
    expect(card.presentedAsCurrent).toBe(false);
    expect(card.expiredWord).toBeTruthy();
    expect(card.testBanner).toBe(T['test.banner']);
  });
});
