# Requirements Document

## Introduction

This is the look spec. It restyles the Listen page and the Broadcast page in the radio look and gives the front page placeholder the same base style. It replaces the earlier "Teletext look" (spec 8 in the work order). The look is described in `.kiro/steering/style-rules.md` (Style_Rules). `docs/design/mockup.png` is a rough sketch of the general arrangement. Where the sketch and the Style_Rules disagree, the Style_Rules win. The sketch shows three urgency levels, a LIVE badge and signal bars. The apps have none of these, and this spec does not add them.

This spec changes the interface only. It does not change what a page does. The message code, the sound link and the offline worker logic stay unchanged. Promises 1 to 6 stay intact.

This spec also closes the icon gap of promise 6. The Broadcast report (`.kiro/specs/broadcast-page/report.md`), the Listen requirements and the Languages report each recorded that alert-type icons were due in this spec.

Facts found in the code:
- `src/message-code/codes.ts` lists nine event types: `flood`, `cyclone`, `fire`, `earthquake`, `heatwave`, `landslide`, `medical`, `missing-person`, `all-clear`. This matches the nine events in the Style_Rules.
- English event names are in `src/broadcast/strings.en.ts` and Hindi names in `src/languages/strings.hi.ts`. Shipped languages are English and Hindi.
- `broadcast/index.html` picks the event with a `<select id="f-event">`. `listen/index.html` has a `<div id="level-meter" role="meter">` with a `level-bar` child.
- Neither app page has a stylesheet or a font today.
- The offline build (`build/offline-check.mjs`) fails when an app page asks for anything from another site. The offline file list has a 2 MiB limit. The allow-list in `src/offline/allow-list.ts` is empty for URLs.
- Three Languages tests forbid fonts: `tests/languages/offline-build.test.ts` (no font file in the file list, no `@font-face` in CSS), and `tests/languages/boundary.test.ts` check (c) (no `@font-face` or font file in the languages sources and the two page HTML files).
- The word "Teletext" appears in `docs/brief.md`, `.kiro/steering/product.md`, `docs/kiro-diary.md`, and in specs under `.kiro/specs/` (`languages`, `message-code`, `broadcast-page`, `listen-page`). `README.md` has no match. The diary and the report files of earlier specs are a record of what was true then, so this spec does not rewrite them.
- The `src/shared/ui/` folder and the `src/shared/ui/icons/` folder do not exist yet.

The user has approved the edits to files of other specs that the design lists as D1 to D5. They are: the arrival flash in `src/languages/dom/web-arrival.ts` and `tests/languages/arrival.test.ts` (D1); six new text keys in English and Hindi (D2); the Listen and Broadcast HTML, `main.ts`, `ids.ts`, `mount.ts` and `render.ts` files (D3); `vite.config.ts` and `tsconfig.json` (D4); `README.md` and `package.json` (D5). The user also approved the left-over Languages fixes in Requirements 20 to 23.

Files this spec owns: new `src/shared/ui/` (styles, icons, header helpers), new tests under `tests/look/`, and `.kiro/specs/radio-look/`. Approved edits to files of other specs are listed in Requirement 16. Any other edit to a file of another spec is raised as a question first.

## Glossary

