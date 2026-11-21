# Requirements Document

## Introduction

This is spec 3 of 10. It builds the Broadcast page at `/broadcast/`. A sender fills in a short form. The page builds the alert bytes with the message code, turns them into sound with the sound link, checks the sound by decoding it in memory, and plays it. The page also shows a sentence for the sender to read aloud, a preview of what a listener will see, a repeat option and a WAV download.

The page uses the existing `src/message-code/` and `src/sound-link/` modules through their `index.ts` files and does not edit them. The UI is plain. The page is plain TypeScript with direct DOM code and no UI framework (no React, Vue or similar), as the tech rules state. The radio look comes in spec 8. All user-facing text is English and lives in one strings file so other languages can be added in spec 7.

Files this spec owns: `broadcast/`, its own strings file, and helpers in a shared folder (`src/shared/`) that the Listen page will also use. This spec does not edit `src/message-code/`, `src/sound-link/`, `listen/` or `sound-test/`. A needed change to any of them is raised as a question first.

Facts taken from the existing code, which these requirements rely on:
- The `Alert` type has these fields: `test`, `passedOn`, `event`, `urgency`, `severity`, `action`, `sentMinute`, `validSteps`, `latitude`, `longitude`, `stationId`, `counter`, `placeName`.
- `latitude` and `longitude` are each `number | null`, and both are null (no map point) or both are numbers. When both are numbers they are integers in units of 0.0001 degree. Bit 0 of byte 0 is the No_Map_Point_Flag: the encoder sets it and writes six zero bytes when both are null, and the decoder returns null and null when it is set. A real point at 0, 0 is two numbers with the flag clear. The encoder rejects exactly one null as `invalid-field` naming `latitude`.
- `encodePlaceName` is not exported. The page measures the place name by calling `encodeAlert` and reading the length of the result: place name bytes = message length minus 21.
- `bytesToAudio` accepts 21 to 40 bytes. `loadSoundLink` loads a fresh copy of ggwave on every call. A link allows one encoder and 3 listeners.
- The ggwave 0.4.0 file embeds its engine as base64 data and contains `require("fs")` and `require("path")` calls in a Node-only branch. It makes no network request for a `.wasm` file. The project has no DOM library in `tsconfig.json` yet, and no React.
- Promise 6 needs an icon for every alert type. This spec shows text labels only. Icons arrive with the radio look (spec 8), so promise 6 is not met on this page until then. This spec records the gap in a report file (Requirement 15).

## Glossary

- **Broadcast_Page**: The static page at `<base>broadcast/`, built from `broadcast/index.html`.
- **Form**: The set of inputs on the Broadcast_Page that describe one alert.
- **Strings_File**: The single TypeScript module that holds every piece of user-facing text of the Broadcast_Page, keyed by name, in English.
- **Message_Code**: The module `src/message-code/`, used through its `index.ts`.
- **Sound_Link**: The module `src/sound-link/`, used through its `index.ts`.
- **Link**: The one object returned by `loadSoundLink` on the Broadcast_Page.
- **Build**: One run of turning the current Form into an Alert, bytes, audio and a Decoded_Alert.
- **Alert_Bytes**: The 21 to 40 bytes returned by `encodeAlert`.
- **Self_Check**: The step that decodes the audio of a Build in memory and compares the result with the Alert_Bytes and the source Alert.
- **Decoded_Alert**: The Alert returned by `decodeMessage` from the bytes the Self_Check heard.
- **Preview**: The panel that shows what a listener will see, built from the Decoded_Alert only.
- **Say_First_Line**: The English sentence the sender reads aloud before the sound plays, built from the Decoded_Alert and the Strings_File.
- **Go_On_Air**: The button that starts one Broadcast.
- **Broadcast**: One Go_On_Air press: one Build, then two plays of the same audio.
- **Play**: One playing of the audio of a Build through the Audio_Context.
- **Play_Gap**: The silence between the end of the first Play and the start of the second Play of one Broadcast.
- **Repeat_Round**: One Broadcast started by the repeat option with the same Alert_Bytes as the first.
- **Repeat_Interval**: The time from the start of one round to the start of the next. It is 60 seconds.
- **Audio_Context**: The browser `AudioContext` used for playback.
- **TEST_Switch**: The switch on the Form that sets the `test` field of the Alert.
- **Station_Store**: The `localStorage` entries of the Broadcast_Page. They hold the station ID and the counter, nothing else.
- **WAV_File**: A WAV file made by `audioToWav` from the same samples as a Broadcast.
- **Map_Point**: The pair of latitude and longitude of an Alert. It is either two numbers or null and null (no map point).
- **Location_Button**: The button on the Form labelled "Use this device's location" (text from the Strings_File).
- **Geolocation_Provider**: The function the page calls to read the device position. In the browser it wraps `navigator.geolocation.getCurrentPosition`. In tests it is injected.
- **Location_Timeout**: 15 seconds, the fixed timeout passed to the Geolocation_Provider.
- **Wake_Lock_Provider**: The function the page calls to request a screen wake lock. In the browser it wraps `navigator.wakeLock.request('screen')`. In tests it is injected.
- **Report_File**: The file `.kiro/specs/broadcast-page/report.md`.
- **Open_Question**: An item at the end of this document. All are answered and the section records the decisions.

