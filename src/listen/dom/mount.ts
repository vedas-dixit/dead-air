// Wires the Listen page: builds the controller with the real providers, draws its state
// and binds the DOM events to its actions.
// On load this creates no AudioContext and makes no microphone request. Both happen only
// inside the Start tap (controller.tapStart calls audio.open() as its first step, so the
// click handler calls tapStart directly with no await before it).
// No network request, no service worker, no logging of samples.
import { loadSoundLink } from '../../sound-link/index';
import { stringsEn } from '../../broadcast/strings.en';
import { createListenController } from '../controller';
import type { ListenController } from '../controller';
import type { SoundLinkLoader } from '../providers';
import { ELEMENT_IDS } from './ids';
import { createListenRenderer } from './render';
import { createWebMicrophone } from './web-microphone';
import { webClock, webIntervals, webVisibility } from './web-platform';
import { createStorageProvider } from './web-storage';
import { createWakeLockProvider } from './web-wake-lock';

const TICK_MS = 1000;

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`Missing element id: ${id}`);
  return el as T;
}

/** Starts the page. Returns a function that removes every listener and timer. */
export function mount(): () => void {
  const strings = stringsEn;

  // The loader runs only when a Session starts, at the rate the microphone context reports.
  const loadLink: SoundLinkLoader = (sampleRate) => loadSoundLink({ sampleRate });

  const controller: ListenController = createListenController({
    clock: webClock,
    timers: webIntervals,
    audio: createWebMicrophone(),
    loadLink,
    storage: createStorageProvider(),
    wake: createWakeLockProvider(),
    visibility: webVisibility,
    strings,
  });

  const renderer = createListenRenderer(document, strings);
  const unsubscribe = controller.subscribe((ui) => renderer.render(ui));
  renderer.render(controller.snapshot());

  const removers: Array<() => void> = [];

  function on(target: EventTarget, type: string, fn: () => void): void {
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
  on(byId(ELEMENT_IDS.stop), 'click', () => safe(() => controller.tapStop()));
  on(byId(ELEMENT_IDS.clear), 'click', () => safe(() => controller.tapClear()));

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
  };
  window.addEventListener('pagehide', teardown);
  return teardown;
}
