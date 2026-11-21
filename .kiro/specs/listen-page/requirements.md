# Requirements Document

## Introduction

This is spec 4 of 10. It builds the Listen page at `/listen/`. After a person taps "Start listening", the page listens on the microphone, gives the audio to the Sound_Link, and sends every payload the Sound_Link returns through the Message_Code decode. A payload that passes the check is shown as an alert card. A payload that fails shows only a short "could not read it" line. The page keeps a history of heard alerts on the device, shows what state it is in, shows a live level meter, keeps the screen awake while listening, and tries to listen again when the page becomes visible after being hidden.

The page reuses `src/message-code/` and `src/sound-link/` through their `index.ts` files and the shared helpers in `src/shared/`. The UI is plain. The page is plain TypeScript with direct DOM code and no UI framework. The Teletext look comes in spec 8. Text is English only and lives in the existing strings file (`src/broadcast/strings.en.ts`).

Files this spec owns: `listen/` and a new folder `src/listen/`. Files owned by other specs are not edited, with one approved exception: adding new `listen.*` keys to `src/broadcast/strings.types.ts` and `src/broadcast/strings.en.ts`. Existing keys and labels are reused as they are.

Facts taken from the existing code, which these requirements rely on:
- `Listener.feed` takes `Float32Array` samples at the link's sample rate and returns `{ ok: true, payloads }` or `{ ok: false, reason }`. The payloads are untrusted bytes. `loadSoundLink` accepts a sample rate from 16000 to 96000 and the default is 48000.
- `decodeMessage` returns `{ ok: true, alert }` or `{ ok: false, reason }`. It rejects an unknown version and a failed CRC-32 check.
- `checkExpiry(alert, nowMs)` returns one of `current`, `expired`, `sent-in-future` or `clock-unknown`, with `sentAtMs` and `expiresAtMs`.
- The `Alert` type has `test`, `passedOn`, `event`, `urgency`, `severity`, `action`, `sentMinute`, `validSteps`, `latitude`, `longitude`, `stationId`, `counter` and `placeName`.
- The strings file already has labels for every event, severity and action, for the four expiry statuses (`labels.status`, where `expired` is "Expired"), and the text keys `test.banner` ("TEST"), `nav.home` and `nav.listen`. It has no key for a link to the Broadcast page, no Listen text, and no icons.
- The broadcast page builds the same alert twice in each round and repeats a round every minute with the same bytes. A listener therefore hears the same alert at least twice per round.
- `Alert.latitude` and `Alert.longitude` are both `null` when the alert has no map point, and both integers in units of 0.0001 degree otherwise. `unitsToDegreesText` in `src/broadcast/map-point.ts` turns units into degrees text with 4 decimals. The Broadcast preview (`src/broadcast/preview.ts`) shows the urgency with `labels.urgency` and shows the map point only when it exists. The Strings_File has `labels.urgency`.
- `src/broadcast/dom/web-wake-lock.ts` wraps `navigator.wakeLock` in a provider and belongs to the broadcast spec. `src/shared/` has no wake lock helper, so this spec writes its own provider under `src/listen/`.
- `src/shared/time.ts` has `formatLocal`, `formatUtc` and `formatClock`. `src/shared/fill.ts` has `fillTemplate`.
- Promise 6 needs an icon for every alert type. This spec shows text only. Icons arrive with the Teletext look (spec 8). The gap is recorded in the Report_File (Requirement 15).

## Glossary

