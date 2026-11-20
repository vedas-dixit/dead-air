// Controller tests for the Broadcast page.
// Part 1 (task 12.3): initial state, TEST dialog, phases and control table, Go on air flow,
// draft behaviour. Part 2 (task 12.4) is appended at the bottom of this file.
// Every alert is a test alert (promise 3), except where a test turns TEST off through the
// confirmed dialog at run time. Fixtures come from fixtures.ts.
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createBroadcastController, DRAFT_DELAY_MS } from '../../src/broadcast/controller';
import type { Controller } from '../../src/broadcast/controller';
import type { LinkLike } from '../../src/broadcast/build';
import { wavFileName } from '../../src/broadcast/file-name';
import type { FormModel, RawForm } from '../../src/broadcast/form';
import { LOCATION_TIMEOUT_MS } from '../../src/broadcast/location';
import {
  LATITUDE_LIMIT_UNITS,
  LONGITUDE_LIMIT_UNITS,
  parseCoordinate,
} from '../../src/broadcast/map-point';
import { formSnapshot } from '../../src/broadcast/snapshot';
import { COUNTER_KEY, STATION_ID_KEY } from '../../src/broadcast/station-store';
import { stringsEn } from '../../src/broadcast/strings.en';
import type { TextKey } from '../../src/broadcast/strings.types';
import { formatUtc } from '../../src/shared/time';
import { decodeMessage } from '../../src/message-code';
import type { SoundLink } from '../../src/sound-link';
import { makeLink } from '../sound-link/harness';
import {
  FakeAudioHost,
  FakeClock,
  FakeDownloader,
  FakeGeolocation,
  type FakeGeoAnswer,
  FakeLink,
  FakePlayer,
  FakeStorage,
  FakeTimers,
  FakeWakeLock,
  flushPromises,
} from './fakes';
import { FIXTURE_NOW_MS, rawFormWithPoint } from './fixtures';
import { FC_OPTIONS, validFormModelArb } from './generators';

// ---------------------------------------------------------------- shared setup (used by part 2 too)

type LinkOption = LinkLike | null | Promise<LinkLike | null> | 'loading';

interface HarnessOptions {
  link?: LinkOption;
  storage?: FakeStorage | null;
  startMs?: number;
  playerMode?: 'manual' | 'timers';
}

interface Harness {
  controller: Controller;
  clock: FakeClock;
  timers: FakeTimers;
  storage: FakeStorage | null;
  player: FakePlayer;
  audio: FakeAudioHost;
  geolocation: FakeGeolocation;
  wakeLock: FakeWakeLock;
  downloader: FakeDownloader;
  /** The fake link, when the harness made one. */
  link: FakeLink | null;
}

function makeHarness(options: HarnessOptions = {}): Harness {
  const clock = new FakeClock(options.startMs ?? FIXTURE_NOW_MS);
  const timers = new FakeTimers(clock);
  const player = new FakePlayer(timers, options.playerMode ?? 'manual');
  const audio = new FakeAudioHost(player);
  const geolocation = new FakeGeolocation();
  const wakeLock = new FakeWakeLock();
  const downloader = new FakeDownloader();
  const storage = options.storage === undefined ? new FakeStorage() : options.storage;

  let link: FakeLink | null = null;
  let linkDep: LinkLike | null | Promise<LinkLike | null> | undefined;
  if (options.link === undefined) {
    link = new FakeLink();
    linkDep = link;
  } else if (options.link === 'loading') {
    linkDep = undefined;
  } else {
    linkDep = options.link;
    if (options.link instanceof FakeLink) link = options.link;
  }

  const controller = createBroadcastController({
    clock,
    timers,
    storage,
    audio,
    geolocation,
    wakeLock,
    downloader,
    strings: stringsEn,
    offsetMinutes: () => 0,
    ...(linkDep === undefined ? {} : { link: linkDep }),
  });
  return { controller, clock, timers, storage, player, audio, geolocation, wakeLock, downloader, link };
}

/** Types the sample form into the boxes. TEST and repeat stay as they are. */
function fillValid(h: Harness, overrides: Partial<RawForm> = {}): void {
  const form: RawForm = { ...rawFormWithPoint, ...overrides };
  const keys: Array<keyof RawForm> = [
    'event', 'urgency', 'severity', 'action', 'placeName',
    'latitude', 'longitude', 'validFor', 'stationId',
  ];
  for (const key of keys) h.controller.setField(key, form[key] as never);
}

/** Lets the draft timer run, so the draft Self_Check finishes. */
function settleDraft(h: Harness): void {
  h.timers.advance(DRAFT_DELAY_MS);
}

function readyHarness(options: HarnessOptions = {}, overrides: Partial<RawForm> = {}): Harness {
  const h = makeHarness(options);
  fillValid(h, overrides);
  settleDraft(h);
  return h;
}

function counterWrites(h: Harness): string[] {
  return (h.storage?.writes ?? []).filter((w) => w.key === COUNTER_KEY).map((w) => w.value);
}

let real: SoundLink;
beforeAll(async () => {
  real = await makeLink();
}, 60000);
afterAll(() => {
  real?.dispose();
});

// ================================================================ initial state

describe('initial state', () => {
  it('starts with TEST on, repeat off, nothing chosen and valid for 1 hour', () => {
    const storage = new FakeStorage({ 'dead-air.broadcast.test': '0' });
    const h = makeHarness({ storage });
    const s = h.controller.state;
    expect(s.form.test).toBe(true);
    expect(s.form.repeat).toBe(false);
    expect([s.form.event, s.form.urgency, s.form.severity, s.form.action]).toEqual(['', '', '', '']);
    expect(s.form.validFor).toBe('h1');
    expect(s.realNotice).toBeNull();
    expect(s.dialogOpen).toBe(false);
    expect(s.controls.goOnAir.enabled).toBe(false);
    expect(s.controls.save.enabled).toBe(false);
    expect(s.controls.stop.enabled).toBe(false);
    expect(s.preview).toBeNull();
  });

  it('builds alerts with passedOn false', () => {
    const h = readyHarness();
    const decoded = decodeMessage(h.link!.lastBytes!);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.alert.passedOn).toBe(false);
  });

  it('is loading first, keeps Go on air disabled, and is ready after the link arrives', () => {
    const h = makeHarness({ link: 'loading' });
    fillValid(h);
    settleDraft(h);
    expect(h.controller.state.phase).toBe('loading');
    expect(h.controller.state.controls.goOnAirNote).toBe('loading');
    expect(h.controller.state.controls.goOnAir.enabled).toBe(false);
    expect(h.controller.state.controls.save.enabled).toBe(false);
    expect(h.controller.state.form.event).toBe('flood'); // the form works while loading

    h.controller.engineLoaded(new FakeLink());
    expect(h.controller.state.phase).toBe('idle');
    expect(h.controller.state.controls.goOnAirNote).toBeNull();
    expect(h.controller.state.controls.goOnAir.enabled).toBe(false); // draft check not yet done
    settleDraft(h);
    expect(h.controller.state.draftCheck).toBe('passed');
    expect(h.controller.state.controls.goOnAir.enabled).toBe(true);
  });

  it('becomes ready when the link promise resolves', async () => {
    const h = makeHarness({ link: Promise.resolve(new FakeLink()) });
    expect(h.controller.state.phase).toBe('loading');
    await flushPromises();
    expect(h.controller.state.phase).toBe('idle');
  });

  it('on a link load failure shows the message, disables Save and Go on air, and keeps the form usable', () => {
    const h = makeHarness({ link: 'loading' });
    fillValid(h);
    h.controller.engineLoaded(null);
    const s = h.controller.state;
    expect(s.phase).toBe('engine-failed');
    expect(s.controls.goOnAirNote).toBe('engine.failed');
    expect(stringsEn.text['engine.failed']).not.toBe('');
    expect(s.controls.goOnAir.enabled).toBe(false);
    expect(s.controls.save.enabled).toBe(false);
    expect(s.controls.formInputs.disabled).toBe(false);
    h.controller.setField('placeName', 'Hill road');
    expect(h.controller.state.form.placeName).toBe('Hill road');
    expect(h.controller.state.errors).toEqual([]);
  });

  it('on a rejected link promise ends in engine-failed', async () => {
    const h = makeHarness({ link: Promise.reject(new Error('no wasm')) as Promise<LinkLike | null> });
    await flushPromises();
    expect(h.controller.state.phase).toBe('engine-failed');
  });
});

