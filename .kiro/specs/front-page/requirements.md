# Requirements Document

## Introduction

The front page is spec 10 of 10 for Dead Air. It replaces the placeholder at `/` with the real page in the radio look, in English and Hindi, under the same header as the Listen and Broadcast pages. The words, facts, sources and order come from `docs/front-page-content.md` and are used as written. The page adds no fact, number or claim that is not in that file.

The first screen has no hero picture. It holds the headline, one short paragraph, the two buttons and a working demo: a "Play test alert" button that plays a TEST flood alert from this device, and a QR code that opens the Listen page.

### What the code already has

- `index.html` is a placeholder: the shared header, an `h1` and two links. It loads `src/offline/dom/front-entry.ts`, which registers the service worker.
- `src/shared/ui/look.css` holds the radio look, and `src/shared/ui/header.ts` and `build/look-header-plugin.ts` build the shared header, including the language switch.
- The Listen page already draws Alert_Cards with icons from `src/shared/ui/icons/` (the cyclone icon is one of the nine).
- The offline spec classifies Front_Page_Images as excluded from the Saved_Copy, so they are not saved today. The 2 MiB limit covers the whole File_List. The last build saved 11 files, 244377 bytes (`docs/kiro-diary.md`). The four pictures total 362160 bytes.
- The offline check lets Front_Page links point to other sites (`<a href>`) and fails on anything loaded from another origin.
- `docs/design/front/credits.md` gives the credit for each of the four pictures. `docs/design/front/illustration-phone.webp` exists, so Section 4 shows it.
- The diary records two informal field tests, both played from a MacBook Pro M4 through its built-in speakers at full volume (about 85 dB) and heard on a Samsung Galaxy S25 Ultra: 8 ft heard every time, and 21 ft with 3 of 4 alerts received. It records no radio test and no loudspeaker test.
- The repository has no QR encoder and `package.json` has no QR package. Decision 3 below adds one.

### Decisions the owner confirmed in the request

1. ~~No hero picture.~~ Reversed by hand after the spec (23 Nov 2026): Section 1 now opens with a hero picture, `illustration-phone.webp`, with the caption "AI-generated illustration". The rest of the first screen is unchanged: the headline, one paragraph, the buttons, the demo and the small line.
2. The page joins the pictures to the Saved_Copy. This reverses offline decision 5 ("Front_Page images are not saved") and edits files that the offline spec owns. The 2 MiB size check must still pass.
3. The QR code is generated inside the app, with no outside service, for the address the site is served from. It uses the npm package `qrcode-generator` (version 2.0.4, licence MIT, no dependencies, ESM build at `dist/qrcode.mjs`, with types). Measured with rolldown on the whole library, it adds about 20.6 KB (20,634 bytes) bundled and minified, and about 7.2 KB (7,200 bytes) gzipped. This approval satisfies the tech rule to ask before adding a dependency.
4. The three numbers are set very large in the mono font, with the words small underneath.
5. Section 3 is drawn as an Alert_Card with the cyclone icon, using the existing card styles and no second look.
6. A thin tuning-scale line with tick marks and the section number sits between sections. It is drawn with SVG or borders and has no gradient.
7. Sections 6 and 7 sit side by side on a wide screen and stack on a phone.
8. The word "dies" in the headline sits in its own element. Nothing else is done for it now.
9. No new tooling, such as a headless-browser script. The owner tests in a real browser.

### Further decisions the owner confirmed