- **Look**: the radio look described in the Style_Rules.
- **Style_Rules**: the file `.kiro/steering/style-rules.md`. It holds the colour tables, contrast ratios, shape, type, size, motion, header, icon and component rules. This spec refers to its sections by name and does not copy its values.
- **Mockup**: `docs/design/mockup.png`, a rough sketch of the general arrangement.
- **Listen_Page**: the page at `/listen`.
- **Broadcast_Page**: the page at `/broadcast`.
- **Front_Page**: the placeholder page at `/`.
- **App_Pages**: the Listen_Page and the Broadcast_Page.
- **Header**: the top bar of every page. It holds the app name, the Page_Switch and the Language_Switch.
- **Page_Switch**: the two-position slide switch of links between Listen and Broadcast.
- **Language_Switch**: the existing control that changes the shown language.
- **Shared_Header_Function**: the pure function that builds the Header markup for the Listen_Page and the Broadcast_Page only.
- **Needs_Human_Check**: the state of a Hindi text that the user has not yet read and approved. The Hindi texts added by this spec stay in this state until the user reads them, and are listed in `docs/translation-check.md`.
- **Front_Page_Links**: two plain pill links in the Front_Page Header, one labelled Listen and one labelled Broadcast, with no knob and no selected position.
- **Language_Slot**: an empty space in the Front_Page Header, reserved for a language switch that the front-page spec adds later.
- **Promise_Tests**: every test that guards one of the six promises of `.kiro/steering/promises.md`.
- **Protected_Tests**: every test under `tests/message-code/` and `tests/sound-link/`, and every test file of those two modules wherever it sits.
- **Theme**: the light theme or the night theme. The night theme follows `prefers-color-scheme: dark`.
- **Theme_Tokens**: the CSS custom properties that hold every colour of a Theme.
- **Contrast_Test**: an automated test that computes every colour pair of the Style_Rules contrast tables from the shipped CSS.
- **Event_Types**: the nine alert event types: flood, cyclone, fire, earthquake, heatwave, landslide, medical emergency, missing person, all clear.
- **Event_Icon**: one SVG file for one Event_Type, stored in `src/shared/ui/icons/`.
- **Event_Name**: the translated visible text name of an Event_Type.
- **Event_Picker**: the control on the Broadcast_Page that chooses the Event_Type.
- **Event_Tile**: one cell of the Event_Picker, holding an Event_Icon and an Event_Name.
- **Test_Toggle**: the control on the Broadcast_Page that sets the TEST flag of an alert.
- **Go_On_Air_Button**: the control on the Broadcast_Page that starts the broadcast.
- **On_Air_Lamp**: the orange lamp on the Go_On_Air_Button while sound plays.
- **Speaker_Grille**: the round grille of dots on the Listen_Page that shows the live sound level. It replaces the level bar.
- **Alert_Card**: one alert shown on the Listen_Page.
- **Test_Banner**: the full-width bar on a card of a test alert.
- **Expired_Card**: an Alert_Card of an alert that is no longer current.
- **Arrival_Flash**: the 24 px frame flash shown when a new alert arrives.
- **Bundled_Font**: the font family IBM Plex Mono, weights 400 and 600, from the `@fontsource/ibm-plex-mono` package, served from this site.
- **Font_Files**: the woff2 files of the Bundled_Font and the package's licence file shipped with them.
- **Offline_File_List**: the list of files the service worker saves on the first visit (`dist/offline-files.json`).
- **Reduced_Motion**: the user setting `prefers-reduced-motion: reduce`.
- **Reference_Phone**: a viewport of 360 by 640 px at default text size.
- **Languages_Font_Tests**: the three font checks named in the Introduction.
- **Placed_Text**: any alert text that comes from a received message, including place names, and any other piece of alert text shown on a page.
- **Read_Aloud_Button**: the button on an Alert_Card that starts or stops reading the alert aloud.
- **Voice_Notes**: the help, missing-voice and error lines inside the `[data-read]` block of an Alert_Card.
- **Noise_Property_Test**: Property 5 in `tests/ears/noise.property.test.ts`.
- **Behaviour_Tests**: all Vitest tests that exist before this spec starts, other than the Languages_Font_Tests.

## Requirements

### Requirement 1: The look is shared by all pages

**User Story:** As a listener or a sender, I want every page to look like one radio, so that I know I am in the same app on any page.

#### Acceptance Criteria

1. THE Look SHALL apply to the Listen_Page, the Broadcast_Page and the Front_Page from one shared stylesheet in `src/shared/ui/`.
2. THE stylesheet SHALL define every colour of the Style_Rules colour table as a Theme_Token, once for the light Theme and once for the night Theme.
3. THE stylesheet SHALL name no hex colour value outside the Theme_Token definitions, except the Signal orange value that the Style_Rules fix for an Event_Icon.
4. WHILE the device reports `prefers-color-scheme: dark`, THE App_Pages and the Front_Page SHALL use the night Theme with the same shapes, sizes and layout as the light Theme.
5. THE App_Pages and the Front_Page SHALL provide no manual Theme control.
6. THE stylesheet SHALL use the 12 px corner radius for every tile, card, field and panel, full pills for buttons and switches, and a straight bar with no radius for the Test_Banner.
7. THE stylesheet SHALL contain no shadow, gradient, blur, texture or decorative image.
8. THE stylesheet SHALL draw a 3 px solid focus ring with a 3 px gap on every focusable control, in ink for the light Theme and paper for the night Theme.
9. THE stylesheet SHALL use orange only for the uses listed in the Style_Rules colour section.
10. THE stylesheet SHALL give every orange lamp a 3 px ring and place a text state beside the lamp.

### Requirement 2: Colour contrast is tested

**User Story:** As a person with weak eyesight, I want text and signs to stay readable in both themes, so that I can read an alert in a bad moment.

#### Acceptance Criteria