// ================================================================ TEST dialog

describe('TEST dialog', () => {
  it('opens with the exact text when TEST is turned off', () => {
    const h = makeHarness();
    h.controller.toggleTest(false);
    const s = h.controller.state;
    expect(s.dialogOpen).toBe(true);
    expect(s.dialogMessage).toEqual({ key: 'test.dialog' });
    expect(stringsEn.text['test.dialog']).toBe('This will send a real alert. Are you sure?');
    expect(s.form.test).toBe(true); // still a test until confirmed
  });

  it('cancel keeps TEST on and shows no real-alert notice', () => {
    const h = makeHarness();
    h.controller.toggleTest(false);
    h.controller.cancelDialog();
    const s = h.controller.state;
    expect(s.dialogOpen).toBe(false);
    expect(s.form.test).toBe(true);
    expect(s.realNotice).toBeNull();
  });

  it('confirm turns TEST off, shows the real-alert notice, and the alert is encoded with test off', () => {
    const h = makeHarness();
    fillValid(h);
    h.controller.toggleTest(false);
    h.controller.confirmDialog();
    settleDraft(h);
    const s = h.controller.state;
    expect(s.dialogOpen).toBe(false);
    expect(s.form.test).toBe(false);
    expect(s.realNotice).toEqual({ key: 'real.notice' });
    expect(s.preview?.test).toBe(false);
    const decoded = decodeMessage(h.link!.lastBytes!);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.alert.test).toBe(false);
  });

  it('turning TEST on needs no dialog', () => {
    const h = makeHarness();
    h.controller.toggleTest(false);
    h.controller.confirmDialog();
    h.controller.toggleTest(true);
    const s = h.controller.state;
    expect(s.dialogOpen).toBe(false);
    expect(s.form.test).toBe(true);
    expect(s.realNotice).toBeNull();
  });

  it('turning TEST on while it is already on opens nothing', () => {
    const h = makeHarness();
    h.controller.toggleTest(true);
    expect(h.controller.state.dialogOpen).toBe(false);
  });

  it('ignores field edits while the dialog is open', () => {
    const h = makeHarness();
    h.controller.toggleTest(false);
    h.controller.setField('placeName', 'Nope');
    expect(h.controller.state.form.placeName).toBe('');
    expect(h.controller.state.controls.dialog).toEqual({ open: true, pageInert: true });
  });
});

// ================================================================ phases and the control table

describe('phases and the control table', () => {
  it('idle with a passed draft: form on, Go on air and Save on, Stop off', () => {
    const h = readyHarness();
    const c = h.controller.state.controls;
    expect(h.controller.state.phase).toBe('idle');
    expect(c.formInputs.disabled).toBe(false);
    expect(c.repeatBox.disabled).toBe(false);
    expect(c.testSwitch.disabled).toBe(false);
    expect(c.goOnAir.enabled).toBe(true);
    expect(c.save.enabled).toBe(true);
    expect(c.stop.enabled).toBe(false);
  });

  it('building: form locked, Stop and Save off', async () => {
    const h = readyHarness();
    const p = h.controller.goOnAir();
    const s = h.controller.state;
    expect(s.phase).toBe('building');
    expect(s.controls.formInputs.disabled).toBe(true);
    expect(s.controls.goOnAir.enabled).toBe(false);
    expect(s.controls.save.enabled).toBe(false);
    expect(s.controls.stop.enabled).toBe(false);
    await flushPromises();
    h.controller.stop();
    await p;
  });

  it('on air: form disabled, Stop on, Save and Go on air off, edits ignored; Stop silences and unlocks the form', async () => {
    const h = readyHarness();
    const before = h.controller.state;
    const p = h.controller.goOnAir();
    await flushPromises();
    const s = h.controller.state;
    expect(s.phase).toBe('on-air');
    expect(s.controls.formInputs.disabled).toBe(true);
    expect(s.controls.repeatBox.disabled).toBe(true);
    expect(s.controls.testSwitch.disabled).toBe(true);
    expect(s.controls.stop.enabled).toBe(true);
    expect(s.controls.save.enabled).toBe(false);
    expect(s.controls.goOnAir.enabled).toBe(false);

    // An edit during the Broadcast changes nothing.
    h.controller.setField('placeName', 'Elsewhere');
    expect(h.controller.state.form.placeName).toBe(before.form.placeName);
    expect(h.controller.state.preview?.placeName).toBe(before.form.placeName);
    expect(h.controller.state.sayFirst).toEqual(s.sayFirst);

    h.controller.stop();
    await p;
    const after = h.controller.state;
    expect(after.phase).toBe('idle');
    expect(h.player.stopCalls).toBeGreaterThan(0);
    expect(after.controls.formInputs.disabled).toBe(false);
    expect(after.controls.stop.enabled).toBe(false);
    expect(after.notices).toContainEqual({ key: 'stopped' });
    expect(h.player.playCalls).toBe(1); // the second play never started
  });

  it('repeating: form disabled and Stop on until Stop', async () => {
    const h = readyHarness();
    h.controller.setField('repeat', true);
    expect(h.controller.state.form.repeat).toBe(true);
    void h.controller.goOnAir();
    await flushPromises();
    const s = h.controller.state;
    expect(s.phase).toBe('repeating');
    expect(s.controls.formInputs.disabled).toBe(true);
    expect(s.controls.stop.enabled).toBe(true);
    expect(s.controls.save.enabled).toBe(false);
    h.controller.stop();
    expect(h.controller.state.phase).toBe('idle');
    expect(h.controller.state.controls.formInputs.disabled).toBe(false);
  });
});

// ================================================================ Go on air flow (real sound link)