## Requirements

### Requirement 1: The page and the Form

**User Story:** As a sender, I want a short form for one alert, so that I can describe the alert quickly.

#### Acceptance Criteria

1. WHEN the Broadcast_Page is requested directly by address at `<base>broadcast/`, THE Broadcast_Page SHALL load and show the Form without a redirect or a not-found result, both under a sub-path and at the root of a domain.
2. THE Form SHALL contain exactly these ten inputs: event, urgency, severity, action, place name, latitude, longitude, valid for, station ID and the TEST_Switch.
3. THE Form SHALL offer exactly the values of `EVENT_TYPES`, `URGENCIES`, `SEVERITIES` and `ACTIONS` from the Message_Code, with no extra and no missing values, and each value SHALL have a non-empty label from the Strings_File in every shipped language.
4. THE Form SHALL offer exactly nine valid-for choices: 15 minutes, 30 minutes, 1 hour, 2 hours, 3 hours, 6 hours, 12 hours, 24 hours and 48 hours, which map to 1, 2, 4, 8, 12, 24, 48, 96 and 192 steps of 15 minutes.
5. WHEN the Form first loads, THE Form SHALL show valid for set to 1 hour (4 steps).
6. WHEN the Form first loads, THE Form SHALL show no event, urgency, severity or action chosen.
7. WHILE any of event, urgency, severity or action is not chosen, THE Go_On_Air button SHALL be disabled.
8. IF the place name, latitude, longitude or station ID entered is outside the limits defined by the Message_Code, THEN THE Form SHALL show an error beside that input, keep everything the sender entered, and keep the Go_On_Air button disabled until every input is within those limits.
9. THE Broadcast_Page SHALL set the `passedOn` field of every Alert it builds to false.
10. THE Broadcast_Page SHALL contain one link to `<base>` (front page) and one link to `<base>listen/`, with both paths derived from the Vite `base` setting and no hard-coded `/dead-air/`.

### Requirement 2: Place name and bytes left

**User Story:** As a sender, I want to see how many bytes are left as I type a place name, so that I know when the name will not fit.

#### Acceptance Criteria

1. WHEN the place name text changes, THE Broadcast_Page SHALL show, within 100 ms, the number of bytes left as a whole number, computed as 40 minus the length in bytes of the array that `encodeAlert` returns for an Alert with that place name.
2. WHILE the place name is empty, THE Broadcast_Page SHALL show 19 bytes left.
3. WHEN the place name is in a compact-form script (Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil, Telugu, Kannada or Malayalam), THE Broadcast_Page SHALL compute the bytes left from the length of the form that `encodeAlert` chose, and SHALL NOT compute it from the UTF-8 length of the typed text.
4. IF `encodeAlert` rejects the place name with `place-name-too-long`, THEN THE Broadcast_Page SHALL replace the bytes-left number with a message from the Strings_File saying the name is too long, and SHALL keep Go_On_Air disabled until the place name is accepted by `encodeAlert`.
5. IF `encodeAlert` rejects the place name with `invalid-field` for `placeName`, THEN THE Broadcast_Page SHALL replace the bytes-left number with a message from the Strings_File saying the name has a character that cannot be sent, and SHALL keep Go_On_Air disabled until the place name is accepted by `encodeAlert`.
6. THE Broadcast_Page SHALL measure the place name without importing `encodePlaceName` and without editing any file of the Message_Code.

### Requirement 3: Map point

**User Story:** As a sender, I want to give a map point as two numbers, or leave it out, or fill it from my device, so that listeners can see where the alert applies when I know it.

#### Acceptance Criteria

