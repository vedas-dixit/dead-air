# Requirements Document

## Introduction

This is spec 6 of 10. It makes Dead Air work with no network after the first visit. A service worker saves every file the Listen_Page and the Broadcast_Page need, then serves them from that saved copy. The service worker is registered on all three pages, so one visit to any of them saves both app pages. The Front_Page HTML and its small own CSS and JavaScript are saved too, so the Front_Page opens with no connection (without its large images). A web app manifest lets "Add to Home Screen" open the Listen_Page. The Home Screen icons are placeholders, to be replaced in the look spec (spec 8). A small line on each app page says whether the app is saved. A build check fails the build if an app page asks for anything from another site.

Facts taken from the existing code that these requirements rely on:
- The site has three real static pages: `index.html` (front page), `listen/index.html` and `broadcast/index.html`. The Vite config builds all three with `base` set from `BASE_PATH` through `resolveBase` in `build/base-path.ts`. The deploy workflow builds with an empty `BASE_PATH`, so the site is at the root of `deadair.vedasdixit.com`.
- The Listen_Page keeps its History in `localStorage` under `HISTORY_STORAGE_KEY` (`src/listen/history-store.ts`). The Broadcast_Page keeps its station data in `localStorage` through `src/broadcast/station-store.ts`. Neither uses the Cache Storage API.
- The ggwave engine is bundled into a hashed JavaScript chunk under `assets/`. The app pages load no fonts, no CDN files and no outside APIs today.
- `npm run build` runs `vite build` and then `build/copy-sound-test.mjs`, which copies `sound-test/` into `dist/`. The `sound-test/` folder is a developer page, not part of the app.
- Page text lives in `src/broadcast/strings.en.ts` with types in `src/broadcast/strings.types.ts`. Listen added its keys under a `listen.` prefix with approval.
- The front page is built last (spec 10) and will have large photos. This spec must not save the photos, but must save the Front_Page HTML and its small own CSS and JavaScript. Because the Front_Page does not yet have its final files, the File_List builder starts from all three HTML pages and classifies Front_Page images as excluded by rule, not by file name.

Decisions taken in these requirements, all confirmed by the owner:
1. Promise 4 reads: after the first load the app works with no network and never contacts any other site. The only request it ever makes is to its own address, to check for a new version, and only when a connection is there. The update check and the file downloads of the Service_Worker go only to the same origin as the page, and carry no alert data and no audio.
2. The new version takes over the next time a page opens, never in the middle of a page that is open. This avoids reloading the Listen_Page during a Session.
3. The Offline_Line appears on the two app pages only, not on the Front_Page.
4. The icons are plain placeholders made for this spec. They are replaced in the look spec (spec 8), together with the alert-type icons of promise 6.
5. The Front_Page HTML and its small own CSS and JavaScript are in the Saved_Copy so the Front_Page opens offline. Front_Page images are not saved. The 2 MiB limit covers the whole File_List.

Further owner decisions (second round):
6. The Offline_Check scans the Front_Page HTML too. On the Front_Page, clickable links (`<a href>`, `<area href>`) may point to another site, but nothing may be loaded from another origin. On the Listen_Page and the Broadcast_Page, nothing may be loaded from another origin and no link may point to another site.
7. The few calls to `fetch`, `XMLHttpRequest` and similar APIs in the bundled ggwave loader are allowed through a minimal allow-list. Each entry names one file and one call, with a written reason. The whole list is shown to the owner.
8. The first press of Start listening or Go on air asks the browser to keep the storage (`navigator.storage.persist()`). A Storage_Note appears when the browser did not agree and the app is not opened from the Home Screen.
9. The Service_Worker fetches each file fresh at install (`cache: 'reload'`), because GitHub Pages lets browsers reuse files for about 10 minutes.
10. Each page opens offline from its address with or without a trailing slash, with `index.html`, with a query string or with a fragment.
11. "Saved for offline use" shows only when every file on the File_List is in the Saved_Copy and a completion marker, written after the last file, is present.
12. `offline-files.json` is not saved in the offline copy. A `BASE_PATH` containing `//` fails the build. A failed update with a complete old Saved_Copy keeps showing "Saved for offline use".

Files this spec owns: a new `src/offline/` folder, the service worker source, the manifest, the icon files, a new build script under `build/`, and the new tests under `tests/offline/`. The owner has approved in advance the edits to these files owned by other specs: `listen/index.html`, `broadcast/index.html`, `index.html`, `listen/main.ts`, `broadcast/main.ts`, `src/broadcast/strings.types.ts`, `src/broadcast/strings.en.ts`, `src/broadcast/dom/mount.ts`, `src/listen/dom/mount.ts`, `vite.config.ts`, `package.json` and the `tsconfig` files. Each edit must be the smallest one the spec needs. Any other file owned by another spec still needs the owner's approval (Requirement 12).

## Glossary