- **Listen_Page**: The static page at `<base>listen/`, built from `listen/index.html`.
- **Strings_File**: The existing English strings module `src/broadcast/strings.en.ts` with its types in `src/broadcast/strings.types.ts`.
- **Message_Code**: The module `src/message-code/`, used through its `index.ts`.
- **Sound_Link**: The module `src/sound-link/`, used through its `index.ts`.
- **Start_Button**: The button labelled "Start listening".
- **Stop_Button**: The button that ends listening.
- **Session**: The time from a successful microphone start to the next stop or microphone loss.
- **Audio_Context**: The browser `AudioContext` that carries the microphone samples.
- **Payload**: One byte array returned by `Listener.feed`. A Payload is untrusted until `decodeMessage` accepts it.
- **Heard_Alert**: The `Alert` returned by `decodeMessage` for a Payload that passed the check.
- **Alert_Key**: The triple of `stationId`, `counter` and `sentMinute` of a Heard_Alert.
- **Alert_Card**: The block that shows one Heard_Alert and its heard count.
- **Test_Banner**: The banner with the text of `test.banner` ("TEST") at the top of an Alert_Card whose alert has `test` true.
- **Expiry_Result**: The value `checkExpiry` returns for a Heard_Alert and the current device time.
- **Clock_Line**: The line on an Alert_Card that says this phone's clock may be wrong.
- **Heard_Count**: The number of Payloads that passed the check and have the same Alert_Key as one Alert_Card.
- **History**: The list of Alert_Cards kept in `localStorage`, newest first.
- **History_Store**: The `localStorage` entry that holds the History.
- **History_Limit**: The most Alert_Cards the History keeps. It is 100.
- **Unreadable_Notice**: The line "Heard something but could not read it. Waiting for the repeat."
- **State_Line**: The line that shows one of three states: not listening, listening, or dead air.
- **Dead_Air_Window**: 90 seconds with no Payload of any kind (passed or failed) during a Session. It is longer than the 60 second repeat interval of the Broadcast page.
- **Last_Heard_Time**: The device time at which the most recent Payload that passed the check was heard.
- **Level_Meter**: The bar that shows the loudness of the latest microphone samples.
- **Microphone_Error**: A refusal, a missing microphone, an unsupported browser, an insecure page or any other failure to get the microphone.
- **Allow_Help**: The plain-words steps that tell the person how to allow the microphone.
- **Map_Point_Row**: The row on an Alert_Card that shows latitude and longitude in decimal degrees.
- **Wake_Lock**: A screen wake lock requested from the browser with `navigator.wakeLock`.
- **Wake_Lock_Provider**: The listen-owned provider object around the Wake_Lock, replaceable in tests.
- **Keep_Open_Line**: The line that tells the person to keep the page open and in front because the phone stops listening when the screen turns off.
- **Hidden_Resume**: The automatic attempt to start a Session without a tap when the page becomes visible again.
- **Listening_Intent**: The state that is true from a successful Session start until the person taps the Stop_Button, and stays true while the page is hidden.
- **Hidden_Stop_Notice**: The line saying that listening stopped while the page was hidden.
- **Report_File**: The file `.kiro/specs/listen-page/report.md`.

## Requirements

### Requirement 1: The page, navigation and no network

**User Story:** As a listener, I want the Listen page to open directly and to work without the internet, so that I can use it when the networks are down.

#### Acceptance Criteria

1. WHEN the Listen_Page is requested directly by address at `<base>listen/`, THE Listen_Page SHALL load and show the State_Line and the Start_Button without a redirect or a not-found result, both under a sub-path and at the root of a domain.
2. THE Listen_Page SHALL contain one link to `<base>` (front page) and one link to `<base>broadcast/`, with both paths derived from the Vite `base` setting and no hard-coded `/dead-air/`.
3. THE Listen_Page SHALL make no network request after the page and its own bundled files have loaded.
4. THE Listen_Page SHALL load no font, script, image or style from another site and no front-page photo.
5. WHEN the Listen_Page loads, THE Listen_Page SHALL show the History from the History_Store, and the State_Line SHALL show the not-listening state.
6. THE Listen_Page SHALL show no emoji.

### Requirement 2: Start listening

**User Story:** As a listener, I want to tap one button to start listening, so that the page can hear alerts.

#### Acceptance Criteria

