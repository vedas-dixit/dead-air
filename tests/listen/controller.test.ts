// Controller tests: start, payloads, stop, failures, storage. Test alerts only.
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { createListenController } from '../../src/listen/controller';
import { HISTORY_STORAGE_KEY, parseHistory } from '../../src/listen/history-store';
import type { MicFailure, StorageProvider } from '../../src/listen/providers';
import type { Alert } from '../../src/message-code';
import { encodeOrThrow } from '../message-code/generators';
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

const T = stringsEn.text;

function testAlert(over: Partial<Alert> = {}): Alert {
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

const NOW = 29_000_000 * 60000 + 60_000;

function setup(opts: { storage?: FakeListenStorage; wake?: FakeWakeLock } = {}) {
  const clock = new FakeListenClock(NOW);
  const timers = new FakeIntervalTimers(clock);
  const audio = new FakeAudioInput();
  const loader = new FakeSoundLinkLoader();
  const storage = opts.storage ?? new FakeListenStorage();
  const wake = opts.wake ?? new FakeWakeLock();
  const visibility = new FakePageVisibility(true);
  const ctl = createListenController({
    clock,
    timers,
    audio,
    loadLink: loader.load,
    storage,
    wake,
    visibility, host: makeFakeHost(), timeouts: makeFakeTimeouts(),
    strings: stringsEn,
  });
  return { ctl, clock, audio, loader, storage, wake };
}

type Setup = ReturnType<typeof setup>;

async function start(s: Setup): Promise<void> {
  await s.ctl.tapStart();
  await flushPromises();
}

/** Queues one payload on the current listener and pushes a block. */
function hear(s: Setup, bytes: Uint8Array): void {
  s.loader.lastLink!.lastListener!.queuePayloads(bytes);
  s.audio.lastHandle!.pushBlock(new Float32Array(128));
}

const good = () => encodeOrThrow(testAlert());
const bad = () => {
  const b = Uint8Array.from(good());
  b[b.length - 1] = b[b.length - 1]! ^ 0xff;
  return b;
};

describe('start', () => {
  it('does nothing before a tap', async () => {
    const s = setup();
    await flushPromises();
    expect(s.audio.openCalls).toBe(0);
    expect(s.loader.loadCalls).toBe(0);
    expect(s.wake.requestCalls).toBe(0);
    expect(s.ctl.snapshot().running).toBe(false);
  });

  it('calls open() inside the tap, before anything else is awaited', () => {
    const s = setup();
    void s.ctl.tapStart();
    expect(s.audio.openCalls).toBe(1);
    expect(s.loader.loadCalls).toBe(0);
  });

  it('loads the Sound_Link at the rate the handle reports', async () => {
    const s = setup();
    s.audio.sampleRate = 44100;
    await start(s);
    expect(s.loader.rates).toEqual([44100]);
    expect(s.loader.lastLink!.sampleRate).toBe(44100);
    expect(s.ctl.snapshot().running).toBe(true);
    expect(s.audio.lastHandle!.started).toBe(true);
    expect(s.loader.lastLink!.openListeners).toBe(1);
  });

  it('ignores a second tap while starting', async () => {
    const s = setup();
    s.audio.hold = true;
    const first = s.ctl.tapStart();
    expect(s.ctl.snapshot().starting).toBe(true);
    await s.ctl.tapStart();
    expect(s.audio.openCalls).toBe(1);
    s.audio.releaseOpen();
    await first;
    await flushPromises();
    expect(s.audio.handles.length).toBe(1);
    expect(s.ctl.snapshot().running).toBe(true);
  });

  it('requests the wake lock once running', async () => {
    const s = setup();
    await start(s);
    expect(s.wake.requestCalls).toBe(1);
    expect(s.wake.activeCount).toBe(1);
  });
});

describe('payloads', () => {
  it('a good payload adds a card and writes storage', async () => {
    const s = setup();
    await start(s);
    hear(s, good());
    const ui = s.ctl.snapshot();
    expect(ui.cards.length).toBe(1);
    expect(ui.cards[0]!.testBanner).toBe(T['test.banner']);
    expect(s.storage.writes.length).toBe(1);
    expect(parseHistory(s.storage.value).length).toBe(1);
    expect(ui.unreadableText).toBeNull();
  });

  it('a bad payload shows the Unreadable_Notice and writes nothing', async () => {
    const s = setup();
    await start(s);
    hear(s, bad());
    const ui = s.ctl.snapshot();
    expect(ui.unreadableText).toBe(T['listen.unreadable']);
    expect(ui.cards.length).toBe(0);
    expect(s.storage.writes.length).toBe(0);
  });

  it('a later good payload removes the notice', async () => {
    const s = setup();
    await start(s);
    hear(s, bad());
    expect(s.ctl.snapshot().unreadableText).not.toBeNull();
    hear(s, good());
    expect(s.ctl.snapshot().unreadableText).toBeNull();
    expect(s.ctl.snapshot().cards.length).toBe(1);
  });

  it('Stop removes the notice', async () => {
    const s = setup();
    await start(s);
    hear(s, bad());
    s.ctl.tapStop();
    expect(s.ctl.snapshot().unreadableText).toBeNull();
  });

  it('a listener that fails or throws does not stop the Session', async () => {
    const s = setup();
    await start(s);
    const l = s.loader.lastLink!.lastListener!;
    l.failWith = 'disposed';
    s.audio.lastHandle!.pushBlock(new Float32Array(128));
    l.failWith = null;
    l.throwOnFeed = true;
    s.audio.lastHandle!.pushBlock(new Float32Array(128));
    l.throwOnFeed = false;
    expect(s.ctl.snapshot().running).toBe(true);
    expect(s.storage.writes.length).toBe(0);
  });
});

describe('ending a Session', () => {
  async function expectClosed(s: Setup, handleIndex = 0): Promise<void> {
    await flushPromises();
    expect(s.audio.handles[handleIndex]!.closed).toBe(true);
    expect(s.loader.lastLink!.openListeners).toBe(0);
    expect(s.wake.activeCount).toBe(0);
    expect(s.ctl.snapshot().running).toBe(false);
  }

  it('Stop closes the handle, disposes the Listener and releases the wake lock', async () => {
    const s = setup();
    await start(s);
    s.ctl.tapStop();
    await expectClosed(s);
    expect(s.wake.releaseCalls).toBe(1);
    expect(s.ctl.snapshot().level).toBe(0);
  });

  it('mic loss does the same and shows the stopped message', async () => {
    const s = setup();
    await start(s);
    s.audio.lastHandle!.lose();
    await expectClosed(s);
    expect(s.wake.releaseCalls).toBe(1);
    expect(s.ctl.snapshot().errorText).toBe(T['listen.mic.stopped']);
  });

  it('a failed start closes the handle and releases nothing it never took', async () => {
    const s = setup();
    await start(s);
    s.ctl.tapStop();
    const requests = s.wake.requestCalls;
    s.loader.lastLink!.createFail = 'engine-error';
    await start(s);
    await expectClosed(s, 1);
    expect(s.wake.requestCalls).toBe(requests);
    // A load failure closes the handle too.
    const t = setup();
    t.loader.failWith = 'engine-load-failed';
    await start(t);
    expect(t.audio.handles[0]!.closed).toBe(true);
    expect(t.wake.activeCount).toBe(0);
  });

  it('Start after Stop makes a new handle and Listener', async () => {
    const s = setup();
    await start(s);
    s.ctl.tapStop();
    await start(s);
    expect(s.audio.handles.length).toBe(2);
    expect(s.audio.handles[0]!.closed).toBe(true);
    expect(s.audio.openHandles.length).toBe(1);
    expect(s.loader.lastLink!.listeners.length).toBe(2);
    expect(s.loader.lastLink!.openListeners).toBe(1);
    expect(s.ctl.snapshot().running).toBe(true);
  });

  it('Stop during a start closes the handle that arrives', async () => {
    const s = setup();
    s.audio.hold = true;
    const p = s.ctl.tapStart();
    s.ctl.tapStop();
    s.audio.releaseOpen();
    await p;
    await flushPromises();
    expect(s.audio.openHandles.length).toBe(0);
    expect(s.ctl.snapshot().running).toBe(false);
    expect(s.ctl.snapshot().starting).toBe(false);
  });
});

describe('failures', () => {
  const cases: Array<[MicFailure, keyof typeof T]> = [
    ['refused', 'listen.mic.refused'],
    ['no-device', 'listen.mic.none'],
    ['unsupported', 'listen.mic.insecure'],
    ['audio', 'listen.mic.audio'],
    ['other', 'listen.mic.failed'],
  ];

  it.each(cases)('%s shows its message and keeps Start', async (reason, key) => {
    const s = setup();
    s.audio.failWith = reason;
    await start(s);
    const ui = s.ctl.snapshot();
    expect(ui.errorText).toBe(T[key]);
    expect(ui.errorText).toBeTruthy();
    expect(ui.running).toBe(false);
    expect(ui.starting).toBe(false);
    expect(s.loader.loadCalls).toBe(0);
  });

  it('a rejected open() is shown as the generic microphone message', async () => {
    const s = setup();
    s.audio.throwOnOpen = new Error('boom');
    await start(s);
    expect(s.ctl.snapshot().errorText).toBe(T['listen.mic.failed']);
    expect(s.ctl.snapshot().starting).toBe(false);
  });

  it('the next tap clears the message', async () => {
    const s = setup();
    s.audio.failWith = 'refused';
    await start(s);
    expect(s.ctl.snapshot().errorText).not.toBeNull();
    s.audio.hold = true;
    const p = s.ctl.tapStart();
    expect(s.ctl.snapshot().errorText).toBeNull();
    s.audio.failWith = null;
    s.audio.releaseOpen();
    await p;
    await flushPromises();
    expect(s.ctl.snapshot().errorText).toBeNull();
    expect(s.ctl.snapshot().running).toBe(true);
  });

  it('engine failure shows engine.failed and releases the microphone', async () => {
    const s = setup();
    s.loader.failWith = 'engine-load-failed';
    await start(s);
    expect(s.ctl.snapshot().errorText).toBe(T['engine.failed']);
    expect(s.audio.handles[0]!.closed).toBe(true);
    expect(s.audio.openHandles.length).toBe(0);
    expect(s.ctl.snapshot().running).toBe(false);
  });

  it('a Listener that cannot be created releases the microphone too', async () => {
    const s = setup();
    await start(s);
    s.ctl.tapStop();
    s.loader.lastLink!.createFail = 'engine-error';
    await start(s);
    expect(s.ctl.snapshot().errorText).toBe(T['engine.failed']);
    expect(s.audio.openHandles.length).toBe(0);
  });
});

describe('storage', () => {
  it('a failing write shows the not-kept line', async () => {
    const s = setup();
    s.storage.failWrites = true;
    await start(s);
    expect(s.ctl.snapshot().historyUnkeptText).toBeNull();
    hear(s, good());
    expect(s.ctl.snapshot().historyUnkeptText).toBe(T['listen.history.unkept']);
    expect(s.ctl.snapshot().cards.length).toBe(1);
  });

  it('a failing remove shows the not-kept line', async () => {
    const s = setup();
    await start(s);
    hear(s, good());
    s.storage.failRemove = true;
    s.ctl.tapClear();
    expect(s.ctl.snapshot().historyUnkeptText).toBe(T['listen.history.unkept']);
  });

  it('unavailable storage shows the not-kept line and still shows cards', async () => {
    const s = setup({ storage: new FakeListenStorage(null, false) });
    expect(s.ctl.snapshot().historyUnkeptText).toBe(T['listen.history.unkept']);
    await start(s);
    hear(s, good());
    expect(s.ctl.snapshot().cards.length).toBe(1);
    expect(s.ctl.snapshot().historyUnkeptText).toBe(T['listen.history.unkept']);
  });

  it('Clear removes the cards and the stored entry', async () => {
    const s = setup();
    await start(s);
    hear(s, good());
    expect(s.ctl.snapshot().clearEnabled).toBe(true);
    s.ctl.tapClear();
    expect(s.ctl.snapshot().cards.length).toBe(0);
    expect(s.ctl.snapshot().clearEnabled).toBe(false);
    expect(s.storage.removeCalls).toBe(1);
    expect(s.storage.value).toBeNull();
  });

  it('loads the stored history at creation', () => {
    const first = setup();
    return start(first).then(() => {
      hear(first, good());
      const s = setup({ storage: new FakeListenStorage(first.storage.value) });
      expect(s.ctl.snapshot().cards.length).toBe(1);
    });
  });

  it('the only storage key written is HISTORY_STORAGE_KEY', async () => {
    // Keyed store behind the provider, as the DOM layer will be.
    const keys = new Map<string, string>();
    const keyed: StorageProvider = {
      available: true,
      read: () => keys.get(HISTORY_STORAGE_KEY) ?? null,
      write: (t) => (keys.set(HISTORY_STORAGE_KEY, t), true),
      remove: () => (keys.delete(HISTORY_STORAGE_KEY), true),
    };
    const clock = new FakeListenClock(NOW);
    const audio = new FakeAudioInput();
    const loader = new FakeSoundLinkLoader();
    const ctl = createListenController({
      clock,
      timers: new FakeIntervalTimers(clock),
      audio,
      loadLink: loader.load,
      storage: keyed,
      wake: new FakeWakeLock(),
      visibility: new FakePageVisibility(true), host: makeFakeHost(), timeouts: makeFakeTimeouts(),
      strings: stringsEn,
    });
    await ctl.tapStart();
    await flushPromises();
    loader.lastLink!.lastListener!.queuePayloads(good());
    audio.lastHandle!.pushBlock(new Float32Array(128));
    ctl.tapClear();
    expect([...keys.keys()]).toEqual([]);
    expect(HISTORY_STORAGE_KEY).toBe('dead-air.listen.history.v1');
  });

  it('only history text is written: version 1, no audio', async () => {
    const s = setup();
    await start(s);
    hear(s, good());
    for (const w of s.storage.writes) {
      const data = JSON.parse(w) as { v: number; entries: Array<Record<string, unknown>> };
      expect(data.v).toBe(1);
      expect(Object.keys(data.entries[0]!).sort()).toEqual(['b', 'f', 'h', 'l', 'n']);
    }
  });
});
