// Listen controller: start, receive, end. Pure logic over injected providers.
// No browser API. Visibility, Hidden_Resume and the wake-lock re-request use `intent`.
import type { Strings } from '../broadcast/strings.types';
import type { WakeLockHandle, WakeLockProvider } from '../broadcast/providers';
import type { Listener, SoundLink } from '../sound-link';
import { buildSpokenText } from '../languages/spoken-text';
import { checkExpiry } from '../message-code/index';
import type { ExpiryStatus } from '../message-code/index';
import { alertKey } from './history';
import { parseHistory, serializeHistory } from './history-store';
import { INITIAL_LEVEL_STATE, bandLevel } from './level';
import type { LevelState } from './level';
import { applyPayload, clearHistory, endSession as endModelSession, initialModel, startSession } from './model';
import type { ListenModel } from './model';
import type {
  AudioHandle,
  AudioInput,
  IntervalTimers,
  ListenClock,
  MicFailure,
  PageVisibility,
  SoundLinkLoader,
  StorageProvider,
} from './providers';
import { buildListenUi } from './ui-state';
import type { ListenUi, Notice, Phase } from './ui-state';

export interface ListenDeps {
  clock: ListenClock;
  timers: IntervalTimers;
  audio: AudioInput;
  loadLink: SoundLinkLoader;
  storage: StorageProvider;
  wake: WakeLockProvider;
  visibility: PageVisibility;
  strings: Strings;
  /** Called once for each alert that is new to the History while a Session runs. */
  onNewAlert?: (e: { expiry: ExpiryStatus }) => void;
  /** The level measurement. Defaults to bandLevel. A throw leaves the level as it was. */
  levelFn?: (
    state: LevelState,
    samples: Float32Array,
    sampleRate: number,
  ) => { state: LevelState; level: number };
}

export interface ListenController {
  tapStart(): Promise<void>;
  tapStop(): void;
  tapClear(): void;
  visibilityChanged(visible: boolean): Promise<void>;
  /** Called by the 1 s timer and when the page becomes visible. */
  tick(): void;
  snapshot(): ListenUi;
  subscribe(fn: (ui: ListenUi) => void): () => void;
  setStrings(next: Strings): void;
  /** The text to read aloud for a History alert, or null when the key is not in the History. */
  spokenText(alertKey: string): string | null;
}

const MIC_NOTICE: Record<MicFailure, Notice> = {
  refused: 'listen.mic.refused',
  'no-device': 'listen.mic.none',
  unsupported: 'listen.mic.insecure',
  audio: 'listen.mic.audio',
  other: 'listen.mic.failed',
};