1. WHEN the page loads, THE Listen_Page SHALL not create or resume an Audio_Context and SHALL not request the microphone.
2. WHEN the person taps the Start_Button, THE Listen_Page SHALL create or resume the Audio_Context inside that tap and then request the microphone. The only start without a tap is the Hidden_Resume in Requirement 17.
3. WHEN the Listen_Page requests the microphone, THE Listen_Page SHALL set `echoCancellation`, `noiseSuppression` and `autoGainControl` to false.
4. WHEN the microphone is granted, THE Listen_Page SHALL load the Sound_Link with the sample rate of the Audio_Context, create one Listener, and start a Session.
5. THE Listen_Page SHALL create the Audio_Context with a sample rate of 48000 where the browser allows it, and SHALL use the rate the Audio_Context actually reports when loading the Sound_Link.
6. IF the Sound_Link fails to load or the Listener cannot be created, THEN THE Listen_Page SHALL release the microphone, show a plain-words message that the sound engine could not start, and show the not-listening state.
7. WHILE a Session is running, THE Listen_Page SHALL show the Stop_Button and hide the Start_Button.
8. WHEN the Start_Button is tapped while a start is already in progress, THE Listen_Page SHALL ignore the extra tap.

### Requirement 3: Decode every Payload through the Message_Code

**User Story:** As a listener, I want everything the phone hears to be checked before I see it, so that a damaged alert is never shown.

#### Acceptance Criteria

1. WHILE a Session is running, THE Listen_Page SHALL pass every block of microphone samples to the Listener as a `Float32Array` at the sample rate of the Sound_Link.
2. WHEN the Listener returns a Payload, THE Listen_Page SHALL pass the Payload to `decodeMessage` before showing anything from the Payload.
3. IF the Listener returns `ok: false` for a block of samples, THEN THE Listen_Page SHALL discard that block, show nothing from it, and continue the Session.
4. THE Listen_Page SHALL show a Heard_Alert only when `decodeMessage` returns `ok: true`.
5. THE Listen_Page SHALL take every displayed alert field from the Heard_Alert returned by `decodeMessage` and from no other source.
6. WHEN `decodeMessage` returns `ok: true`, THE Listen_Page SHALL call `checkExpiry` with the Heard_Alert and the current device time and use the Expiry_Result for display.

### Requirement 4: The Alert_Card

**User Story:** As a listener, I want each alert shown as a clear card, so that I can read what to do.

#### Acceptance Criteria

1. WHEN a Heard_Alert is shown, THE Alert_Card SHALL show the event label, the urgency label, the severity label, the action label, the sent time and the valid-until time, each from the Strings_File (`labels.event`, `labels.urgency`, `labels.severity`, `labels.action`) and the shared time helpers.
2. WHEN a Heard_Alert is shown, THE Alert_Card SHALL show the sender ID, which is the `stationId` of the Heard_Alert, with a "Sender ID" label.
3. WHEN the `placeName` of the Heard_Alert is not empty, THE Alert_Card SHALL show the place name.
4. WHEN the `placeName` of the Heard_Alert is empty, THE Alert_Card SHALL leave out the place name row.
5. WHEN the `test` field of the Heard_Alert is true, THE Alert_Card SHALL show the Test_Banner at the top of the card.
6. THE Alert_Card SHALL show the Test_Banner in every state of the card, including expired, repeated and loaded from the History.
7. THE Alert_Card SHALL show the sent time in every state of the card.
8. THE Alert_Card SHALL show the sent time and the valid-until time as local time with its UTC offset, using `formatLocal` and the offset of the device clock.
9. THE Alert_Card SHALL show the event label, urgency label, severity label and action label in text.
10. THE Listen_Page SHALL show no sample, demo or built-in alert that has `test` false.
11. WHEN the `latitude` and `longitude` of the Heard_Alert are integers, THE Alert_Card SHALL show the Map_Point_Row with latitude and longitude in decimal degrees with 4 decimals, formatted with `unitsToDegreesText`.
12. WHEN the `latitude` and `longitude` of the Heard_Alert are `null`, THE Alert_Card SHALL leave out the Map_Point_Row.
13. WHEN the `latitude` and `longitude` of the Heard_Alert are both 0, THE Alert_Card SHALL show the Map_Point_Row with "0.0000" for each value.