10. **Offline copy.** The four pictures join the Saved_Copy. Editing the offline spec's files is approved, with the smallest change needed and without asking file by file. The tasks will name each file touched. The size check stays: the build fails, naming the largest file, if the File_List is over the Size_Limit.
11. **QR encoder.** The QR code uses `qrcode-generator` (decision 3), bundled into the site with no CDN and no outside request. The Listen_URL is derived from the Vite `base` and the current origin, never hard-coded. The package is named in the credits with its MIT licence. The QR is written as inline SVG, so no data URL and no extra request is needed.
12. **Distances.** The two diary results are shown in metres with feet in brackets (8 ft is 2.4 m, 21 ft is 6.4 m), with the feet figure exact and metres rounded to one decimal. The text says what played the sound, read from the Diary_File, and that the tests were informal. Radio and loudspeaker stay "not tested yet".
13. **Hindi.** All new Hindi text is marked `needs human check` and goes through the existing Hindi_Check. This includes the Hindi of the illustration caption "Illustration".
14. **Credits text.** The font and the libraries are named with the `license` field of each installed package: IBM Plex Mono OFL-1.1, ggwave MIT and qrcode-generator MIT.

## Glossary

- **Front_Page**: The page at `<base>`, built from `index.html`.
- **Content_File**: `docs/front-page-content.md`.
- **Diary_File**: `docs/kiro-diary.md`.
- **Credits_File**: `docs/design/front/credits.md`.
- **Header**: The shared header with the logo, the Listen and Broadcast switch and the language switch.
- **Language_File**: The English or Hindi text file of the app, with one key per string.
- **Hindi_Check**: The Hindi translation check of the languages spec, with its Reviewed_List and `docs/translation-check.md`.
- **Section**: One of the eight numbered parts of the Content_File.
- **Tuning_Line**: The thin line with small tick marks and the section number that is drawn between Sections.
- **Big_Number**: One of the three figures in Section 2, with its words and its source link.
- **Source_Link**: An ordinary `<a href>` to the address given in the Content_File, placed next to the number or claim it supports.
- **Case_Card**: The Section 3 block, drawn as an Alert_Card with the cyclone icon.
- **Alert_Card**: The card of the Listen page, with its styles from `src/shared/ui/look.css`.
- **Demo_Alert**: The TEST flood alert that the Play_Button plays.
- **Play_Button**: The "Play test alert" button.
- **Demo_Player**: The code that builds the Demo_Alert, loads the Sound_Link and plays it.
- **Sound_Link**: The ggwave based audio module of the sound-link spec.
- **QR_Library**: The npm package `qrcode-generator` 2.0.4 (MIT), bundled into the site.
- **QR_Code**: The QR matrix from the QR_Library, drawn as inline SVG beside the buttons.
- **Listen_URL**: The absolute address of the Listen page, made from the address the page was served from, including any sub-path.
- **Picture**: One of the four images in `docs/design/front/`: `fani-before.webp`, `fani-after.webp`, `acoustic-coupler.webp` and `illustration-phone.webp`.
- **Caption**: The muted text under a Picture, with the credit and the licence from the Credits_File.
- **Text_Column**: The centred column of the Front_Page, at most 40rem wide.
- **Dies_Element**: The element that wraps the word "dies" in the headline.
- **Saved_Copy**, **File_List**, **Offline_Check**, **Size_Limit**: As defined in the offline spec. The Size_Limit is 2097152 bytes.
- **TEST_Banner**, **Promise**: As defined in the Alert_Card of the Listen page and in `promises.md`.

## Requirements

### Requirement 1: Page structure, content and language

**User Story:** As a visitor, I want the front page to say what Dead Air is and where it stands, in my language, so that I can judge it quickly.

#### Acceptance Criteria