1. THE Contrast_Test SHALL read the Theme_Token values from the shipped CSS and compute the WCAG 2.x contrast ratio of every pair in the Style_Rules light table and night table.
2. IF a pair that the Style_Rules mark as passing falls below 4.5:1 for text, 3:1 for text at 24 px and above, or 3:1 for a shape that carries meaning, THEN THE Contrast_Test SHALL fail and name the pair and the Theme.
3. THE Contrast_Test SHALL confirm that each pair that the Style_Rules mark "Fails by design" or "Forbidden pair" is not used for text in the shipped CSS.
4. THE Contrast_Test SHALL confirm that the ratios computed from the shipped CSS match the ratios written in the Style_Rules to within 0.05.
5. THE stylesheet SHALL set the muted text colour only on the page background and, in the night Theme, on the expired panel.
6. THE stylesheet SHALL set the olive colour only on shapes, never on text.

### Requirement 3: Header on every page

**User Story:** As a user, I want the same header on each page, so that I can move between Listen and Broadcast and change language without searching.

#### Acceptance Criteria

1. THE Header SHALL appear on the Listen_Page, the Broadcast_Page and the Front_Page.
2. THE Header of each App_Page SHALL show the app name, then the Page_Switch, then the Language_Switch, in that order.
3. THE Page_Switch SHALL be two real links, one to `/listen` and one to `/broadcast`, resolved against the Vite `base` setting.
4. THE Page_Switch SHALL draw a pill track with a round knob and a text label for both positions.
5. THE Page_Switch SHALL show the current page by the knob position and by text, not by colour alone.
6. WHEN scripts are not running, THE Page_Switch SHALL still work as two links.
7. THE Page_Switch SHALL be usable with the keyboard, with a visible focus ring on each link.
8. THE Page_Switch and the Language_Switch SHALL each have touch targets of at least 48 by 48 px with at least 8 px between neighbours.
9. THE Header of the Front_Page SHALL show the app name and the Front_Page_Links, and SHALL NOT show the Page_Switch or a Language_Switch.
10. THE Front_Page_Links SHALL be two real links to `/listen` and `/broadcast`, resolved against the Vite `base` setting, drawn as full pills with a text label and with touch targets of at least 48 by 48 px and at least 8 px between them.
11. THE Header of the Front_Page SHALL keep the Language_Slot at the end of the Header, so that the front-page spec can add a language switch without a change to the Header layout.
12. THE Language_Slot SHALL hold no control, no text and no focusable element in this spec.
13. THE Shared_Header_Function SHALL build the Header of the Listen_Page and the Broadcast_Page only.
14. THE Header of the Front_Page SHALL be static HTML written in `index.html`, holding the app name and the Front_Page_Links, so that the Front_Page Header works with scripts off.

### Requirement 4: Event icons

**User Story:** As a listener who cannot read well or is in a hurry, I want a clear picture beside the event name, so that I know the kind of alert at a glance.

#### Acceptance Criteria

1. THE System SHALL provide exactly one Event_Icon file for each of the nine Event_Types in `src/shared/ui/icons/`, named by the Event_Type id.
2. THE Event_Icon SHALL use a 48 by 48 `viewBox`.
3. THE Event_Icon SHALL use `fill="currentColor"` for its main shapes.
4. THE Event_Icon SHALL draw each cut-out as a real hole using `fill-rule="evenodd"`, not as paint.
5. THE Event_Icon SHALL contain at most one orange part, with the Signal orange value in every Theme and state.
6. THE Event_Icon SHALL contain no gradient and no stroke thinner than 2 px at 32 px size.
7. THE Event_Icon SHALL read from its ink shape without the orange part.
8. THE Event_Icon of each Event_Type SHALL follow the idea listed for it in the Style_Rules icon table.
9. WHEN an Event_Icon is shown, THE page SHALL show the Event_Name as visible text next to it.
10. THE page SHALL mark each shown Event_Icon `aria-hidden="true"`.
11. THE build SHALL inline or bundle each Event_Icon so that `currentColor` follows the page Theme, and THE page SHALL request no icon from another site.
12. WHERE the build bundles Event_Icons into the JavaScript, THE source SHALL keep each Event_Icon as its own SVG file in `src/shared/ui/icons/`.
13. WHEN the Event_Icons are shown at 32 px, THE nine Event_Icons SHALL be distinct from each other, checked by a reviewed image sheet recorded in the report.
14. THE icon test SHALL confirm that each of the nine files exists, uses `currentColor`, has `fill-rule="evenodd"` where it has a hole, has at most one orange part and has no gradient.
15. THE icon test SHALL confirm that the Event_Types in `src/message-code/codes.ts` and the icon files are the same set, so that a new Event_Type without an Event_Icon fails the test.
16. THE pages SHALL insert an Event_Icon as markup only from the SVG files of this spec, and SHALL insert every Placed_Text, including place names, as text only.
17. A test SHALL feed Placed_Text that contains markup characters, such as `<img src=x onerror=1>` and `<svg onload=1>`, through the Alert_Card and the preview, and SHALL confirm that the page holds the characters as text and creates no element from them.
18. A test SHALL confirm that the only code path that assigns markup to the page is the Event_Icon insertion, and that it takes its input from the bundled icon strings.