### Requirement 5: Expired alerts and clock problems

**User Story:** As a listener, I want an old alert clearly marked, and a warning when the phone clock cannot be trusted, so that I do not act on stale information.

#### Acceptance Criteria

1. WHEN the Expiry_Result of a Heard_Alert is `expired`, THE Alert_Card SHALL be greyed out and SHALL show the word "Expired" taken from `labels.status.expired`.
2. WHEN the Expiry_Result of a Heard_Alert is `current`, THE Alert_Card SHALL show no "Expired" word, no greyed-out style and no Clock_Line.
3. WHEN the Expiry_Result of a Heard_Alert is `sent-in-future` or `clock-unknown`, THE Alert_Card SHALL still show the alert, SHALL show the sent time, and SHALL show the Clock_Line.
4. THE Alert_Card SHALL not describe a Heard_Alert as current unless the Expiry_Result is `current`.
5. WHILE the Listen_Page is open, THE Listen_Page SHALL re-run `checkExpiry` for every Alert_Card with the current device time at least once every 30 seconds and update the card.
6. WHEN an Alert_Card is loaded from the History, THE Listen_Page SHALL run `checkExpiry` with the current device time and SHALL not use a status stored from an earlier time.

### Requirement 6: Payloads that fail the check

**User Story:** As a listener, I want a short note when something was heard but could not be read, so that I know to wait for the repeat.

#### Acceptance Criteria

1. IF `decodeMessage` returns `ok: false` for a Payload, THEN THE Listen_Page SHALL show the Unreadable_Notice.
2. IF `decodeMessage` returns `ok: false` for a Payload, THEN THE Listen_Page SHALL show no field, label or text derived from that Payload, including the rejection reason.
3. IF `decodeMessage` returns `ok: false` for a Payload, THEN THE Listen_Page SHALL not add an Alert_Card, change a Heard_Count or change the History.
4. WHEN a later Payload passes the check, THE Listen_Page SHALL remove the Unreadable_Notice.
5. WHEN a Session ends, THE Listen_Page SHALL remove the Unreadable_Notice.

### Requirement 7: The same alert heard again

**User Story:** As a listener, I want a repeated alert counted and not listed again, so that the list stays short and a new alert is never hidden by an old one.

#### Acceptance Criteria

1. WHEN a Heard_Alert has the same Alert_Key as an Alert_Card already in the History, THE Listen_Page SHALL increase the Heard_Count of that card by one and SHALL not add a new card.
2. WHEN a Heard_Alert has an Alert_Key that is not in the History, THE Listen_Page SHALL add a new Alert_Card with a Heard_Count of 1 at the top of the History.
3. THE Alert_Card SHALL show the Heard_Count with the text "Heard N times", where N is the Heard_Count, and "Heard 1 time" when N is 1.
4. WHEN a repeat of an Alert_Key arrives, THE Listen_Page SHALL keep the card in its place in the History order.
5. WHEN a Heard_Alert has the same `stationId` and `counter` as a card but a different `sentMinute`, THE Listen_Page SHALL add a new Alert_Card for it.
6. FOR ALL sequences of Payloads that pass the check, THE History SHALL hold one Alert_Card per distinct Alert_Key (`stationId`, `counter` and `sentMinute`) and the Heard_Count of each card SHALL equal the number of Payloads with that Alert_Key.

### Requirement 8: History that survives closing the page

**User Story:** As a listener, I want my list of alerts to be there when I open the page again, so that I do not lose an alert by closing the page.

#### Acceptance Criteria