1. THE Front_Page SHALL contain Sections 1 to 8 of the Content_File in that order, as real static HTML in `index.html`, so that the address opens correctly on GitHub Pages without a script.
2. THE Front_Page SHALL use the words, numbers and facts of the Content_File as written, and SHALL contain no fact, number or claim that is absent from the Content_File.
3. THE Front_Page SHALL show the Header with the logo, two plain pills (Listen and Broadcast) and the working language switch, and SHALL draw no knob.
3a. THE Front_Page SHALL place the logo in the Header at the same position and size as on the Listen page and the Broadcast page.
4. THE Front_Page SHALL not draw lines of the Content_File that start with "Kiro:".
5. THE Front_Page SHALL contain exactly one `h1`, the headline of Section 1, and one `h2` for each of Sections 2 to 7.
6. WHEN the Chosen_Language changes, THE Front_Page SHALL show every text of the page in the new language without a reload, and SHALL keep the position of the Demo_Alert state and the scroll position.
7. THE Front_Page SHALL take every text from the Language_Files, with one key per string, so that the Hindi_Check lists every Hindi text of the page.
8. THE Front_Page SHALL show every Source_Link text, number, place name and quoted name as given in the Content_File, and SHALL translate only the surrounding sentences.
9. WHEN a Hindi text of the Front_Page is not in the Reviewed_List, THE Hindi_Check SHALL list it as `needs human check`.
10. THE Front_Page SHALL contain no emoji.
11. THE Hindi_Check SHALL list every new Hindi text of the Front_Page, including the Hindi of the caption "Illustration", as `needs human check` until a reviewer adds it to the Reviewed_List.

### Requirement 2: First screen with a hero picture

**User Story:** As a visitor on a phone, I want to see the headline, a short explanation and a working demo without scrolling, so that I understand the idea in one screen.

#### Acceptance Criteria

1. THE Front_Page SHALL show in its first screen, in this order: the headline, the one paragraph of Section 1, the buttons "Play test alert" and "Open Listen", the QR_Code with its scan line, and the small line "A prototype. A backup channel, not a replacement for official alerts."
2. THE Front_Page SHALL show `illustration-phone.webp` as the hero Picture in Section 1, with its caption and credit. (Changed by hand on 23 Nov 2026; this was "no Picture" before.)
3. THE headline SHALL wrap the word "dies" in the Dies_Element, a `span` with a fixed `id` or `class` that a later spec can select.
4. THE Dies_Element SHALL carry no style, script or drawing in this spec, and THE headline SHALL read word for word as in the Content_File.
5. WHEN the viewport is 360 px wide at the default text size, THE Front_Page SHALL show the headline, the paragraph and both buttons without a horizontal scroll bar.
6. THE "Open Listen" button SHALL be an ordinary link to the Listen page, built from the Vite `base`.
7. THE "Play test alert" and "Open Listen" buttons SHALL be pills of at least 48 by 48 px with at least 8 px between them, with "Play test alert" as the primary ink pill.

### Requirement 3: The in-app QR code

**User Story:** As a visitor with one phone in my hand, I want to scan a code from the page with a second phone, so that the second phone opens the Listen page and hears the demo.

#### Acceptance Criteria

1. THE QR_Code SHALL encode the Listen_URL, built from `location.origin`, the Vite `base` and `listen/`, so that the code is correct at the root of a domain and under a sub-path.
2. THE QR_Code SHALL be made by the QR_Library, bundled into the site's own JavaScript, and drawn by the page code as inline SVG with no outside service, no CDN, no data URL, no image fetched from any address and no network request.
3. THE QR_Code SHALL be drawn as inline SVG with the light-theme ink colour for the modules and the light-theme paper colour for the background, in both colour themes.
3a. THE QR_Code SHALL have a clear light border of at least 4 modules on every side, drawn in the light-theme paper colour in both colour themes, so that a phone reads it at night as well.
4. THE QR_Code SHALL have a text alternative that gives the Listen_URL, and the scan line "Scan with a second phone, then press Play test alert." SHALL sit beside it.
5. THE Front_Page SHALL call the QR_Library only from a small wrapper module with no browser API, which takes a text and returns the module matrix, so that the wrapper runs in plain Node.
6. THE wrapper SHALL return a matrix whose modules equal the matrix the QR_Library gives for each of at least three fixed test texts, one of them a Listen_URL under a sub-path, checked against known-good matrices stored in the tests.
7. IF the QR_Library fails to make a code for a text, THEN THE Front_Page SHALL show the Listen_URL as plain text in place of the QR_Code.
8. WHEN the page is served from an address with a sub-path, THE QR_Code SHALL encode that sub-path.