describe('Go on air flow', () => {
  it('unlocks inside the tap before the Build, makes no audio call before it, then plays the same samples twice 1000 ms apart', async () => {
    const order: string[] = [];
    const spy: LinkLike = {
      get sampleRate() {
        return real.sampleRate;
      },
      bytesToAudio: (b) => {
        order.push('build');
        return real.bytesToAudio(b);
      },
      createListener: () => real.createListener(),
    };
    const storage = new FakeStorage();
    const h = readyHarness({ link: spy, storage });

    // Nothing touched audio before the tap.
    expect(h.audio.unlockCalls).toBe(0);
    expect(h.player.playCalls).toBe(0);
    expect(h.player.stopCalls).toBe(0);
    expect(counterWrites(h)).toEqual([]);
    const draftPreview = h.controller.state.preview;
    expect(draftPreview?.draft).toBe(true);

    const origUnlock = h.audio.unlock.bind(h.audio);
    h.audio.unlock = () => {
      order.push('unlock');
      return origUnlock();
    };
    const seenAtPlay: Array<boolean | null> = [];
    const origPlay = h.player.play.bind(h.player);
    h.player.play = (samples, rate) => {
      seenAtPlay.push(h.controller.state.preview?.draft ?? null);
      return origPlay(samples, rate);
    };
    order.length = 0;

    const done = h.controller.goOnAir();
    // Unlock happened synchronously inside the tap, and the Build ran right after it.
    expect(h.audio.unlockCalls).toBe(1);
    expect(order).toEqual(['unlock', 'build']);
    expect(h.player.playCalls).toBe(0);
    // The counter is not used up until the unlock has succeeded.
    expect(counterWrites(h)).toEqual([]);

    await flushPromises();
    expect(counterWrites(h)).toEqual(['1']);
    expect(h.player.playCalls).toBe(1);
    // The draft preview was replaced by the real one before the first play.
    expect(seenAtPlay).toEqual([false]);
    const s = h.controller.state;
    expect(s.preview?.draft).toBe(false);
    expect(s.preview?.counter).toBe(0);
    expect(s.sayFirst?.ok).toBe(true);
    expect(s.preview?.test).toBe(true);

    const first = h.player.plays[0]!;
    expect(first.samples.length).toBeGreaterThan(0);
    expect(first.sampleRate).toBe(real.sampleRate);

    h.clock.advance(2500);
    const endedAt = h.clock.now();
    h.player.finishCurrent();
    await flushPromises();
    expect(h.player.playCalls).toBe(1);
    h.timers.advance(999);
    await flushPromises();
    expect(h.player.playCalls).toBe(1);
    h.timers.advance(1);
    await flushPromises();
    expect(h.player.playCalls).toBe(2);
    expect(h.player.plays[1]!.at - endedAt).toBe(1000);
    expect(h.player.plays[1]!.samples).toBe(first.samples);

    h.player.finishCurrent();
    await done;
    expect(h.controller.state.phase).toBe('idle');
    expect(counterWrites(h)).toEqual(['1']); // committed once
    expect(h.link).toBeNull();
  }, 60000);

  it('uses the next counter on the next broadcast', async () => {
    const h = readyHarness();
    for (let round = 0; round < 2; round++) {
      const p = h.controller.goOnAir();
      await flushPromises();
      expect(h.controller.state.preview?.counter).toBe(round);
      h.controller.stop();
      await p;
    }
    expect(counterWrites(h)).toEqual(['1', '2']);
  });

  it('with unlock refused: counter unchanged, Go on air stays enabled, a message shows, nothing plays', async () => {
    const h = readyHarness();
    h.audio.refuse = true;
    await h.controller.goOnAir();
    const s = h.controller.state;
    expect(h.audio.unlockCalls).toBe(1);
    expect(counterWrites(h)).toEqual([]);
    expect(h.player.playCalls).toBe(0);
    expect(s.phase).toBe('idle');
    expect(s.controls.goOnAir.enabled).toBe(true);
    expect(s.banner).toEqual({ key: 'audio.unavailable' });
    expect(s.preview?.draft).toBe(true);
  });

  it('with unlock rejecting: same as refused', async () => {
    const h = readyHarness();
    h.audio.throwOnUnlock = new Error('blocked');
    await h.controller.goOnAir();
    expect(counterWrites(h)).toEqual([]);
    expect(h.player.playCalls).toBe(0);
    expect(h.controller.state.banner).toEqual({ key: 'audio.unavailable' });
    expect(h.controller.state.controls.goOnAir.enabled).toBe(true);
  });

  it('a failed Self_Check plays nothing, shows the failure, keeps the counter and shows no preview from that build', async () => {
    const fake = new FakeLink();
    const h = readyHarness({ link: fake });
    const draftPreview = h.controller.state.preview;
    expect(draftPreview?.draft).toBe(true);

    fake.behavior = { kind: 'changed', index: 3 };
    await h.controller.goOnAir();
    const s = h.controller.state;
    expect(h.audio.unlockCalls).toBe(1);
    expect(h.player.playCalls).toBe(0);
    expect(counterWrites(h)).toEqual([]);
    expect(s.phase).toBe('idle');
    expect(s.banner).toEqual({ key: 'check.failed' });
    expect(s.preview).toEqual(draftPreview); // still the draft, not a preview of the failed build
    expect(s.preview?.draft).toBe(true);
    expect(fake.openListeners).toBe(0);
  });

  it('a failed Build from an audio failure plays nothing', async () => {
    const fake = new FakeLink();
    const h = readyHarness({ link: fake });
    fake.audioFail = 'engine-error';
    await h.controller.goOnAir();
    expect(h.player.playCalls).toBe(0);
    expect(counterWrites(h)).toEqual([]);
    expect(h.controller.state.banner?.key).toBe('err.audio');
  });

  it('a clock failure refuses the Build and plays nothing', async () => {
    const h = readyHarness();
    h.clock.set(Number.NaN);
    await h.controller.goOnAir();
    const s = h.controller.state;
    expect(h.player.playCalls).toBe(0);
    expect(counterWrites(h)).toEqual([]);
    expect(s.banner).toEqual({ key: 'clock.bad' });
    expect(s.phase).toBe('idle');
  });

  it('does nothing when the form is invalid or the draft check has not passed', async () => {
    const h = makeHarness();
    await h.controller.goOnAir();
    fillValid(h); // draft check still pending
    await h.controller.goOnAir();
    expect(h.audio.unlockCalls).toBe(0);
    expect(h.player.playCalls).toBe(0);
  });
});

// ================================================================ draft behaviour

