// Pure API of the offline spec. Modules are added here as they are written.
export { checkBase, joinBase, stripBase, parseUrl, dirOf, resolveRelative, globMatch } from './paths.ts';
export { CACHE_PREFIX, cacheNameFor, markerPathFor, selectCachesToDelete } from './caches.ts';
export { computeSiteVersion } from './version.ts';
export type { VersionEntry } from './version.ts';
export { SIZE_LIMIT_BYTES, summarizeSize } from './size.ts';
export type { SizedFile, SizeSummary } from './size.ts';
export { makeMarkerText, parseMarker, chooseSavedState } from './marker.ts';
export type { MarkerData, SavedInput } from './marker.ts';
export { routeRequest } from './route.ts';
export type { RouteContext, Route } from './route.ts';
export { INITIAL_LINE_STATE, reduceOfflineLine } from './line-state.ts';
export type { OfflineEvent, OfflineLineState } from './line-state.ts';
export { storageNoteVisible, isHomeScreenMode } from './storage-note.ts';
export type { NoteInput } from './storage-note.ts';
export { registrationPlan } from './registration.ts';
export type { RegistrationPlan } from './registration.ts';
export { buildManifest, manifestText } from './manifest.ts';
export type { WebManifest } from './manifest.ts';
export { LOADER_CALL_LIST, ALLOWED_URLS } from './allow-list.ts';
export type { LoaderCall, AllowedUrl } from './allow-list.ts';
export { IMAGE_EXTENSIONS, kindOf, extractRefs } from './refs.ts';
export type { FileKind, Ref } from './refs.ts';
export {
  scanBuild,
  scanHtml,
  scanCss,
  scanJs,
  findCalls,
  isExternalUrl,
  validateCallList,
  validateAllowedUrls,
} from './check.ts';
export type { CheckFile, CheckInput, CheckResult, Finding, FindingKind, JsCall, ScanContext } from './check.ts';
export { planOffline, DEFAULT_PLAN_RULES } from './plan.ts';
export type { PlanInput, PlanResult, PlanRules, OfflineConfig } from './plan.ts';
export { createPersistController } from './persist.ts';
export type { StorageLike, PersistDeps, PersistController } from './persist.ts';
