# Requirements Document

## Introduction

This is spec 7 of 10, "Languages and read aloud". It adds Hindi next to English on the Listen page and the Broadcast page. The alert on the air is only codes (event, urgency, severity, action, times, place name), so each language builds the words and the full sentence from those codes with its own templates. Nothing about the message code or the sound changes. A listener hears one alert and reads it in the language chosen on that phone.

The spec has five parts:
1. A second language file (Hindi) with the same keys as English, covering every event, urgency, severity and action and all interface text on both app pages.
2. A first-visit choice from the phone's language settings, and a visible switch that changes the language at once and remembers the choice.
3. A "Read aloud" button on each Listen alert card, using the browser's built-in speech with a voice stored on the device only. The button is hidden when no such voice exists for the chosen language, and a short line about installing the voice is shown in its place when the language is not English.
4. A flash and a vibration when a new alert arrives, each with its own on/off setting. The two settings sit below the alert cards.
5. A test that fails when any text key is missing in any language, and the file `docs/translation-check.md` that lists every Hindi string as "checked" (found in a small reviewed list, with the exact text that was checked; this covers the sample sentences too) or "needs human check", with a count at the top.

Facts taken from the existing code that these requirements rely on:
- `src/broadcast/strings.types.ts` defines `Strings` (`labels` with `event`, `urgency`, `severity`, `action`, `status`, `validFor`, `field`, `decodeReason`, `audioReason`, `wavReason`, and `text`), the `TEXT_KEYS` list and the `PLACEHOLDERS` table. `src/broadcast/strings.en.ts` is the only language file. Both pages pass `stringsEn` once at mount (`src/broadcast/dom/mount.ts`, `src/listen/dom/mount.ts`), and the Offline_Line takes a `Strings` argument.
- The Listen card (`src/listen/card.ts`) and the Say_First line (`src/broadcast/say-first.ts`) already build text from codes and the `Strings` object. The card shows the alert as label and value rows and has no single sentence.
- The Listen page keeps `Alert` values (codes) in the History, so a stored alert can be shown again in another language.
- HTML text is filled from `data-text` attributes by `bindStaticText`. `listen/index.html` and `broadcast/index.html` have `lang="en"` and one `aria-label=""` on the level meter that the renderer fills.
- `src/shared/time.ts` writes times as `YYYY-MM-DD HH:MM UTC+hh:mm` with Latin digits. This spec keeps that format in both languages.
- `tests/broadcast/strings.test.ts` checks the English file only.
- The offline build (`build/offline-check.mjs`) fails the build when an app page asks for anything from another site, and the offline File_List has a 2 MiB limit.
- Promise 6 asks for an icon and text for every alert type in every shipped language. The alert-type icons belong to the Teletext look (spec 8). This spec delivers the text and records the icon gap in the Report_File (Requirement 14).

Files this spec owns: a new `src/languages/` folder, a new `tests/languages/` folder, `docs/translation-check.md`, the Reviewed_List, the generator script for that file under `tools/`, and `.kiro/specs/languages/`.

Files owned by other specs that this spec needs to edit. The user (project owner) has approved the edits to every file in the list below, including the small additions to the five `tsconfig` files, `package.json` and `.gitignore`, so no further approval is asked file by file. Each file gets the smallest edit that this spec needs, and the design lists each edit:
- `src/broadcast/strings.types.ts` and `src/broadcast/strings.en.ts` (spec 3): new text keys for the switch, Read aloud, the alert settings and the sentence templates.
- `src/broadcast/dom/mount.ts`, `src/broadcast/dom/render.ts`, `src/broadcast/controller.ts`, `broadcast/index.html` (spec 3): runtime language change and the switch.
- `src/listen/dom/mount.ts`, `src/listen/dom/render.ts`, `src/listen/card.ts`, `src/listen/ui-state.ts`, `src/listen/controller.ts`, `listen/index.html` (spec 4): the same, plus Read aloud and the arrival alert.
- `src/offline/dom/offline-line.ts` (spec 6): the Offline_Line follows the chosen language.
- The five `tsconfig` files that need the new `src/languages/` folder in their `include` list, `package.json` (only a script entry for the generator) and `.gitignore` (only if the new files need an entry): the user approved a small addition to each of these, and no other change to them.
- `src/message-code/`, `src/sound-link/` and `tools/ears/` (specs 1, 2, 5): not edited.

## Glossary