### Requirement 4: The working demo

**User Story:** As a visitor, I want to press one button and hear a test alert from my device, so that I can see the idea work without a second sender.

#### Acceptance Criteria

1. WHEN the visitor taps the Play_Button, THE Demo_Player SHALL unlock the audio inside that tap, load the Sound_Link if it is not loaded, and play the Demo_Alert through the speaker of this device.
2. THE Demo_Alert SHALL be a flood alert with the `test` flag set, built with the message code, with a sent time taken from the device clock at the tap and a valid-for period of 1 hour.
2a. THE Demo_Alert SHALL carry an empty place name, and IF the Listen page's sentence builder cannot build a sentence from an empty place name, THEN THE Demo_Alert SHALL carry the place name "Test" instead.
3. FOR ALL Demo_Alert values the Demo_Player builds, THE encoded bytes SHALL decode to an alert with `test` equal to true, and the same alert in the Listen page SHALL show the TEST_Banner (Promise 3).
4. THE Demo_Alert SHALL use the same play pattern as Go on air: two plays with a 1 second gap.
5. THE Demo_Player SHALL not load the Sound_Link before the first tap on the Play_Button, so that the first screen draws without the sound code.
6. WHILE the Demo_Alert plays, THE Front_Page SHALL show the Play_Button as hollow with the text "Playing", and a Stop button as a solid pill.
7. WHEN the Demo_Alert ends or the visitor taps Stop, THE Front_Page SHALL return the Play_Button to its pressable state.
8. WHILE the Demo_Alert plays, THE Front_Page SHALL show the line "Turn your volume all the way up."
9. IF the Sound_Link fails to load, THEN THE Front_Page SHALL show a plain failure line and SHALL keep the Play_Button pressable, so that the next tap retries.
10. THE Demo_Player SHALL not request the microphone and SHALL not record, store or upload audio (Promise 5).
11. THE Demo_Player SHALL not send the Demo_Alert to any network address.

### Requirement 5: Section styling

**User Story:** As a visitor, I want the page to look like the rest of the app and not like a template, so that it feels like one product.

#### Acceptance Criteria

1. THE Front_Page SHALL use the colours, the 12 px radius, the pills and the IBM Plex Mono font of `look.css` and SHALL add no font, colour value or second look.
2. THE Front_Page SHALL set each Big_Number of Section 2 in the mono font at 3rem or larger, with its words below at body size and its Source_Link directly under or beside the words.
3. THE Front_Page SHALL show the line under the Big_Numbers and its WMO and UNDRR Source_Link as one block in the Text_Column.
4. THE Case_Card SHALL be drawn as an Alert_Card that reuses the existing card styles and the cyclone icon, with the title "Cyclone Fani", the place and date line, the four labelled rows ("What failed", "What still worked", "What happened", "The gap") and the Source_Links of each row next to its text.
5. THE Case_Card SHALL show no TEST_Banner, no sent time and no read-aloud button, because it is a description of a past storm and not an alert received by the app.
6. THE Front_Page SHALL draw a Tuning_Line between Sections 1 and 2, 2 and 3, 3 and 4, 4 and 5, 5 and 6, and 6 and 7 and 7 and 8, with the section number of the following Section on it.
7. THE Tuning_Line SHALL be drawn with inline SVG or CSS borders, with small tick marks in ink on the page colour, and with no gradient, no shadow and no glow.
8. THE Tuning_Line SHALL be hidden from screen readers (`aria-hidden="true"`), and the section number SHALL also be present in the heading text or in an attribute that does not change the heading's accessible name.
9. WHILE the viewport is at least 60em wide, THE Front_Page SHALL place Sections 6 and 7 side by side, and WHILE it is narrower, THE Front_Page SHALL stack them with Section 6 first.
10. THE Front_Page SHALL show Section 5 as three points on a line, with the pull quote and its attribution and Source_Link below.
11. THE Front_Page SHALL size all text in `rem`, SHALL keep every text at 0.875rem or larger, and SHALL stay usable at 200% text size.
12. THE Front_Page SHALL use no animation, and under `prefers-reduced-motion: reduce` SHALL use no transition.