- **Site**: The three static pages `<base>`, `<base>listen/` and `<base>broadcast/` built from this repository.
- **Base**: The Vite `base` value, from `BASE_PATH` through `resolveBase`. It is `/` at the root of a domain and `/<repo>/` under a sub-path.
- **Listen_Page**: The page at `<base>listen/`.
- **Broadcast_Page**: The page at `<base>broadcast/`.
- **Front_Page**: The page at `<base>`.
- **App_Pages**: The Listen_Page and the Broadcast_Page.
- **Service_Worker**: The script that saves files and answers page requests from the saved copy.
- **Service_Worker_Scope**: The URL range the Service_Worker controls. It is `<base>`.
- **Saved_Copy**: The set of files (the File_List) stored in the browser's Cache Storage by the Service_Worker for one Site_Version.
- **App_File**: A file in the File_List: the HTML of the Listen_Page, the Broadcast_Page and the Front_Page, the JavaScript, CSS, icons and manifest they load, and the files those load in turn, except Excluded_Files.
- **File_List**: The list of every App_File for one build, written during the build with each file's path relative to Base. It is the content of the Saved_Copy.
- **Front_Page_Image**: An image file that is referenced only from the Front_Page HTML or from files reached only from the Front_Page HTML, and is not referenced from the Listen_Page HTML, the Broadcast_Page HTML or the Manifest. Icons listed in the Manifest are never Front_Page_Images.
- **Front_Page_File**: A file the Front_Page HTML needs other than a Front_Page_Image: the Front_Page HTML itself and its own CSS, JavaScript and other small files.
- **Excluded_File**: A built file that is not saved. These are the Front_Page_Images, the `sound-test/` folder, the Service_Worker file itself, the File_List data file `offline-files.json`, and any source map. The Front_Page HTML and the Front_Page_Files are not Excluded_Files.
- **Site_Version**: A build identifier that changes whenever any App_File changes and stays the same when none changes.
- **Completion_Marker**: An entry in the Saved_Copy of one Site_Version that the Service_Worker writes only after the last file of the File_List is stored.
- **Fully_Saved**: The state in which every file in the File_List for the running Site_Version is in the Saved_Copy and the Completion_Marker of that Site_Version is present.
- **Offline_Line**: The small status line on each App_Page.
- **Manifest**: The web app manifest file linked from all three pages.
- **Start_Address**: The `start_url` of the Manifest.
- **History**: The Listen_Page list of heard alerts kept in `localStorage`.
- **External_Request**: Any request or load from the Listen_Page, the Broadcast_Page or the Front_Page, or from their scripts or styles, to an origin other than the page's own origin. A click on a link that opens another site is not an External_Request.
- **External_Link**: An `<a href>` or `<area href>` whose URL points to an origin other than the site's own origin.
- **Loader_Call_List**: The allow-list of calls to `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `navigator.sendBeacon` that the Offline_Check accepts. Each entry has a file path pattern for the Build_Output, one call, and a written reason.
- **Persist_Request**: The call `navigator.storage.persist()`.
- **Start_Control**: The Start listening button on the Listen_Page and the Go on air button on the Broadcast_Page.
- **Storage_Note**: The small extra line on each App_Page with the text "Your browser may clear this saved copy if you do not use the app. Add it to your Home Screen to keep it."
- **Home_Screen_Mode**: The state in which the page was opened from the Home Screen, that is `display-mode: standalone` matches or `navigator.standalone` is true.
- **Offline_Check**: The automated check that fails the build on an External_Request.
- **Build_Output**: The `dist/` folder produced by `npm run build`.

## Requirements

### Requirement 1: Save the app on the first visit

**User Story:** As a listener, I want one visit to any page to save the whole app, so that I can use Listen and Broadcast later with no network.

#### Acceptance Criteria

1. WHEN the Front_Page, the Listen_Page or the Broadcast_Page loads in a browser that supports service workers, THE page SHALL call registration of the Service_Worker with the Service_Worker_Scope within 1 second of the page's load event.
2. IF the browser does not support service workers or registration is rejected, THEN THE page SHALL continue to load and run without showing a blocking error, and SHALL leave any existing Saved_Copy unchanged.
3. WHEN the Service_Worker installs, THE Service_Worker SHALL download every file in the File_List and store each one in the Saved_Copy, so that all files are stored before the install is reported as complete.
4. IF any file in the File_List fails to download during install (network error, or a response status outside 200 to 299), THEN THE Service_Worker SHALL fail the install, store no partial set of the new files as the active Saved_Copy, leave the previous Saved_Copy in place and leave the previous Service_Worker in control.
5. THE Service_Worker SHALL save the HTML of the Listen_Page, the Broadcast_Page and the Front_Page, whichever of the three pages started the install.
6. THE Service_Worker SHALL NOT save any Excluded_File, including any Front_Page_Image.
7. THE File_List SHALL contain every file that the Listen_Page and the Broadcast_Page load, including the ggwave engine chunk, the Manifest and the icons, so that loading `/listen` and `/broadcast` with the network off makes 0 network requests. THE File_List SHALL also contain the Front_Page HTML and every Front_Page_File.
8. THE Service_Worker, the registration code and the File_List SHALL be the same code and the same data on all three pages.
9. WHERE the site is served under a sub-path, THE File_List entries and the Service_Worker_Scope SHALL resolve against the Vite `base` setting, and no entry SHALL contain a hard-coded sub-path.
10. WHILE the page runs under the Vite dev server (`import.meta.env.PROD` is false), THE registration code SHALL do nothing: it SHALL NOT register a Service_Worker and SHALL NOT make a request for one.
11. WHILE the page runs under the Vite dev server, THE Offline_Line SHALL show "Open this page once with internet to save it".
12. WHEN the Service_Worker downloads a file of the File_List during install, THE Service_Worker SHALL create the request with cache mode `reload`, so that the browser HTTP cache is bypassed and the file comes from the server.
13. FOR ALL File_Lists, THE Service_Worker install SHALL issue exactly one request per File_List entry, AND every one of those requests SHALL have cache mode `reload` (fresh fetch property, checked with a fake fetch that records the cache mode of each request).

### Requirement 2: Serve from the saved copy

**User Story:** As a listener, I want the app to open with no network, so that it works when the internet and mobile networks are down.

#### Acceptance Criteria

1. WHEN a page under the Service_Worker_Scope requests a file that is in the Saved_Copy, THE Service_Worker SHALL answer from the Saved_Copy without sending any network request for that file.
2. WHEN the browser requests `<base>listen`, `<base>listen/`, `<base>listen/index.html`, `<base>broadcast`, `<base>broadcast/` or `<base>broadcast/index.html`, with or without a query string or a fragment, THE Service_Worker SHALL answer with the saved HTML of the matching page.
3. IF a requested file is not in the Saved_Copy, THEN THE Service_Worker SHALL pass the request to the network unchanged, SHALL NOT add the response to the Saved_Copy, and SHALL leave the Saved_Copy unchanged.
4. WHEN a request targets an origin other than the origin of the Service_Worker, THE Service_Worker SHALL NOT answer it from the Saved_Copy and SHALL leave it untouched.
5. WHEN the browser requests `<base>` or `<base>index.html`, with or without a query string or a fragment, THE Service_Worker SHALL answer with the saved HTML of the Front_Page.
6. WHEN the device has no network and the Saved_Copy is Fully_Saved, THE Front_Page SHALL open from the Saved_Copy and render its text, layout and buttons, instead of the browser's error page, and every request for a Front_Page_Image SHALL fail without breaking the rest of the page.
7. WHEN the device has no network and the Saved_Copy is Fully_Saved, THE Listen_Page and the Broadcast_Page SHALL each open, load all of their scripts and styles without any failed request, and run every function they offer without network access.
8. WHEN the Listen_Page opens from the Saved_Copy, THE Listen_Page SHALL show every entry of the stored History with the same content and the same order as before the page closed.
9. IF the device has no network and the requested file is not in the Saved_Copy, THEN THE Service_Worker SHALL let the browser report its normal failed-request result and SHALL NOT answer with a substitute page or a different saved file.
10. WHEN the device has no network and the Saved_Copy is Fully_Saved, THE Listen_Page, THE Broadcast_Page and THE Front_Page SHALL each open from every address variant in criteria 2 and 5, and the scripts and styles of the opened page SHALL load from paths derived from Base, not from paths relative to the address variant.
11. THE Manifest `start_url` SHALL stay `<base>listen/`, which is one of the address variants in criterion 2.

### Requirement 3: Work at the root of a domain and under a sub-path

**User Story:** As the maintainer, I want the app to work at the root of `deadair.vedasdixit.com` and also at `https://<user>.github.io/<repo>/`, so that the same build works for the live site and for a test deploy.

