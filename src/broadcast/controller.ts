// The Broadcast page controller. Holds all page state and has one method per user action.
// Everything outside it is injected (clock, timers, storage, audio, location, wake lock,
// downloader, strings, sound link). No DOM types and no browser API, so it runs in Node.
//
// Order of decisions in a Go on air tap (promises 1 and 2 never bend):
//   unlock audio (inside the tap) -> read clock once -> peek counter -> Build + Self_Check
//   -> await unlock -> commit counter -> show preview -> play twice.
import { checkExpiry, decodeMessage, encodeAlert } from '../message-code/index';
import type { Alert } from '../message-code/index';
import { audioToWav } from '../sound-link/index';
import { labelFor } from '../shared/labels';
import { formatUtc } from '../shared/time';
import { composeBroadcastAudio } from './compose';
import { runBuild, sentMinuteFrom, toAlert } from './build';
import type { Build, BuildFailure, LinkLike } from './build';
import { runBroadcast } from './broadcast-run';
import type { BroadcastRun } from './broadcast-run';
import { wavFileName } from './file-name';
import { initialForm, parseStationId, validateForm } from './form';
import type { FieldError, FormCheck, RawForm } from './form';
import { requestLocation } from './location';
import { bytesLeft } from './place-name';
import { buildPreview } from './preview';
import type { PreviewModel } from './preview';
import type {
  AudioHost,
  Clock,
  Downloader,
  GeolocationProvider,
  Timers,
  WakeLockHandle,
  WakeLockProvider,
} from './providers';
import { createRepeater } from './repeater';
import type { Repeater } from './repeater';
import { buildSayFirst } from './say-first';
import type { SayFirst } from './say-first';
import { formSnapshot } from './snapshot';
import { createStationStore } from './station-store';
import type { KeyValueStorage } from './station-store';
import type { Msg, Strings } from './strings.types';
import { deriveControls } from './ui-state';
import type { Controls, LocationAvailability, Phase } from './ui-state';

export type { Phase } from './ui-state';

/** Wait after the last form change before the draft Self_Check runs. */
export const DRAFT_DELAY_MS = 150;
/** The preview status is recomputed this often. */
export const PREVIEW_TICK_MS = 1000;

export type WakeState = 'on' | 'off' | 'unsupported' | 'refused';
export type DraftCheck = 'none' | 'pending' | 'passed' | 'failed';

export interface ViewState {
  phase: Phase;
  form: RawForm;
  errors: FieldError[];
  bytesLeft: { kind: 'number'; left: number } | { kind: 'error'; code: 'too-long' | 'bad-char' };
  controls: Controls;
  dialogOpen: boolean;
  /** The text of the TEST dialog while it is open. */
  dialogMessage: Msg | null;
  /** Shown next to Go on air while TEST is off. */
  realNotice: Msg | null;
  preview: PreviewModel | null;
  /** State of the draft Self_Check. A preview with draft true and 'pending' reads "sound check pending". */
  draftCheck: DraftCheck;
  sayFirst: SayFirst | null;
  sayFirstError: boolean;
  /** Status line, in order. */
  notices: Msg[];
  /** Build failure, clock or audio problem. */
  banner: Msg | null;
  /** The reason or field behind a failed sound check. */
  bannerDetail: Msg | null;
  repeat: {
    round: number;
    secondsToNext: number | null;
    sentUtc: string;
    wake: WakeState;
  } | null;
  location: { available: boolean; whyNot: Msg | null; message: Msg | null };
  stationIdRemembered: boolean;
}

export interface ControllerDeps {
  clock: Clock;
  timers: Timers;
  storage: KeyValueStorage | null;
  audio: AudioHost;
  geolocation: GeolocationProvider;
  wakeLock: WakeLockProvider;
  downloader: Downloader;
  strings: Strings;
  offsetMinutes(ms: number): number;
  /**
   * The sound link, loaded once by the caller. A promise or undefined means still loading,
   * null means the load failed. Alternatively call engineLoaded() later.
   */
  link?: LinkLike | null | Promise<LinkLike | null>;
  /** False when the page is not in a secure context. Location is then off. Default true. */
  secureContext?: boolean;
}

export interface ControllerActions {
  setField<K extends keyof RawForm>(key: K, value: RawForm[K]): void;
  toggleTest(on: boolean): void;
  confirmDialog(): void;
  cancelDialog(): void;
  goOnAir(): Promise<void>;
  stop(): void;
  save(): Promise<void>;
  useLocation(): Promise<void>;
  setRepeat(on: boolean): void;
  visibilityChanged(visible: boolean): void;
  dispose(): void;
}