- **Language**: One shipped language. The shipped Languages are English (`en`) and Hindi (`hi`).
- **Language_Code**: The string `en` or `hi` that names a Language.
- **Language_File**: A module that exports one complete `Strings` object for one Language. English is `src/broadcast/strings.en.ts`. Hindi is `src/languages/strings.hi.ts`.
- **Language_Catalog**: The list of every Language_File with its Language_Code, its own name (`English`, `हिन्दी`) and its speech tag (`en`, `hi`).
- **Text_Key**: One entry of `TEXT_KEYS`, plus every code key inside `labels` (event, urgency, severity, action, status, validFor, field, decodeReason, audioReason, wavReason). Both kinds are "text keys" in this spec.
- **Template**: A string with `{name}` placeholders that a Language_File supplies and the code fills.
- **Alert_Sentence**: One full sentence for an `Alert`, built from the event, urgency, severity and action codes and the place name, using the Templates and labels of one Language.
- **Place_Name**: The `placeName` field of an `Alert`, exactly as sent.
- **Language_Switch**: The visible control on each app page that lets the person choose a Language.
- **Language_Store**: The `localStorage` entry `dead-air.language.v1` that holds the chosen Language_Code. Both app pages share it because they share one origin.
- **Chosen_Language**: The Language in use on a page. It is the Language_Store value when valid, otherwise the Device_Language, otherwise English.
- **Device_Language**: The first entry of `navigator.languages` (or `navigator.language` when the list is missing) whose primary subtag matches a Language_Code in the Language_Catalog.
- **Read_Aloud_Button**: The button labelled "Read aloud" (in the Chosen_Language) on an Alert_Card.
- **Spoken_Text**: The text the browser speaks for one Alert_Card (Requirement 8).
- **Local_Voice**: A speech voice with `localService` true whose `lang` matches the speech tag of the Chosen_Language by Requirement 7, criterion 17.
- **Voice_Help_Line**: The one small help line shown near the Read_Aloud_Button when the Chosen_Language is not English and a Local_Voice exists (Requirement 7).
- **Voice_Missing_Line**: The one short line shown where the Read_Aloud_Button would be when the Chosen_Language is not English and no Local_Voice exists (Requirement 7).
- **Sent_Age**: The time from the sent time of a Heard_Alert to the device time, in milliseconds, used only for the Spoken_Text.
- **Spoken_Age**: The announcer-style phrase for the Sent_Age (Requirement 8): "Sent just now.", "Sent {n} minutes ago.", "Sent {n} hours ago." or "Sent {n} days ago." in the Chosen_Language.
- **Settings_Area**: The block below the Alert_Card list that holds the Flash_Setting and the Vibrate_Setting switches.
- **Sample_Sentence**: One sample Alert_Sentence per event type that the Translation_Check_File lists (Requirement 13).
- **Reviewed_List**: A small file in the repository that holds, for each Hindi string a human has checked, the string key and the exact text that was checked.
- **Arrival_Alert**: The flash and the vibration shown when a new alert arrives.
- **New_Alert**: A Heard_Alert whose Alert_Key is not in the History at the moment the alert passes the check, heard while a Session is running.
- **Flash_Setting** and **Vibrate_Setting**: The two on/off settings of the Arrival_Alert, kept in the Settings_Store.
- **Settings_Store**: The `localStorage` entry `dead-air.listen.alertSettings.v1`.
- **Translation_Check_File**: The file `docs/translation-check.md`.
- **Report_File**: The file `.kiro/specs/languages/report.md`.
- **Alert_Card**, **Heard_Alert**, **Alert_Key**, **History**, **Session**, **Listen_Page**, **Test_Banner**: As defined in the Listen page spec. The **Broadcast_Page**, **Say_First** line and **Offline_Line** are as defined in the Broadcast page and offline specs.

## Requirements

### Requirement 1: A complete Hindi language file

**User Story:** As a listener who reads Hindi, I want every word on the app pages in Hindi, so that I can understand an alert without English.

#### Acceptance Criteria

1. THE Language_Catalog SHALL contain exactly two Languages: English with Language_Code `en` and Hindi with Language_Code `hi`.
2. THE Hindi Language_File SHALL export a `Strings` object that has a non-empty value for every Text_Key that the English Language_File has.
3. THE Hindi Language_File SHALL have a label for each of the 9 event types, the 5 urgencies, the 5 severities and the 6 actions of the Message_Code.
4. THE Hindi Language_File SHALL have a label for each of the 4 expiry statuses, the 9 valid-for choices, the 13 field names and the decode, audio and WAV reasons.
5. THE Hindi Language_File SHALL have a Template for every text key that the Language_File needs for the Listen_Page, the Broadcast_Page, the Offline_Line, the Language_Switch, the Read_Aloud_Button and the alert settings.
6. THE Hindi Language_File SHALL use, in each Template, exactly the placeholder names that `PLACEHOLDERS` allows for that key and every placeholder name that `PLACEHOLDERS` declares for that key.
7. THE Hindi Language_File SHALL contain no emoji.
8. THE Hindi `test.banner` text SHALL contain both the Hindi word for "test" and the Latin word `TEST`, together in the same banner.
9. THE Language_Files SHALL be bundled into the built JavaScript of the app pages, so that no Language_File is requested from another site or from a URL outside the site's own files.
10. THE Hindi Language_File SHALL use the wording of a local radio announcer: short everyday words and polite commands (for example जाएँ, रहें), with no formal or Sanskrit-heavy words.