1. WHEN an Alert_Card is added or its Heard_Count changes, THE Listen_Page SHALL save the History to the History_Store.
2. THE History_Store SHALL hold, for each Alert_Card, the message bytes that passed the check, the Heard_Count, the time the alert was first heard and the Last_Heard_Time of the card, and nothing else.
3. WHEN the Listen_Page loads, THE Listen_Page SHALL run `decodeMessage` on the stored bytes of every entry and SHALL keep only entries for which `decodeMessage` returns `ok: true`.
4. IF the History_Store holds data that cannot be read, or an entry fails `decodeMessage`, THEN THE Listen_Page SHALL drop the unreadable data or entry, show nothing from it, and keep the other entries.
5. THE Listen_Page SHALL order the History with the card first heard most recently at the top.
6. WHEN the History holds more than the History_Limit cards, THE Listen_Page SHALL remove the oldest cards until the History holds the History_Limit cards.
7. IF `localStorage` is not available or a save fails, THEN THE Listen_Page SHALL keep the History in memory for the Session and SHALL show a line that the history will not be kept on this device.
8. FOR ALL Heard_Alerts, saving then loading the History SHALL give an equal Heard_Alert, Heard_Count and times (round-trip property).

### Requirement 9: Clear the History

**User Story:** As a listener, I want to clear the list, so that old alerts do not pile up.

#### Acceptance Criteria

1. THE Listen_Page SHALL show a "Clear history" button.
2. WHEN the person taps the "Clear history" button, THE Listen_Page SHALL remove every Alert_Card from the page and remove the History_Store entry.
3. WHEN the History is cleared, THE State_Line SHALL show that nothing has been heard yet.
4. WHILE the History holds no Alert_Card, THE Listen_Page SHALL disable the "Clear history" button.

### Requirement 10: The State_Line

**User Story:** As a listener, I want to see at all times whether the phone is listening and when it last heard an alert, so that I can trust the page.

#### Acceptance Criteria

1. THE State_Line SHALL show exactly one of three states at any time: not listening, listening, or dead air.
2. WHILE no Session is running, THE State_Line SHALL show the not-listening state.
3. WHILE a Session is running and a Payload was heard within the last Dead_Air_Window, THE State_Line SHALL show the listening state.
4. WHILE a Session is running and no Payload was heard within the last Dead_Air_Window, THE State_Line SHALL show the dead air state.
5. WHEN a Session starts, THE State_Line SHALL show the listening state until the Dead_Air_Window passes with no Payload heard.
6. WHILE the State_Line shows the dead air state and a Last_Heard_Time exists, THE State_Line SHALL show "Dead air. Last heard N min ago.", where N is the number of whole minutes from the Last_Heard_Time to the current device time.
7. WHILE the State_Line shows the dead air state and no Last_Heard_Time exists, THE State_Line SHALL show "Dead air. Nothing heard yet."
8. WHILE the State_Line shows the dead air state, THE Listen_Page SHALL update the value of N at least once every 10 seconds.
9. WHEN the Last_Heard_Time is later than the current device time, THE State_Line SHALL show N as 0.
10. THE Listen_Page SHALL set the Last_Heard_Time from the most recent `lastHeard` time in the History when the page loads.

### Requirement 11: The Level_Meter

**User Story:** As a listener, I want to see that the microphone is picking up sound, so that I know the page is working.

#### Acceptance Criteria

1. WHILE a Session is running, THE Level_Meter SHALL show the loudness of the latest microphone samples and SHALL update at least 10 times per second.
2. THE Level_Meter SHALL show an empty bar for silent samples and SHALL show a full bar for samples at full scale.
3. WHILE no Session is running, THE Level_Meter SHALL show an empty bar.
4. THE Level_Meter SHALL have a text alternative that gives the level as a percentage for assistive technology.
5. FOR ALL blocks of samples, THE level value SHALL be a number from 0 to 1.

### Requirement 12: Microphone problems

**User Story:** As a listener whose microphone is refused or missing, I want plain instructions, so that I can fix it myself.

#### Acceptance Criteria