1. THE Form SHALL take latitude and longitude as two number boxes in decimal degrees.
2. WHEN latitude or longitude changes to a valid number, THE Broadcast_Page SHALL convert it to an integer in units of 0.0001 degree by rounding to the nearest unit, with a value exactly halfway between two units rounded away from zero (12.34565 gives 123457, and -12.34565 gives -123457).
3. IF the rounded latitude is outside -900000 to 900000 (-90 to 90 degrees) or the rounded longitude is outside -1800000 to 1800000 (-180 to 180 degrees), THEN THE Broadcast_Page SHALL show a message from the Strings_File naming the field and the allowed range, and SHALL keep Go_On_Air disabled.
4. IF only one of latitude and longitude is filled in, THEN THE Broadcast_Page SHALL show a message from the Strings_File asking for both, and SHALL keep Go_On_Air disabled.
5. IF latitude and longitude are both empty, THEN THE Broadcast_Page SHALL treat the Map_Point as no map point, SHALL set `latitude` and `longitude` of the Alert to null and null, and SHALL NOT disable Go_On_Air because of the map point. THE Broadcast_Page SHALL NOT use 0 and 0 to mean no map point.
6. THE Broadcast_Page SHALL accept a value typed with either a dot or a comma as the single decimal mark, with an optional leading minus sign or plus sign, and SHALL treat 12,5 and 12.5 as the same value.
7. IF a filled-in latitude or longitude is not a number (it has letters, spaces inside the number, more than one decimal mark, a thousands separator, or exponent notation), THEN THE Broadcast_Page SHALL show a message from the Strings_File naming the field and saying the value is not a number, and SHALL keep Go_On_Air disabled.
8. WHEN latitude or longitude changes, THE Broadcast_Page SHALL update its map point message and the Go_On_Air state within 100 milliseconds, and SHALL keep the sender's typed text unchanged in the box.
9. THE Form SHALL show the Location_Button next to the latitude and longitude boxes.
10. THE Broadcast_Page SHALL NOT call the Geolocation_Provider and SHALL NOT ask for location permission before the sender taps the Location_Button, including at page load.
11. WHEN the sender taps the Location_Button, THE Broadcast_Page SHALL call the Geolocation_Provider once, with the Location_Timeout.
12. WHEN the Geolocation_Provider returns a position, THE Broadcast_Page SHALL round the latitude and the longitude to 4 decimal places and SHALL write them into the latitude and longitude boxes, replacing any earlier text in both boxes, and SHALL then apply criteria 2 to 4 to the new values.
13. IF the location is refused, is unavailable, does not arrive within the Location_Timeout, or the geolocation API is missing, THEN THE Broadcast_Page SHALL show a message from the Strings_File that names which of these happened, and SHALL leave the latitude and longitude boxes exactly as they were, empty if they were empty.
14. IF the geolocation API is missing or the page is not in a secure context, THEN THE Broadcast_Page SHALL hide the Location_Button or disable it, and SHALL show a message from the Strings_File saying why location cannot be used.
15. THE Broadcast_Page SHALL NOT write the position to `localStorage`, cookies, IndexedDB, the Cache API, logs or any request body, and SHALL NOT send it anywhere. THE Broadcast_Page makes no network request to read the position. The browser may use the device's location services, which is the browser's own behavior and not a page network request, so Requirement 14 criterion 1 and promise 4 still hold.

### Requirement 4: Station ID and counter

**User Story:** As a sender, I want the page to remember my station ID, so that I do not type it every time.

#### Acceptance Criteria

1. THE Form SHALL take the station ID as a whole number from 0 to 65535, written in decimal digits only, with no sign, no decimal point, no spaces and no more than 5 digits.
2. IF the station ID is empty, not a whole number or outside 0 to 65535, THEN THE Broadcast_Page SHALL show a message from the Strings_File next to the station ID input, SHALL keep Go_On_Air disabled, and SHALL NOT change the value saved in the Station_Store.
3. WHEN the station ID is valid and changes, THE Broadcast_Page SHALL save it in the Station_Store before the next Broadcast is started.
4. WHEN the Broadcast_Page loads and the Station_Store has a valid station ID, THE Broadcast_Page SHALL fill the station ID input with it.
5. THE Broadcast_Page SHALL keep the counter (0 to 255) in the Station_Store, starting at 0 when none is saved.
6. WHEN a new alert is built for a Broadcast, THE Broadcast_Page SHALL use the saved counter as the `counter` field and then save the counter plus 1, wrapping from 255 to 0.
7. WHEN the same alert is repeated or replayed without being rebuilt from the Form, THE Broadcast_Page SHALL keep the same `counter` field and SHALL NOT change the saved counter.
8. THE Broadcast_Page SHALL write nothing to `localStorage` except the station ID and the counter, and SHALL write nothing to cookies, IndexedDB or the Cache API.
9. IF `localStorage` is not available or a read or write throws, THEN THE Broadcast_Page SHALL keep working with the station ID and counter held in memory for the life of the page, and SHALL show a message from the Strings_File saying the station ID will not be remembered.
10. IF a saved station ID or counter is not a whole number in its range, THEN THE Broadcast_Page SHALL ignore the saved value and use the empty station ID or counter 0.

### Requirement 5: TEST switch and real alerts

**User Story:** As a sender, I want alerts to be tests unless I say otherwise, so that I never send a real alert by mistake.

#### Acceptance Criteria

1. WHEN the Broadcast_Page loads, THE TEST_Switch SHALL be on, regardless of any value saved from an earlier visit, reload, or the state of the switch when the page was last closed.
2. WHILE the TEST_Switch is on, THE Broadcast_Page SHALL set the `test` field of every Alert it encodes to true.
3. WHILE the TEST_Switch is off, THE Broadcast_Page SHALL set the `test` field of every Alert it encodes to false.
4. WHEN the sender turns the TEST_Switch off, THE Broadcast_Page SHALL show a confirmation dialog containing the Strings_File text "This will send a real alert. Are you sure?" and two buttons, one to confirm and one to cancel, and THE TEST_Switch SHALL stay on while the dialog is open.
5. WHEN the sender cancels the confirmation dialog, THE Broadcast_Page SHALL close the dialog and leave the TEST_Switch on.
6. WHEN the sender confirms the dialog, THE Broadcast_Page SHALL close the dialog and turn the TEST_Switch off.
7. WHEN the sender turns the TEST_Switch on, THE Broadcast_Page SHALL turn it on without showing a dialog.
8. WHILE the TEST_Switch is on, THE Broadcast_Page SHALL show a TEST banner in the Preview, and THE Say_First_Line SHALL contain the word "test" or its Strings_File equivalent.
9. WHILE the TEST_Switch is off, THE Broadcast_Page SHALL show a message from the Strings_File next to Go_On_Air stating that the alert is real, and THE Preview SHALL show no TEST banner.
10. WHEN the sender changes the TEST_Switch, THE Broadcast_Page SHALL update the Preview, the Say_First_Line and the message next to Go_On_Air within 100 milliseconds of the change taking effect.
11. THE Strings_File SHALL hold the confirmation dialog text as one entry, and THE Broadcast_Page SHALL read the dialog text only from that entry.