#### Acceptance Criteria

1. WHEN the build runs, THE build SHALL derive every path used by the Service_Worker, the registration code, the Manifest and the File_List from Base, and SHALL write no path to those files that is not derived from Base.
2. THE repository SHALL contain no hard-coded sub-path (including `/dead-air/`) in any file this spec adds, and a text search of those files for `/dead-air/` SHALL return zero matches.
3. WHEN the build runs with `BASE_PATH` empty, THE Service_Worker_Scope SHALL be `/` and every File_List path SHALL begin with `/` and resolve against `/`.
4. WHEN the build runs with `BASE_PATH` set to a repository name, THE Service_Worker_Scope SHALL be `/<repo>/` and every File_List path SHALL begin with `/<repo>/` and resolve under `/<repo>/`.
5. THE Service_Worker file SHALL be served from `<base>` so that its default scope equals the Service_Worker_Scope, and THE registration code SHALL register it without passing a scope wider than `<base>`.
6. IF `BASE_PATH` is set with a leading slash, a trailing slash, or both (for example `/repo`, `repo/` or `/repo/`), THEN THE build SHALL normalize it so that Service_Worker_Scope, File_List paths and Manifest paths contain exactly one `/` between segments and no `//`.
7. IF `BASE_PATH` contains `//` or any other empty path segment, THEN THE build SHALL fail with an error naming the value and SHALL NOT write the build output.
8. IF any generated File_List path, Manifest path or registration path falls outside Service_Worker_Scope, THEN THE build SHALL fail with an error naming the offending path and SHALL NOT write the build output.

