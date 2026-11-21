// Controller tests for language changes. Test alerts only.
// Listen part first, then the Broadcast part.
import { describe, expect, it } from 'vitest';
import { createBroadcastController, DRAFT_DELAY_MS } from '../../src/broadcast/controller';
import type { RawForm } from '../../src/broadcast/form';
import { buildSayFirst } from '../../src/broadcast/say-first';
import { stringsEn } from '../../src/broadcast/strings.en';
import { decodeMessage } from '../../src/message-code';
import {
  FakeAudioHost,
  FakeClock,
  FakeDownloader,
  FakeGeolocation,
  FakeLink,
  FakePlayer,
  FakeStorage,
  FakeTimers,
  FakeWakeLock as FakeBroadcastWakeLock,
} from '../broadcast/fakes';
import { FIXTURE_NOW_MS, rawFormWithPoint } from '../broadcast/fixtures';
import { buildSpokenText } from '../../src/languages/spoken-text';
import { stringsHi } from '../../src/languages/strings.hi';
import { createListenController } from '../../src/listen/controller';
import { alertKey } from '../../src/listen/history';
import type { Alert } from '../../src/message-code';
import { buildCardView } from '../../src/listen/card';
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
} from '../listen/fakes';

describe('Listen controller language', () => {
  const SENT = 29_000_000;
  const NOW = SENT * 60000 + 60_000;

  const alert: Alert = {
    test: true,
    passedOn: false,
    event: 'flood',
    urgency: 'immediate',
    severity: 'severe',
    action: 'evacuate',
    sentMinute: SENT,
    validSteps: 8,
    latitude: null,
    longitude: null,
    stationId: 7,
    counter: 1,
    placeName: 'Test Town',
  };

  function setup() {
    const clock = new FakeListenClock(NOW);
    const audio = new FakeAudioInput();
    const loader = new FakeSoundLinkLoader();
    const ctl = createListenController({
      clock,
      timers: new FakeIntervalTimers(clock),
      audio,
      loadLink: loader.load,
      storage: new FakeListenStorage(),
      wake: new FakeWakeLock(),
      visibility: new FakePageVisibility(true),
      strings: stringsEn,
    });
    return { ctl, clock, audio, loader };
  }

  async function startAndHear(s: ReturnType<typeof setup>): Promise<void> {
    await s.ctl.tapStart();
    await flushPromises();
    s.loader.lastLink!.lastListener!.queuePayloads(encodeOrThrow(alert));
    s.audio.lastHandle!.pushBlock(new Float32Array(128));
  }

  /** Requirements 6.3, 8.6 */
  it('setStrings keeps the Session and the History and redraws cards in the new language', async () => {
    const s = setup();
    await startAndHear(s);
    const before = s.ctl.snapshot();
    expect(before.running).toBe(true);
    expect(before.cards).toHaveLength(1);

    const seen: number[] = [];
    s.ctl.subscribe((ui) => seen.push(ui.cards.length));
    s.ctl.setStrings(stringsHi);

    const after = s.ctl.snapshot();
    expect(after.running).toBe(true);
    expect(s.audio.lastHandle!.closed).toBe(false);
    expect(s.loader.lastLink!.lastListener!.disposed).toBe(false);
    expect(after.cards.map((c) => c.key)).toEqual([alertKey(alert)]);
    expect(seen).toEqual([1]); // subscribers are told once

    const entryView = buildCardView(
      { bytes: encodeOrThrow(alert), alert, heardCount: 1, firstHeardMs: NOW, lastHeardMs: NOW },
      NOW,
      0,
      stringsHi,
    );
    expect(after.cards[0]!.rows.map((r) => r.label)).toEqual(entryView.rows.map((r) => r.label));
    expect(after.cards[0]!.testBanner).toBe(stringsHi.text['test.banner']);
    expect(after.cards[0]!.rows.map((r) => r.label)).not.toEqual(before.cards[0]!.rows.map((r) => r.label));

    // Hearing more still works in the same Session.
    s.ctl.setStrings(stringsEn);
    expect(s.ctl.snapshot().cards[0]!.testBanner).toBe(stringsEn.text['test.banner']);
  });

  /** Requirements 5.9, 9.3 */
  it('spokenText uses the device time at the call', async () => {
    const s = setup();
    await startAndHear(s);
    const key = alertKey(alert);

    const first = s.ctl.spokenText(key);
    expect(first).toBe(buildSpokenText(alert, NOW, stringsEn));
    expect(first).not.toBeNull();

    s.clock.advance(3 * 60_000);
    const later = s.ctl.spokenText(key);
    expect(later).toBe(buildSpokenText(alert, NOW + 3 * 60_000, stringsEn));
    expect(later).not.toBe(first);

    s.ctl.setStrings(stringsHi);
    expect(s.ctl.spokenText(key)).toBe(buildSpokenText(alert, NOW + 3 * 60_000, stringsHi));
  });

  /** Requirement 9.4 */
  it('spokenText returns null for a key that is not in the History', async () => {
    const s = setup();
    await startAndHear(s);
    expect(s.ctl.spokenText('9:9:9')).toBeNull();
    expect(s.ctl.spokenText('')).toBeNull();
  });
});