### Requirement 6: Build, encode and Self_Check

**User Story:** As a sender, I want the page to check the sound before it plays, so that I never put out a damaged alert.

#### Acceptance Criteria

1. WHEN the Form is valid and Go_On_Air is pressed, THE Broadcast_Page SHALL run a Build that calls `encodeAlert`, then `bytesToAudio`, then decodes the samples with a Sound_Link listener, then calls `decodeMessage`, and SHALL complete the Build, including the Self_Check for a 40-byte payload, within 15 seconds, measured as real elapsed time in the Node test run. The time on a real phone is a manual check listed in the Report_File.
2. THE Self_Check SHALL run in memory and SHALL NOT need an Audio_Context.
3. THE Self_Check SHALL pass only when the listener returns exactly one payload, that payload equals the Alert_Bytes byte for byte, `decodeMessage` returns `ok: true`, and every field of the Decoded_Alert equals the same field of the source Alert.
4. IF `encodeAlert` returns a rejection, THEN THE Broadcast_Page SHALL refuse to go on air, SHALL show the reason and field in words from the Strings_File, SHALL keep the Form values unchanged, and SHALL NOT call `bytesToAudio`.
5. IF `bytesToAudio` returns `ok: false`, THEN THE Broadcast_Page SHALL refuse to go on air, SHALL show the reason in words from the Strings_File, and SHALL keep the Form values unchanged.
6. IF the listener returns zero payloads, more than one payload, or a payload that differs from the Alert_Bytes, THEN THE Broadcast_Page SHALL refuse to go on air and SHALL show a message from the Strings_File saying that the sound check failed.
7. IF `decodeMessage` rejects the heard bytes, or a field of the Decoded_Alert differs from the source Alert, THEN THE Broadcast_Page SHALL refuse to go on air and SHALL show a message from the Strings_File saying that the sound check failed, followed by the rejection reason or the name of the differing field.
8. IF the Self_Check fails, THEN THE Broadcast_Page SHALL play no sound, SHALL NOT offer a WAV_File for that Build, SHALL NOT show a Preview or Say_First_Line for that Build, and SHALL discard the samples from that Build.
9. WHEN a Self_Check ends, whether it passes, fails or throws an error, THE Broadcast_Page SHALL dispose the listener it created for that check, so that no more than one listener is open at a time.
10. THE Broadcast_Page SHALL show the Preview and the Say_First_Line only for a Build whose Self_Check passed.
11. WHEN Go_On_Air is pressed, THE Broadcast_Page SHALL run the Build again, including the Self_Check, even when a Preview already exists, and SHALL replace the earlier Preview with the result of the new Build.
12. THE Broadcast_Page SHALL NOT write audio samples to storage, logs or the body of a network request.

### Requirement 7: Sent time and identical bytes

**User Story:** As a sender, I want the sent time to be the moment I go on air, so that listeners see when the alert really started.

#### Acceptance Criteria

1. WHEN Go_On_Air is pressed, THE Broadcast_Page SHALL set `sentMinute` to the device clock time in milliseconds divided by 60000, rounded down, read once for that press.
2. IF the device clock time is not finite, is negative, or gives a `sentMinute` above 4294967295, THEN THE Broadcast_Page SHALL refuse to go on air, SHALL NOT start any Play, SHALL keep the Form values unchanged, and SHALL show a message from the Strings_File about the device clock.
3. WHILE the Form is being edited and no Broadcast has started, THE Broadcast_Page SHALL build a draft with `sentMinute` from the current clock minute, SHALL rebuild the draft within 1 second after each Form change, and SHALL label the sent time in the Preview as a draft.
4. WHEN Go_On_Air is pressed and the clock check in criterion 2 passes, THE Broadcast_Page SHALL replace the draft Preview and Say_First_Line with those of the new Build, and SHALL complete the replacement before the first Play starts.
5. WHILE a Broadcast or a Repeat_Round sequence is running, THE Broadcast_Page SHALL send the same bytes in every Play, with `sentMinute`, `counter` and every other byte equal to those of the Build made at the Go_On_Air press, and SHALL keep this true when the Form is edited or the device clock minute changes.
6. THE Broadcast_Page SHALL show the sent time in the Preview in UTC and in the device's local time, both taken from the Decoded_Alert and each shown to the minute.
7. IF the Form is edited after a Broadcast has started, THEN THE Broadcast_Page SHALL leave the running Broadcast's bytes, Preview and Say_First_Line unchanged until Go_On_Air is pressed again.

### Requirement 8: Preview

**User Story:** As a sender, I want to see exactly what listeners will see, so that I can catch mistakes before I go on air.

#### Acceptance Criteria

1. THE Preview SHALL be built from the Decoded_Alert and not from the Form fields.
2. THE Preview SHALL show the event, urgency, severity and action as the labels from the Strings_File.
3. THE Preview SHALL show the place name when it is not empty, the station ID and the counter, and SHALL show the latitude and longitude in decimal degrees when the Decoded_Alert has a map point.