export interface Controller extends ControllerActions {
  readonly state: ViewState;
  getState(): ViewState;
  subscribe(listener: (s: ViewState) => void): () => void;
  engineLoaded(link: LinkLike | null): void;
  /** Same as toggleTest. Names as in the design. */
  requestTest(on: boolean): void;
  confirmReal(): void;
  cancelReal(): void;
  readonly actions: ControllerActions;
}

interface LastBuild {
  build: Build;
  snapshot: string;
}

export function createBroadcastController(deps: ControllerDeps): Controller {
  const { clock, timers, audio, geolocation, wakeLock, downloader, strings } = deps;
  const store = createStationStore(deps.storage);

  // ---- state ----
  let phase: Phase = 'loading';
  let link: LinkLike | null = null;
  let raw: RawForm = initialForm();
  let check: FormCheck = validateForm(raw);
  let left = bytesLeft(raw.placeName);
  let dialogOpen = false;
  let previewAlert: Alert | null = null;
  let previewDraft = true;
  let preview: PreviewModel | null = null;
  let draftCheck: DraftCheck = 'none';
  let sayFirst: SayFirst | null = null;
  let banner: Msg | null = null;
  let bannerDetail: Msg | null = null;
  let flowNotices: Msg[] = [];
  let repeatState: ViewState['repeat'] = null;
  let locationMessage: Msg | null = null;
  let lastBuild: LastBuild | null = null;
  let disposed = false;

  const listeners = new Set<(s: ViewState) => void>();

  // draft
  let generation = 0;
  let draftTimer: unknown = null;
  let draftTimerArmed = false;
  let draftRunning = false;

  // preview tick
  let tickTimer: unknown = null;
  let tickArmed = false;

  // running sound
  let currentRun: BroadcastRun | null = null;
  let repeater: Repeater | null = null;
  let wakeHandle: WakeLockHandle | null = null;
  let wakeRequesting = false;

  // ---- helpers ----
  const stored = store.readStationId();
  if (stored !== null) {
    raw = { ...raw, stationId: String(stored) };
    check = validateForm(raw);
  }

  let availability: LocationAvailability;
  try {
    availability = geolocation.availability();
  } catch {
    availability = { ok: false, reason: 'no-api' };
  }
  if (availability.ok && deps.secureContext === false) {
    availability = { ok: false, reason: 'insecure' };
  }

  function clockNow(): number {
    try {
      return clock.now();
    } catch {
      return NaN;
    }
  }

  function offsetAt(ms: number): number {
    try {
      const o = deps.offsetMinutes(ms);
      return Number.isFinite(o) ? o : 0;
    } catch {
      return 0;
    }
  }

  function locked(): boolean {
    return phase === 'building' || phase === 'on-air' || phase === 'repeating';
  }

  function controlsNow(): Controls {
    return deriveControls({
      phase,
      // Go on air and Save also wait for the draft Self_Check to pass.
      formValid: check.ok && draftCheck === 'passed',
      dialogOpen,
      locationAvailability: availability,
    });
  }

  function wakeNotice(w: WakeState): Msg {
    return { key: w === 'on' ? 'wake.on' : w === 'off' ? 'wake.off' : w === 'unsupported' ? 'wake.unsupported' : 'wake.refused' };
  }

  function buildState(): ViewState {
    const controls = controlsNow();
    const notices: Msg[] = [];
    if (phase === 'building') notices.push({ key: 'building' });
    if (phase === 'on-air') notices.push({ key: 'on-air' });
    if (phase === 'repeating') {
      notices.push({ key: 'on-air' });
      notices.push({ key: 'repeat.keep-open' });
      if (repeatState) notices.push(wakeNotice(repeatState.wake));
    }
    for (const n of flowNotices) notices.push(n);
    if (!store.persistent) notices.push({ key: 'storage.unavailable' });
    return {
      phase,
      form: { ...raw },
      errors: check.ok ? [] : check.errors,
      bytesLeft: left.ok ? { kind: 'number', left: left.left } : { kind: 'error', code: left.code },
      controls,
      dialogOpen,
      dialogMessage: dialogOpen ? { key: 'test.dialog' } : null,
      realNotice: raw.test ? null : { key: 'real.notice' },
      preview,
      draftCheck,
      sayFirst,
      sayFirstError: sayFirst !== null && !sayFirst.ok,
      notices,
      banner,
      bannerDetail,
      repeat: repeatState ? { ...repeatState } : null,
      location: {
        available: availability.ok,
        whyNot: controls.locationButton.whyNot ? { key: controls.locationButton.whyNot } : null,
        message: locationMessage,
      },
      stationIdRemembered: store.persistent,
    };
  }

  function publish(): void {
    if (disposed) return;
    const s = buildState();
    for (const fn of [...listeners]) {
      try {
        fn(s);
      } catch {
        // A failing listener must not break the controller.
      }
    }
  }

  function recheck(): void {
    check = validateForm(raw);
    left = bytesLeft(raw.placeName);
  }

  function setBanner(b: Msg | null, detail: Msg | null = null): void {
    banner = b;
    bannerDetail = detail;
  }

  function describeFailure(f: BuildFailure): { banner: Msg; detail: Msg | null } {
    if (f.kind === 'encode') {
      return {
        banner: { key: 'err.encode', params: { field: labelFor(strings.labels.field, f.field) ?? f.field } },
        detail: null,
      };
    }
    if (f.kind === 'audio') {
      return {
        banner: { key: 'err.audio', params: { reason: labelFor(strings.labels.audioReason, f.reason) ?? f.reason } },
        detail: null,
      };
    }
    if (f.why === 'decode-rejected') {
      return {
        banner: { key: 'check.failed' },
        detail: {
          key: 'check.failed.reason',
          params: { reason: labelFor(strings.labels.decodeReason, f.reason) ?? f.reason },
        },
      };
    }
    if (f.why === 'field-differs') {
      return {
        banner: { key: 'check.failed' },
        detail: {
          key: 'check.failed.field',
          params: { field: labelFor(strings.labels.field, f.field) ?? f.field },
        },
      };
    }
    return { banner: { key: 'check.failed' }, detail: null };
  }

  function showFailure(f: BuildFailure): void {
    const d = describeFailure(f);
    setBanner(d.banner, d.detail);
  }

  // ---- preview and tick ----
  function setPreviewFrom(alert: Alert | null, draft: boolean): void {
    previewAlert = alert;
    previewDraft = draft;
    if (alert === null) {
      preview = null;
    } else {
      const now = clockNow();
      preview = buildPreview(alert, now, offsetAt(now), draft);
      ensureTick();
    }
  }

  function setSayFirst(alert: Alert | null): void {
    if (alert === null) {
      sayFirst = null;
      return;
    }
    sayFirst = buildSayFirst(alert, strings, offsetAt(alert.sentMinute * 60000));
  }

  function ensureTick(): void {
    if (disposed || tickArmed || previewAlert === null) return;
    tickArmed = true;
    tickTimer = timers.setTimeout(() => {
      tickArmed = false;
      if (disposed || previewAlert === null) return;
      const before = preview ? preview.status : null;
      const now = clockNow();
      preview = buildPreview(previewAlert, now, offsetAt(now), previewDraft);
      if (preview.status !== before) publish();
      ensureTick();
    }, PREVIEW_TICK_MS);
  }

  function stopTick(): void {
    if (!tickArmed) return;
    tickArmed = false;
    try {
      timers.clearTimeout(tickTimer);
    } catch {
      // nothing to do
    }
  }

  // ---- draft ----
  function clearDraftTimer(): void {
    if (!draftTimerArmed) return;
    draftTimerArmed = false;
    try {
      timers.clearTimeout(draftTimer);
    } catch {
      // nothing to do
    }
  }

  /** Synchronous part: draft preview from encode + decode only, no sound. Never uses the counter. */
  function draftSync(): void {
    generation += 1;
    clearDraftTimer();
    draftCheck = 'none';
    sayFirst = null;
    setBanner(null);
    setPreviewFrom(null, true);
    stopTick();
    if (!check.ok) return;

    const now = clockNow();
    const sentMinute = sentMinuteFrom(now);
    if (sentMinute === null) {
      setBanner({ key: 'clock.bad' });
      return;
    }
    const alert = toAlert(check.model, sentMinute, store.peekCounter());
    const enc = encodeAlert(alert);
    if (!enc.ok) {
      setBanner({ key: 'err.encode', params: { field: labelFor(strings.labels.field, enc.field) ?? enc.field } });
      return;
    }
    const dec = decodeMessage(enc.bytes);
    if (!dec.ok) {
      setBanner(
        { key: 'check.failed' },
        { key: 'check.failed.reason', params: { reason: labelFor(strings.labels.decodeReason, dec.reason) ?? dec.reason } },
      );
      return;
    }
    setPreviewFrom(dec.alert, true);
    draftCheck = 'pending';
    armDraft();
  }

  function armDraft(): void {
    if (disposed || link === null || draftCheck !== 'pending') return;
    clearDraftTimer();
    const gen = generation;
    draftTimerArmed = true;
    draftTimer = timers.setTimeout(() => {
      draftTimerArmed = false;
      runDraft(gen);
    }, DRAFT_DELAY_MS);
  }

  function runDraft(gen: number): void {
    if (disposed || gen !== generation || phase !== 'idle' || link === null || !check.ok) return;
    if (draftRunning) return; // at most one listener open at a time
    draftRunning = true;
    try {
      const sentMinute = sentMinuteFrom(clockNow());
      if (sentMinute === null) {
        setBanner({ key: 'clock.bad' });
        draftCheck = 'failed';
        publish();
        return;
      }
      const alert = toAlert(check.model, sentMinute, store.peekCounter());
      const result = runBuild(link, alert, true);
      if (gen !== generation) return; // overlapping draft: discard
      if (result.ok) {
        setPreviewFrom(result.build.decoded, true);
        setSayFirst(result.build.decoded);
        draftCheck = 'passed';
        setBanner(null);
      } else {
        draftCheck = 'failed';
        sayFirst = null;
        setPreviewFrom(null, true);
        stopTick();
        showFailure(result.failure);
      }
      publish();
    } finally {
      draftRunning = false;
    }
  }

  /** Called after any change of the form values. */
  function formChanged(): void {
    flowNotices = [];
    recheck();
    draftSync();
  }

  // ---- wake lock ----
  function setWake(w: WakeState): void {
    if (repeatState) repeatState = { ...repeatState, wake: w };
  }

  async function requestWake(): Promise<void> {
    if (!wakeLock.supported) {
      setWake('unsupported');
      publish();
      return;
    }
    if (wakeRequesting || wakeHandle !== null) return;
    wakeRequesting = true;
    let handle: WakeLockHandle | null = null;
    try {
      handle = await wakeLock.request();
    } catch {
      handle = null;
    }
    wakeRequesting = false;
    if (disposed) {
      releaseHandle(handle);
      return;
    }
    if (phase !== 'repeating') {
      // Repeat ended while the request was pending.
      releaseHandle(handle);
      return;
    }
    if (handle === null) {
      setWake('refused');
    } else {
      wakeHandle = handle;
      setWake('on');
      try {
        handle.onRelease(() => {
          if (wakeHandle !== handle) return;
          wakeHandle = null;
          if (phase === 'repeating') {
            setWake('off');
            publish();
          }
        });
      } catch {
        // The handle still works. A missed release callback is covered by the visible check.
      }
    }
    publish();
  }

  function releaseHandle(h: WakeLockHandle | null): void {
    if (h === null) return;
    try {
      void Promise.resolve(h.release()).catch(() => undefined);
    } catch {
      // nothing to do
    }
  }

  function releaseWake(): void {
    const h = wakeHandle;
    wakeHandle = null;
    releaseHandle(h);
  }

  // ---- repeat end ----
  function endRepeat(reason: 'stopped' | 'expired'): void {
    repeater = null;
    currentRun = null;
    releaseWake();
    repeatState = null;
    phase = 'idle';
    flowNotices = [{ key: reason === 'expired' ? 'repeat.expired' : 'stopped' }];
    publish();
  }

  // ---- actions ----
  function engineLoaded(l: LinkLike | null): void {
    if (disposed || phase !== 'loading') return;
    if (l === null) {
      phase = 'engine-failed';
    } else {
      link = l;
      phase = 'idle';
      armDraft();
    }
    publish();
  }

  function requestTest(on: boolean): void {
    if (disposed || locked() || dialogOpen) return;
    if (on) {
      if (raw.test) return;
      raw = { ...raw, test: true };
      formChanged();
      publish();
    } else if (raw.test) {
      dialogOpen = true;
      publish();
    }
  }

  function confirmReal(): void {
    if (disposed || !dialogOpen) return;
    dialogOpen = false;
    raw = { ...raw, test: false };
    formChanged();
    publish();
  }

  function cancelReal(): void {
    if (disposed || !dialogOpen) return;
    dialogOpen = false;
    publish();
  }

  function setField<K extends keyof RawForm>(key: K, value: RawForm[K]): void {
    if (disposed || locked() || dialogOpen) return;
    if (key === 'test') {
      requestTest(Boolean(value));
      return;
    }
    raw = { ...raw, [key]: value };
    if (key === 'repeat') {
      publish();
      return;
    }
    if (key === 'stationId') {
      const n = parseStationId(raw.stationId);
      if (n !== null) store.writeStationId(n);
    }
    formChanged();
    publish();
  }

  async function goOnAir(): Promise<void> {
    if (disposed || link === null || !check.ok || !controlsNow().goOnAir.enabled) return;
    const activeLink = link;
    const model = check.model;
    const wantRepeat = raw.repeat;

    // The first call in the tap. No await before it.
    let unlockP: Promise<boolean>;
    try {
      unlockP = Promise.resolve(audio.unlock());
    } catch {
      unlockP = Promise.resolve(false);
    }
    const unlocked: Promise<boolean> = unlockP.then(
      (v) => v === true,
      () => false,
    );

    phase = 'building';
    flowNotices = [];
    setBanner(null);
    clearDraftTimer();
    publish();

    const now = clockNow();
    const sentMinute = sentMinuteFrom(now);
    if (sentMinute === null) {
      setBanner({ key: 'clock.bad' });
      phase = 'idle';
      publish();
      return;
    }
    const counter = store.peekCounter();
    const alert = toAlert(model, sentMinute, counter);
    const result = runBuild(activeLink, alert, false);
    if (!result.ok) {
      showFailure(result.failure);
      phase = 'idle';
      publish();
      return;
    }
    const build = result.build;

    const ready = await unlocked;
    if (disposed) return;
    if (!ready) {
      setBanner({ key: 'audio.unavailable' });
      phase = 'idle';
      publish();
      return;
    }

    // Build passed and audio is ready: now the counter is used up.
    store.commitCounter(alert.counter);
    lastBuild = { build, snapshot: formSnapshot(model) };
    generation += 1; // any pending draft is now stale
    clearDraftTimer();
    setPreviewFrom(build.decoded, false);
    setSayFirst(build.decoded);
    draftCheck = 'passed';

    if (!wantRepeat) {
      phase = 'on-air';
      publish();
      const run = runBroadcast(audio.player, timers, build);
      currentRun = run;
      const outcome = await run.done;
      if (disposed || currentRun !== run) return;
      currentRun = null;
      if (outcome.status === 'failed') {
        setBanner({ key: 'audio.unavailable' });
      }
      phase = 'idle';
      publish();
      return;
    }

    startRepeat(build, now);
  }

  function startRepeat(build: Build, now: number): void {
    const expiry = checkExpiry(build.decoded, now);
    phase = 'repeating';
    repeatState = {
      round: 0,
      secondsToNext: null,
      sentUtc: formatUtc(build.decoded.sentMinute * 60000),
      wake: wakeLock.supported ? 'off' : 'unsupported',
    };
    const rep = createRepeater({
      clock,
      timers,
      expiresAtMs: expiry.expiresAtMs,
      events: {
        startRound(round, info) {
          if (disposed) return Promise.resolve();
          if (repeatState) repeatState = { ...repeatState, round };
          flowNotices = info.late
            ? [{ key: 'repeat.missed', params: { skipped: info.skipped } }]
            : [];
          const run = runBroadcast(audio.player, timers, build);
          currentRun = run;
          publish();
          return run.done.then((outcome) => {
            if (currentRun === run) currentRun = null;
            if (outcome.status === 'failed' && !disposed && repeater === rep) {
              rep.stop();
              setBanner({ key: 'audio.unavailable' });
              publish();
            }
          });
        },
        onTick(info) {
          if (disposed || repeater !== rep || !repeatState) return;
          repeatState = { ...repeatState, round: info.round, secondsToNext: info.secondsToNext };
          publish();
        },
        onEnd(reason) {
          if (disposed) return;
          endRepeat(reason);
        },
      },
    });
    repeater = rep;
    publish();
    void requestWake();
    rep.start();
  }

  function stop(): void {
    if (disposed || (phase !== 'on-air' && phase !== 'repeating')) return;
    if (repeater !== null) {
      const r = repeater;
      const run = currentRun;
      if (run) run.stop();
      r.stop(); // calls endRepeat('stopped')
      if (phase === 'repeating') endRepeat('stopped');
      return;
    }
    const run = currentRun;
    currentRun = null;
    if (run) run.stop();
    else {
      try {
        audio.player.stop();
      } catch {
        // nothing to do
      }
    }
    phase = 'idle';
    flowNotices = [{ key: 'stopped' }];
    publish();
  }

  async function save(): Promise<void> {
    if (disposed || link === null || !check.ok || !controlsNow().save.enabled) return;
    const activeLink = link;
    const model = check.model;
    const snapshot = formSnapshot(model);
    flowNotices = [];
    setBanner(null);
    const now = clockNow();

    let build: Build;
    let fresh = false;
    if (
      lastBuild !== null &&
      lastBuild.snapshot === snapshot &&
      Number.isFinite(now) &&
      checkExpiry(lastBuild.build.decoded, now).status === 'current'
    ) {
      build = lastBuild.build;
    } else {
      const sentMinute = sentMinuteFrom(now);
      if (sentMinute === null) {
        setBanner({ key: 'clock.bad' });
        publish();
        return;
      }
      const result = runBuild(activeLink, toAlert(model, sentMinute, store.peekCounter()), false);
      if (!result.ok) {
        showFailure(result.failure);
        publish();
        return;
      }
      build = result.build;
      fresh = true;
    }

    const wav = audioToWav(composeBroadcastAudio(build.samples, build.sampleRate), build.sampleRate);
    if (!wav.ok) {
      setBanner({
        key: 'err.wav',
        params: { reason: labelFor(strings.labels.wavReason, wav.reason) ?? wav.reason },
      });
      publish();
      return;
    }
    const name = wavFileName(build.alert);
    try {
      downloader.save(wav.wav, name);
    } catch {
      setBanner({ key: 'err.unexpected' });
      publish();
      return;
    }
    if (fresh) {
      store.commitCounter(build.alert.counter);
      lastBuild = { build, snapshot };
      generation += 1;
      clearDraftTimer();
      setPreviewFrom(build.decoded, false);
      setSayFirst(build.decoded);
      draftCheck = 'passed';
    }
    flowNotices = [{ key: 'saved', params: { name } }];
    publish();
  }

  async function useLocation(): Promise<void> {
    if (disposed || !controlsNow().locationButton.enabled) return;
    const result = await requestLocation(geolocation);
    if (disposed) return;
    if (result.ok) {
      if (locked()) return;
      raw = { ...raw, latitude: result.latitude, longitude: result.longitude };
      locationMessage = { key: 'location.found' };
      formChanged();
    } else {
      locationMessage = { key: `location.${result.reason}` as Msg['key'] };
    }
    publish();
  }

  function visibilityChanged(visible: boolean): void {
    if (disposed || repeater === null) return;
    repeater.visibilityChanged(visible);
    if (visible && phase === 'repeating' && wakeHandle === null && wakeLock.supported) {
      void requestWake();
    }
  }

  function dispose(): void {
    if (disposed) return;
    const r = repeater;
    const run = currentRun;
    disposed = true;
    clearDraftTimer();
    stopTick();
    repeater = null;
    currentRun = null;
    try {
      r?.stop();
    } catch {
      // nothing to do
    }
    try {
      run?.stop();
    } catch {
      // nothing to do
    }
    releaseWake();
    listeners.clear();
  }

  // ---- start ----
  draftSync();
  if (deps.link !== undefined) {
    const l = deps.link;
    if (l !== null && typeof (l as Promise<unknown>).then === 'function') {
      (l as Promise<LinkLike | null>).then(
        (v) => engineLoaded(v),
        () => engineLoaded(null),
      );
    } else {
      engineLoaded(l as LinkLike | null);
    }
  }

  const actions: ControllerActions = {
    setField,
    toggleTest: requestTest,
    confirmDialog: confirmReal,
    cancelDialog: cancelReal,
    goOnAir,
    stop,
    save,
    useLocation,
    setRepeat: (on: boolean) => setField('repeat', on),
    visibilityChanged,
    dispose,
  };

  return {
    ...actions,
    get state(): ViewState {
      return buildState();
    },
    getState: buildState,
    subscribe(listener: (s: ViewState) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    engineLoaded,
    requestTest,
    confirmReal,
    cancelReal,
    actions,
  };
}
