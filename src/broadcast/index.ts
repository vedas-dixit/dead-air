// Public entry point of the Broadcast page logic. The DOM glue and tests import from here.
// No browser API.
export { createBroadcastController, DRAFT_DELAY_MS, PREVIEW_TICK_MS } from './controller';
export type {
  Controller,
  ControllerActions,
  ControllerDeps,
  DraftCheck,
  ViewState,
  WakeState,
} from './controller';
export { deriveControls } from './ui-state';
export type { ControlInput, Controls, LocationAvailability, Phase } from './ui-state';
export { initialForm, validateForm, parseStationId } from './form';
export type { FieldError, FormCheck, FormModel, RawForm } from './form';
export { formSnapshot } from './snapshot';
export { runBuild, sentMinuteFrom, toAlert } from './build';
export type { Build, BuildFailure, BuildResult, LinkLike } from './build';
export { buildPreview } from './preview';
export type { PreviewModel } from './preview';
export { buildSayFirst } from './say-first';
export type { SayFirst } from './say-first';
export { composeBroadcastAudio, PLAY_GAP_MS } from './compose';
export { wavFileName } from './file-name';
export { runBroadcast } from './broadcast-run';
export { createRepeater, REPEAT_INTERVAL_MS } from './repeater';
export { requestLocation, LOCATION_TIMEOUT_MS } from './location';
export { createDownloader, REVOKE_AFTER_MS } from './download';
export type { DownloadPlatform } from './download';
export { createStationStore, STATION_ID_KEY, COUNTER_KEY } from './station-store';
export type { KeyValueStorage, StationStore } from './station-store';
export { VALID_FOR, DEFAULT_VALID_FOR } from './valid-for';
export { TEXT_KEYS, PLACEHOLDERS } from './strings.types';
export type { Msg, Strings, TextKey, ValidForKey } from './strings.types';
export type {
  AudioHost,
  Clock,
  Downloader,
  GeolocationProvider,
  LocationFailure,
  Player,
  Position,
  Timers,
  WakeLockHandle,
  WakeLockProvider,
} from './providers';