describe('Broadcast controller language', () => {
  function setupBroadcast(audioFail?: 'engine-error') {
    const clock = new FakeClock(FIXTURE_NOW_MS);
    const timers = new FakeTimers(clock);
    const player = new FakePlayer(timers, 'timers');
    const link = new FakeLink(audioFail ? { audioFail } : {});
    const ctl = createBroadcastController({
      clock,
      timers,
      storage: new FakeStorage(),
      audio: new FakeAudioHost(player),
      geolocation: new FakeGeolocation(),
      wakeLock: new FakeBroadcastWakeLock(),
      downloader: new FakeDownloader(),
      strings: stringsEn,
      offsetMinutes: () => 0,
      link,
    });
    const keys: Array<keyof RawForm> = [
      'event', 'urgency', 'severity', 'action', 'placeName',
      'latitude', 'longitude', 'validFor', 'stationId',
    ];
    for (const key of keys) ctl.setField(key, rawFormWithPoint[key] as never);
    timers.advance(DRAFT_DELAY_MS);
    return { ctl, link, player };
  }

  /** Requirements 5.10, 6.2, 6.4 */
  it('setStrings keeps the form, rebuilds the Say_First line and tells subscribers', () => {
    const s = setupBroadcast();
    const before = s.ctl.state;
    expect(before.draftCheck).toBe('passed');
    expect(before.sayFirst).not.toBeNull();
    const seen: number[] = [];
    s.ctl.subscribe(() => seen.push(1));

    s.ctl.setStrings(stringsHi);

    const after = s.ctl.state;
    expect(after.form).toEqual(before.form);
    expect(after.phase).toBe('idle');
    expect(after.draftCheck).toBe('passed');
    expect(after.preview).toEqual(before.preview);
    expect(seen).toHaveLength(1);

    const decoded = decodeMessage(s.link.lastBytes!);
    if (!decoded.ok) throw new Error('fixture bytes did not decode');
    expect(after.sayFirst).toEqual(buildSayFirst(decoded.alert, stringsHi, 0));
    expect(after.sayFirst).not.toEqual(before.sayFirst);

    s.ctl.setStrings(stringsEn);
    expect(s.ctl.state.sayFirst).toEqual(before.sayFirst);
  });

  /** Requirements 6.2, 6.4 */
  it('setStrings keeps the repeat state and the sound state and leaves the sound bytes unchanged', async () => {
    const s = setupBroadcast();
    s.ctl.setField('repeat', true);
    await s.ctl.goOnAir();
    const before = s.ctl.state;
    expect(before.phase).toBe('repeating');
    expect(before.repeat).not.toBeNull();
    const plays = s.player.plays.length;
    const builds = s.link.bytesToAudioCalls;
    const bytes = Uint8Array.from(s.link.lastBytes!);
    const samples = s.player.plays[0]!.samples;
    const stops = s.player.stopCalls;

    s.ctl.setStrings(stringsHi);

    const after = s.ctl.state;
    expect(after.phase).toBe('repeating');
    expect(after.form).toEqual(before.form);
    expect(after.repeat).toEqual(before.repeat);
    expect(after.controls).toEqual(before.controls);
    expect(s.player.plays).toHaveLength(plays);
    expect(s.player.stopCalls).toBe(stops);
    expect(s.link.bytesToAudioCalls).toBe(builds);
    expect(Array.from(s.link.lastBytes!)).toEqual(Array.from(bytes));
    expect(s.player.plays[0]!.samples).toBe(samples);
    const decoded = decodeMessage(s.link.lastBytes!);
    if (!decoded.ok) throw new Error('fixture bytes did not decode');
    expect(after.sayFirst).toEqual(buildSayFirst(decoded.alert, stringsHi, 0));
    s.ctl.stop();
    s.ctl.dispose();
  });

  /** Requirement 5.10 */
  it('setStrings re-labels a stored banner message in the new language', () => {
    const s = setupBroadcast('engine-error');
    const before = s.ctl.state;
    expect(before.banner).toEqual({
      key: 'err.audio',
      params: { reason: stringsEn.labels.audioReason['engine-error'] },
    });

    s.ctl.setStrings(stringsHi);
    expect(s.ctl.state.banner).toEqual({
      key: 'err.audio',
      params: { reason: stringsHi.labels.audioReason['engine-error'] },
    });
    expect(s.ctl.state.form).toEqual(before.form);

    s.ctl.setStrings(stringsEn);
    expect(s.ctl.state.banner).toEqual(before.banner);
  });

  /** Requirement 5.10 */
  it('setStrings leaves messages without a label unchanged', () => {
    const s = setupBroadcast();
    s.ctl.setField('repeat', true);
    s.ctl.setField('validFor', 'm15');
    const notices = s.ctl.state.notices;
    s.ctl.setStrings(stringsHi);
    expect(s.ctl.state.notices).toEqual(notices);
    expect(s.ctl.state.banner).toBeNull();
  });
});
