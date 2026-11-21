// Wires the Broadcast page: loads the sound link once, builds the controller with the real
// platform pieces, draws its state and binds the DOM events to its actions.
// No network request, no microphone, no logging of samples or positions. The service worker is in src/offline.
// The AudioContext is made only inside the Go on air tap (controller.goOnAir calls audio.unlock
// as its first step), so the click handler calls goOnAir directly with no await before it.
import { loadSoundLink } from '../../sound-link/index';
import { createBroadcastController } from '../controller';
import type { Controller } from '../controller';
import { createDownloader } from '../download';
import type { LinkLike } from '../build';
import type { RawForm } from '../form';
import type { Strings } from '../strings.types';
import { applyDocumentLanguage, createWebLanguageState } from '../../languages/dom/web-language';
import { mountLanguageSwitch } from '../../languages/dom/language-switch';
import { OFFLINE_IDS } from '../../offline/dom/ids';
import { ELEMENT_IDS } from './ids';
import { createRenderer } from './render';
import { createWebAudioHost } from './web-audio';
import { webDownloadPlatform } from './web-download';
import { createGeolocationProvider } from './web-location';
import { getWebStorage, isSecureContext, offsetMinutes, webClock, webTimers } from './web-platform';
import { createWakeLockProvider } from './web-wake-lock';
import { createPersistence } from '../../offline/dom/persist';

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`Missing element id: ${id}`);
  return el as T;
}