### Requirement 2: Sentences built from codes

**User Story:** As a listener, I want each alert to read as a proper sentence in my language, so that I can understand it at a glance.

#### Acceptance Criteria

1. WHEN an Alert_Sentence is built for an `Alert`, THE Language_File of the Chosen_Language SHALL supply the Templates and the labels for the event, urgency, severity and action of that `Alert`.
2. WHEN an Alert_Sentence is built, THE Alert_Sentence SHALL contain the event label, the urgency label, the severity label and the action label of the Chosen_Language.
3. WHEN the Place_Name of the `Alert` is not empty, THE Alert_Sentence SHALL contain the Place_Name exactly as sent.
4. WHEN the Place_Name of the `Alert` is empty, THE Alert_Sentence SHALL contain no place part.
5. WHEN the `test` field of the `Alert` is true, THE Alert_Sentence SHALL begin with the test sentence of the Chosen_Language.
6. THE Alert_Sentence SHALL contain no English word from the English Language_File when the Chosen_Language is Hindi, except the Latin word `TEST` required by Requirement 1 and a Place_Name sent in Latin letters.
7. IF a Template or a label that an Alert_Sentence needs is missing or empty, THEN THE Language_File check SHALL fail the test run (Requirement 12), and THE Alert_Sentence builder SHALL return no sentence and no partial sentence.
8. FOR ALL valid `Alert` values and each Language, building the Alert_Sentence twice from the same `Alert` SHALL produce the same text.
9. THE Alert_Sentence builder SHALL use the same sentence for the Alert_Card text, the Say_First line main part and the Spoken_Text, so that all three agree word for word where they share a part.

### Requirement 3: Place names stay as sent

**User Story:** As a listener, I want the place name exactly as the sender wrote it, so that no machine guess changes where the danger is.

#### Acceptance Criteria

1. THE Alert_Card SHALL show the Place_Name exactly as the Heard_Alert carries it, in every Language.
2. THE Alert_Sentence SHALL contain the Place_Name exactly as sent, in every Language.
3. THE Spoken_Text SHALL contain the Place_Name exactly as sent.
4. THE Listen_Page SHALL apply no translation, transliteration, case change or re-spelling to a Place_Name.
5. THE Alert_Card SHALL set `dir="auto"` on the Place_Name element, so that a Place_Name in a different script is not reordered.
6. FOR ALL Place_Name values the message code accepts, THE Alert_Sentence of each Language SHALL contain the Place_Name as a substring.

### Requirement 4: First-visit language from the phone

**User Story:** As a listener, I want the app to open in my phone's language the first time, so that I do not have to look for a setting.

#### Acceptance Criteria

1. WHEN a page loads and the Language_Store holds no valid Language_Code, THE page SHALL use the Device_Language as the Chosen_Language.
2. WHEN a page loads, no valid Language_Code is stored and no entry of `navigator.languages` matches a Language_Code, THE page SHALL use English as the Chosen_Language.
3. THE Device_Language choice SHALL compare only the primary subtag of each entry, ignoring case and accepting both `-` and `_` as the separator, so that `hi`, `hi-IN`, `hi_IN` and `HI-in` each give Hindi.
4. WHEN the Device_Language is chosen on load, THE page SHALL write nothing to the Language_Store.
5. IF reading the Language_Store throws or returns a value that is not a Language_Code of the Language_Catalog, THEN THE page SHALL treat the Language_Store as empty.
6. WHEN the Chosen_Language is set on load and WHEN it changes through the Language_Switch, THE page SHALL set `document.documentElement.lang` (the `lang` attribute of the `<html>` element) to the Language_Code, so that screen readers and fonts pick the right language.
7. THE page SHALL choose the Chosen_Language before the first draw of text, so that no English text is shown first and replaced.

### Requirement 5: A visible language switch that is remembered

**User Story:** As a listener, I want to change the language with one visible control and have the app keep my choice, so that I do not have to choose again.

#### Acceptance Criteria