export function createListenController(deps: ListenDeps): ListenController {
  let strings = deps.strings;
  let model: ListenModel = initialModel(parseHistory(deps.storage.read()));
  let intent = false; // Listening_Intent. True after a successful start; false on Stop and mic loss.
  let phase: Phase = 'idle';
  let notice: Notice = 'none';
  let historyKept = deps.storage.available;
  let level = 0;
  let levelState: LevelState = INITIAL_LEVEL_STATE;
  let levelRate = 0; // sample rate of the owner handle
  const levelFn = deps.levelFn ?? bandLevel;

  let link: SoundLink | null = null;
  let linkRate = 0;
  let listener: Listener | null = null;
  let handle: AudioHandle | null = null;
  let wakeHandle: WakeLockHandle | null = null;
  let generation = 0; // bumped when a start in progress must be abandoned

  const subscribers = new Set<(ui: ListenUi) => void>();

  function snapshot(): ListenUi {
    return buildListenUi({
      model,
      phase,
      notice,
      historyKept,
      level,
      nowMs: deps.clock.now(),
      offsetMinutes: deps.clock.offsetMinutes(),
      strings,
    });
  }

  function emit(): void {
    if (subscribers.size === 0) return;
    const ui = snapshot();
    for (const fn of [...subscribers]) fn(ui);
  }

  function releaseWake(): void {
    const h = wakeHandle;
    wakeHandle = null;
    if (h) {
      try {
        void h.release().catch(() => undefined);
      } catch {
        // A failed release changes nothing.
      }
    }
  }

  async function requestWake(): Promise<void> {
    if (!deps.wake.supported || wakeHandle) return;
    let h: WakeLockHandle | null = null;
    try {
      h = await deps.wake.request();
    } catch {
      h = null;
    }
    if (!h) return; // Requirement 16.4: nothing changes.
    if (phase !== 'running') {
      try {
        void h.release().catch(() => undefined);
      } catch {
        // ignore
      }
      return;
    }
    wakeHandle = h;
    try {
      h.onRelease(() => {
        if (wakeHandle !== h) return;
        wakeHandle = null;
        // Re-request once the page is visible while running (16.6).
        if (phase === 'running' && deps.visibility.isVisible()) void requestWake();
      });
    } catch {
      // ignore
    }
  }

  /** Closes the microphone and the listener, stops the wake lock, resets the Session. */
  function endSession(): void {
    const hnd = handle;
    const lst = listener;
    handle = null;
    listener = null;
    try {
      hnd?.close();
    } catch {
      // closing twice or a failing close must not block the rest
    }
    try {
      lst?.dispose();
    } catch {
      // ignore
    }
    releaseWake();
    model = endModelSession(model);
    level = 0;
    levelState = INITIAL_LEVEL_STATE;
    phase = 'idle';
  }

  function saveHistory(): void {
    const ok = deps.storage.write(serializeHistory(model.history));
    if (!ok) historyKept = false;
  }

  function makeOnBlock(owner: AudioHandle): (samples: Float32Array) => void {
    return (samples) => {
      if (handle !== owner || phase !== 'running' || !listener) return;
      try {
        const m = levelFn(levelState, samples, levelRate);
        levelState = m.state;
        level = m.level;
      } catch {
        // The level is only a display. It keeps its last value and the decoder is still fed.
      }
      try {
        const r = listener.feed(samples);
        if (r.ok) {
          const before = model.history;
          const keysBefore = new Set(before.map((e) => alertKey(e.alert)));
          for (const payload of r.payloads) {
            model = applyPayload(model, payload, deps.clock.now());
          }
          if (model.history !== before) saveHistory();
          const now = deps.clock.now();
          for (const entry of model.history) {
            if (keysBefore.has(alertKey(entry.alert))) continue;
            deps.onNewAlert?.({ expiry: checkExpiry(entry.alert, now).status });
          }
        }
        // ok:false: the block is discarded.
      } catch {
        // A thrown error in the handler must not stop the Session.
      }
      emit();
    };
  }

  function makeOnLost(owner: AudioHandle): () => void {
    return () => {
      if (handle !== owner) return;
      intent = false;
      endSession();
      notice = 'listen.mic.stopped';
      emit();
    };
  }

  async function ensureLink(sampleRate: number): Promise<SoundLink | null> {
    if (link && linkRate === sampleRate) return link;
    if (link) {
      try {
        link.dispose();
      } catch {
        // ignore
      }
      link = null;
      linkRate = 0;
    }
    const r = await deps.loadLink(sampleRate);
    if (!r.ok) return null;
    link = r.link;
    linkRate = sampleRate;
    return link;
  }

  async function begin(fromTap: boolean): Promise<void> {
    if (phase !== 'idle') return;
    phase = 'starting';
    notice = 'none';
    generation += 1;
    const gen = generation;
    emit();

    // open() first: its AudioContext is created inside the tap.
    let opened: Awaited<ReturnType<AudioInput['open']>>;
    try {
      opened = await deps.audio.open();
    } catch {
      opened = { ok: false, reason: 'other' };
    }
    if (!opened.ok) {
      phase = 'idle';
      if (fromTap) intent = false;
      notice = fromTap ? MIC_NOTICE[opened.reason] : 'listen.hidden-stop';
      emit();
      return;
    }
    const hnd = opened.handle;

    if (gen !== generation) {
      hnd.close();
      phase = 'idle';
      emit();
      return;
    }

    let lst: Listener | null = null;
    try {
      const l = await ensureLink(hnd.sampleRate);
      if (l) {
        const c = l.createListener();
        if (c.ok) lst = c.listener;
      }
    } catch {
      lst = null;
    }

    if (gen !== generation) {
      hnd.close();
      lst?.dispose();
      phase = 'idle';
      emit();
      return;
    }
    if (!lst) {
      hnd.close();
      phase = 'idle';
      if (fromTap) intent = false;
      notice = fromTap ? 'engine.failed' : 'listen.hidden-stop';
      emit();
      return;
    }
    if (!deps.visibility.isVisible()) {
      // The page was hidden while the start finished: close everything, keep the wish to listen.
      hnd.close();
      try {
        lst.dispose();
      } catch {
        // ignore
      }
      phase = 'idle';
      intent = true;
      emit();
      return;
    }

    handle = hnd;
    levelRate = hnd.sampleRate;
    listener = lst;
    hnd.start(makeOnBlock(hnd), makeOnLost(hnd));
    model = startSession(model, deps.clock.now());
    phase = 'running';
    intent = true;
    emit();
    void requestWake();
  }

  return {
    async tapStart() {
      if (phase !== 'idle') return;
      // Clear the Hidden_Stop_Notice on a tap; begin() clears any other notice.
      await begin(true);
    },

    tapStop() {
      intent = false;
      if (phase === 'starting') {
        generation += 1; // abandon the start in progress
        emit();
        return;
      }
      if (phase === 'running') endSession();
      emit();
    },

    tapClear() {
      model = clearHistory(model);
      if (!deps.storage.remove()) historyKept = false;
      emit();
    },

    async visibilityChanged(visible: boolean) {
      if (phase === 'starting') return; // 17.x: ignored while a start is in progress
      if (!visible) {
        if (phase === 'running') {
          endSession(); // intent is kept
          emit();
        }
        return;
      }
      if (phase === 'idle' && intent) {
        await begin(false); // Hidden_Resume
        return;
      }
      if (phase === 'running' && !wakeHandle) void requestWake();
    },

    tick() {
      emit();
    },

    snapshot,

    setStrings(next) {
      strings = next;
      emit();
    },

    spokenText(key) {
      const entry = model.history.find((e) => alertKey(e.alert) === key);
      return entry ? buildSpokenText(entry.alert, deps.clock.now(), strings) : null;
    },

    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
}