### Requirement 6: Pictures, captions and alt text

**User Story:** As a visitor, I want the pictures shown with their credit, so that I can see where each one comes from and use my own language to understand them.

#### Acceptance Criteria

1. THE Front_Page SHALL show `fani-before.webp` and `fani-after.webp` side by side in the Case_Card on a wide screen and stacked on a phone, with the caption "City lights around Bhubaneswar and Cuttack, before and after Cyclone Fani." followed by the credit line of each picture from the Credits_File.
2. THE Front_Page SHALL show `illustration-phone.webp` in Section 4 with the caption "AI-generated illustration".
3. THE Front_Page SHALL show `acoustic-coupler.webp` with the 1970s point of Section 5, with the credit line from the Credits_File.
4. THE Front_Page SHALL use each Picture as it is, with no crop, filter or resize in code, and with width and height attributes so the page does not shift while it loads.
5. THE Front_Page SHALL draw each Picture with a 12 px corner radius and a width no larger than the Text_Column.
6. THE Caption of each Picture SHALL give the credit and the licence exactly as the Credits_File states, in the muted colour on the page background, and SHALL not be placed on a panel.
7. THE Caption credit link SHALL be an ordinary link to the address in the Credits_File, and the `illustration-phone.webp` caption SHALL show the caption "AI-generated illustration" with no link.
8. THE Front_Page SHALL give each Picture an `alt` text in English and in Hindi, taken from the Language_Files and describing what the picture shows, and WHEN the Chosen_Language changes THE Front_Page SHALL change the `alt` text with it.
9. IF a Picture fails to load, THEN THE Front_Page SHALL show its `alt` text and Caption and keep the layout readable.

### Requirement 7: Offline, size and no other sites

**User Story:** As a visitor who loaded the page once, I want the front page, its pictures and the demo to work with no network, so that the page keeps every promise the app makes.

#### Acceptance Criteria

1. THE File_List SHALL include the Front_Page HTML, its CSS and JavaScript, and the four Pictures, so that the Front_Page opens with its pictures with no network after one visit.
2. THE offline build SHALL no longer classify Front_Page_Images as Excluded_Files, and SHALL keep the `sound-test/` folder, the service worker file, `offline-files.json` and source maps excluded.
3. THE build SHALL pass the Offline_Check, and the total size of the File_List SHALL be at most the Size_Limit of 2097152 bytes.
4. IF the total size of the File_List exceeds the Size_Limit, THEN THE build SHALL fail with a message that names the total, the limit and the largest file.
5. THE Front_Page SHALL load no font, script, image, style sheet, map, frame or video from another origin, and SHALL not contact any address other than its own (Promise 4).
6. THE Front_Page SHALL carry Source_Links as ordinary `<a href>` links to other sites, which the Offline_Check already allows, and SHALL load nothing from those sites.
7. FOR ALL built files of the Front_Page, THE Offline_Check SHALL find no reference to another origin outside an `<a href>` link, so that a new picture, script or style cannot bring a request to another site.
8. THE Front_Page SHALL work at the root of a domain and under a sub-path, with every asset path and the Listen_URL derived from the Vite `base`.
9. THE Front_Page SHALL register the service worker as it does today.
10. THE Front_Page SHALL not show the Offline_Line, as offline decision 3 says.
11. THE changes to the offline spec's files that criteria 1 and 2 need SHALL be the smallest change that moves the four Pictures from the Excluded_Files to the File_List, and THE offline spec's report and tests SHALL be updated to say that offline decision 5 is reversed.
12. THE built site SHALL contain the QR_Library inside its own JavaScript files, with no reference to any CDN or other origin, and the Offline_Check SHALL pass with it.