1. THE Listen_Page and the Broadcast_Page SHALL each show the Language_Switch at the top of the page, in the first screen, without opening a menu.
2. THE Language_Switch SHALL name each Language by its own name (`English`, `हिन्दी`), so that a person can find their language while the page is in the other Language.
3. WHILE the Language_Switch is shown, THE Language_Switch SHALL mark the Chosen_Language as selected and expose that state to assistive technology.
4. WHEN the person selects a Language in the Language_Switch, THE page SHALL redraw all of its text in that Language without reloading the page.
5. WHEN the person selects a Language in the Language_Switch, THE page SHALL write the Language_Code to the Language_Store.
6. WHEN a page loads and the Language_Store holds a valid Language_Code, THE page SHALL use that Language_Code as the Chosen_Language, whatever the Device_Language is.
7. WHEN the person changes the Language on one page, THE other app page SHALL show the same Language the next time that page loads.
8. IF writing the Language_Store fails, THEN THE page SHALL keep the new Language for the rest of the page's life and SHALL show no error.
9. WHEN the Language changes while a Session is running on the Listen_Page, THE Listen_Page SHALL keep the Session running and SHALL keep the History.
10. WHEN the Language changes on the Broadcast_Page, THE Broadcast_Page SHALL keep every form entry, the repeat state and any sound that is playing, and SHALL not change the bytes or the sound of any alert.

### Requirement 6: All interface text follows the Chosen_Language

**User Story:** As a listener, I want nothing left in the other language after I switch, so that the app is usable in one language.

#### Acceptance Criteria

1. WHEN the Chosen_Language is set or changed, THE Listen_Page SHALL draw the page title, headings, buttons, links, state lines, error lines, level label, Offline_Line, storage note and every Alert_Card in the Chosen_Language.
2. WHEN the Chosen_Language is set or changed, THE Broadcast_Page SHALL draw the page title, headings, form labels, the options of every select, the validation errors, the real-alert dialog, the Test_Banner, the preview, the Say_First line, the repeat and wake-lock lines and the Offline_Line in the Chosen_Language.
3. WHEN the Chosen_Language changes, THE Listen_Page SHALL redraw every Alert_Card in the History from its stored `Alert`, so that old alerts appear in the new Language.
4. WHEN the Chosen_Language changes, THE Listen_Page and the Broadcast_Page SHALL redraw the values that were already on the page from their codes and not from stored text.
5. THE Listen_Page and the Broadcast_Page SHALL take every `aria-label` and every `title` text from the Language_File.
6. THE Alert_Card SHALL show the sent time and the valid-until time in the same format in every Language, with Latin digits.
7. THE Listen_Page and the Broadcast_Page SHALL contain no user-facing English sentence written outside the English Language_File, including in HTML, so that no text escapes translation.
8. WHILE the Chosen_Language is Hindi, THE Listen_Page and the Broadcast_Page SHALL draw the Hindi text with a font from the phone's own system fonts that covers Devanagari, with no font file loaded from the network and no font file added to the offline File_List.
9. WHILE the Chosen_Language is Hindi, THE Listen_Page and the Broadcast_Page SHALL show no English month name and no English day name in any date or time, using the numbers-only format of criterion 6 or Hindi names.

### Requirement 7: Read aloud with an on-device voice

**User Story:** As a listener who cannot read the screen easily, I want to hear an alert spoken in my language, so that I can take it in without looking.

#### Acceptance Criteria