1. IF the person refuses the microphone, THEN THE Listen_Page SHALL show the not-listening state and the Allow_Help.
2. IF the device has no microphone, THEN THE Listen_Page SHALL show the not-listening state and a message that no microphone was found.
3. IF the page is not on https or localhost, or the browser has no microphone feature, THEN THE Listen_Page SHALL show the not-listening state and a message that the microphone needs a secure page or a newer browser.
4. THE Allow_Help SHALL tell the person to open the browser's site settings or the lock icon beside the address, set Microphone to Allow for this site, and tap "Start listening" again.
5. IF the microphone stops during a Session, THEN THE Listen_Page SHALL end the Session, show the not-listening state and show a message that the microphone stopped.
6. WHEN a Microphone_Error is shown, THE Start_Button SHALL stay available so the person can try again.
7. WHEN the person taps the Start_Button after a Microphone_Error, THE Listen_Page SHALL remove the earlier error message.

### Requirement 13: Stopping, and microphone audio stays in memory

**User Story:** As a listener, I want the phone to forget what it heard, so that my privacy is kept.

#### Acceptance Criteria

1. WHEN the person taps the Stop_Button, THE Listen_Page SHALL stop every microphone track, dispose the Listener, close the Audio_Context and show the not-listening state.
2. THE Listen_Page SHALL process microphone samples in memory and discard them after the Listener has consumed them.
3. THE Listen_Page SHALL not write microphone samples or any derived audio to `localStorage`, `sessionStorage`, IndexedDB, the Cache API, a file, a log or any network request body.
4. THE Listen_Page SHALL write only the History_Store entries described in Requirement 8 to device storage.
5. WHEN the page is hidden or closed, THE Listen_Page SHALL release the microphone tracks and the Wake_Lock it holds. A Hidden_Resume (Requirement 17) is the only way the microphone is requested again without a tap.
6. WHEN the person taps the Start_Button again after a stop, THE Listen_Page SHALL start a new Session with a new Audio_Context and a new Listener.

### Requirement 14: Text in the Strings_File

**User Story:** As a maintainer, I want all Listen text in the strings file, so that other languages can be added in spec 7.

#### Acceptance Criteria

1. THE Listen_Page SHALL take every user-facing text from the Strings_File, with no sentence written in the page code.
2. THE Listen_Page SHALL reuse existing keys and labels of the Strings_File for the event, severity and action labels, the expiry status labels, `test.banner` and navigation text, without changing them.
3. WHERE the Strings_File has no key for a Listen text, THE Listen_Page SHALL add a new key with the prefix `listen.` and a matching entry in the placeholder table.
4. THE Strings_File SHALL hold, for every `listen.` key, a non-empty English text whose `{name}` placeholders match the placeholder table.
5. THE Listen_Page SHALL show the Unreadable_Notice, the dead air texts and the heard-count texts with the exact wording of this document.
6. THE Listen_Page SHALL fill placeholders with `fillTemplate` and SHALL show a plain fallback line instead of an empty or broken text if a template cannot be filled.

### Requirement 15: Ownership, tests and the report

**User Story:** As a maintainer, I want this spec to stay inside its files and record what it leaves open, so that later specs know the state.

#### Acceptance Criteria

1. THE Listen_Page SHALL keep its logic that does not need a browser (heard-alert list, deduplication, History saving and loading, state decision, level calculation, text building) in pure functions under `src/listen/` that run in plain Node.
2. THE Listen_Page SHALL reach the microphone, the Audio_Context, `localStorage` and the clock only through small provider objects that tests replace.
3. THE spec SHALL change no file in `src/message-code/`, `src/sound-link/`, `broadcast/`, `sound-test/` or the other `src/broadcast/` files, and SHALL change `src/broadcast/strings.types.ts` and `src/broadcast/strings.en.ts` only by adding `listen.` keys.
4. THE spec SHALL add property tests, run with Vitest and fast-check, for these properties: a repeated Alert_Key (`stationId`, `counter` and `sentMinute`) gives one card and a matching Heard_Count, and alerts that differ only in `sentMinute` give separate cards; a Payload that fails `decodeMessage` changes no card and no stored data; an alert whose Expiry_Result is not `current` never shows as current; History saving then loading gives the same cards; every level value is from 0 to 1.
5. THE spec SHALL use only test alerts (`test` true) in every test fixture, sample and demo.
6. THE spec SHALL write the Report_File with the gaps it leaves: promise 6 icons are missing until spec 8 (the cards show text only), the service worker comes in spec 6, and the checks on real phones and speakers are not yet done.
7. THE spec SHALL add no new npm dependency.