describe('draft behaviour', () => {
  it('shows a draft preview at once, labelled pending, and runs the Self_Check after the debounce', () => {
    const h = makeHarness();
    fillValid(h);
    let s = h.controller.state;
    expect(s.preview?.draft).toBe(true);
    expect(s.draftCheck).toBe('pending');
    expect(stringsEn.text['draft.pending']).toBe('Sound check pending');
    expect(h.link!.createListenerCalls).toBe(0);

    h.timers.advance(DRAFT_DELAY_MS - 1);
    expect(h.controller.state.draftCheck).toBe('pending');
    expect(h.link!.createListenerCalls).toBe(0);

    h.timers.advance(1);
    s = h.controller.state;
    expect(s.draftCheck).toBe('passed');
    expect(s.preview?.draft).toBe(true); // still a draft until Go on air
    expect(h.link!.createListenerCalls).toBe(1);
  });

  it('does not use the counter', () => {
    const h = readyHarness();
    expect(h.controller.state.preview?.counter).toBe(0);
    h.controller.setField('placeName', 'Another place');
    settleDraft(h);
    expect(h.controller.state.draftCheck).toBe('passed');
    expect(counterWrites(h)).toEqual([]);
    expect(h.controller.state.preview?.counter).toBe(0);
  });

  it('restarts the debounce on each edit, so only the last form is checked', () => {
    const h = makeHarness();
    fillValid(h);
    h.timers.advance(100);
    h.controller.setField('placeName', 'Second');
    h.timers.advance(100);
    expect(h.link!.createListenerCalls).toBe(0);
    h.timers.advance(50);
    expect(h.link!.createListenerCalls).toBe(1);
    expect(h.controller.state.preview?.placeName).toBe('Second');
  });

  it('discards a draft result when the form changed during the check (generation token)', () => {
    const link = new FakeLink();
    const h = makeHarness({ link });
    fillValid(h);
    const orig = link.createListener.bind(link);
    let once = true;
    link.createListener = () => {
      if (once) {
        once = false;
        h.controller.setField('placeName', 'Newer');
      }
      return orig();
    };
    settleDraft(h);
    // The first result was for the old name and must not be accepted.
    let s = h.controller.state;
    expect(s.draftCheck).toBe('pending');
    expect(s.preview?.placeName).toBe('Newer');
    expect(s.sayFirst).toBeNull();
    expect(s.controls.goOnAir.enabled).toBe(false);

    settleDraft(h);
    s = h.controller.state;
    expect(s.draftCheck).toBe('passed');
    expect(s.preview?.placeName).toBe('Newer');
  });

  it('keeps at most one listener open at a time', async () => {
    const link = new FakeLink();
    const h = makeHarness({ link });
    for (let i = 0; i < 5; i++) {
      fillValid(h, { placeName: `Place ${i}` });
      settleDraft(h);
    }
    const p = h.controller.goOnAir();
    await flushPromises();
    h.controller.stop();
    await p;
    expect(link.createListenerCalls).toBe(6);
    expect(link.maxOpenListeners).toBe(1);
    expect(link.openListeners).toBe(0);
  });

  it('keeps Say first, Go on air and Save off until the draft Self_Check passes', async () => {
    const h = makeHarness();
    fillValid(h);
    let s = h.controller.state;
    expect(s.sayFirst).toBeNull();
    expect(s.controls.goOnAir.enabled).toBe(false);
    expect(s.controls.save.enabled).toBe(false);
    await h.controller.goOnAir();
    await h.controller.save();
    expect(h.audio.unlockCalls).toBe(0);
    expect(h.player.playCalls).toBe(0);
    expect(h.downloader.saveCalls).toBe(0);

    settleDraft(h);
    s = h.controller.state;
    expect(s.sayFirst?.ok).toBe(true);
    expect(s.controls.goOnAir.enabled).toBe(true);
    expect(s.controls.save.enabled).toBe(true);
  });

  it('a failed draft Self_Check shows the failure, no Say first, and keeps Go on air and Save off', () => {
    const link = new FakeLink({ behavior: { kind: 'none' } });
    const h = makeHarness({ link });
    fillValid(h);
    settleDraft(h);
    const s = h.controller.state;
    expect(s.draftCheck).toBe('failed');
    expect(s.banner).toEqual({ key: 'check.failed' });
    expect(s.sayFirst).toBeNull();
    expect(s.preview).toBeNull();
    expect(s.controls.goOnAir.enabled).toBe(false);
    expect(s.controls.save.enabled).toBe(false);
  });

  it('remembers the station ID when it changes to a valid value, and not when it is invalid', () => {
    const storage = new FakeStorage();
    const h = makeHarness({ storage });
    h.controller.setField('stationId', '42');
    expect(storage.writes).toContainEqual({ key: STATION_ID_KEY, value: '42' });
    const writes = storage.writes.length;
    h.controller.setField('stationId', '70000');
    h.controller.setField('stationId', 'abc');
    expect(storage.writes.length).toBe(writes);

    const next = makeHarness({ storage });
    expect(next.controller.state.form.stationId).toBe('42');
    expect(next.controller.state.stationIdRemembered).toBe(true);
    // Only the two known keys are ever written.
    expect(storage.writes.every((w) => w.key === STATION_ID_KEY || w.key === COUNTER_KEY)).toBe(true);
  });
});

// ================================================================ PART 2 IS APPENDED BELOW (task 12.4)
// Save, location, wake lock, repeat flow, Properties 15 and 19. Reuse makeHarness, fillValid,
// settleDraft, readyHarness and counterWrites from the shared setup above.

// ---------------------------------------------------------------- part 2 helpers

/** Go on air, then Stop while the first play is pending. Leaves a lastBuild behind. */
async function goThenStop(h: Harness): Promise<void> {
  const p = h.controller.goOnAir();
  await flushPromises();
  h.controller.stop();
  await p;
}

/** Turns repeat on and taps Go on air. Resolves once round 1 has started. */
async function startRepeat(h: Harness): Promise<void> {
  h.controller.setField('repeat', true);
  void h.controller.goOnAir();
  await flushPromises();
}

function lastSaved(h: Harness): { bytes: Uint8Array; fileName: string } {
  const s = h.downloader.saves[h.downloader.saves.length - 1];
  if (!s) throw new Error('nothing was saved');
  return s;
}

/** Alert that the fake link last turned into sound. */
function lastAlert(h: Harness) {
  const decoded = decodeMessage(h.link!.lastBytes!);
  if (!decoded.ok) throw new Error('last bytes do not decode');
  return decoded.alert;
}

const HOUR_MS = 3_600_000;

// ================================================================ Save as sound file