1. THE Listen_Page SHALL speak with the browser's built-in `speechSynthesis` and with no other speech source.
2. WHEN a page loads and each time the browser reports that the list of voices changed, THE Listen_Page SHALL look for a Local_Voice for the Chosen_Language.
3. WHILE a Local_Voice for the Chosen_Language exists, THE Alert_Card SHALL show a Read_Aloud_Button.
4. WHILE no Local_Voice for the Chosen_Language exists, THE Alert_Card SHALL hide the Read_Aloud_Button, so that no alert is read in the wrong language, and criterion 21 applies in its place.
5. WHILE the browser has no `speechSynthesis`, THE Alert_Card SHALL hide the Read_Aloud_Button and SHALL show neither the Voice_Help_Line nor the Voice_Missing_Line.
6. THE Listen_Page SHALL treat a voice as a Local_Voice only when its `localService` value is true, so that no voice that sends text to a server is used.
7. WHEN the person taps the Read_Aloud_Button, THE Listen_Page SHALL set the utterance `voice` to the chosen Local_Voice and the utterance `lang` to the voice's `lang` before speaking.
8. THE Listen_Page SHALL start speaking only after a tap on a Read_Aloud_Button and SHALL never speak an alert on arrival.
9. WHEN the person taps the Read_Aloud_Button while that card is being read, THE Listen_Page SHALL stop the speech.
10. WHEN the person taps a Read_Aloud_Button while another card is being read, THE Listen_Page SHALL stop the first speech before the second starts.
11. WHEN the Chosen_Language changes, THE Listen_Page SHALL stop any speech in progress.
12. WHEN the page is hidden or closed, THE Listen_Page SHALL stop any speech in progress.
13. IF the speech reports an error, THEN THE Listen_Page SHALL return the Read_Aloud_Button to its ready state and SHALL not start the speech again by itself.
14. THE Listen_Page SHALL send the Spoken_Text to no `fetch` or `XMLHttpRequest` call and to no other site, so that reading aloud works with no connection.
15. WHILE speech is in progress, THE Read_Aloud_Button of that card SHALL show a "Stop reading" label in the Chosen_Language.
16. WHERE the voice list is empty when the page loads and fills later, THE Listen_Page SHALL show the Read_Aloud_Button on every card, and SHALL remove the Voice_Missing_Line, as soon as a Local_Voice appears.
17. THE Listen_Page SHALL treat a voice `lang` tag and a speech tag as the same language WHEN their primary subtags are equal, ignoring case and accepting both `-` and `_` as the separator, so that `hi`, `hi-IN` and `hi_IN` (as reported by Chrome on Android and Samsung Internet) match.
18. IF the speech reports an error, THEN THE Listen_Page SHALL show a short error message in the Chosen_Language near that Read_Aloud_Button.
19. WHILE the Chosen_Language is not English, `speechSynthesis` exists and a Read_Aloud_Button is shown, THE Listen_Page SHALL show the Voice_Help_Line near the Read_Aloud_Button, with the English text "If you hear nothing or the voice sounds wrong, install this language's voice in your phone's text-to-speech settings." and a Hindi version of the same line in the Hindi Language_File.
20. THE Report_File SHALL record as a known gap that Chrome on Android can list a voice whose language is not installed and then speak with an English voice, and that the page cannot detect this (Requirement 14, criterion 9).
21. WHILE the Chosen_Language is not English, `speechSynthesis` exists and no Local_Voice for the Chosen_Language exists, THE Alert_Card SHALL show the Voice_Missing_Line where the Read_Aloud_Button would be, with the English text "To hear alerts read aloud, install this language's voice in your phone's text-to-speech settings." and a Hindi version of the same line in the Hindi Language_File.
22. THE Alert_Card SHALL show exactly one of the following, so that the Voice_Help_Line and the Voice_Missing_Line never appear together: the Read_Aloud_Button with the Voice_Help_Line, the Voice_Missing_Line, or neither.
23. WHILE the Chosen_Language is English and no Local_Voice exists, THE Alert_Card SHALL show neither the Read_Aloud_Button nor the Voice_Missing_Line.

### Requirement 8: What is spoken keeps the promises

**User Story:** As a listener, I want the spoken alert to carry the same warnings as the card, so that speech never makes a test or an old alert sound current.

#### Acceptance Criteria

1. WHEN the `test` field of the Heard_Alert is true, THE Spoken_Text SHALL begin with the test sentence of the Chosen_Language.
2. WHEN the Expiry_Result of the Heard_Alert is `expired`, THE Spoken_Text SHALL begin with the label of the `expired` status in the Chosen_Language, placed after the test sentence when there is one.
3. WHEN the Expiry_Result is `sent-in-future` or `clock-unknown`, THE Spoken_Text SHALL include the clock line of the Chosen_Language and SHALL contain no sent time and no Spoken_Age.
4. WHEN the Expiry_Result is `current` or `expired`, THE Spoken_Text SHALL include the Spoken_Age of the Heard_Alert, placed after the `expired` label when there is one, and SHALL NOT include the sent time text that the Alert_Card shows.
5. THE Spoken_Text SHALL contain the Alert_Sentence of the Heard_Alert.
6. THE Listen_Page SHALL build the Spoken_Text at the moment of the tap from the stored `Alert`, the device time and the Chosen_Language, so that the Expiry_Result is current.
7. THE Spoken_Text SHALL come only from a Heard_Alert that passed the check, so that a damaged alert is never spoken.
8. FOR ALL Heard_Alerts with `test` true and each Language, THE Spoken_Text SHALL contain the test sentence of that Language.
9. FOR ALL Heard_Alerts that `checkExpiry` reports as `expired` and each Language, THE Spoken_Text SHALL contain the `expired` label of that Language.
10. WHEN the Sent_Age is less than 2 minutes, THE Spoken_Age SHALL be "Sent just now." in the Chosen_Language.
11. WHEN the Sent_Age is 2 minutes or more and less than 120 minutes, THE Spoken_Age SHALL be "Sent {n} minutes ago." in the Chosen_Language, with n the whole number of minutes of the Sent_Age, rounded down.
12. WHEN the Sent_Age is 120 minutes or more and less than 48 hours, THE Spoken_Age SHALL be "Sent {n} hours ago." in the Chosen_Language, with n the whole number of hours of the Sent_Age, rounded down.
13. WHEN the Sent_Age is 48 hours or more, THE Spoken_Age SHALL be "Sent {n} days ago." in the Chosen_Language, with n the whole number of days of the Sent_Age, rounded down.
14. THE Language_Files SHALL supply the four Spoken_Age Templates as text keys, with the placeholder `{n}` declared in `PLACEHOLDERS` for the minutes, hours and days Templates, and with a Hindi version of each in short announcer-style wording (Requirement 1, criterion 10).
15. THE Spoken_Age Templates SHALL need no singular form, because the limits of criteria 10 to 13 make n at least 2 in every Template.
16. THE Alert_Card SHALL keep showing the exact sent time in the format of Requirement 6, criterion 6, whatever the Spoken_Text says.
17. FOR ALL Sent_Age values and each Language, THE Spoken_Age SHALL follow the boundaries of criteria 10 to 13, so that 1 minute 59 seconds gives "just now", 2 minutes gives 2 minutes, 119 minutes gives 119 minutes, 120 minutes gives 2 hours, 47 hours 59 minutes gives 47 hours and 48 hours gives 2 days.

