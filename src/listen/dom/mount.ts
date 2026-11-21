// Wires the Listen page: builds the controller with the real providers, draws its state
// and binds the DOM events to its actions.
// On load this creates no AudioContext and makes no microphone request. Both happen only
// inside the Start tap (controller.tapStart calls audio.open() as its first step, so the
// click handler calls tapStart directly with no await before it).
// No network request, no logging of samples. The service worker is in src/offline.
import { loadSoundLink } from '../../sound-link/index';
import type { Strings } from '../../broadcast/strings.types';
import { createSpeechController } from '../../languages/speech';
import { mountLanguageSwitch } from '../../languages/dom/language-switch';
import { applyDocumentLanguage, createWebLanguageState } from '../../languages/dom/web-language';
import { createWebSpeechHost } from '../../languages/dom/web-speech';
import { createWebArrival } from '../../languages/dom/web-arrival';
import { createWebAlertSettings } from '../../languages/dom/web-alert-settings';
import { OFFLINE_IDS } from '../../offline/dom/ids';
import { createListenController } from '../controller';
import type { ListenController } from '../controller';
import type { SoundLinkLoader } from '../providers';
import { ELEMENT_IDS } from './ids';
import { readButtonKey } from './read-tap';
import { createGrille, prefersReducedMotion } from '../../shared/ui/dom/grille';
import { createListenRenderer } from './render';
import { createWebMicrophone } from './web-microphone';
import { webClock, webIntervals, webVisibility } from './web-platform';
import { createStorageProvider } from './web-storage';
import { createWakeLockProvider } from './web-wake-lock';
import { createPersistence } from '../../offline/dom/persist';

const TICK_MS = 1000;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`Missing element id: ${id}`);
  return el as T;
}

/** Starts the page. Returns a function that removes every listener and timer. */
export function mount(): () => void {
  const state = createWebLanguageState();
  applyDocumentLanguage(document, state.current());
  let strings: Strings = state.current().strings;

  // The loader runs only when a Session starts, at the rate the microphone context reports.
  const loadLink: SoundLinkLoader = (sampleRate) => loadSoundLink({ sampleRate });

  const alertSettings = createWebAlertSettings();
  const arrival = createWebArrival(() => alertSettings.get());

  const controller: ListenController = createListenController({
    clock: webClock,
    timers: webIntervals,
    audio: createWebMicrophone(),
    loadLink,
    storage: createStorageProvider(),
    wake: createWakeLockProvider(),
    visibility: webVisibility,
    strings,
    onNewAlert: ({ expiry }) => arrival.signal(expiry),
  });

  const grille = createGrille(document, byId(ELEMENT_IDS.levelMeter), {
    now: () => performance.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    reducedMotion: () => prefersReducedMotion(window),
  });
  const renderer = createListenRenderer(document, strings, { level: grille });
  const unsubscribe = controller.subscribe((ui) => renderer.render(ui));
  renderer.render(controller.snapshot());

  const speech = createSpeechController({
    host: createWebSpeechHost(),
    language: () => state.current(),
    buildText: (key) => controller.spokenText(key),
  });
  const unsubscribeSpeech = speech.subscribe((ui) => renderer.renderSpeech(ui));
  renderer.renderSpeech(speech.snapshot());

  const switchLabel = (): string => strings.text['lang.switch.label'];
  const unmountSwitch = mountLanguageSwitch(byId(ELEMENT_IDS.languageSwitch), state, switchLabel);

  const unsubscribeLanguage = state.subscribe((entry) => {
    applyDocumentLanguage(document, entry);
    strings = entry.strings;
    controller.setStrings(strings);
    renderer.setStrings(strings);
    speech.languageChanged();
    renderer.render(controller.snapshot());
    const note = document.getElementById(OFFLINE_IDS.storageNote);
    if (note !== null && !note.hidden) note.textContent = strings.text['offline.storageNote'];
  });

  const removers: Array<() => void> = [];

  function on(target: EventTarget, type: string, fn: (ev: Event) => void): void {
    target.addEventListener(type, fn);
    removers.push(() => target.removeEventListener(type, fn));
  }

  function safe(action: () => void | Promise<void>): void {
    try {
      const result = action();
      if (result !== undefined) result.catch(() => undefined);
    } catch {
      // The controller reports its own failures through the error line.
    }
  }

  on(byId(ELEMENT_IDS.start), 'click', () => safe(() => controller.tapStart()));
  // Reads the current language each time, so the note is worded in the Chosen_Language.
  const stringsView: Strings = {
    get labels() {
      return state.current().strings.labels;
    },
    get text() {
      return state.current().strings.text;
    },
  };
  const persistence = createPersistence(document, stringsView);
  on(byId(ELEMENT_IDS.start), 'click', () => persistence.firstPress());
  on(byId(ELEMENT_IDS.stop), 'click', () => safe(() => controller.tapStop()));
  on(byId(ELEMENT_IDS.clear), 'click', () => safe(() => controller.tapClear()));

  // Alert settings switches.
  renderer.flashSwitch.checked = alertSettings.get().flash;
  renderer.vibrateSwitch.checked = alertSettings.get().vibrate;
  const saveSettings = (): void => {
    alertSettings.set({ flash: renderer.flashSwitch.checked, vibrate: renderer.vibrateSwitch.checked });
  };
  on(renderer.flashSwitch, 'change', saveSettings);
  on(renderer.vibrateSwitch, 'change', saveSettings);

  // Read aloud: one delegated listener for every card.
  on(byId(ELEMENT_IDS.cards), 'click', (ev) => {
    const key = readButtonKey(ev.target);
    if (key) safe(() => speech.tap(key));
  });

  on(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') safe(() => speech.stop());
  });
  on(window, 'pagehide', () => safe(() => speech.stop()));

  on(document, 'visibilitychange', () =>
    safe(async () => {
      await controller.visibilityChanged(document.visibilityState === 'visible');
      controller.tick();
    }),
  );

  const timer = webIntervals.setInterval(() => safe(() => controller.tick()), TICK_MS);

  let done = false;
  const teardown = (): void => {
    if (done) return;
    done = true;
    webIntervals.clearInterval(timer);
    for (const r of removers) r();
    removers.length = 0;
    window.removeEventListener('pagehide', teardown);
    unsubscribe();
    unsubscribeLanguage();
    unsubscribeSpeech();
    unmountSwitch();
    speech.dispose();
    arrival.dispose();
    grille.dispose();
  };
  window.addEventListener('pagehide', teardown);
  return teardown;
}