4. THE Preview SHALL show the sent time and the valid-until time of the Decoded_Alert.
5. THE Preview SHALL show the status from `checkExpiry` for the Decoded_Alert against the device clock.
6. IF `checkExpiry` returns `expired`, `sent-in-future` or `clock-unknown`, THEN THE Preview SHALL show a status label that differs from the label shown for `current` and SHALL show the sent time.
7. WHILE the Decoded_Alert has `test` set to true, THE Preview SHALL show a TEST banner above all other Preview content.
8. WHILE the Decoded_Alert has `test` set to false, THE Preview SHALL show no TEST banner.
9. THE Preview SHALL show a text label for the event and no icon, and the missing icon SHALL be recorded in the Report_File as a promise 6 gap until spec 8.
10. THE Preview SHALL contain only text from the Strings_File and values from the Decoded_Alert.
11. WHEN any Form field changes, THE Preview SHALL update to the re-encoded and re-decoded Decoded_Alert within 500 milliseconds.
12. IF the Form content cannot be encoded or the encoded bytes fail to decode, THEN THE Preview SHALL show no alert content and SHALL show an error indication naming the failure.
13. WHEN the Decoded_Alert has latitude null and longitude null, THE Preview SHALL show the "no map point" text from the Strings_File and SHALL NOT show 0, 0 or any coordinates.

### Requirement 9: Say this first

**User Story:** As a sender reading into a radio or a megaphone, I want a sentence to read aloud before the sound, so that people know what the sound is.

#### Acceptance Criteria

1. THE Say_First_Line SHALL be built only from the Decoded_Alert and templates in the Strings_File, with no text hard-coded outside the Strings_File.
2. THE Say_First_Line SHALL contain the event label, the action label, the sent time as hours and minutes in the device's local time zone, and the valid-for duration.
3. WHERE the place name is not empty, THE Say_First_Line SHALL contain the place name.
4. IF the place name is empty, THEN THE Say_First_Line SHALL omit the place name and SHALL contain no empty placeholder, stray punctuation, or doubled space where it would have been.
5. WHILE the Decoded_Alert has `test` set to true, THE Say_First_Line SHALL begin with the test sentence from the Strings_File, before any other sentence.
6. WHILE the Decoded_Alert has `test` set to false, THE Say_First_Line SHALL NOT contain the test sentence from the Strings_File.
7. IF the Strings_File has no template, event label, or action label needed to build the Say_First_Line, THEN THE Say_First_Line SHALL NOT be shown in part, and THE Broadcast_Page SHALL show an error message saying the line cannot be built.
8. THE Say_First_Line SHALL be shown as text on the page, and THE Broadcast_Page SHALL NOT produce speech output from it.

### Requirement 10: Go on air

**User Story:** As a sender, I want one button to play the alert twice, so that a missed play is covered.

#### Acceptance Criteria

1. WHEN the sender taps Go_On_Air, THE Broadcast_Page SHALL create the Audio_Context, or resume it when it exists and is suspended, inside that tap, before the Build starts.
2. THE Broadcast_Page SHALL NOT create or resume an Audio_Context before the first tap on Go_On_Air.
3. WHEN the Self_Check of the Broadcast passes, THE Broadcast_Page SHALL play the audio of the Build as the first Play, wait for the Play_Gap, then play the same samples as the second Play.
4. THE Play_Gap SHALL be 1 second, measured from the end of the first Play to the start of the second Play, with a tolerance of 0.25 seconds.
5. THE Broadcast_Page SHALL play the same Float32 samples in both Plays, with no new Build between them.
6. WHILE a Broadcast is playing, THE Broadcast_Page SHALL show a message from the Strings_File saying the alert is on air, and SHALL disable the Form and Go_On_Air.
7. WHEN the second Play ends, THE Broadcast_Page SHALL remove the on-air message and enable the Form and Go_On_Air again, unless repeat is running.
8. WHILE a Broadcast or repeat is running, THE Broadcast_Page SHALL show the Stop button enabled, and WHILE neither is running, THE Broadcast_Page SHALL show it disabled.
9. WHEN the sender taps Stop, THE Broadcast_Page SHALL silence the sound within 0.25 seconds, cancel the pending second Play, cancel all later repeat rounds, and enable the Form and Go_On_Air.
10. IF the Audio_Context cannot be created or resumed, THEN THE Broadcast_Page SHALL show a message from the Strings_File, SHALL play no sound, SHALL NOT show the on-air message, and SHALL keep Go_On_Air enabled so the sender can tap again.
11. THE Broadcast_Page SHALL create the Audio_Context with `sampleRate` 48000, as in the official ggwave browser example.
12. THE Broadcast_Page SHALL load the Link once at 48000 before any tap. IF the Audio_Context reports a sample rate other than the Link sample rate, THEN THE Broadcast_Page SHALL play the same samples as an `AudioBuffer` at the Link sample rate and let the browser resample, and SHALL NOT load a second Link. The real phone check of this is listed in the Report_File.

### Requirement 11: Repeat

**User Story:** As a sender, I want the alert to repeat every minute until I stop it, so that people who arrive late still hear it.