### Requirement 4: Web app manifest and Home Screen start

**User Story:** As a listener, I want "Add to Home Screen" to open the Listen page directly, so that one tap on the icon starts the page that hears alerts.

#### Acceptance Criteria

1. THE Manifest SHALL contain a non-empty `name`, a non-empty `short_name` of 12 characters or fewer, a `start_url`, a `scope`, a `display` value of `standalone` and an `icons` list.
2. THE Manifest `start_url` SHALL resolve to `<base>listen/`, where `<base>` is the Vite `base` setting, and SHALL NOT contain a hard-coded sub-path.
3. THE Manifest `scope` SHALL resolve to `<base>`, so that the Front_Page, the Listen_Page and the Broadcast_Page all fall inside the scope.
4. THE Manifest `icons` list SHALL contain a PNG icon of 192 by 192 pixels and a PNG icon of 512 by 512 pixels, and each listed icon file SHALL exist in the Build_Output at the path given in the `icons` list.
5. THE Manifest SHALL contain a `background_color` and a `theme_color`, each a valid CSS color value.
6. THE Front_Page, the Listen_Page and the Broadcast_Page SHALL each contain a `<link rel="manifest">` element whose `href` is derived from Base and resolves to the Manifest file in the Build_Output.
7. THE Manifest SHALL contain no URL that points to another origin, and every `start_url`, `scope` and icon `src` value SHALL be a path on the same origin as the site.
8. THE icon files SHALL be committed in the repository and SHALL be listed in the File_List.
9. THE icon files SHALL be placeholders, and replacing them in the look spec (spec 8) SHALL need no change to the Manifest structure beyond the icon file contents or paths.
10. WHEN the site is built with an empty `BASE_PATH` and WHEN the site is built with `BASE_PATH` set to a sub-path name, THE Manifest SHALL have `start_url`, `scope` and icon paths that begin with the corresponding `<base>` value in each build.

### Requirement 5: Offline status line

**User Story:** As a listener, I want to see whether the app is saved, so that I know it will work when the network is gone.

#### Acceptance Criteria

1. THE Offline_Line SHALL appear exactly once on the Listen_Page and exactly once on the Broadcast_Page.
2. WHILE the Service_Worker has not reached Fully_Saved on the device, THE Offline_Line SHALL show the text "Open this page once with internet to save it".
3. WHEN the device reaches Fully_Saved, THE Offline_Line SHALL change to the text "Saved for offline use" within 1 second of the Service_Worker reporting Fully_Saved, without a page reload.
4. WHEN a page opens on a device that is already Fully_Saved for the running Site_Version, THE Offline_Line SHALL show "Saved for offline use" without waiting for the network, and the text SHALL be present within 1 second of the page's first render, with no network connection required.
5. WHILE a new Site_Version is downloading and the previous Saved_Copy is still complete, THE Offline_Line SHALL keep showing "Saved for offline use" and SHALL NOT show "Open this page once with internet to save it" at any point during the download.
6. IF the browser does not support service workers, registration fails, or a download of any file in the Saved_Copy fails, and no complete Saved_Copy exists on the device, THEN THE Offline_Line SHALL show "Open this page once with internet to save it", and SHALL change to "Saved for offline use" only after the device later reaches Fully_Saved.
7. THE Offline_Line SHALL be a single line of plain text of 60 characters or fewer in the English Strings_File, with no icon and no emoji.
8. THE two Offline_Line texts SHALL be keys in the Strings_File, so that a language file missing either key fails the build or the test run.
9. THE Offline_Line SHALL carry `aria-live="polite"`, so that a change of its text is announced without interrupting the current speech.
10. THE Front_Page SHALL NOT contain an Offline_Line.
11. THE Service_Worker SHALL write the Completion_Marker of a Site_Version only after the last file of the File_List is stored, and SHALL NOT write it if any file failed to download or to store.
12. BEFORE THE Offline_Line shows "Saved for offline use", THE page SHALL check that the Completion_Marker of the running Site_Version is present and that every File_List path is present in the Saved_Copy, and IF either check fails, THEN THE Offline_Line SHALL show "Open this page once with internet to save it", except as criterion 14 states.
13. FOR ALL File_Lists and all contents of the Saved_Copy, THE Offline_Line state choice SHALL return the saved state if and only if the Completion_Marker is present and every File_List path is present in the Saved_Copy (never-early property, including a Saved_Copy with every file but no marker, and a Saved_Copy with the marker but one file missing).
14. IF the download of a new Site_Version fails while the previous Saved_Copy passes the check in criterion 12, THEN THE Offline_Line SHALL keep showing "Saved for offline use".