### Requirement 8: Promises, limits and credits sections

**User Story:** As a visitor, I want the promises and the limits stated plainly and the sources named, so that I can trust what the page claims.

#### Acceptance Criteria

1. THE Front_Page SHALL show the six promises of Section 6 as a numbered list in the words of the Content_File.
2. THE Front_Page SHALL show the seven points of Section 7 in the words of the Content_File, with each Source_Link next to its point.
3. WHEN Section 7 gives the tested distances, THE Front_Page SHALL take them from the Diary_File and show them in metres with feet in brackets, as "2.4 m (8 ft), heard every time" and "6.4 m (21 ft), next room through an open doorway, 3 of 4 alerts received", with the feet figure as in the Diary_File and the metres rounded to one decimal.
3a. WHEN Section 7 gives the tested distances, THE Front_Page SHALL name what played the sound as the Diary_File does ("a MacBook Pro M4 through its built-in speakers at full volume, about 85 dB") and the phone that heard it ("a Samsung Galaxy S25 Ultra"), and SHALL say that these were informal tests.
4. THE Front_Page SHALL write "Radio: not tested yet." and "Loudspeaker: not tested yet." in Section 7, because the Diary_File holds no radio or loudspeaker result.
5. THE Front_Page SHALL carry the distances, the device names and the "not tested yet" lines of Section 7 as static page text, and a test SHALL parse the Diary_File and fail WHEN any of those distances, devices or "not tested yet" lines differs from the Diary_File, so that the page and the diary cannot drift apart.
6. THE Front_Page SHALL show in Section 8 the links "Listen", "Broadcast" and "GitHub" to `https://github.com/vedas-dixit/dead-air`.
7. THE Front_Page SHALL name in Section 8 the font "IBM Plex Mono" with the licence "OFL-1.1", the sound library "ggwave" with the licence "MIT" and the QR library "qrcode-generator" with the licence "MIT", each taken from the `license` field of the installed package, and SHALL list the Picture credits of the Credits_File.
8. THE Front_Page SHALL end with the last line of the Content_File: "Dead Air is a prototype and a backup channel. Always follow official alerts."
9. THE Front_Page SHALL show the six promises and the limits in Hindi as well as English, with each Hindi text listed in the Hindi_Check.

### Requirement 9: Correctness tests for the promises

**User Story:** As the developer, I want tests that fail when the page could break a promise, so that the front page cannot show a false or unmarked alert or contact another site.

#### Acceptance Criteria

1. FOR ALL sent times and Demo_Alert builds, THE Demo_Player SHALL produce bytes that decode, pass the check and carry `test` equal to true, so that Promise 3 holds (property test).
2. FOR ALL Demo_Alert builds, THE decoded alert SHALL have a sent time equal to the device clock at the tap and a valid-for period of 1 hour, so that the Listen page treats the alert as current only inside that period (Promise 2, property test).
3. FOR ALL single changed bytes of the Demo_Alert's bytes, THE decoder SHALL reject the message, so that the demo cannot play a damaged alert as an alert (Promise 1, property test).
4. THE test suite SHALL check that every key the Front_Page uses exists in both Language_Files and that no Hindi value is empty, so that a missing text is found before it ships.
5. THE test suite SHALL check that the built `index.html` has no `src`, `href` on `<link>`, `srcset`, `url()` or `@import` that points to another origin (Promise 4).
6. THE test suite SHALL check that the four Pictures are in the File_List and that the File_List total is at most the Size_Limit.
7. THE test suite SHALL check that every `img` has a non-empty `alt` in English and in Hindi.
8. THE test suite SHALL check that the Dies_Element exists, holds only the word "dies", and has no style.
9. THE test suite SHALL use example tests and not property tests for the QR wrapper, the layout and the section order, because no Promise depends on them.
10. THE tests SHALL add no new tool and no headless-browser script, and the owner SHALL do the visual check at 360 px and at 60em in a real browser, in both languages and both themes.