#### Acceptance Criteria

1. WHEN the Broadcast_Page loads, THE Form SHALL show the repeat option set to off.
2. WHEN a Broadcast starts with repeat on, THE Broadcast_Page SHALL start each next Repeat_Round 60 seconds (plus or minus 1 second) after the start of the previous round, using the same Alert_Bytes and the same audio samples, with no new Build and no new counter.
3. WHILE repeat is running and the tab is visible, THE Broadcast_Page SHALL show a countdown in whole seconds to the start of the next round, and SHALL update it at least once per second.
4. WHILE repeat is running, THE Broadcast_Page SHALL show the round number (starting at 1 for the first round) and the sent time of the alert being repeated.
5. WHEN the sender taps Stop, THE Broadcast_Page SHALL cancel all later rounds, SHALL start no new round after the tap, and SHALL clear the countdown. IF a round is playing at the time of the tap, THEN THE Broadcast_Page SHALL stop that round's audio within 1 second.
6. WHEN the device clock reaches the valid-until time of the alert, THE Broadcast_Page SHALL stop the repeat, SHALL play no further round, and SHALL show a message from the Strings_File saying the alert has expired. IF a round is playing at that moment, THEN THE Broadcast_Page SHALL let that round finish.
7. THE Broadcast_Page SHALL compute the start time of each next round from the device clock and the start time of the first round, and SHALL NOT derive it from a count of timer ticks.
8. WHILE the page is hidden with repeat running, THE Broadcast_Page SHALL keep the repeat state. WHEN the page becomes visible again and one or more round times have passed, THE Broadcast_Page SHALL start exactly one round within 1 second, SHALL show a message from the Strings_File giving the number of rounds that were missed, and SHALL schedule the next round 60 seconds after that round's start. IF the valid-until time has also passed, THEN THE Broadcast_Page SHALL apply criterion 6 and start no round.
9. WHILE repeat is running, THE Broadcast_Page SHALL show a message from the Strings_File telling the sender to keep the page open and in front.
10. WHEN repeat starts, THE Broadcast_Page SHALL request a screen wake lock through the Wake_Lock_Provider (in the browser, `navigator.wakeLock.request('screen')`) from within the Go_On_Air tap flow or immediately when repeat starts, WHERE the Wake Lock API is supported.
11. WHILE repeat is running, THE Broadcast_Page SHALL disable every Form field, including the repeat option, so that the Alert_Bytes cannot change. WHEN repeat stops for any reason, THE Broadcast_Page SHALL enable the Form again.
12. WHEN the page becomes visible again while repeat is running and the wake lock has been released, THE Broadcast_Page SHALL request the wake lock again.
13. WHEN the sender taps Stop, or repeat ends for any other reason, THE Broadcast_Page SHALL release the wake lock.
14. IF the Wake Lock API is unsupported or the request fails, THEN THE Broadcast_Page SHALL rely on the keep-the-page-open notice of criterion 9 and the catch-up round of criterion 8, and SHALL keep repeat running.
15. WHILE repeat is running, THE Broadcast_Page SHALL show a message from the Strings_File saying whether the screen is being kept awake, and SHALL update it within 1 second of the wake lock being granted, released or refused.
16. THE wake lock SHALL make no network request.

### Requirement 12: Save as sound file

**User Story:** As a sender, I want to download the sound as a file, so that I can play it from another device or pass it on.

#### Acceptance Criteria

1. WHEN the sender taps "Save as sound file" and the Self_Check of the Build passes, THE Broadcast_Page SHALL download one WAV_File made by `audioToWav` from the Build samples at the Link sample rate, within 2 seconds of the tap.
2. THE WAV_File SHALL contain the first Play, the Play_Gap of silence and the second Play, so that it holds the same audio as a Broadcast, and its length SHALL equal the length of two Plays plus one Play_Gap, to the nearest sample.
3. WHEN the sender taps "Save as sound file", the Form has not changed since the last Broadcast, and the alert of that Broadcast has not expired by the device clock, THE Broadcast_Page SHALL save the audio of that Broadcast with the same Alert_Bytes and SHALL NOT use a new counter.
4. WHEN the sender taps "Save as sound file" and either the Form has changed since the last Broadcast, no Broadcast has run, or the alert of the last Broadcast has expired by the device clock, THE Broadcast_Page SHALL run a new Build, including a new counter and a new `sentMinute`, and SHALL save its audio.
5. THE WAV_File name SHALL follow the pattern `dead-air-<test|alert>-<event>-<YYYYMMDDTHHMM>Z-s<stationId>-n<counter>.wav`, where `<test|alert>` is `test` when the `test` field of the saved Alert is true and `alert` otherwise, `<event>` is the event value of the saved Alert, the time is the `sentMinute` of the saved Alert in UTC, and `<stationId>` and `<counter>` are the decimal values of the saved Alert with no leading zeros.
6. WHEN the sender taps "Save as sound file", THE Broadcast_Page SHALL make the download from an in-memory Blob and an object URL, and SHALL revoke the URL within 10 seconds after the download starts.
7. THE Save button SHALL work without an Audio_Context and SHALL NOT create or resume one.
8. IF `audioToWav` returns `ok: false`, THEN THE Broadcast_Page SHALL show the reason in words from the Strings_File, SHALL download nothing, and SHALL keep the Form values and the previous Preview unchanged.
9. IF the Self_Check of the Build fails when the sender taps "Save as sound file", THEN THE Broadcast_Page SHALL download nothing and SHALL show the sound check failure message from the Strings_File.