### Requirement 6: Update to a new version without losing data

**User Story:** As a listener, I want the app to update itself when a new version is published, so that I get fixes without reinstalling and without losing my alert history.

#### Acceptance Criteria

1. WHEN a page opens on a device with a connection, THE page SHALL ask the browser to check for a new Service_Worker within 5 seconds of the page finishing load.
2. WHEN the check finds a new Site_Version, THE new Service_Worker SHALL download the complete new File_List into a new Saved_Copy while the old Saved_Copy keeps serving pages.
3. WHEN the new Saved_Copy is complete and no page controlled by the old Service_Worker remains open, THE new Service_Worker SHALL take control, and the next page open SHALL load from the new Saved_Copy.
4. WHEN the new Service_Worker takes control, THE new Service_Worker SHALL delete every Saved_Copy that belongs to an older Site_Version, and the Saved_Copy of the current Site_Version SHALL remain.
5. THE Service_Worker and the page registration code SHALL NOT reload, navigate or close a page that is already open.
6. WHILE a Session is running on the Listen_Page, THE Service_Worker SHALL NOT interrupt the Session, and the Session SHALL keep running on the old Saved_Copy until the page is closed.
7. THE Service_Worker and the registration code SHALL NOT read, write or delete any `localStorage` entry, so that the History and the station data survive every update.
8. IF a new File_List fails to download in full, THEN THE Service_Worker SHALL delete the incomplete new Saved_Copy, THE old Saved_Copy SHALL stay in use for all pages, and THE Service_Worker SHALL try again at the next page open with a connection.
9. IF the connection drops, the browser closes, or a download otherwise stops while a new Saved_Copy is being saved, THEN THE old Saved_Copy SHALL keep serving every page, every file in the old Saved_Copy SHALL be byte-unchanged, and no part of the new Saved_Copy SHALL become active.
10. WHEN the File_List of two builds is the same and every App_File is byte-identical, THE two builds SHALL have the same Site_Version.
11. WHEN any App_File changes between two builds, including a file being added, removed or having one byte changed, THE two builds SHALL have different Site_Versions.
12. IF the device has no connection when a page opens, THEN THE page SHALL load from the current Saved_Copy and SHALL NOT show an error about the update check.

### Requirement 7: No external requests from the pages

**User Story:** As a listener who relies on the app in an emergency, I want the pages never to load anything from another site, so that nothing depends on a network and nothing leaks.

#### Acceptance Criteria