/** Starts the page. Returns a function that removes every listener and disposes the controller. */
export function mount(): () => void {
  const languageState = createWebLanguageState();
  applyDocumentLanguage(document, languageState.current());
  let strings: Strings = languageState.current().strings;

  // Browsers may restore form state after a reload. TEST on and repeat off are the start values.
  const testBox = byId<HTMLInputElement>(ELEMENT_IDS.test);
  const repeatBox = byId<HTMLInputElement>(ELEMENT_IDS.repeat);
  testBox.checked = true;
  repeatBox.checked = false;

  // The one and only load of the sound link on this page.
  const link: Promise<LinkLike | null> = loadSoundLink().then(
    (r) => (r.ok ? r.link : null),
    () => null,
  );

  const controller: Controller = createBroadcastController({
    clock: webClock,
    timers: webTimers,
    storage: getWebStorage(),
    audio: createWebAudioHost(),
    geolocation: createGeolocationProvider(),
    wakeLock: createWakeLockProvider(),
    downloader: createDownloader(webDownloadPlatform),
    strings,
    offsetMinutes,
    secureContext: isSecureContext(),
    link,
  });

  const renderer = createRenderer(document, strings);
  const unsubscribe = controller.subscribe((s) => renderer.render(s));
  renderer.render(controller.getState());

  // One subscriber for a language change. It is added before the switch, so the switch label
  // is read after `strings` has been replaced.
  const unsubscribeLanguage = languageState.subscribe((entry) => {
    strings = entry.strings;
    applyDocumentLanguage(document, entry);
    controller.setStrings(strings);
    renderer.setStrings(strings);
    renderer.render(controller.getState());
    const note = document.getElementById(OFFLINE_IDS.storageNote);
    if (note && !note.hidden) note.textContent = strings.text['offline.storageNote'];
  });
  const switchHost = byId<HTMLElement>(ELEMENT_IDS.languageSwitch);
  const disposeSwitch = mountLanguageSwitch(switchHost, languageState, () => strings.text['lang.switch.label']);

  const banner = byId<HTMLElement>(ELEMENT_IDS.banner);
  const removers: Array<() => void> = [];

  function on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    fn: (ev: HTMLElementEventMap[K]) => void,
  ): void {
    target.addEventListener(type, fn as EventListener);
    removers.push(() => target.removeEventListener(type, fn as EventListener));
  }

  /** Shows err.unexpected and returns the page to idle. Never throws. */
  function fail(): void {
    try {
      controller.stop();
    } catch {
      // nothing more to do
    }
    try {
      banner.textContent = strings.text['err.unexpected'];
      banner.removeAttribute('data-sig');
    } catch {
      // nothing more to do
    }
  }

  /** Runs one handler. The action is called synchronously inside this call. */
  function guard(action: () => void | Promise<void>): void {
    try {
      const result = action();
      if (result !== undefined && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(fail);
      }
    } catch {
      fail();
    }
    try {
      // Make the boxes follow the controller even when it published nothing.
      renderer.render(controller.getState());
    } catch {
      // nothing more to do
    }
  }

  // Text and select fields.
  const fields: Array<[string, keyof RawForm]> = [
    [ELEMENT_IDS.event, 'event'],
    [ELEMENT_IDS.urgency, 'urgency'],
    [ELEMENT_IDS.severity, 'severity'],
    [ELEMENT_IDS.action, 'action'],
    [ELEMENT_IDS.place, 'placeName'],
    [ELEMENT_IDS.lat, 'latitude'],
    [ELEMENT_IDS.lon, 'longitude'],
    [ELEMENT_IDS.valid, 'validFor'],
    [ELEMENT_IDS.station, 'stationId'],
  ];
  for (const [id, key] of fields) {
    const input = byId<HTMLInputElement | HTMLSelectElement>(id);
    const handler = (): void =>
      guard(() => {
        const value = input.value;
        if (controller.getState().form[key] === value) return;
        controller.setField(key, value as never);
      });
    on(input, 'input', handler);
    on(input, 'change', handler);
  }

  // TEST switch. The box follows the controller: turning TEST off only takes effect after confirm.
  on(testBox, 'change', () => guard(() => controller.requestTest(testBox.checked)));
  on(repeatBox, 'change', () => guard(() => controller.setRepeat(repeatBox.checked)));

  // TEST dialog. Esc fires "cancel" and counts as cancel.
  const dialog = byId<HTMLDialogElement>(ELEMENT_IDS.dialog);
  on(byId<HTMLButtonElement>(ELEMENT_IDS.dialogConfirm), 'click', () => guard(() => controller.confirmReal()));
  on(byId<HTMLButtonElement>(ELEMENT_IDS.dialogCancel), 'click', () => guard(() => controller.cancelReal()));
  on(dialog, 'cancel', () => guard(() => controller.cancelReal()));
  on(dialog, 'close', () => guard(() => controller.cancelReal()));

  // Buttons. goOnAir is called straight from the click, so the audio unlock runs inside the tap.
  on(byId<HTMLButtonElement>(ELEMENT_IDS.go), 'click', () => guard(() => controller.goOnAir()));
  const stringsView: Strings = {
    get text() {
      return strings.text;
    },
    get labels() {
      return strings.labels;
    },
  };
  const persistence = createPersistence(document, stringsView);
  on(byId<HTMLButtonElement>(ELEMENT_IDS.go), 'click', () => persistence.firstPress());
  on(byId<HTMLButtonElement>(ELEMENT_IDS.stop), 'click', () => guard(() => controller.stop()));
  on(byId<HTMLButtonElement>(ELEMENT_IDS.save), 'click', () => guard(() => controller.save()));
  on(byId<HTMLButtonElement>(ELEMENT_IDS.location), 'click', () => guard(() => controller.useLocation()));
  on(byId<HTMLFormElement>(ELEMENT_IDS.form), 'submit', (ev) => ev.preventDefault());

  // Visibility and page exit.
  const onVisibility = (): void =>
    guard(() => controller.visibilityChanged(document.visibilityState !== 'hidden'));
  document.addEventListener('visibilitychange', onVisibility);
  removers.push(() => document.removeEventListener('visibilitychange', onVisibility));

  let done = false;
  const teardown = (): void => {
    if (done) return;
    done = true;
    for (const r of removers) r();
    removers.length = 0;
    window.removeEventListener('pagehide', teardown);
    unsubscribe();
    unsubscribeLanguage();
    disposeSwitch();
    controller.dispose();
  };
  window.addEventListener('pagehide', teardown);
  return teardown;
}