describe('Save as sound file', () => {
  it('is disabled while on air and while repeating, and does nothing then', async () => {
    const h = readyHarness();
    const p = h.controller.goOnAir();
    await flushPromises();
    expect(h.controller.state.controls.save.enabled).toBe(false);
    await h.controller.save();
    expect(h.downloader.saveCalls).toBe(0);
    h.controller.stop();
    await p;
    expect(h.controller.state.controls.save.enabled).toBe(true);

    await startRepeat(h);
    expect(h.controller.state.phase).toBe('repeating');
    expect(h.controller.state.controls.save.enabled).toBe(false);
    await h.controller.save();
    expect(h.downloader.saveCalls).toBe(0);
    h.controller.stop();
  });

  it('with no Broadcast yet builds a new alert, uses counter 0 then commits it, and names the file with wavFileName', async () => {
    const h = readyHarness();
    await h.controller.save();
    expect(h.downloader.saveCalls).toBe(1);
    const alert = lastAlert(h);
    expect(alert.counter).toBe(0);
    expect(alert.sentMinute).toBe(Math.floor(FIXTURE_NOW_MS / 60000));
    expect(lastSaved(h).fileName).toBe(wavFileName(alert));
    expect(lastSaved(h).fileName).toMatch(/^dead-air-test-flood-\d{8}T\d{4}Z-s1234-n0\.wav$/);
    expect(counterWrites(h)).toEqual(['1']);
    expect(h.controller.state.notices).toContainEqual({ key: 'saved', params: { name: lastSaved(h).fileName } });
    expect(h.controller.state.preview?.draft).toBe(false);
  });

  it('never calls the audio host and never plays', async () => {
    const h = readyHarness();
    await h.controller.save();
    await h.controller.save();
    expect(h.audio.unlockCalls).toBe(0);
    expect(h.player.playCalls).toBe(0);
    expect(h.player.stopCalls).toBe(0);
  });

  it('reuses the last Broadcast audio and bytes, with the same counter, when the form is unchanged and the alert is current', async () => {
    const h = readyHarness();
    await goThenStop(h);
    expect(counterWrites(h)).toEqual(['1']);
    const bytesBefore = Uint8Array.from(h.link!.lastBytes!);
    const audioCalls = h.link!.bytesToAudioCalls;
    const listeners = h.link!.createListenerCalls;
    const goSamples = h.player.plays[0]!.samples;

    h.clock.advance(5 * 60000); // still current, later minute
    await h.controller.save();
    await h.controller.save();

    expect(h.downloader.saveCalls).toBe(2);
    expect(h.link!.bytesToAudioCalls).toBe(audioCalls);
    expect(h.link!.createListenerCalls).toBe(listeners);
    expect(Array.from(h.link!.lastBytes!)).toEqual(Array.from(bytesBefore));
    expect(counterWrites(h)).toEqual(['1']);
    const [a, b] = h.downloader.saves;
    expect(a!.fileName).toBe(b!.fileName);
    expect(a!.fileName).toBe(wavFileName(lastAlert(h)));
    expect(a!.fileName).toMatch(/-n0\.wav$/);
    expect(Array.from(a!.bytes)).toEqual(Array.from(b!.bytes));
    // The file holds the same samples as the Broadcast played: first play at the start of the data.
    const view = new DataView(a!.bytes.buffer, a!.bytes.byteOffset, a!.bytes.byteLength);
    for (let i = 0; i < 200; i++) {
      const s = Math.max(-1, Math.min(1, goSamples[i]!));
      expect(view.getInt16(44 + i * 2, true)).toBe(Math.round(s < 0 ? s * 32768 : s * 32767));
    }
    // The preview of the Broadcast is kept.
    expect(h.controller.state.preview?.counter).toBe(0);
  });

  it('a second Save after a fresh Save reuses it too', async () => {
    const h = readyHarness();
    await h.controller.save();
    await h.controller.save();
    expect(h.downloader.saveCalls).toBe(2);
    expect(counterWrites(h)).toEqual(['1']);
    expect(h.downloader.saves[0]!.fileName).toBe(h.downloader.saves[1]!.fileName);
    expect(h.link!.bytesToAudioCalls).toBe(2); // one draft, one Save build
  });

  it('turning repeat on or off does not change the snapshot, so Save still reuses', async () => {
    const h = readyHarness();
    await h.controller.save();
    h.controller.setField('repeat', true);
    h.controller.setField('repeat', false);
    await h.controller.save();
    expect(counterWrites(h)).toEqual(['1']);
    expect(h.downloader.saves[0]!.fileName).toBe(h.downloader.saves[1]!.fileName);
  });

  it('builds a new alert with a new sent minute and counter when the form changed', async () => {
    const h = readyHarness();
    await goThenStop(h);
    await h.controller.save();
    const first = lastSaved(h);
    const firstAlert = lastAlert(h);

    h.controller.setField('placeName', 'Harbour road');
    settleDraft(h);
    h.clock.advance(2 * 60000);
    await h.controller.save();

    const second = lastSaved(h);
    const alert = lastAlert(h);
    expect(h.downloader.saveCalls).toBe(2);
    expect(alert.counter).toBe(1);
    expect(alert.sentMinute).toBe(firstAlert.sentMinute + 2);
    expect(alert.placeName).toBe('Harbour road');
    expect(second.fileName).toBe(wavFileName(alert));
    expect(second.fileName).not.toBe(first.fileName);
    expect(counterWrites(h)).toEqual(['1', '2']);
    expect(h.controller.state.preview?.counter).toBe(1);
  });

  it('builds a new alert when TEST changed through the confirmed dialog', async () => {
    const h = readyHarness();
    await h.controller.save();
    h.controller.toggleTest(false);
    h.controller.confirmDialog();
    settleDraft(h);
    await h.controller.save();
    expect(lastSaved(h).fileName).toMatch(/^dead-air-alert-flood-/);
    expect(lastAlert(h).test).toBe(false);
    expect(lastAlert(h).counter).toBe(1);
    expect(counterWrites(h)).toEqual(['1', '2']);
    expect(h.controller.state.preview?.test).toBe(false);
  });

  it('builds a new alert with a new sent minute and counter when the Broadcast alert has expired', async () => {
    const h = readyHarness(); // valid for 6 hours
    await goThenStop(h);
    const sentBefore = lastAlert(h).sentMinute;

    h.clock.advance(7 * HOUR_MS);
    await h.controller.save();

    const alert = lastAlert(h);
    expect(alert.counter).toBe(1);
    expect(alert.sentMinute).toBe(sentBefore + 7 * 60);
    expect(lastSaved(h).fileName).toBe(wavFileName(alert));
    expect(counterWrites(h)).toEqual(['1', '2']);
    expect(h.controller.state.preview?.status).toBe('current');
  });

  it('writes a WAV of two plays plus a 1 s gap, to the nearest sample', async () => {
    const link = new FakeLink({ sampleRate: 44100, audioSeconds: 1.2345 });
    const h = readyHarness({ link });
    await h.controller.save();
    const n = Math.round(1.2345 * 44100);
    const gap = Math.round(1.0 * 44100);
    const wav = lastSaved(h).bytes;
    expect(wav.length).toBe(44 + 2 * (2 * n + gap));
    const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint32(40, true)).toBe(2 * (2 * n + gap));
    // Gap is silent, second play starts after it.
    expect(view.getInt16(44 + 2 * n, true)).toBe(0);
    expect(view.getInt16(44 + 2 * (n + gap) - 2, true)).toBe(0);
    expect(view.getInt16(44 + 2 * (n + gap) + 2 * 3, true)).toBe(view.getInt16(44 + 2 * 3, true));
  });

  it('downloads nothing, keeps the counter and keeps the previous preview when the WAV cannot be made', async () => {
    const inner = new FakeLink();
    const bad: LinkLike = {
      sampleRate: inner.sampleRate,
      bytesToAudio: (b) => {
        const r = inner.bytesToAudio(b);
        if (!r.ok) return r;
        const samples = Float32Array.from(r.samples);
        samples[5] = Number.NaN;
        return { ok: true, samples };
      },
      createListener: () => inner.createListener(),
    };
    const h = readyHarness({ link: bad });
    const previewBefore = h.controller.state.preview;
    const formBefore = h.controller.state.form;
    await h.controller.save();
    const s = h.controller.state;
    expect(h.downloader.saveCalls).toBe(0);
    expect(counterWrites(h)).toEqual([]);
    expect(s.banner).toEqual({
      key: 'err.wav',
      params: { reason: stringsEn.labels.wavReason['not-finite'] },
    });
    expect(s.preview).toEqual(previewBefore);
    expect(s.form).toEqual(formBefore);
    expect(h.audio.unlockCalls).toBe(0);
  });

  it('downloads nothing and shows the failure when the Self_Check fails', async () => {
    const fake = new FakeLink();
    const h = readyHarness({ link: fake });
    const previewBefore = h.controller.state.preview;
    fake.behavior = { kind: 'changed', index: 2 };
    await h.controller.save();
    const s = h.controller.state;
    expect(h.downloader.saveCalls).toBe(0);
    expect(counterWrites(h)).toEqual([]);
    expect(s.banner).toEqual({ key: 'check.failed' });
    expect(s.preview).toEqual(previewBefore);
    expect(s.phase).toBe('idle');
    expect(fake.openListeners).toBe(0);
  });

  it('refuses a bad clock without building', async () => {
    const h = readyHarness();
    h.clock.set(Number.NaN);
    await h.controller.save();
    expect(h.downloader.saveCalls).toBe(0);
    expect(counterWrites(h)).toEqual([]);
    expect(h.controller.state.banner).toEqual({ key: 'clock.bad' });
  });
});