### Requirement 5: Every alert type has an icon and text in every language

**User Story:** As a listener, I want each alert type shown with a picture and a name in my language, so that promise 6 holds.

#### Acceptance Criteria

1. FOR ALL Event_Types and FOR ALL shipped languages, THE System SHALL provide an Event_Name and an Event_Icon.
2. THE Listen_Page SHALL show the Event_Icon and the Event_Name on every Alert_Card.
3. THE Broadcast_Page SHALL show the Event_Icon and the Event_Name on every Event_Tile.
4. THE Broadcast_Page SHALL show the Event_Icon and the Event_Name in the preview of the alert.
5. IF an Event_Type has no Event_Icon or no Event_Name in a shipped language, THEN THE icon test SHALL fail and name the Event_Type and the language.
6. WHEN this spec is complete, THE report SHALL record that the icon gap of promise 6 is closed.

### Requirement 6: Broadcast event picker

**User Story:** As a sender, I want to pick the event from big tiles, so that I choose quickly and without a mistake.

#### Acceptance Criteria

1. THE Event_Picker SHALL show the nine Event_Types as a grid of Event_Tiles, each with an Event_Icon and an Event_Name.
2. THE Event_Picker SHALL be a group of radio buttons inside a `fieldset` with a `legend` that carries the translated "event" label.
3. WHEN the user presses an arrow key while an Event_Tile has focus, THE Event_Picker SHALL move the choice to the neighbouring Event_Tile.
4. THE Event_Picker SHALL let a screen reader announce the Event_Name, the position in the group and the selected state of each Event_Tile.
5. WHEN an Event_Tile is selected, THE Event_Tile SHALL show the inverted selected style of the Style_Rules in both Themes, with the round dot in its corner.
6. THE Event_Tile SHALL have a touch target of at least 48 by 48 px, with at least 8 px between neighbours.
7. THE Event_Picker SHALL feed the same form value `event` as the previous drop-down, so that the form validation, the preview, the "say this first" line, the message code input and the saved station values behave as before.
8. WHEN the form is reset or restored from a saved station, THE Event_Picker SHALL show the restored Event_Type as selected, or no tile selected when the form has no event.
9. WHEN the language changes, THE Event_Picker SHALL show the Event_Names in the new language and keep the selected Event_Type.
10. IF the form is submitted with no Event_Type chosen, THEN THE Broadcast_Page SHALL show the same "choose an event" error as before.

### Requirement 7: Broadcast test toggle and Go on air

**User Story:** As a sender, I want a clear test switch and a big Go on air button, so that I never send a real alert by mistake and always see when I am on air.

#### Acceptance Criteria

1. THE Test_Toggle SHALL be a pill switch with a text state "TEST ON" or "TEST OFF" in the shown language.
2. WHILE the TEST flag is on, THE Test_Toggle SHALL show an orange lamp with its ring.
3. THE Test_Toggle SHALL be usable with the keyboard and SHALL announce its state to a screen reader.
4. THE Go_On_Air_Button SHALL be the largest control on the Broadcast_Page and SHALL span the full width of the content.
5. THE Go_On_Air_Button SHALL sit in the lower half of the screen on the Reference_Phone.
6. WHILE sound plays, THE Go_On_Air_Button SHALL show the On_Air_Lamp with its ring and a text state.
7. WHILE sound does not play, THE Go_On_Air_Button SHALL show no On_Air_Lamp.
8. THE preview SHALL show the Test_Banner whenever the TEST flag is on, as before.

### Requirement 8: Listen speaker grille

**User Story:** As a listener, I want to see the sound level on a round grille, so that I know the phone is hearing something.

#### Acceptance Criteria

1. THE Listen_Page SHALL show the Speaker_Grille in place of the level bar. The Speaker_Grille is a round grille of dots whose lit dots show the live sound level.
2. THE Speaker_Grille SHALL keep `role="meter"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` and a translated `aria-label`.
3. THE Speaker_Grille SHALL give a screen reader a text value of the level.
4. THE Speaker_Grille SHALL redraw at most 15 times in any one second.
5. WHILE Reduced_Motion is set, THE Speaker_Grille SHALL keep showing the level and SHALL change at most 2 times in any one second, with no easing.
6. THE Speaker_Grille SHALL use no transition or animation of its own.
7. WHILE the page is not listening, THE Speaker_Grille SHALL show no lit dot and SHALL redraw no frames.
8. WHILE the page is listening, THE Listen_Page SHALL show the orange listening lamp with its ring beside a text state.
9. THE Listen_Page SHALL keep the same level values, the same update source and the same stop and start behaviour as before. Only the drawing changes.
10. A test SHALL drive the Speaker_Grille with level changes faster than 15 per second and count the redraws, once without Reduced_Motion and once with it.