### Requirement 16: Keep the screen awake

**User Story:** As a listener, I want the phone to stay awake while listening, so that the page keeps hearing alerts.

#### Acceptance Criteria

1. WHEN a Session starts and the Wake_Lock_Provider reports support, THE Listen_Page SHALL request a Wake_Lock.
2. WHILE a Session is running, THE Listen_Page SHALL show the Keep_Open_Line.
3. WHEN a Session ends, THE Listen_Page SHALL release the Wake_Lock and hide the Keep_Open_Line.
4. IF the Wake_Lock request is refused or fails, THEN THE Listen_Page SHALL continue the Session without change to the State_Line and the Level_Meter.
5. IF the Wake_Lock_Provider reports no support, THEN THE Listen_Page SHALL continue the Session.
6. WHEN the browser releases the Wake_Lock while a Session is running, THE Listen_Page SHALL request a Wake_Lock again once the page is visible, and a failure of that request SHALL not end the Session.
7. THE Listen_Page SHALL reach the Wake_Lock only through the Wake_Lock_Provider under `src/listen/`, with no edit to `src/broadcast/dom/web-wake-lock.ts`.

### Requirement 17: Listen again when the page becomes visible

**User Story:** As a listener, I want the page to try to listen again when I come back to it, so that I do not have to tap again after a short interruption.

#### Acceptance Criteria

1. WHEN the page becomes hidden while a Session is running, THE Listen_Page SHALL end the Session as in Requirement 13.1 and keep the Listening_Intent true.
2. WHEN the page becomes visible and the Listening_Intent is true, THE Listen_Page SHALL attempt a Hidden_Resume by creating a new Audio_Context, requesting the microphone with the settings of Requirement 2.3, and starting a new Session.
3. WHEN the page becomes visible and the Listening_Intent is false, THE Listen_Page SHALL not request the microphone or create an Audio_Context.
4. IF the Hidden_Resume fails because the browser needs a tap for the Audio_Context or the microphone, or refuses either, THEN THE Listen_Page SHALL show the not-listening state and the Hidden_Stop_Notice and keep the Start_Button available.
5. IF the Hidden_Resume fails, THEN THE Listen_Page SHALL release every microphone track and Audio_Context it created for that attempt.
6. WHEN a Hidden_Resume succeeds, THE Listen_Page SHALL show the listening state, request a Wake_Lock as in Requirement 16, and set the Listening_Intent to true.
7. WHEN the person taps the Stop_Button, THE Listen_Page SHALL set the Listening_Intent to false.
8. WHEN a Microphone_Error ends a Session in Requirement 12.5, THE Listen_Page SHALL set the Listening_Intent to false.
9. WHEN the person taps the Start_Button after a Hidden_Resume failure, THE Listen_Page SHALL remove the Hidden_Stop_Notice.
10. THE Listen_Page SHALL ignore a visibility change that arrives while a start or a Hidden_Resume is in progress.
11. THE Listen_Page SHALL request the microphone without a tap only in a Hidden_Resume.

## Decisions

These points were answered by the project owner.

1. The spec adds `listen.*` keys to `src/broadcast/strings.types.ts` and `src/broadcast/strings.en.ts` and changes nothing else in those files.
2. The Alert_Key is `stationId`, `counter` and `sentMinute`, because the counter wraps after 256 sends.
3. The Dead_Air_Window is 90 seconds, because broadcasts repeat every 60 seconds.
4. The History_Limit is 100 cards.
5. The History is ordered by first heard, and a repeat does not move a card.
6. The Stop_Button stays.
7. Cards show text only. The missing icons (promise 6) are recorded in the Report_File until spec 8.