### Requirement 9: Flash and vibrate on a new alert

**User Story:** As a listener with my phone nearby, I want a flash and a buzz when a new alert arrives, so that I notice it without watching the screen.

#### Acceptance Criteria

1. WHEN a New_Alert arrives, the Expiry_Result of that alert is `current` and the Flash_Setting is on, THE Listen_Page SHALL flash the screen.
2. WHEN a New_Alert arrives, the Expiry_Result of that alert is `current`, the Vibrate_Setting is on and the browser supports vibration, THE Listen_Page SHALL vibrate the phone.
3. WHEN a Heard_Alert repeats an Alert_Key already in the History, THE Listen_Page SHALL not flash and SHALL not vibrate.
4. WHEN the Listen_Page loads the History from storage, THE Listen_Page SHALL not flash and SHALL not vibrate.
5. WHEN the Expiry_Result of an arriving alert is `expired`, `sent-in-future` or `clock-unknown`, THE Listen_Page SHALL not flash and SHALL not vibrate, so that an alert that is not shown as current does not get an urgent signal.
6. THE flash SHALL show a coloured frame about 24 pixels wide along the edge of the screen, SHALL last 600 milliseconds or less in total and SHALL contain no more than 2 pulses, so that the flash stays at or under 3 flashes in any 1 second.
7. THE flash SHALL be a layer that, apart from the frame of criterion 6, does not cover the Alert_Card text, ignores taps, is hidden from assistive technology and carries no text.
8. WHERE the person's device setting `prefers-reduced-motion: reduce` is on, THE Listen_Page SHALL not flash.
9. THE vibration SHALL use a pattern of about 1 second in total, with a pattern of 400, 150 and 400 milliseconds (950 milliseconds in total) and a total that is at least 900 and at most 1100 milliseconds.
10. THE Listen_Page SHALL show Test_Banner and Alert_Card as usual when a flash or vibration happens for a test alert, and the flash and vibration SHALL carry no information that differs between a test alert and a real alert.
11. IF the browser rejects the vibration call or the page is not allowed to vibrate, THEN THE Listen_Page SHALL continue without a message.
12. THE flash and the vibration SHALL never exceed 3 flashes in any 1 second, counting each pulse of the flash as one flash and counting repeated New_Alerts, so that a second New_Alert within 1 second of a flash SHALL not start another flash until the earlier flash has ended.

### Requirement 10: Settings for flash and vibrate

**User Story:** As a listener, I want to turn the flash and the vibration off separately, so that I can use the app in a dark room or on a phone that buzzes too much.

#### Acceptance Criteria

1. THE Listen_Page SHALL show one switch for the Flash_Setting and one switch for the Vibrate_Setting, each with a label in the Chosen_Language.
2. THE Flash_Setting and the Vibrate_Setting SHALL both be on when the Settings_Store holds no valid value.
3. WHEN the person changes a switch, THE Listen_Page SHALL write both settings to the Settings_Store and SHALL apply the new value to the next New_Alert.
4. WHEN the Listen_Page loads, THE Listen_Page SHALL read both settings from the Settings_Store.
5. IF reading the Settings_Store throws or returns a value that is not valid, THEN THE Listen_Page SHALL use the default (both on) for the invalid setting.
6. IF writing the Settings_Store fails, THEN THE Listen_Page SHALL keep the new values for the rest of the page's life and SHALL show no error.
7. WHILE the browser does not support vibration, THE Listen_Page SHALL hide the Vibrate_Setting switch.
8. WHILE the Flash_Setting is off, THE Listen_Page SHALL not flash for any alert.
9. WHILE the Vibrate_Setting is off, THE Listen_Page SHALL not vibrate for any alert.
10. THE Settings_Store SHALL hold only the two on/off values and no alert text, no audio and no place name.
11. THE Listen_Page SHALL place the Settings_Area below the Alert_Card list, so that the newest Alert_Card is the first thing seen after the Language_Switch and the state lines.
12. WHILE the History is empty, THE Listen_Page SHALL still show the Settings_Area below the place where Alert_Cards appear.
13. THE Listen_Page SHALL keep the Language_Switch at the top of the page and SHALL not move it into the Settings_Area.