### Requirement 9: Listen layout and controls

**User Story:** As a listener holding a phone in one hand, I want the newest alert and the Start button where my thumb and eyes are, so that I can read the alert without scrolling.

#### Acceptance Criteria

1. WHEN an alert has arrived, THE Listen_Page SHALL show, with no scrolling, on the Reference_Phone at default text size, the Test_Banner when the alert is a test, the icon tile, the Event_Name and the sentence line of the newest Alert_Card.
2. WHEN an alert has arrived, THE Listen_Page SHALL shrink the Speaker_Grille to a compact strip.
3. THE Listen_Page SHALL allow the rows below the sentence line of the newest Alert_Card to need a scroll, and SHALL add no Details fold or hidden card content.
4. WHERE the Start and Stop control sits in a bar fixed to the bottom of the screen, THE Listen_Page SHALL leave room so that the bar never covers a card.
5. THE Start and Stop control SHALL sit in the lower half of the screen on the Reference_Phone and SHALL have a touch target of at least 48 by 48 px.
6. THE Listen_Page SHALL keep the "Dead air. Last heard N min ago." line and the history as before.
7. THE layout check SHALL run at the Reference_Phone viewport in English and in Hindi, SHALL confirm the parts named in criterion 1, and SHALL record the result in the report.

### Requirement 10: Alert card

**User Story:** As a listener, I want the alert to read big and clear, so that I get the kind of danger first and the details after.

#### Acceptance Criteria

1. THE Alert_Card SHALL show, in this order, the Test_Banner when the alert is a test, a large icon tile with the Event_Icon, the Event_Name in large type, then the remaining fields of the card as before.
2. THE Alert_Card SHALL show the sent time of the alert in plain text (promise 2).
3. THE Alert_Card SHALL set the Event_Name at 2rem or larger.
4. THE Alert_Card SHALL use the panel colour of the active Theme.
5. WHEN the alert is a test alert, THE Alert_Card SHALL show the Test_Banner as the first element, as a full-width orange bar with ink text (promise 3).
6. THE Test_Banner SHALL appear on every test alert, on every Alert_Card, in every language, on every page that shows the alert, including the Broadcast_Page preview.
7. WHEN the alert is no longer current, THE Alert_Card SHALL become an Expired_Card with the expired panel colour of the active Theme.
8. THE Expired_Card SHALL show a visible "no longer current" label in the shown language.
9. THE Expired_Card SHALL use ink text in the light Theme and paper text in the night Theme at full contrast, with no strike-through on any part.
10. THE Expired_Card SHALL keep the sent time as plain, easy to read text.
11. THE Alert_Card SHALL show its state (current, expired, test) by text and shape as well as by panel colour.
12. THE decision whether an alert is expired SHALL stay in the existing code that compares the sent time and the valid-for period with the device clock. The Look SHALL add no second rule.
13. IF the check value of a received message fails, THEN THE Listen_Page SHALL show nothing from that message, as before (promise 1).

### Requirement 11: Arrival flash

**User Story:** As a listener who is not looking at the phone, I want a clear flash when an alert arrives, so that I notice it.

#### Acceptance Criteria

1. WHEN a new alert arrives, THE Listen_Page SHALL show the Arrival_Flash as a 24 px frame round the screen edge with an orange band and an ink band.
2. WHILE the night Theme is active, THE Arrival_Flash SHALL use a paper band in place of the ink band.
3. THE Arrival_Flash SHALL show no more than 3 flashes in any one second.
4. WHILE Reduced_Motion is set, THE Listen_Page SHALL show no Arrival_Flash.
5. THE Arrival_Flash SHALL use the existing flash gate and keep the existing limits of the Languages spec (no more than 3 pulses in any 1 second window).
6. THE Arrival_Flash SHALL cover no text and SHALL NOT block taps on the page.
7. THE vibration of a new alert SHALL stay as the Languages spec set it.

### Requirement 12: Bundled font

**User Story:** As a user on a phone with no network, I want the page to look right offline, so that the font does not depend on any other site.

#### Acceptance Criteria