// ================================================================ location

function makeLocationHarness(
  available: { ok: true } | { ok: false; reason: 'no-api' | 'insecure' },
  secureContext?: boolean,
) {
  const clock = new FakeClock(FIXTURE_NOW_MS);
  const timers = new FakeTimers(clock);
  const geolocation = new FakeGeolocation();
  geolocation.available = available;
  const storage = new FakeStorage();
  const controller = createBroadcastController({
    clock,
    timers,
    storage,
    audio: new FakeAudioHost(new FakePlayer(timers)),
    geolocation,
    wakeLock: new FakeWakeLock(),
    downloader: new FakeDownloader(),
    strings: stringsEn,
    offsetMinutes: () => 0,
    link: new FakeLink(),
    ...(secureContext === undefined ? {} : { secureContext }),
  });
  return { controller, geolocation, storage };
}

describe('location', () => {
  it('makes no position request until the button is tapped', () => {
    const h = makeHarness();
    fillValid(h);
    settleDraft(h);
    h.controller.setField('placeName', 'Edit');
    settleDraft(h);
    expect(h.geolocation.getPositionCalls).toBe(0);
    expect(h.geolocation.timeouts).toEqual([]);
    expect(h.controller.state.controls.locationButton.enabled).toBe(true);
  });

  it('on success fills both boxes with 4 decimals and asks with a 15000 ms timeout', async () => {
    expect(LOCATION_TIMEOUT_MS).toBe(15000);
    const h = makeHarness();
    h.geolocation.answer = { ok: true, position: { latitude: -33.86882, longitude: 151.20929 } };
    await h.controller.useLocation();
    const s = h.controller.state;
    expect(s.form.latitude).toBe('-33.8688');
    expect(s.form.longitude).toBe('151.2093');
    expect(s.location.message).toEqual({ key: 'location.found' });
    expect(h.geolocation.getPositionCalls).toBe(1);
    expect(h.geolocation.timeouts).toEqual([15000]);
  });

  it('pads to 4 decimals for round values', async () => {
    const h = makeHarness();
    h.geolocation.answer = { ok: true, position: { latitude: 12.5, longitude: -7 } };
    await h.controller.useLocation();
    expect(h.controller.state.form.latitude).toBe('12.5000');
    expect(h.controller.state.form.longitude).toBe('-7.0000');
  });

  for (const reason of ['refused', 'unavailable', 'timeout', 'no-api'] as const) {
    it(`on ${reason} leaves both boxes exactly as they were and shows a message`, async () => {
      const h = makeHarness();
      h.controller.setField('latitude', ' 1,5 ');
      h.controller.setField('longitude', '2.50');
      h.geolocation.answer = { ok: false, reason };
      await h.controller.useLocation();
      const s = h.controller.state;
      expect(s.form.latitude).toBe(' 1,5 ');
      expect(s.form.longitude).toBe('2.50');
      const key = `location.${reason}` as TextKey;
      expect(s.location.message).toEqual({ key });
      expect(stringsEn.text[key]).not.toBe('');
      expect(h.geolocation.timeouts).toEqual([15000]);
    });
  }

  it('on failure with empty boxes leaves them empty', async () => {
    const h = makeHarness();
    h.geolocation.answer = { ok: false, reason: 'refused' };
    await h.controller.useLocation();
    expect(h.controller.state.form.latitude).toBe('');
    expect(h.controller.state.form.longitude).toBe('');
  });

  it('is disabled with a reason, and never asks, when the API is missing', async () => {
    const h = makeLocationHarness({ ok: false, reason: 'no-api' });
    const s = h.controller.state;
    expect(s.controls.locationButton.enabled).toBe(false);
    expect(s.controls.locationButton.whyNot).toBe('location.off.no-api');
    expect(s.location.available).toBe(false);
    expect(s.location.whyNot).toEqual({ key: 'location.off.no-api' });
    expect(stringsEn.text['location.off.no-api']).not.toBe('');
    await h.controller.useLocation();
    expect(h.geolocation.getPositionCalls).toBe(0);
    expect(h.controller.state.form.latitude).toBe('');
  });

  it('is disabled with a reason when the page is not secure', async () => {
    const h = makeLocationHarness({ ok: true }, false);
    const s = h.controller.state;
    expect(s.controls.locationButton.enabled).toBe(false);
    expect(s.controls.locationButton.whyNot).toBe('location.off.insecure');
    await h.controller.useLocation();
    expect(h.geolocation.getPositionCalls).toBe(0);
  });

  it('provider reporting insecure is also disabled with its reason', () => {
    const h = makeLocationHarness({ ok: false, reason: 'insecure' });
    expect(h.controller.state.location.whyNot).toEqual({ key: 'location.off.insecure' });
  });

  it('never stores the position: only the station ID and counter keys are written', async () => {
    const h = makeHarness();
    h.geolocation.answer = { ok: true, position: { latitude: 48.8566, longitude: 2.3522 } };
    await h.controller.useLocation();
    fillValid(h);
    settleDraft(h);
    await h.controller.save();
    await goThenStop(h);
    const writes = h.storage!.writes;
    expect(writes.length).toBeGreaterThan(0);
    expect(writes.every((w) => w.key === STATION_ID_KEY || w.key === COUNTER_KEY)).toBe(true);
    // Station ID and counter never hold the position either.
    expect(writes.some((w) => /48\.|2\.3522/.test(w.value))).toBe(false);
    expect(h.storage!.keys.every((k) => k === STATION_ID_KEY || k === COUNTER_KEY)).toBe(true);
  });
});

// ================================================================ wake lock