### Requirement 11: No network, no outside sites, no audio kept

**User Story:** As a listener in a disaster area, I want language and speech to work with the network off, so that the app is as reliable as the sound.

#### Acceptance Criteria

1. THE Listen_Page and the Broadcast_Page SHALL make no network request for a Language_File, a voice, a font or a translation after the page and its own bundled files have loaded.
2. THE Listen_Page and the Broadcast_Page SHALL load no font, script, image, style or voice from another site.
3. WHEN the build output is checked, THE offline File_List SHALL contain every file needed to show both Languages on `/listen` and `/broadcast`, so that switching Language with the network off makes 0 network requests.
4. THE offline File_List SHALL stay within its 2 MiB limit with the Hindi Language_File included.
5. THE Language_Store and the Settings_Store SHALL contain no microphone audio and no decoded alert text.
6. THE Listen_Page SHALL keep microphone audio in memory only, with no change from the Listen page spec, while the Language, speech and Arrival_Alert code run.
7. THE Language_Switch SHALL work when `localStorage` is blocked, for the life of the page.

### Requirement 12: A test that fails on any missing text key

**User Story:** As the developer, I want a test that fails when any language misses any text, so that a missing translation is found before it ships.

#### Acceptance Criteria

1. THE language test SHALL fail WHEN any Language in the Language_Catalog lacks a non-empty value for any key of `TEXT_KEYS`.
2. THE language test SHALL fail WHEN any Language lacks a non-empty label for any code of `EVENT_TYPES`, `URGENCIES`, `SEVERITIES`, `ACTIONS`, any expiry status, any valid-for key, any field name, any decode reason, any audio reason or any WAV reason.
3. THE language test SHALL fail WHEN any Language has a key that the English Language_File does not have.
4. THE language test SHALL fail WHEN a Template of any Language uses a placeholder that `PLACEHOLDERS` does not allow for that key, or omits a placeholder that `PLACEHOLDERS` declares for that key.
5. THE language test SHALL fail WHEN any value of any Language is empty after trimming white space.
6. THE language test SHALL fail WHEN any value of any Language contains an emoji.
7. THE language test SHALL fail WHEN the Hindi `test.banner` does not contain both a Devanagari letter and the Latin word `TEST`, or the Hindi test sentence does not contain the Latin word `TEST`, as Requirement 1 requires.
8. THE language test SHALL fail WHEN a `data-text` attribute in `listen/index.html` or `broadcast/index.html` names a key that is not in `TEXT_KEYS`.
9. THE language test SHALL fail WHEN the Language_Catalog lists a Language without a Language_File, or a Language_File that the Language_Catalog does not list.
10. THE language test SHALL fail WHEN the Hindi Language_File repeats an English sentence as its value for a key whose English value contains a letter A to Z, except for the keys on a short, named exception list in the test (for example `test.banner`, and keys whose value is the same word in both Languages).
11. WHEN a new Text_Key is added to `TEXT_KEYS` without a value in every Language_File, THE TypeScript type check SHALL fail, so that the gap is found before the test run.
12. FOR ALL Languages in the Language_Catalog and ALL valid `Alert` values, THE language test SHALL check that the Alert_Sentence builder returns a sentence (Requirement 2) and that the Alert_Card builder returns a view with the Test_Banner when `test` is true.

### Requirement 13: Hindi review file

**User Story:** As a native Hindi speaker asked to review, I want every Hindi string listed in one file next to its English meaning, so that I can check each one.

#### Acceptance Criteria