1. THE System SHALL add `@fontsource/ibm-plex-mono` as a dev dependency, with the approval already given by the user.
2. THE build SHALL copy the Latin subset woff2 files for weights 400 and 600 of IBM Plex Mono, unmodified and unrenamed in content, into the build output, served from this site.
3. THE Font_Files SHALL total at most 60 KB (61 440 bytes), woff2.
4. THE stylesheet SHALL declare the Bundled_Font with `@font-face` and a `unicode-range`, so that Devanagari characters never use the Bundled_Font.
5. THE stylesheet SHALL set Hindi text in the system UI font stack.
6. THE stylesheet SHALL declare no other font family from a file and SHALL load no font from another site and no font loader script.
7. THE build SHALL ship the package's `LICENSE` text and copyright line in the build output next to the Font_Files.
8. THE `README.md` SHALL record the licence name (SIL Open Font License 1.1), the source package and the package version.
9. THE build SHALL load the Bundled_Font with a font-display value that shows text at once in the fallback font, so that no text is hidden while the font loads.
10. THE font check SHALL confirm every `src` of every `@font-face` in the shipped CSS is a path on this site that exists in the build output.
11. IF the two Latin woff2 files of weights 400 and 600 total more than 60 KB (61 440 bytes), THEN THE System SHALL stop work and report the two file sizes to the user before any further step.

### Requirement 13: Type and size

**User Story:** As a person who has set a large text size on my phone, I want the pages to follow it, so that I can read and tap everything.

#### Acceptance Criteria

1. THE stylesheet SHALL set every font size in `rem`.
2. THE stylesheet SHALL set body text at 1.125rem or larger, labels at 0.875rem or larger, and Alert_Card Event_Names at 2rem or larger.
3. THE page SHALL NOT set `user-scalable=no`, `maximum-scale` or a text-size lock.
4. THE stylesheet SHALL set small labels in capitals with 0.12em letter spacing.
5. WHILE the shown language is Hindi, THE stylesheet SHALL set capitalisation off and letter spacing to 0 for labels, using `:lang(hi)`, and SHALL set a line height of at least 1.5.
6. THE App_Pages SHALL use no fixed-height text box and clip no line, in English and in Hindi.
7. WHILE the text size is 200 percent, THE App_Pages SHALL keep every control reachable and every text readable with no overlap and no horizontal scrolling at the Reference_Phone width.
8. THE stylesheet SHALL give every tile, switch position, the Language_Switch and every button a touch target of at least 48 by 48 px with at least 8 px between neighbours.
9. THE stylesheet SHALL use no font weight below 400.
10. THE report SHALL record the 200 percent text size check in English and in Hindi, with the result of each, or state which part was not checked.

### Requirement 14: Motion

**User Story:** As a user who is sensitive to motion, I want the app to move only when it shows something real, so that I am not distracted or made ill.

#### Acceptance Criteria

1. THE stylesheet and scripts SHALL animate only sound arriving, a broadcast playing, or a state change the user caused.
2. WHILE the Listen_Page is listening, THE page SHALL draw no more than 15 times in any one second.
3. WHILE Reduced_Motion is set, THE pages SHALL run no transition, no animation and no easing, except the Speaker_Grille level stepping of Requirement 8.
4. THE pages SHALL contain no decorative animation, no looping spinner and no animated background.
5. A test SHALL read the shipped CSS and fail if a `transition` or `animation` rule is outside a `prefers-reduced-motion: no-preference` block or an equivalent guard.

### Requirement 15: Offline and no other site

**User Story:** As a listener with no network, I want the new look to work offline after the first visit, so that the app still looks and works in an emergency.

#### Acceptance Criteria

1. THE Offline_File_List SHALL include every Font_File, the licence file and the JavaScript file that holds the nine Event_Icons, or each Event_Icon file where the build writes one.
2. THE offline build check SHALL pass with the Look added.
3. THE total size of the Offline_File_List SHALL stay within the existing 2 MiB limit.
4. THE App_Pages SHALL request nothing from another site (promise 4).
5. THE App_Pages SHALL NOT load any image of the Front_Page.
6. THE Offline_File_List SHALL stay small: the Look SHALL add no image file other than the nine Event_Icons, and the Font_Files.
7. THE Look SHALL leave the worker logic, the file list rules and the allow-list in `src/offline/` unchanged. Only the build output's file contents change.
8. IF a Font_File, the licence file or the drawing of an Event_Icon is missing from the Offline_File_List, THEN THE offline test SHALL fail and name the file or the Event_Type.
9. WHEN the network is off after the first visit, THE App_Pages SHALL show the Bundled_Font and the Event_Icons from the saved copy.

### Requirement 16: Wording change and approved edits to other specs

**User Story:** As the project owner, I want the docs to say "the radio look" and the font tests to allow the one font, so that the files agree with the product.

#### Acceptance Criteria