describe('wake lock', () => {
  it('is requested when repeat starts, and released on Stop', async () => {
    const h = readyHarness();
    expect(h.wakeLock.requestCalls).toBe(0);
    await startRepeat(h);
    expect(h.wakeLock.requestCalls).toBe(1);
    expect(h.wakeLock.activeCount).toBe(1);
    expect(h.controller.state.repeat?.wake).toBe('on');
    expect(h.controller.state.notices).toContainEqual({ key: 'wake.on' });

    h.controller.stop();
    expect(h.wakeLock.releaseCalls).toBe(1);
    expect(h.wakeLock.activeCount).toBe(0);
    expect(h.controller.state.repeat).toBeNull();
  });

  it('is not requested for a single Broadcast', async () => {
    const h = readyHarness();
    await goThenStop(h);
    expect(h.wakeLock.requestCalls).toBe(0);
  });

  it('is requested again when the tab is visible after the browser released it', async () => {
    const h = readyHarness();
    await startRepeat(h);
    expect(h.wakeLock.requestCalls).toBe(1);

    h.wakeLock.releaseByBrowser();
    expect(h.controller.state.repeat?.wake).toBe('off');
    expect(h.controller.state.notices).toContainEqual({ key: 'wake.off' });

    h.controller.visibilityChanged(false);
    await flushPromises();
    expect(h.wakeLock.requestCalls).toBe(1); // hidden: nothing to ask

    h.controller.visibilityChanged(true);
    await flushPromises();
    expect(h.wakeLock.requestCalls).toBe(2);
    expect(h.wakeLock.activeCount).toBe(1);
    expect(h.controller.state.repeat?.wake).toBe('on');

    h.controller.stop();
    expect(h.wakeLock.activeCount).toBe(0);
  });

  it('does not ask again on a visible tab while the lock is still held', async () => {
    const h = readyHarness();
    await startRepeat(h);
    h.controller.visibilityChanged(true);
    await flushPromises();
    expect(h.wakeLock.requestCalls).toBe(1);
    h.controller.stop();
  });

  it('is released when repeat ends by expiry', async () => {
    const h = readyHarness({ playerMode: 'timers' }, { validFor: 'm15' });
    await startRepeat(h);
    expect(h.wakeLock.activeCount).toBe(1);
    await h.timers.advanceAsync(15 * 60000);
    expect(h.controller.state.phase).toBe('idle');
    expect(h.wakeLock.activeCount).toBe(0);
    expect(h.wakeLock.releaseCalls).toBe(1);
  });

  it('is released when a failing round ends the repeat', async () => {
    const h = readyHarness();
    h.player.failNext = new Error('speaker gone');
    await startRepeat(h);
    await flushPromises();
    expect(h.controller.state.phase).toBe('idle');
    expect(h.wakeLock.activeCount).toBe(0);
  });

  it('unsupported: repeat goes on with the notice and a status message', async () => {
    const h = readyHarness();
    h.wakeLock.supported = false;
    await startRepeat(h);
    const s = h.controller.state;
    expect(h.wakeLock.requestCalls).toBe(0);
    expect(s.phase).toBe('repeating');
    expect(s.repeat?.wake).toBe('unsupported');
    expect(s.notices).toContainEqual({ key: 'repeat.keep-open' });
    expect(s.notices).toContainEqual({ key: 'wake.unsupported' });
    expect(h.player.playCalls).toBe(1);
    h.controller.visibilityChanged(true);
    await flushPromises();
    expect(h.wakeLock.requestCalls).toBe(0);
    h.controller.stop();
  });

  it('refused: repeat goes on with the notice and a status message', async () => {
    const h = readyHarness();
    h.wakeLock.refuse = true;
    await startRepeat(h);
    const s = h.controller.state;
    expect(h.wakeLock.requestCalls).toBe(1);
    expect(s.phase).toBe('repeating');
    expect(s.repeat?.wake).toBe('refused');
    expect(s.notices).toContainEqual({ key: 'repeat.keep-open' });
    expect(s.notices).toContainEqual({ key: 'wake.refused' });
    h.controller.stop();
  });

  it('a rejecting request is treated as refused', async () => {
    const h = readyHarness();
    h.wakeLock.throwOnRequest = new Error('NotAllowedError');
    await startRepeat(h);
    expect(h.controller.state.phase).toBe('repeating');
    expect(h.controller.state.repeat?.wake).toBe('refused');
    h.controller.stop();
  });

  it('a lock granted after Stop is released at once', async () => {
    const h = readyHarness();
    h.controller.setField('repeat', true);
    void h.controller.goOnAir();
    await flushPromises();
    h.controller.stop();
    await flushPromises();
    expect(h.wakeLock.activeCount).toBe(0);
  });
});

// ================================================================ repeat flow

describe('repeat flow', () => {
  it('plays a round every 60 s with the same samples, no new Build and no new counter', async () => {
    const h = readyHarness({ playerMode: 'timers' });
    await startRepeat(h);
    const audioCalls = h.link!.bytesToAudioCalls;
    const listeners = h.link!.createListenerCalls;
    expect(counterWrites(h)).toEqual(['1']);
    expect(h.player.playCalls).toBe(1);

    await h.timers.advanceAsync(3000); // end of round 1: two plays and the gap
    expect(h.player.playCalls).toBe(2);
    await h.timers.advanceAsync(57000); // t = 60 s
    expect(h.player.playCalls).toBe(3);
    expect(h.controller.state.repeat?.round).toBe(2);
    await h.timers.advanceAsync(60000); // t = 120 s
    expect(h.player.playCalls).toBe(5);
    expect(h.controller.state.repeat?.round).toBe(3);

    const [p0, , p2, , p4] = h.player.plays;
    expect(p2!.at - p0!.at).toBe(60000);
    expect(p4!.at - p0!.at).toBe(120000);
    for (const p of h.player.plays) expect(p.samples).toBe(p0!.samples);

    expect(h.link!.bytesToAudioCalls).toBe(audioCalls);
    expect(h.link!.createListenerCalls).toBe(listeners);
    expect(counterWrites(h)).toEqual(['1']);
    expect(h.controller.state.preview?.counter).toBe(0);
    h.controller.stop();
  });

  it('shows round number, sent time and a countdown in the state', async () => {
    const h = readyHarness({ playerMode: 'timers' });
    await startRepeat(h);
    let r = h.controller.state.repeat!;
    expect(r.round).toBe(1);
    expect(r.sentUtc).toBe(formatUtc(Math.floor(FIXTURE_NOW_MS / 60000) * 60000));
    expect(r.secondsToNext).toBe(60);
    expect(h.controller.state.notices).toContainEqual({ key: 'on-air' });
    expect(h.controller.state.notices).toContainEqual({ key: 'repeat.keep-open' });

    await h.timers.advanceAsync(10000);
    r = h.controller.state.repeat!;
    expect(r.secondsToNext).toBe(50);
    expect(r.sentUtc).toBe(formatUtc(Math.floor(FIXTURE_NOW_MS / 60000) * 60000));
    h.controller.stop();
  });

  it('disables the form while repeating and enables it again after Stop', async () => {
    const h = readyHarness();
    await startRepeat(h);
    let c = h.controller.state.controls;
    expect(c.formInputs.disabled).toBe(true);
    expect(c.repeatBox.disabled).toBe(true);
    expect(c.testSwitch.disabled).toBe(true);
    expect(c.stop.enabled).toBe(true);
    h.controller.setField('placeName', 'Nope');
    expect(h.controller.state.form.placeName).toBe('Riverside ward 4');

    h.controller.stop();
    c = h.controller.state.controls;
    expect(c.formInputs.disabled).toBe(false);
    expect(c.repeatBox.disabled).toBe(false);
    expect(c.stop.enabled).toBe(false);
    expect(h.controller.state.phase).toBe('idle');
  });

  it('Stop silences the sound and cancels every later round', async () => {
    const h = readyHarness({ playerMode: 'timers' });
    await startRepeat(h);
    await h.timers.advanceAsync(60500); // round 2 is playing
    expect(h.player.playing).toBe(true);
    const plays = h.player.playCalls;
    h.controller.stop();
    await flushPromises();
    expect(h.player.stopCalls).toBeGreaterThan(0);
    expect(h.controller.state.notices).toContainEqual({ key: 'stopped' });
    await h.timers.advanceAsync(10 * 60000);
    expect(h.player.playCalls).toBe(plays);
    expect(h.controller.state.phase).toBe('idle');
    expect(h.controller.state.repeat).toBeNull();
  });

  it('Stop during a playing round silences it and starts no second play', async () => {
    const h = readyHarness();
    await startRepeat(h);
    expect(h.player.playing).toBe(true);
    h.controller.stop();
    await flushPromises();
    await h.timers.advanceAsync(5000);
    expect(h.player.playCalls).toBe(1);
    expect(h.player.playing).toBe(false);
  });

  it('stops with a message when the valid-until time is reached, with no round at or after it', async () => {
    const h = readyHarness({ playerMode: 'timers' }, { validFor: 'm15' });
    await startRepeat(h);
    await h.timers.advanceAsync(15 * 60000);
    const s = h.controller.state;
    expect(s.phase).toBe('idle');
    expect(s.notices).toContainEqual({ key: 'repeat.expired' });
    expect(stringsEn.text['repeat.expired']).not.toBe('');
    expect(s.controls.formInputs.disabled).toBe(false);
    expect(h.player.playCalls).toBe(30); // rounds at 0, 60, ..., 840 s, two plays each
    await h.timers.advanceAsync(5 * 60000);
    expect(h.player.playCalls).toBe(30);
  });

  it('plays exactly one catch-up round with the skipped count after a hidden tab', async () => {
    const h = readyHarness({ playerMode: 'timers' });
    await startRepeat(h);
    await h.timers.advanceAsync(3000); // round 1 done
    expect(h.player.playCalls).toBe(2);

    // The tab is hidden: timers do not run, but the clock moves to 150 s.
    h.clock.advance(147000);
    h.controller.visibilityChanged(true);
    await flushPromises();

    expect(h.player.playCalls).toBe(3); // exactly one new round
    expect(h.controller.state.repeat?.round).toBe(2);
    expect(h.controller.state.notices).toContainEqual({ key: 'repeat.missed', params: { skipped: 1 } });
    expect(h.player.plays[2]!.samples).toBe(h.player.plays[0]!.samples);

    // The next round is 60 s after the catch-up round, not on the old schedule.
    await h.timers.advanceAsync(59000);
    expect(h.player.playCalls).toBe(4); // second play of the catch-up round only
    await h.timers.advanceAsync(1000);
    expect(h.player.playCalls).toBe(5);
    expect(h.player.plays[4]!.at - h.player.plays[2]!.at).toBe(60000);
    h.controller.stop();
  });

  it('a failing round play stops the repeat with a message', async () => {
    const h = readyHarness();
    h.player.failNext = new Error('speaker gone');
    await startRepeat(h);
    await flushPromises();
    const s = h.controller.state;
    expect(s.phase).toBe('idle');
    expect(s.repeat).toBeNull();
    expect(s.banner).toEqual({ key: 'audio.unavailable' });
    expect(s.controls.formInputs.disabled).toBe(false);
    await h.timers.advanceAsync(5 * 60000);
    expect(h.player.playCalls).toBe(1);
  });

  it('a failing later round also stops the repeat', async () => {
    const h = readyHarness({ playerMode: 'timers' });
    await startRepeat(h);
    await h.timers.advanceAsync(3000);
    h.player.failNext = new Error('speaker gone');
    await h.timers.advanceAsync(57000);
    await flushPromises();
    expect(h.controller.state.phase).toBe('idle');
    expect(h.controller.state.banner).toEqual({ key: 'audio.unavailable' });
    const plays = h.player.playCalls;
    await h.timers.advanceAsync(5 * 60000);
    expect(h.player.playCalls).toBe(plays);
  });

  it('form edits and a later clock minute do not change the bytes of the running repeat', async () => {
    const h = readyHarness({ playerMode: 'timers' });
    await startRepeat(h);
    h.controller.setField('placeName', 'Other');
    await h.timers.advanceAsync(125000);
    const first = h.player.plays[0]!.samples;
    expect(h.player.plays.length).toBeGreaterThanOrEqual(5);
    for (const p of h.player.plays) expect(p.samples).toBe(first);
    expect(h.controller.state.preview?.placeName).toBe('Riverside ward 4');
    h.controller.stop();
  });
});