### Requirement 13: Loading ggwave in the built site

**User Story:** As the owner, I want the built site to run ggwave on the Broadcast page, so that the page works for real, not only in Node tests.

#### Acceptance Criteria

1. WHEN the Broadcast_Page loads, THE Broadcast_Page SHALL call `loadSoundLink` exactly once, and SHALL reuse the resulting Link for every Build, Self_Check and Save until the page is closed or reloaded.
2. THE production build SHALL include ggwave and the ggwave engine in the files of the Broadcast_Page, so that opening the Broadcast_Page makes 0 requests to another site and 0 requests for a separate `.wasm` file.
3. WHEN the built site is served, THE Broadcast_Page SHALL load the Link and complete a Self_Check with a passing result in a desktop browser and in a phone browser.
4. IF `loadSoundLink` returns `ok: false`, THEN THE Broadcast_Page SHALL show a message from the Strings_File that states the sound engine failed to load, SHALL keep Go_On_Air and Save disabled, and SHALL keep the rest of the form usable.
5. WHILE `loadSoundLink` has not finished, THE Broadcast_Page SHALL show a loading indicator from the Strings_File and SHALL keep Go_On_Air and Save disabled.
6. THE design SHALL list every Vite and tsconfig setting that the build needs for the CommonJS ggwave file, including how the `require("fs")` and `require("path")` calls are handled so that neither module is requested at run time, and the DOM library setting for the page code.
7. THE page code SHALL pass the existing `typecheck` script, or the design SHALL add a separate tsconfig for the page and add it to the `typecheck` script so that the script type-checks both the existing code and the page code with 0 errors.
8. THE production build SHALL keep the existing three-page Vite `rollupOptions.input` (front page, `/listen`, `/broadcast`) and the `base` handling, and any change to `vite.config.ts` SHALL be limited to what ggwave loading needs.

### Requirement 14: No network, no microphone, bundled text

**User Story:** As the owner, I want the page to keep the promises, so that it is safe to use in an emergency.

#### Acceptance Criteria

1. WHILE the Broadcast_Page is open after its files have loaded, THE Broadcast_Page SHALL make 0 network requests, including `fetch`, `XMLHttpRequest`, beacon and WebSocket requests.
2. THE Broadcast_Page SHALL load 0 scripts, styles, fonts or images from another site.
3. THE Broadcast_Page SHALL load 0 files from the front page's photos.
4. THE Broadcast_Page SHALL make 0 calls to `getUserMedia` or any other microphone API.
5. THE Broadcast_Page SHALL contain no emoji characters in its user-facing text.
6. THE Strings_File SHALL hold every piece of user-facing text of the Broadcast_Page, and THE page code SHALL contain no other English text shown to the user, except values taken from the Decoded_Alert or the Form.
7. THE Strings_File SHALL use keys that are identical in every language file, so that another language file with the same keys can replace it without any change to page logic.
8. THE Strings_File SHALL have a non-empty label for every value of `EVENT_TYPES`, `URGENCIES`, `SEVERITIES` and `ACTIONS`.
9. IF the Vite `base` setting is changed to a different sub-path or to the root `/`, THEN THE Broadcast_Page SHALL still resolve every `<link>`, `<script>` and image path to an existing file, with no path containing a hard-coded `/dead-air/`.
10. THE Broadcast_Page SHALL register 0 service workers in this spec, because registration on all three pages is owned by spec 6.

### Requirement 15: Tests

**User Story:** As the owner, I want tests that show the page logic is correct, so that I can trust it before a real speaker test.

#### Acceptance Criteria