1. THE System SHALL replace "Teletext look" with "the radio look" and "Teletext style" with "radio look" in `docs/brief.md` and `.kiro/steering/product.md`, as a wording change only.
2. THE System SHALL replace the sentence about the old tech in `docs/brief.md` and `.kiro/steering/product.md` with exactly: "The old tech it revives is the modem screech and data broadcast over radio. It wears the face of a mid-century radio."
3. THE System SHALL update every forward-looking mention of "Teletext look" or "spec 8" that names the look in the `requirements.md` and `design.md` files of `.kiro/specs/languages/`, `.kiro/specs/message-code/`, `.kiro/specs/broadcast-page/` and `.kiro/specs/listen-page/`, as a wording change only.
4. THE System SHALL update a mention in a `tasks.md` file only where the mention is forward-looking, and SHALL leave every task marked done unchanged.
5. THE System SHALL NOT edit any existing text of `docs/kiro-diary.md` and SHALL NOT edit any `report.md` file of an earlier spec.
6. THE System SHALL add one new entry to `docs/kiro-diary.md` for this spec, as an addition after the existing entries, stating that the Teletext look became the radio look, and why: the look is a style and not a revived technology, and it wears the face of a mid-century radio.
7. THE System SHALL leave the work order numbering in `docs/brief.md` and `.kiro/steering/product.md` unchanged, with item 8 reading "The radio look".
8. THE System SHALL find every file to change by searching the repository for "Teletext" outside `node_modules`, `dist`, `build`, `docs/kiro-diary.md` and the `report.md` files of earlier specs, and SHALL record the list of changed files in the report.
9. THE System SHALL change the Languages_Font_Tests so that they allow exactly one font family, the Bundled_Font in weights 400 and 600, served from this site, and keep forbidding any other font file, any `@font-face` for another family, any font from another site and any font host.
10. THE changed Languages_Font_Tests SHALL fail for a font file from any other family, for a third weight of the Bundled_Font, and for any font URL that points to another site.
11. THE System SHALL make no other edit to the Languages_Font_Tests and no edit to the other Languages tests, except as Requirement 18 allows.
12. THE System SHALL record in the report each file of another spec that this spec edited.
13. THE System SHALL edit no file of another spec beyond Requirements 6, 8, 9, 10, 11, 12, 16, 18 and 20 to 23 and the approved edits D1 to D5 named in the Introduction without first asking.
14. THE System SHALL record each Hindi text added by this spec as Needs_Human_Check in `docs/translation-check.md`.

### Requirement 17: Front page placeholder

**User Story:** As a visitor, I want the front page placeholder to match the apps, so that the site feels like one thing until the real front page arrives.

#### Acceptance Criteria

1. THE Front_Page placeholder SHALL use the same shared stylesheet, the Theme_Tokens, the Bundled_Font and the shapes as the App_Pages, with the Front_Page Header of Requirement 3.
2. THE Front_Page placeholder SHALL load no app code.
3. THE Front_Page placeholder SHALL load no file from another site.
4. THE Front_Page placeholder SHALL change no text beyond what the Header needs.
5. WHERE the Front_Page loads its own images, THE images SHALL come from this site and THE App_Pages SHALL NOT load them.

### Requirement 18: No change of behaviour

**User Story:** As the project owner, I want this spec to change looks only, so that the earlier specs stay correct.

#### Acceptance Criteria

1. THE System SHALL leave `src/message-code/`, `src/sound-link/` and the worker logic of `src/offline/` unchanged.
2. WHEN the Behaviour_Tests run after this spec, THE Behaviour_Tests SHALL pass, except where a test checks the markup that Requirements 6, 8 and 10 replace (the drop-down, the level bar and the card layout).
3. IF a Behaviour_Test must change because of replaced markup, THEN THE System SHALL change that test so that the new assertion checks the same behaviour on the new markup (the Broadcast radio group, the Speaker_Grille or the Alert_Card layout).
4. THE System SHALL NOT weaken any Promise_Test, meaning the changed Promise_Test SHALL fail for every input for which the earlier version failed, and SHALL keep every input and every case of the earlier version.
5. IF a change to a Promise_Test cannot keep it at least as strict as before, THEN THE System SHALL stop and ask before the change.
6. THE System SHALL NOT edit any Protected_Test, and SHALL NOT edit any file under `src/message-code/` or `src/sound-link/`.
7. THE report SHALL list each changed test, the reason, the old assertion and the new assertion, and SHALL state for each changed Promise_Test why it is not weaker.
8. THE promises 1 to 6 SHALL hold after this spec: a damaged alert is never shown, an expired alert is never shown as current, a test alert always shows the Test_Banner, the App_Pages contact no other site, microphone audio stays in memory and is discarded, and every Event_Type has an icon and text in every shipped language.
9. THE Look SHALL add no urgency level, no LIVE badge and no signal bars from the Mockup.
10. THE UI text added by this spec SHALL use plain words and no emoji, and every added text SHALL exist in every shipped language.
11. THE six new text keys (`nav.switch.listen`, `nav.switch.broadcast`, `switch.test.on`, `switch.test.off`, `btn.onair`, `card.expired`) SHALL have English text and Hindi text in the same everyday style as the existing Hindi strings.
12. THE Look SHALL add no UI framework and no dependency other than `@fontsource/ibm-plex-mono`.
13. THE Look SHALL change no file of another spec for the arrival flash other than `src/languages/dom/web-arrival.ts` and `tests/languages/arrival.test.ts`, and SHALL keep `FLASH_PLAN`, `planFlash` and `decideArrival` unchanged.
14. THE `npm run typecheck`, `npm run build` and `npx vitest --run` commands SHALL pass.