// ================================================================ properties

describe('properties', () => {
  // Feature: broadcast-page, Property 15: The form snapshot is equal exactly when the models are equal
  // **Validates: Requirements 12.3, 12.4**
  it('Property 15: snapshot equal if and only if every model field is equal', () => {
    const FIELDS: Array<keyof FormModel> = [
      'event', 'urgency', 'severity', 'action', 'placeName',
      'latitude', 'longitude', 'validSteps', 'stationId', 'test',
    ];
    const pairArb: fc.Arbitrary<[FormModel, FormModel]> = fc.oneof(
      // identical copies
      validFormModelArb().map((m): [FormModel, FormModel] => [m, { ...m }]),
      // unrelated models
      fc.tuple(validFormModelArb(), validFormModelArb()),
      // one field taken from another model
      fc
        .tuple(validFormModelArb(), validFormModelArb(), fc.integer({ min: 0, max: FIELDS.length - 1 }))
        .map(([a, other, i]): [FormModel, FormModel] => {
          const key = FIELDS[i]!;
          return [a, { ...a, [key]: other[key] } as FormModel];
        }),
    );
    fc.assert(
      fc.property(pairArb, ([a, b]) => {
        const same = FIELDS.every((k) => a[k] === b[k]);
        expect(formSnapshot(a) === formSnapshot(b)).toBe(same);
      }),
      FC_OPTIONS,
    );
  });

  // Feature: broadcast-page, Property 19: A found location fills both boxes with four decimals
  // **Validates: Requirements 3.12, 3.15**
  it('Property 19: a found location fills both boxes with four decimals and stores nothing', async () => {
    const positionArb = fc.tuple(
      fc.double({ min: -90, max: 90, noNaN: true }),
      fc.double({ min: -180, max: 180, noNaN: true }),
    );
    await fc.assert(
      fc.asyncProperty(positionArb, async ([latitude, longitude]) => {
        const h = makeHarness();
        const keysBefore = h.storage!.keys;
        const writesBefore = [...h.storage!.writes];
        const answer: FakeGeoAnswer = { ok: true, position: { latitude, longitude } };
        h.geolocation.answer = answer;
        await h.controller.useLocation();

        const form = h.controller.state.form;
        expect(form.latitude).toMatch(/^-?\d{1,2}\.\d{4}$/);
        expect(form.longitude).toMatch(/^-?\d{1,3}\.\d{4}$/);
        const lat = parseCoordinate(form.latitude, LATITUDE_LIMIT_UNITS);
        const lon = parseCoordinate(form.longitude, LONGITUDE_LIMIT_UNITS);
        expect(lat.ok && lon.ok).toBe(true);
        if (lat.ok && lon.ok) {
          expect(Math.abs(lat.units! / 10000 - latitude)).toBeLessThanOrEqual(0.00005 + 1e-9);
          expect(Math.abs(lon.units! / 10000 - longitude)).toBeLessThanOrEqual(0.00005 + 1e-9);
        }
        const fieldErrors = h.controller.state.errors.filter(
          (e) => e.field === 'latitude' || e.field === 'longitude',
        );
        expect(fieldErrors).toEqual([]);
        expect(h.geolocation.timeouts).toEqual([LOCATION_TIMEOUT_MS]);
        expect(h.storage!.writes).toEqual(writesBefore);
        expect(h.storage!.keys).toEqual(keysBefore);
      }),
      FC_OPTIONS,
    );
  });
});