1. THE Translation_Check_File SHALL list every Hindi value of the Hindi Language_File, including every label and every Template.
2. THE Translation_Check_File SHALL show, for each entry, the key, the English text, the Hindi text and a status that is `checked` or `needs human check`.
3. THE Translation_Check_File SHALL show placeholders such as `{minutes}` unchanged in the Hindi text.
4. THE Translation_Check_File SHALL be produced from the Hindi Language_File and the English Language_File by a script in `tools/`, so that no string is copied by hand.
5. WHEN the Hindi Language_File changes, THE sync test SHALL fail until the Translation_Check_File is produced again.
6. THE sync test SHALL compare the keys, the English text, the Hindi text, the status of each entry (Sample_Sentences included) and the two counts of the Translation_Check_File with the two Language_Files, the sample sentence builder and the Reviewed_List, so that a status change comes only from the Reviewed_List and never from hand-editing the Translation_Check_File.
7. THE Translation_Check_File SHALL begin with a short note that says the Hindi text is machine-written, that only the entries marked `checked` have been checked by a native speaker, and that all other entries must be reviewed before any real use.
8. THE Translation_Check_File SHALL contain no emoji.
9. THE Translation_Check_File SHALL list one Sample_Sentence for each event type in Hindi, each with its own key (`sample.` followed by the event code), its English sentence and its Hindi sentence, so that the reviewer can read whole sentences and not only parts.
10. WHEN the key of an entry, a Sample_Sentence entry included, is in the Reviewed_List and the Hindi text equals the text stored for that key in the Reviewed_List, THE Translation_Check_File SHALL show the status `checked` for that entry.
11. WHEN the key of an entry, a Sample_Sentence entry included, is not in the Reviewed_List, or the Hindi text differs from the text stored for that key in the Reviewed_List, THE Translation_Check_File SHALL show the status `needs human check` for that entry, so that a changed string returns to review.
12. THE Translation_Check_File SHALL show at its top the count of `checked` entries and the count of `needs human check` entries, with every Language_File string and every Sample_Sentence counted in one of the two.
13. THE Translation_Check_File SHALL be produced again from the Reviewed_List each time it is generated, so that a human review survives regeneration.
14. WHEN the Reviewed_List holds every key of the Hindi Language_File and every Sample_Sentence key, each with its exact current text, THE Translation_Check_File SHALL show a `needs human check` count of 0.
15. THE Translation_Check_File SHALL show a Sample_Sentence as `checked` only by the rule of criterion 10, with no fixed `needs human check` status for any Sample_Sentence.

### Requirement 14: Scope, tests and report

**User Story:** As the developer, I want the other specs to keep working and the open gaps recorded, so that the next specs start from known facts.

#### Acceptance Criteria

1. THE English text shown on the Listen_Page and the Broadcast_Page SHALL be the same as before this spec, word for word, for every key that existed before this spec.
2. THE tests of the existing specs SHALL pass after this spec's changes with only edits that the owner of each spec has approved.
3. THE message code, the sound link and the sound output SHALL be unchanged by this spec.
4. THE Report_File SHALL list each file of another spec that this spec edited, with the approval.
5. THE Report_File SHALL record that the alert-type icons of promise 6 are not part of this spec and are due in the Teletext look (spec 8), and SHALL record that Hindi and English are the only Languages that have text for every alert type.
6. THE Report_File SHALL record the result of a manual check on a real phone for Hindi display, voice availability with the network off, the hidden Read_Aloud_Button when no voice exists, the flash and the vibration, or SHALL state that no phone was available and which parts remain unchecked.
7. THE language property tests SHALL include: the Alert_Sentence contains all four labels and the Place_Name for every valid `Alert` and Language; the Spoken_Text contains the test sentence for every test alert and the `expired` label for every expired alert; Device_Language choice matches the primary subtag for any list of language tags; the Language_Store round trip returns the Language_Code that was written; and the Spoken_Age boundaries of Requirement 8, criterion 17 (1 minute 59 seconds and 2 minutes, 119 and 120 minutes, 47 hours 59 minutes and 48 hours) for every Language, with n always 2 or more in minutes, hours and days.
8. THE Language_Store round trip SHALL return the Language_Code that was written for every Language_Code in the Language_Catalog, and SHALL return no Language for any other string.
9. THE Report_File SHALL list the listed-but-not-installed voice limit (Requirement 7, criterion 20) in its gaps list, with its own real-device check: on an Android phone with the Hindi voice not installed, record whether Read aloud speaks with an English voice and whether the Voice_Missing_Line is shown in place of the Read_Aloud_Button.
10. THE language property tests SHALL include: for any voice tag and speech tag, the match of Requirement 7, criterion 17 is true exactly when the primary subtags are equal ignoring case and separator; and for any text change to a Reviewed_List entry, a Sample_Sentence entry included, that entry shows `needs human check`; and the counts of the Translation_Check_File add up to the number of entries for any Reviewed_List.

### Requirement 15: Adding another language later

**User Story:** As the developer, I want a new language to need one file and one list entry, so that adding it cannot break the other languages.

#### Acceptance Criteria

1. WHEN a new Language is added, THE developer SHALL need only one new Language_File and one new entry in the Language_Catalog, with no other code edit.
2. THE Language_Switch, the Device_Language choice, the Language_Store check, the voice matching, the `lang` attribute, the language tests and the Translation_Check_File generator SHALL each take the list of Languages from the Language_Catalog and not from a fixed list of `en` and `hi`.
3. WHEN a Language is added to the Language_Catalog, THE language test of Requirement 12 SHALL run for that Language with no test edit.