1. WHEN the Offline_Check runs, THE Offline_Check SHALL scan every file in the File_List of the Build_Output, including the Front_Page HTML and every Front_Page_File, and SHALL also scan the Service_Worker file and the HTML, CSS, JavaScript and web manifest files among them.
2. IF the Listen_Page HTML or the Broadcast_Page HTML has a `src`, `href`, `action`, `formaction`, `poster`, `srcset`, `data`, `ping` or `content` URL attribute value that points to another origin, including the `href` of an `<a>` or `<area>` element, THEN THE Offline_Check SHALL fail the build, exit with a non-zero status, and report the file name and the URL.
3. IF the Front_Page HTML loads anything from another origin, that is a URL in the `src`, `srcset`, `poster`, `data` or `ping` attribute of any element, the `href` of any `<link>` element (stylesheet, preload, prefetch, preconnect, dns-prefetch, modulepreload, icon or manifest), the `action` or `formaction` attribute, or a `<meta>` refresh `content` value, THEN THE Offline_Check SHALL fail the build, exit with a non-zero status, and report the file name and the URL.
4. WHEN the Front_Page HTML has an External_Link, THE Offline_Check SHALL accept that External_Link and SHALL report no failure for it.
5. IF a CSS file, an inline style or a `style` attribute in the File_List has a `url()` or `@import` that points to another origin, THEN THE Offline_Check SHALL fail the build, exit with a non-zero status, and report the file name and the URL. This applies to the Front_Page_Files as well.
6. IF a JavaScript file in the File_List, including a Front_Page_File, contains an absolute `http://`, `https://` or protocol-relative `//` URL used as a request target, an import, a script source or a worker source, THEN THE Offline_Check SHALL fail the build, exit with a non-zero status, and report the file name and the URL.
7. IF a JavaScript file in the File_List calls `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `navigator.sendBeacon` with a target that the check cannot show to be a same-origin relative path, and the call has no entry in the Loader_Call_List, THEN THE Offline_Check SHALL fail the build, exit with a non-zero status, and report the file name and the call.
8. THE Loader_Call_List SHALL contain only entries that each name exactly one file path pattern in the Build_Output, exactly one call, and a written reason.
9. IF a Loader_Call_List entry has an empty reason, matches no call in the current Build_Output, matches more than one file, or matches more than one call, THEN THE Offline_Check SHALL fail the build, exit with a non-zero status, and report the entry.
10. THE Offline_Check SHALL read its allowed non-request URL strings, such as XML namespace identifiers, from one list in which every entry has a written reason, AND THE Offline_Check SHALL fail the build if any entry has an empty reason.
11. WHEN `npm test` or `npm run build` runs, THE Offline_Check SHALL run, so that the deploy workflow fails when the check fails.
12. WHEN the Offline_Check runs, THE Offline_Check SHALL check both a Build_Output built with an empty `BASE_PATH` and a Build_Output built with a repository-name `BASE_PATH`, AND IF either one fails, THEN THE Offline_Check SHALL fail the build and report which `BASE_PATH` build failed.
13. IF the Offline_Check is given a Listen_Page or Broadcast_Page fixture that contains one external URL of each kind in criteria 2, 5 and 6 and one call of the kind in criterion 7, including one External_Link, THEN THE Offline_Check SHALL report one failure for each, AND THE count of reported failures SHALL equal the count of those external URLs and calls in the fixture.
14. IF the Offline_Check is given a Front_Page fixture that contains one external loaded URL of each kind in criteria 3, 5 and 6 (image, script, stylesheet, font through CSS, frame, audio, video, preload link, prefetch link, manifest link, CSS `@import` and JavaScript import), THEN THE Offline_Check SHALL report one failure for each, AND THE count of reported failures SHALL equal the count of those URLs in the fixture.
15. IF the Offline_Check is given a Front_Page fixture that contains only External_Links, THEN THE Offline_Check SHALL report zero failures, AND IF the Offline_Check is given a Listen_Page fixture that contains the same External_Links, THEN THE Offline_Check SHALL report one failure for each.
16. IF the Offline_Check is given a Loader_Call_List fixture with an entry that matches no call, an entry that matches two files, an entry that matches two calls, and an entry with an empty reason, THEN THE Offline_Check SHALL report one failure for each entry.
17. WHEN the Offline_Check runs against the current Build_Output, THE Offline_Check SHALL pass with zero reported failures.

### Requirement 8: Keep the saved copy small

**User Story:** As a listener on a phone with little storage, I want the saved copy to hold only what the app needs, so that saving it is fast and small.

#### Acceptance Criteria

1. THE File_List SHALL contain only files reachable from the Listen_Page HTML, the Broadcast_Page HTML, the Front_Page HTML, the Manifest and the Service_Worker registration code, and SHALL NOT contain any Excluded_File.
2. THE File_List SHALL NOT contain any Front_Page_Image.
3. THE File_List SHALL NOT contain any file under `sound-test/`.
4. THE Listen_Page and the Broadcast_Page SHALL NOT load any file that is an Excluded_File.
5. WHEN the build finishes, whether it passes or fails the size limit, THE build SHALL print the number of files in the File_List and the total size of the Saved_Copy (the File_List) in bytes.
6. IF the total size of the File_List, including the Front_Page HTML and every Front_Page_File, is greater than 2,097,152 bytes (2 MiB), THEN THE build SHALL exit with a non-zero status and print the total size and the limit.
7. IF a file in the File_List is an Excluded_File, THEN THE build SHALL exit with a non-zero status and print the path of each offending file.
8. IF a file in the File_List does not exist in the build output, THEN THE build SHALL exit with a non-zero status and print the path of each missing file.

### Requirement 9: File list generation and correctness

**User Story:** As the maintainer, I want the file list to be made by the build, so that no file is forgotten when the app changes.

#### Acceptance Criteria

1. WHEN `npm run build` completes successfully, THE build SHALL write exactly one File_List and exactly one Site_Version into the Build_Output.
2. THE File_List builder SHALL derive the list from the Build_Output by following references transitively, starting at the Listen_Page HTML file, the Broadcast_Page HTML file and the Front_Page HTML file, through scripts, stylesheets, icons, the manifest and any file those files reference, and SHALL NOT use a hand-written list of hashed file names.
3. THE File_List builder SHALL classify a file as a Front_Page_Image by the rule in the Glossary (an image file reached only from the Front_Page HTML), and SHALL NOT classify by file name or folder name, so that the rule holds for the Front_Page built in spec 10.
4. FOR ALL files referenced, directly or transitively, from the Listen_Page HTML, the Broadcast_Page HTML or the Front_Page HTML in a Build_Output, THE File_List SHALL contain the file unless the file is a Front_Page_Image or another Excluded_File (completeness property).
5. FOR ALL paths in the File_List, THE path SHALL be relative to Base, SHALL NOT contain a `..` segment, SHALL NOT be an absolute path or a full URL, and SHALL name an existing file in the Build_Output (soundness property).
6. WHEN the File_List builder runs twice on the same Build_Output, THE File_List builder SHALL produce a byte-identical File_List and an identical Site_Version, independent of file system listing order and of the time of the run (determinism property).
7. IF the File_List builder finds a reference, other than to a Front_Page_Image, in the Listen_Page HTML, the Broadcast_Page HTML, the Front_Page HTML or any file reached from them that names a file not in the Build_Output, THEN THE build SHALL fail with a non-zero exit status, SHALL name each missing file and the file that references it, and SHALL NOT leave a File_List or Site_Version in the Build_Output from that run.
8. IF a reference found by the File_List builder, other than an External_Link in the Front_Page HTML, is an absolute URL to another site, THEN THE build SHALL fail with a non-zero exit status and name the reference and the file that contains it (promise 4). THE File_List builder SHALL NOT follow an External_Link.
9. WHEN any file listed in the File_List changes its content, THE File_List builder SHALL produce a different Site_Version from the one produced before the change.

### Requirement 10: Offline logic that can be tested without a browser

**User Story:** As the maintainer, I want the decision logic of the offline code kept in pure functions, so that plain Node tests can check it.

#### Acceptance Criteria

1. THE offline module SHALL hold the Offline_Line state choice, the request-routing choice, the old-copy deletion choice, the Storage_Note visibility choice and the Offline_Check scanning in pure functions that use no browser APIs and import no module that uses browser APIs.
2. THE Service_Worker and the registration code SHALL contain only calls to the browser APIs and calls to the pure functions in the offline module, with no branching on Offline_Line state, request routing, old-copy deletion, Storage_Note visibility or Offline_Check results beyond what those pure functions return.
3. FOR ALL cache-name lists and a current Site_Version, THE old-copy deletion choice SHALL return exactly the names of Dead Air caches whose Site_Version differs from the current Site_Version, and SHALL return no name of a cache that is not a Dead Air cache and no name of the Dead Air cache with the current Site_Version (selection property).
4. FOR ALL request URLs, THE request-routing choice SHALL answer from the Saved_Copy only for a same-origin URL whose path is in the File_List or maps to a page HTML in the File_List (including `<base>` and `<base>index.html` for the Front_Page, and the address variants of criteria 2.2 and 2.5), and SHALL not answer from the Saved_Copy for any other URL, including a cross-origin URL. FOR ALL page addresses, adding any query string or fragment SHALL NOT change the routing result (routing property).
5. THE offline tests SHALL include at least one unit test for each of Requirements 1 to 8 and 14, using a fake Cache Storage and a fake Service_Worker registration, and SHALL run in plain Node with no browser, no network and no real Service_Worker.
6. IF an offline test needs a browser API that the fakes do not provide, THEN THE offline test run SHALL fail with an error naming the missing API and SHALL not skip the test silently.

### Requirement 11: Existing rules stay true

**User Story:** As the project owner, I want the offline work to keep the six promises, so that saving the app does not weaken them.

#### Acceptance Criteria

1. THE Service_Worker SHALL NOT write microphone audio or any decoded alert to the cache, to storage, to logs, or to the body of any network request (promise 5).
2. THE Service_Worker SHALL return each cached response byte-identical to the response that was downloaded and saved, with no change to body or content type.
3. THE Service_Worker SHALL NOT register a handler for `message` events. This means no alert data or audio can reach it from a page.
4. THE Offline_Line text and the Manifest `name` SHALL contain no emoji characters, checked against the Unicode Emoji property in every shipped language.
5. THE Service_Worker, the registration code and the Manifest SHALL reference only URLs on the same origin as the site, AND the Listen_Page, the Broadcast_Page and the Front_Page SHALL load nothing from another origin. This applies to fonts, scripts, images, styles, frames and media, and the built output SHALL contain zero such references (promise 4). Only External_Links on the Front_Page may point to another site.
6. WHEN the Offline_Line is shown or hidden, THE Listen page SHALL render each alert card with the same sent time, expired status and TEST banner as it renders when the Offline_Line is absent (promises 1 to 3).
7. IF a cached copy of a page or file is missing when the device is offline, THEN THE Service_Worker SHALL return a network-error response and SHALL NOT substitute another page, file or alert content.

### Requirement 12: Files from other specs

**User Story:** As the project owner, I want the edits to other specs' files to be approved and kept small, so that this spec changes no more than it needs.

#### Acceptance Criteria

1. THE offline spec SHALL treat as approved by the project owner the edits to these files: `listen/index.html`, `broadcast/index.html`, `index.html`, `listen/main.ts`, `broadcast/main.ts`, `src/broadcast/strings.types.ts`, `src/broadcast/strings.en.ts`, `src/broadcast/dom/mount.ts`, `src/listen/dom/mount.ts`, `vite.config.ts`, `package.json` and every `tsconfig` file.
2. THE offline spec SHALL add to each of `listen/index.html` and `broadcast/index.html` only one `<link rel="manifest">` element, one Offline_Line element and one Storage_Note element, and to `index.html` only one `<link rel="manifest">` element and the one script element that loads the Front_Page registration entry.
3. THE offline spec SHALL add to each of `listen/main.ts` and `broadcast/main.ts` only the call that registers the Service_Worker and the call that connects the Offline_Line (the Storage_Note and the Persist_Request are wired in the `dom/mount.ts` files), and SHALL put the Front_Page registration call in a new entry script owned by this spec.
4. THE offline spec SHALL add to `src/broadcast/strings.types.ts` and `src/broadcast/strings.en.ts` only the Offline_Line keys and the Storage_Note key, each starting with the `offline.` prefix.
5. THE offline spec SHALL change `vite.config.ts`, `package.json` and the `tsconfig` files only as far as needed to build the Service_Worker, write the File_List, run the Offline_Check and type-check the new files.
6. FOR EACH approved file, THE offline spec SHALL make the smallest edit that delivers the behavior, and SHALL leave every other line of that file unchanged.
7. IF the offline spec needs to edit a file owned by another spec that is not listed in criterion 1, THEN THE offline spec SHALL stop and ask the project owner to approve that file, by name, before the edit, and SHALL leave the file byte-for-byte unchanged until then.
8. WHEN the Front_Page is rebuilt in spec 10, THE Front_Page SHALL keep the manifest link and the registration call added by this spec.
9. THE offline spec SHALL change `src/broadcast/dom/mount.ts` only to add the Persist_Request hook and the Storage_Note wiring and to correct the comment that says there is no service worker, and SHALL leave every other line of that file unchanged.
10. THE offline spec SHALL change `src/listen/dom/mount.ts` only to add the Persist_Request hook and the Storage_Note wiring, and SHALL leave every other line of that file unchanged.

### Requirement 13: Report of what could not be tested in code

**User Story:** As the project owner, I want to know what was tested on real devices, so that I can trust the offline behaviour.

#### Acceptance Criteria

1. WHEN the offline spec is completed, THE offline spec SHALL write a Report_File at `.kiro/specs/offline/report.md` that contains one entry for each of the eight checks listed in criterion 2.
2. THE Report_File SHALL list each of these eight checks, and each entry SHALL state a result of exactly one of "pass", "fail" or "not run", plus the device model and the browser name with its version: first visit saves both pages, airplane-mode start of the Listen_Page, airplane-mode start of the Broadcast_Page, Home Screen start opens the Listen_Page, update to a new version with the History kept, a sub-path build, the Front_Page opens with no connection without its large images, and the storage persistence request after the first press and the Storage_Note.
3. IF a check was not run on a real device, THEN THE Report_File SHALL mark that check "not run on a real device", name the check, and give the reason it was not run.
4. IF a check has a result of "fail", THEN THE Report_File SHALL describe the observed behaviour and the expected behaviour for that check.
5. THE Report_File SHALL record the date on which each check was run, and SHALL leave no check without a result.
6. THE Report_File SHALL contain the whole Loader_Call_List and the whole list of allowed non-request URL strings, each entry with its file, call and reason, AND the final summary given to the project owner when the spec is completed SHALL show both lists in full.

### Requirement 14: Ask the browser to keep the saved copy

**User Story:** As a listener, I want the app to ask the browser to keep its saved files, so that the browser does not clear the offline copy when storage runs low.

#### Acceptance Criteria

1. WHEN the person presses a Start_Control for the first time on a page load, THE page SHALL call the Persist_Request once, unless `navigator.storage.persisted()` already reports true.
2. THE page SHALL NOT call the Persist_Request at page load or at any time before the first press of a Start_Control.
3. WHEN the person presses a Start_Control, THE page SHALL make the audio call of that press before the Persist_Request, SHALL NOT await the Persist_Request before the audio call, and SHALL NOT await it inside the audio path.
4. IF the Persist_Request is unsupported, throws, rejects, never settles or returns false, THEN THE page SHALL run Start listening or Go on air with the same result as when the Persist_Request succeeds, and SHALL show no error.
5. THE page SHALL record nothing in `localStorage` about the Persist_Request, and SHALL use `navigator.storage.persisted()` to learn whether the browser agreed.
6. WHEN the first press has happened and `navigator.storage.persisted()` reports false and Home_Screen_Mode is false, THE page SHALL show the Storage_Note.
7. WHILE `navigator.storage.persisted()` reports true or Home_Screen_Mode is true, THE page SHALL hide the Storage_Note.
8. FOR ALL combinations of first-press state, persisted result and Home_Screen_Mode, THE Storage_Note visibility choice SHALL return shown if and only if the first press has happened, persisted is false and Home_Screen_Mode is false (visibility property).
9. THE Storage_Note text SHALL be exactly "Your browser may clear this saved copy if you do not use the app. Add it to your Home Screen to keep it.", SHALL be a key in the Strings_File with the `offline.` prefix, SHALL contain no emoji, and SHALL be on an element with `aria-live="polite"`.
10. THE Storage_Note SHALL appear exactly once on the Listen_Page and exactly once on the Broadcast_Page, and SHALL NOT appear on the Front_Page.
11. THE Service_Worker SHALL NOT call the Persist_Request.

> Update 22 Nov 2026 (front-page spec, task 6.3): offline decision 5 ("Front_Page images are not saved") is reversed by the front-page spec (Requirements 7.1, 7.2, 7.11). The four front pictures now join the File_List and the Saved_Copy. The 2 MiB Size_Limit still applies to the whole File_List.