### Requirement 19: Report

**User Story:** As the project owner, I want a short report of what was done and what was checked on a real phone, so that I know what is still unchecked.

#### Acceptance Criteria

1. THE System SHALL write `.kiro/specs/radio-look/report.md` when the spec is complete.
2. THE report SHALL record the results of `npx vitest --run`, `npm run typecheck` and `npm run build`.
3. THE report SHALL record, for each of the checks on a real phone (Reference_Phone layout, 200 percent text size, Hindi layout, night Theme, Reduced_Motion, Arrival_Flash, offline look), either the result or "not run" with the reason.
4. THE report SHALL list every file of another spec that this spec edited, with the approval.
5. THE report SHALL record the closing of the icon gap of promise 6.
6. THE report SHALL list the Hindi texts that remain Needs_Human_Check.
7. THE report SHALL record the cause and the fix of the Noise_Property_Test failure (Requirement 22) and the diary entry added (Requirement 23).

### Requirement 20: Read aloud starts only from the button

**User Story:** As a listener, I want reading aloud to start or stop only when I tap its button, so that a tap on a help or error line does not start the voice by mistake.

#### Acceptance Criteria

1. WHEN the user taps the Read_Aloud_Button, THE Listen_Page SHALL start reading the Alert_Card aloud, or stop it when it is already reading.
2. WHEN the user taps a Voice_Note, THE Listen_Page SHALL leave the reading state unchanged.
3. WHEN the user taps any part of the `[data-read]` block other than the Read_Aloud_Button, THE Listen_Page SHALL leave the reading state unchanged.
4. THE click handler in `src/listen/dom/mount.ts` SHALL match the Read_Aloud_Button itself and not the whole `[data-read]` block.
5. A test SHALL tap the Read_Aloud_Button, each Voice_Note and a child element of the Read_Aloud_Button, and SHALL confirm that only the Read_Aloud_Button and its child change the reading state.

### Requirement 21: The name in Latin letters

**User Story:** As a Hindi-speaking listener, I want the app name written the same way on every page, so that I recognise it.

#### Acceptance Criteria

1. THE Hindi strings file SHALL write the name "Dead Air" in Latin letters in every string that holds the name, including `listen.page.title`.
2. THE `listen/index.html` file SHALL hold the static title text "Dead Air", the same as the Broadcast_Page.
3. THE markup test exception SHALL cover `listen.page.title` in the same way as it covers the Broadcast page title.
4. A test SHALL confirm that no Hindi string spells the app name in Devanagari letters.

### Requirement 22: Stable noise test

**User Story:** As the project owner, I want the test run before each deploy to be stable, so that a real failure is never hidden by a flaky one and a flaky one never blocks a deploy.

#### Acceptance Criteria

1. THE System SHALL run the Noise_Property_Test with at least 100 times its normal number of runs, with the seed printed, to reproduce the failure.
2. WHEN the failure is reproduced, THE System SHALL find the cause in the test or in the code that the test checks, and SHALL record the cause in the report.
3. THE System SHALL fix that cause.
4. THE System SHALL keep the Noise_Property_Test at the same strictness, with the same number of runs, the same generators and the same assertions, or stricter.
5. IF the cause is a defect in code under `src/message-code/` or `src/sound-link/`, THEN THE System SHALL stop and ask the user before any edit there.
6. WHEN the fix is done, THE Noise_Property_Test SHALL pass in at least 20 full runs of `npx vitest --run`.

### Requirement 23: Diary entry for the Languages spec

**User Story:** As the project owner, I want the diary to hold one entry for each spec, so that the story of the project is complete.

#### Acceptance Criteria

1. IF `docs/kiro-diary.md` has no entry for the Languages spec, THEN THE System SHALL add one, written from the files in `.kiro/specs/languages/` and from the git history.
2. THE System SHALL place the Languages entry before the entry of this spec, and SHALL leave the text of every existing entry unchanged.
3. THE Languages entry SHALL state only facts found in those files and in the git history.
4. IF `docs/kiro-diary.md` already has an entry for the Languages spec, THEN THE System SHALL leave the file unchanged for this requirement and say so in the report.
