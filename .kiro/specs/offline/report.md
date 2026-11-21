# Offline: report of real-device checks

No real-device run has happened. Every check below is "not run on a real device". No check is marked "pass". Automated tests cover only part of each check, and they are named in each entry.

Each check has the same lines: Result, Date, Device, Browser, Reason/Notes. Result is exactly one of "pass", "fail" or "not run on a real device".

## Check 1: First visit saves both pages
Result: not run on a real device
Date: 2026-11-21
Device: none
Browser: none
Reason/Notes: No phone was available for a real run. A real service worker and its cache cannot run in Vitest. Partly covered by tests/offline/install-atomic.property.test.ts (install saves every file or none), tests/offline/file-list-complete.property.test.ts (the file list holds every file the pages need) and tests/offline/site-build.test.ts (the built site and its worker for both BASE_PATH values).

## Check 2: Airplane-mode start of Listen
Result: not run on a real device
Date: 2026-11-21
Device: none
Browser: none
Reason/Notes: No phone was available for a real run. Airplane mode cannot be set in Vitest. Partly covered by tests/offline/route.property.test.ts (each address variant of /listen is answered from the saved copy) and tests/offline/fetch-handling.property.test.ts.

## Check 3: Airplane-mode start of Broadcast
Result: not run on a real device
Date: 2026-11-21
Device: none
Browser: none
Reason/Notes: No phone was available for a real run. Airplane mode cannot be set in Vitest. Partly covered by tests/offline/route.property.test.ts (each address variant of /broadcast is answered from the saved copy) and tests/offline/fetch-handling.property.test.ts.

## Check 4: Home Screen start opens Listen
Result: not run on a real device
Date: 2026-11-21
Device: none
Browser: none
Reason/Notes: No phone was available for a real run. Adding to the Home Screen and starting from the icon cannot be done in Vitest. Partly covered by tests/offline/manifest.test.ts (start URL of the manifest points to Listen) and tests/offline/icons.test.ts (the icon files exist at the declared sizes).

## Check 5: Update to a new version with History kept
Result: not run on a real device
Date: 2026-11-21
Device: none
Browser: none
Reason/Notes: No phone was available for a real run. A real update of an installed worker cannot be done in Vitest. Partly covered by tests/offline/version-change.property.test.ts, tests/offline/version-order.property.test.ts, tests/offline/install-reload.property.test.ts and tests/offline/caches.property.test.ts (old caches are removed, other storage is left alone).

## Check 6: A sub-path build
Result: not run on a real device
Date: 2026-11-21
Device: none
Browser: none
Reason/Notes: No phone and no sub-path host (for example https://user.github.io/repo/) were used. Partly covered by tests/offline/site-build.test.ts (builds once with an empty BASE_PATH and once with BASE_PATH=dead-air, and checks paths and worker scope) and tests/offline/base.property.test.ts.

## Check 7: The Front_Page opens with no connection without its large images
Result: not run on a real device
Date: 2026-11-21
Device: none
Browser: none
Reason/Notes: No phone was available for a real run. Partly covered by tests/offline/front-image.property.test.ts (front page images are left out of the saved copy), tests/offline/check-front.property.test.ts and tests/offline/size.property.test.ts.

## Check 8: The storage persistence request after the first press and the Storage_Note
Result: not run on a real device
Date: 2026-11-21
Device: none
Browser: none
Reason/Notes: No phone was available for a real run. Real persist() answers differ by browser and cannot be produced in Vitest. Partly covered by tests/offline/persist.property.test.ts (the request is made once, after the first press, and never awaited in the click path) and tests/offline/storage-note.property.test.ts (the Storage_Note text for each answer).

## LOADER_CALL_LIST

Copied from src/offline/allow-list.ts. There are 7 entries. Each entry has file, call, occurrence (where the source gives one) and reason.

### Loader call 1
File: sw.js
Call: fetch(url, init)
Occurrence: none
Reason: Service worker install: fetches the app's own files from its own origin to save them.

### Loader call 2
File: sw.js
Call: fetch(request)
Occurrence: none
Reason: Service worker pass-through of an own-origin request when it is not served from the saved copy.

### Loader call 3
File: assets/persist-*.js
Call: XMLHttpRequest
Occurrence: 1
Reason: Emscripten loader path in ggwave for reading a wasm file by URL. ggwave embeds its wasm as a data: URI, so this path never runs.

### Loader call 4
File: assets/persist-*.js
Call: XMLHttpRequest
Occurrence: 2
Reason: Emscripten loader path in ggwave for reading a wasm file by URL. ggwave embeds its wasm as a data: URI, so this path never runs.

### Loader call 5
File: assets/persist-*.js
Call: XMLHttpRequest
Occurrence: 3
Reason: Emscripten loader path in ggwave for reading a wasm file by URL. ggwave embeds its wasm as a data: URI, so this path never runs.

### Loader call 6
File: assets/persist-*.js
Call: fetch(<identifier>,{credentials:`same-origin`})
Occurrence: 1
Reason: Emscripten loader path in ggwave for fetching a wasm file by URL. ggwave embeds its wasm as a data: URI, so this path never runs.

### Loader call 7
File: assets/persist-*.js
Call: fetch(<identifier>,{credentials:`same-origin`})
Occurrence: 2
Reason: Emscripten loader path in ggwave for fetching a wasm file by URL. ggwave embeds its wasm as a data: URI, so this path never runs.

## ALLOWED_URLS

Copied from src/offline/allow-list.ts. ALLOWED_URLS is currently empty: there are 0 entries. No non-request URL string has been accepted.