1. THE page logic that builds bytes, runs the Self_Check, computes bytes left, converts map points, picks the counter, builds the Say_First_Line and builds the file name SHALL be pure or injectable functions that run in plain Node under Vitest, with no browser API needed.
2. THE property test for Build SHALL run at least 100 generated cases using fast-check and the real Sound_Link, and for every valid Form value that passes validation, both with a map point and without one, a Build followed by the Self_Check SHALL pass and the Decoded_Alert SHALL equal the source Alert. FOR ALL Forms with both map point boxes empty, the Build SHALL produce an Alert and a Decoded_Alert whose latitude and longitude are null and null, and SHALL NOT produce numeric coordinates.
3. THE property test for a changed byte SHALL run at least 100 generated cases, and for every Alert_Bytes value and every single changed byte (any position, any different value 0 to 255) in the heard payload, the Self_Check comparison SHALL fail, using an injected listener that returns the changed bytes.
4. THE property test for bad listener results SHALL run at least 100 generated cases, and for every injected listener result that is not exactly one payload equal to the Alert_Bytes (no payload, two or more payloads, or one payload with different bytes), the Self_Check SHALL fail and the page logic SHALL return no audio for playback.
5. THE property test for the Say_First_Line SHALL run at least 100 generated cases, and for every Decoded_Alert built from a valid Form, the Say_First_Line SHALL contain the test sentence if and only if `test` is true.
6. THE property test for bytes left SHALL run at least 100 generated cases, and for every place name that is accepted, the bytes left SHALL equal 40 minus the `encodeAlert` length, and for every place name that is rejected, the Form SHALL be invalid.
7. THE property test for expiry SHALL run at least 100 generated cases using `checkExpiry` with generated clock times, and for every Decoded_Alert of an expired Build, the Preview model SHALL NOT carry the status `current`.
8. THE test for the counter SHALL check every counter value from 0 to 255, and for each value the next counter SHALL equal the counter plus 1 modulo 256.
9. THE property test for map points SHALL run at least 100 generated cases over the full valid latitude and longitude range of the map, and for each point, converting to units and back to degrees SHALL differ from the input by at most 0.00005 degree.
10. THE tests SHALL cover the TEST dialog flow with the exact text from Requirement 5: cancel keeps TEST on, confirm turns TEST off, and turning TEST on opens no dialog.
11. THE tests SHALL cover the repeat timing with an injected clock: rounds start 60 seconds apart with identical bytes, Stop cancels all later rounds, and the repeat ends at the valid-until time with no round started at or after it.
12. THE tests SHALL cover the Play_Gap and the double Play with an injected player, and SHALL check that zero player calls happen before a tap and zero player calls happen after a failed Self_Check.
13. THE tests SHALL check that the Strings_File has a non-empty label for every event, urgency, severity and action code, and that the TEST dialog text matches Requirement 5 exactly.
14. THE tests SHALL check that the Station_Store holds only the station ID and the counter, and that unavailable or invalid stored values fall back as in Requirement 4.
15. THE tests SHALL include a build test that builds the site and checks that `dist/broadcast/index.html` and every file it links to contain the ggwave engine, contain no `http://` or `https://` request URL to another site, and use paths that resolve correctly with `BASE_PATH` set and with `BASE_PATH` unset.
16. THE tests SHALL include a browser-run check that loads the built `/broadcast/` page, runs a Self_Check and plays audio, and the owner or an already installed headless browser SHALL run it.
17. IF the browser-run check cannot run in CI, THEN THE spec SHALL list it in a report as not run in CI, with the reason.
18. THE sample alerts and fixtures in the tests and the page SHALL all have `test` set to true, and a test SHALL fail if any fixture has `test` set to false.
19. THE spec SHALL list real speaker and phone tests as a manual step and SHALL NOT claim them as done by code tests.
20. THE tests SHALL cover the Location_Button with an injected Geolocation_Provider: zero provider calls before the tap, a success fills both boxes with values rounded to 4 decimals, and a refusal, an unavailable result, a timeout and a missing API each leave both boxes unchanged and show the message from the Strings_File.
21. THE tests SHALL cover the wake lock with an injected Wake_Lock_Provider: the lock is requested when repeat starts, requested again when the page becomes visible after a release, released on Stop and when repeat ends, and repeat keeps running with a notice when the provider is missing or fails.
22. THE tests SHALL check that the Preview shows the "no map point" text and no coordinates for a Decoded_Alert with null and null, and shows 0, 0 as numbers for a real point at 0, 0.
23. THE spec SHALL write the Report_File. THE Report_File SHALL state that promise 6 is not met on this page for icons until spec 8, because every alert type needs an icon and this page shows text labels only. THE Report_File SHALL list these manual items: real phone sample rate, real phone Build timing, real speaker and phone test, geolocation on a real phone, wake lock on a real phone, and the browser-run check of criterion 17 if it did not run in CI.

## Open Questions

All questions are answered. This section is a record of the owner's decisions.

1. **No map point (Requirements 3, 8 and 15).** Answered: the map point is optional. Both boxes empty means null and null, sent with the No_Map_Point_Flag. 0, 0 is never used for "no point".
2. **Counter and duplicates (Requirements 4, 7 and 12).** Answered: each Go_On_Air press is a new alert with a new sent minute and the next counter. Repeats keep identical bytes. Save as sound file reuses the last Broadcast if the Form is unchanged, otherwise it builds a new one with a new counter.
3. **Valid-for list (Requirement 1).** Answered: the nine fixed choices stay.
4. **Icons and promise 6 (Requirement 8).** Answered: text labels only now. Icons arrive with the radio look in spec 8. The gap is recorded in the Report_File.
5. **Hidden tab and wake lock (Requirement 11).** Answered: yes, use the screen wake lock while repeat is running, with the notice and the catch-up round as fallback.
6. **Sample rate mismatch (Requirement 10).** Answered: the Link loads once at 48000 before any tap. If the Audio_Context runs at another rate, play the same samples as an `AudioBuffer` at the Link rate and let the browser resample.
7. **React (Tech rules).** Answered: no. Plain TypeScript with direct DOM code and no UI framework.
8. **WAV content (Requirement 12).** Answered: the WAV holds both Plays and the Play_Gap.
9. **Self_Check cost and listener use (Requirement 6).** Answered: one short-lived listener per check, disposed after.

Manual checks that remain, listed in the Report_File:
- Real phone sample rate.
- Real phone Build timing.
- Real speaker and phone test.
- Geolocation on a real phone.
- Wake lock on a real phone.
