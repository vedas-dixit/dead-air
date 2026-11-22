# Requirements Document

## Introduction

Pass it on lets a listener play an alert they received through the phone's own speaker, so that people out of range of the first sender can hear it. It is spec 9 of 10 for Dead Air. It adds one button to each current Alert_Card on the Listen page. The button plays the same alert through the Sound_Link with the Passed_On_Flag set and a hop count raised by one. The alert keeps its sent time, valid-for period, station ID and counter, so that every phone treats the copy as the same alert.

### What the code already has

- The Message has a Passed_On_Flag (bit 2 of byte 0). The Alert type has `passedOn`. The Broadcast page always sends `passedOn: false`.
- The Message has no hop count. Every byte of the layout is in use: byte 0 holds the Version and four flags, and the counter, station ID, Valid_Steps and place name are fixed. The only free space is in two places:
  - The high 4 bits of the Event_Type byte (byte 1). Event codes are 1 to 9, so those bits are always 0 today.
  - Values 150 to 255 of the packed Urgency, Severity and Action byte (byte 2).
- The History keys an alert by station ID, counter and Sent_Minute, so a passed-on copy already matches the original card. The History keeps the first heard alert unedited and counts repeats. It stores no hop count.

### Proposal: the smallest change to the message layout

The Message_Code needs a hop count. This spec proposes the smallest change that gives one.

- **Where.** The high 4 bits of byte 1 hold the Hop_Count, 0 to 15. The low 4 bits keep the Event_Type code, 1 to 9.
- **Size.** The Message stays 21 to 40 bytes. No field moves. The Check_Value stays a 4-byte CRC-32 over every byte before it, so a changed hop count is caught like any other changed byte.
- **Original alerts are unchanged.** An alert that has not been passed on has Hop_Count 0, so its bytes are identical to today's bytes.
- **Rule that ties the flag to the count.** The Passed_On_Flag is set exactly when the Hop_Count is 1 or more. The Decoder rejects any other pairing, so there is one byte form for each alert (canonical encoding, as in message-code Requirement 4.3).
- **Why not the other free space.** Values 150 to 255 of byte 2 cannot hold a 0 to 15 count without changing the mixed-radix packing of three other fields. The high nibble of byte 1 needs no repacking.
- **Older apps.** An older Version 1 decoder reads byte 1 as the whole Event_Type code and rejects any non-zero hop count as `unknown-event`. A phone with an older app therefore ignores a passed-on copy and never shows a wrong alert. This is the same safe behaviour that message-code used for the No_Map_Point_Flag.
- **Version (confirmed).** The owner confirmed that the Version stays 1. The precedent set by the No_Map_Point_Flag change is to keep Version 1 when older decoders reject the new form and the old byte forms are unchanged. This proposal follows that precedent. Message-code Requirement 6.4 is updated to state this rule, with the optional map point and the hop count as the two precedents.
- **Approval.** The owner has approved this proposal. It edits files that spec 1 owns, and those edits need no further per-file approval (Requirement 15). The tests still come first (Requirement 3 criterion 7).
- **Tests first.** The tests that describe the new layout are written and shown failing before any Message_Code source file is changed (Requirement 3).

### Decisions made in this document

The owner has confirmed decisions 1 to 11.

1. **Maximum of 15 hops.** A copy with Hop_Count 15 cannot be passed on again. Pass it on is shown disabled with a reason.
2. **Own pass does not count.** Passing an alert on does not change the Highest_Hop_Count of that card on the sending phone. The phone does not listen while it plays, so it never hears its own copy.
3. **Hop count for the copy.** The copy carries the card's Highest_Hop_Count plus 1.
4. **Play pattern.** The copy plays twice with a 1 second gap, the same as Go on air.
5. **Only current alerts.** Pass it on is offered only when the expiry status is `current`. The statuses `sent-in-future` and `clock-unknown` are not offered, because they are not `current`.
6. **Version stays 1.** The hop count uses the high 4 bits of byte 1 and the Version number does not change (confirmed).
7. **Sound_Link loads on the tap.** The Sound_Link is not loaded until needed. A tap on the Pass_Button loads it if it is not loaded yet, with the audio unlocked inside that tap. The Pass_Button is therefore enabled on saved current alerts even when no Session has run.
8. **Volume reminder.** While a Copy plays, the Listen_Page shows the line "Turn your volume all the way up." The page cannot read the device volume setting, so the line is a reminder only.
9. **A failed load is retried by the next tap.** The Pass_Button is disabled only while a Sound_Link_Load is running. After a failed load the Pass_Button stays enabled, the page shows a plain failure line, and the next tap on the Pass_Button retries the load with the audio unlocked inside that tap. There is no separate Try again button.
10. **Start listening is disabled while a Copy plays.** The Start_Button is shown disabled, with a reason line, from the tap on the Pass_Button until the Pass_Playback has ended or been cancelled and the Echo_Guard has finished. A tap on a disabled Start_Button is not accepted.
11. **Playing reuses the loaded link.** A separate Play_Link_Function plays through the already loaded Sound_Link and never loads it. A Session start reloads the Sound_Link only when the sample rate of the loaded Sound_Link differs from the sample rate of the microphone. When the rates match, a loaded Sound_Link is not reloaded. A start can never cut the sound of a Copy, because the Start_Button is disabled while a Sound_Link_Load runs, while a Copy plays and during the Echo_Guard (decision 10).

### Files of other specs that need edits

The owner has approved every edit in this table (Requirement 15).

| Owner | File | Edit |
|---|---|---|
| message-code | `src/message-code/types.ts`, `layout.ts`, `encode.ts`, `decode.ts`, `validate.ts`, `index.ts` | Add `hopCount`, the nibble rule and the pairing rule. |
| message-code | `tests/message-code/` | Update generators and examples for `hopCount` first. |
| broadcast-page | `src/broadcast/build.ts`, `place-name.ts` and any other literal Alert | Add `hopCount: 0` to every Alert built there. |
| languages | `src/languages/translation-check.ts` | Add `hopCount: 0` to the Alert it builds. |
| languages | `src/languages/strings.hi.ts` | Add the new Hindi text. |
| broadcast-page | `src/broadcast/strings.en.ts`, `strings.types.ts` | Add the new text keys. |
| listen-page | `src/listen/history.ts`, `history-store.ts`, `card.ts`, `controller.ts`, `providers.ts`, `ui-state.ts`, `dom/*` | Track the Highest_Hop_Count, add the button and the pause. |
| radio-look | `src/shared/ui/` styles | Style the button and the line, if needed. |
| offline | none | The File_List is generated by the build. |

## Glossary

- **Pass_It_On**: The feature in this spec. It is the Pass_Button, the Copy, and the pause and resume around the Copy.
- **Listen_Page**: The static page at `<base>listen/`, owned by spec 4.
- **Alert_Card**: The block on the Listen_Page that shows one History entry.
- **Pass_Button**: The button labelled "Pass it on" on an Alert_Card.
- **Message_Code**: The module `src/message-code/`, used through its `index.ts`.
- **Sound_Link**: The module `src/sound-link/`, used through its `index.ts`.
- **Alert**: The decoded form of a message, as in the Message_Code.
- **Hop_Count**: A whole number from 0 to 15 in the Alert. It is 0 for an alert that has not been passed on. Each Copy carries one more than the alert it was made from.
- **Hop_Nibble**: The high 4 bits of byte 1 of the Message. It holds the Hop_Count. The low 4 bits hold the Event_Type code.
- **Max_Hop_Count**: 15, the largest Hop_Count the Hop_Nibble holds.
- **Passed_On_Flag**: The existing flag in bit 2 of byte 0.
- **Alert_Key**: The triple of `stationId`, `counter` and `sentMinute`. The Hop_Count and the Passed_On_Flag are not part of the Alert_Key.
- **Highest_Hop_Count**: For one History entry, the largest Hop_Count among all payloads that passed the check and have that entry's Alert_Key.
- **Passed_On_Line**: The line on an Alert_Card that shows "Passed on N times", where N is the Highest_Hop_Count.
- **Copy**: The Message the Pass_Button plays. It has the same fields as the alert on the card, except that the Passed_On_Flag is set and the Hop_Count is the card's Highest_Hop_Count plus 1.
- **Expiry_Result**: The value `checkExpiry` returns for an alert and the current device time.
- **Sound_Link_Load**: The step that loads the Sound_Link when it is not loaded yet. The Pass_Button tap starts it, and the audio is unlocked inside that tap.
- **Volume_Reminder**: The line "Turn your volume all the way up." shown while a Copy plays. It is a reminder only, because the page cannot read the device volume setting.
- **Start_Button**: The existing control on the Listen_Page, labelled "Start listening", that starts a Session.
- **Start_Reason_Line**: The line shown next to a disabled Start_Button that says why it is disabled and what to do next.
- **Load_Failure_Line**: The line shown after a failed Sound_Link_Load. It says that the sound could not be loaded and that tapping Pass it on again tries again.
- **Play_Link_Function**: The function that plays samples through the Sound_Link that is already loaded. It never starts a Sound_Link_Load.
- **Failure_Line**: Any line of this spec that tells the person something went wrong: the Load_Failure_Line and the lines in Requirements 5, 6 and 7.
- **Pass_Playback**: The time from the first sample of the first Play of a Copy to the end of the second Play, or to a stop.
- **Play**: One playing of the Copy samples through the speaker.
- **Play_Gap**: 1 second between the end of the first Play and the start of the second Play, with a tolerance of 0.25 seconds.
- **Listening_Pause**: The state of the Listen_Page during the Pass_Playback and the Echo_Guard, where the Listen_Page does not feed microphone samples to a Listener.
- **Echo_Guard**: 1 second after the Pass_Playback ends, during which microphone samples are still discarded, so that the room echo of the Copy is not heard as an alert.
- **Strings_File**: The English strings module `src/broadcast/strings.en.ts` with its types in `strings.types.ts`, and the Hindi file `src/languages/strings.hi.ts`.
- **Shipped_Languages**: English and Hindi.
- **Player**: The existing playback provider interface in `src/broadcast/providers.ts`.
- **Report_File**: The file `.kiro/specs/pass-it-on/report.md`.

## Requirements

### Requirement 1: Hop count in the message layout

**User Story:** As a listener who passes an alert on, I want the message to carry how many times it has been passed on, so that other phones can show it.

#### Acceptance Criteria

1. THE Message_Code SHALL carry the Hop_Count in the Hop_Nibble and the Event_Type code in the low 4 bits of byte 1.
2. THE Message_Code SHALL accept a Hop_Count from 0 to 15 in an Alert.
3. THE Message_Code SHALL keep the Message at 21 to 40 bytes and SHALL keep the offset and size of every field other than the split of byte 1.
4. THE Message_Code SHALL keep the Check_Value a 4-byte CRC-32 over every byte before it.
5. WHEN an Alert has Hop_Count 0, THE Encoder SHALL produce the same bytes that the Encoder produced for that Alert before this change.
6. WHEN an Alert has a Hop_Count of 1 or more, THE Encoder SHALL set the Passed_On_Flag.
7. WHEN an Alert has Hop_Count 0, THE Encoder SHALL clear the Passed_On_Flag.
8. THE Message_Code SHALL keep the Version at 1.
9. THE Message_Code SHALL keep every Event_Type code, every Urgency, Severity and Action code, and every other assigned code unchanged.

### Requirement 2: Decoding the hop count

**User Story:** As a listener, I want a damaged or inconsistent hop count rejected, so that I never see a wrong "Passed on" line.

#### Acceptance Criteria

1. WHEN the Decoder accepts a Message, THE Decoder SHALL return an Alert whose Hop_Count equals the Hop_Nibble.
2. IF the Hop_Nibble is 0 and the Passed_On_Flag is set, THEN THE Decoder SHALL return a Rejection with the reason `invalid-field`.
3. IF the Hop_Nibble is 1 or more and the Passed_On_Flag is clear, THEN THE Decoder SHALL return a Rejection with the reason `invalid-field`.
4. IF the low 4 bits of byte 1 are not an Event_Type code from 1 to 9, THEN THE Decoder SHALL return a Rejection with the reason `unknown-event`.
5. THE Decoder SHALL verify the Check_Value before it reads the Hop_Nibble.
6. IF an Alert has a Hop_Count that is not a whole number from 0 to 15, THEN THE Encoder SHALL return a Rejection with the reason `invalid-field` that names the field `hopCount`.
7. IF an Alert has `passedOn` that does not match its Hop_Count by the rules in Requirement 1 criteria 6 and 7, THEN THE Encoder SHALL return a Rejection with the reason `invalid-field` that names the field `passedOn`.
8. FOR ALL valid Alerts including every Hop_Count from 0 to 15, decoding the encoded Message SHALL return an Alert equal to the original (round-trip property).
9. FOR ALL byte sequences that the Decoder accepts, encoding the decoded Alert SHALL produce the same bytes (canonical encoding).
10. IF any single byte of a valid Message with any Hop_Count is changed to a different value, THEN THE Decoder SHALL return a Rejection.
11. FOR ALL Alerts and Messages with a mismatched pairing of the Passed_On_Flag and the Hop_Count, THE Encoder SHALL return a Rejection for an Alert with `passedOn` set and Hop_Count 0 or `passedOn` clear and Hop_Count 1 or more, THE Decoder SHALL return a Rejection with the reason `invalid-field` for a Message with the Passed_On_Flag set and Hop_Nibble 0 or the Passed_On_Flag clear and Hop_Nibble 1 or more (built with a correct Check_Value), and THE validate function SHALL reject the same Alerts (property test).
12. THE property test in criterion 11 SHALL live in the Listen_Page tests and run over the real Message_Code, and SHALL NOT be one of the four Message_Code property tests in Requirement 3 criterion 3.

### Requirement 3: Tests of the layout change are written first

**User Story:** As the project owner, I want the layout tests changed before the layout code, so that the change is checked from the start.

#### Acceptance Criteria

1. THE Pass_It_On spec SHALL change the Message_Code tests for Requirements 1 and 2 before it changes any Message_Code source file.
2. WHEN the changed Message_Code tests are first run against the unchanged Message_Code source, THE tests SHALL fail, and THE Report_File SHALL record the names of the failing tests.
3. THE Pass_It_On spec SHALL keep exactly four fast-check property tests for the Message_Code, as message-code Requirement 12.1 requires, and SHALL change the generators of those tests to cover every Hop_Count from 0 to 15 and the matching Passed_On_Flag.
4. THE Pass_It_On spec SHALL add example-based tests for: byte 1 equal to the event code for Hop_Count 0; byte 1 high nibble equal to 1 and 15 for those Hop_Counts; every rejection in Requirement 2; the Hop_Nibble and the Passed_On_Flag mismatch in both directions, each built with a correct Check_Value so that the check does not reject first; and an unchanged byte sequence for a Hop_Count 0 Alert from before this change.
5. THE Pass_It_On spec SHALL keep the round-trip, single-changed-byte and expired-never-current properties unchanged in meaning.
6. THE Pass_It_On spec SHALL store every Fixture with the TEST_Flag set.
7. THE Pass_It_On spec SHALL change no Message_Code source file until the changed tests have been run against the unchanged source and shown failing, as criterion 2 requires.

### Requirement 4: The Pass_Button

**User Story:** As a listener, I want a "Pass it on" button on each current alert, so that I can help the alert reach people who are out of range.

#### Acceptance Criteria

1. WHILE the Expiry_Result of an Alert_Card has the status `current`, THE Listen_Page SHALL show an enabled Pass_Button on that Alert_Card, unless a condition in criteria 2 to 5 applies.
2. WHILE the Expiry_Result of an Alert_Card has the status `expired`, `sent-in-future` or `clock-unknown`, THE Listen_Page SHALL show no enabled Pass_Button on that Alert_Card.
3. WHILE the Highest_Hop_Count of an Alert_Card is 15, THE Listen_Page SHALL show the Pass_Button disabled and SHALL show a line from the Strings_File that says the alert cannot be passed on again.
4. WHILE a Pass_Playback is running, THE Listen_Page SHALL show every Pass_Button disabled.
5. WHILE a Sound_Link_Load is running, THE Listen_Page SHALL show every Pass_Button disabled, and IF a Sound_Link_Load has failed, THEN THE Listen_Page SHALL show the Load_Failure_Line and SHALL keep every Pass_Button that criteria 1 to 4 allow enabled.
6. THE Listen_Page SHALL run `checkExpiry` with the current device time every time it renders an Alert_Card, and SHALL NOT use an Expiry_Result stored from an earlier time.
7. WHEN the Expiry_Result of an Alert_Card changes from `current` to any other status while the card is shown, THE Listen_Page SHALL disable the Pass_Button on the next one-second update.
8. THE Pass_Button SHALL be a real `button` element with the text from the Strings_File and SHALL show no emoji.
9. WHILE the Listen_Page is not running a Session, including when the Sound_Link is not loaded yet or the last Sound_Link_Load failed, THE Listen_Page SHALL show an enabled Pass_Button on current Alert_Cards that come from the saved History, as criterion 1 requires.
10. WHEN the person taps the Pass_Button and the Sound_Link is not loaded, including after a failed Sound_Link_Load, THE Listen_Page SHALL start a new Sound_Link_Load inside that tap, with the audio unlocked inside that tap, and SHALL build and play the Copy when the load succeeds.
11. WHEN a Sound_Link_Load starts, THE Listen_Page SHALL remove the Load_Failure_Line.
12. THE Listen_Page SHALL show no Try again button, because the next tap on the Pass_Button is the retry.

### Requirement 5: Expired alerts cannot be passed on

**User Story:** As a listener, I want the app to refuse to pass on an alert that has ended, so that no one hears an old warning as new (promise 2).

#### Acceptance Criteria

1. WHEN the person taps the Pass_Button, THE Listen_Page SHALL run `checkExpiry` with the current device time before any sound is built.
2. IF the Expiry_Result of that check is not `current`, THEN THE Listen_Page SHALL build no Copy, SHALL play no sound, and SHALL show a line from the Strings_File that says the alert is no longer current.
3. WHEN the Copy is ready to play, THE Listen_Page SHALL run `checkExpiry` once more, and IF the result is not `current`, THEN THE Listen_Page SHALL play no sound.
4. WHEN the second Play of a Pass_Playback is due to start, THE Listen_Page SHALL run `checkExpiry` again, and IF the result is not `current`, THEN THE Listen_Page SHALL cancel the second Play and SHALL show the `listen.pass.err.expired-mid` line.
5. FOR ALL Alerts and all current device times at or after the Expiry_Time, THE function that decides whether a Copy may be built SHALL refuse (property test).
6. THE Listen_Page SHALL decide expiry only from the sent time, the valid-for period and the device clock, and SHALL NOT change the Sent_Minute or Valid_Steps of the Copy.

### Requirement 6: Building the Copy

**User Story:** As a listener, I want the copy to say exactly what the first sender said, so that nothing changes along the way.

#### Acceptance Criteria

1. WHEN the person taps the Pass_Button on a current alert, THE Listen_Page SHALL build the Copy from the Alert of that History entry with the Passed_On_Flag set and the Hop_Count set to the Highest_Hop_Count plus 1.
2. THE Copy SHALL have the same TEST_Flag, Event_Type, Urgency, Severity, Action, Sent_Minute, Valid_Steps, latitude, longitude, station ID, counter and Place_Name as the Alert of that History entry.
3. THE Listen_Page SHALL encode the Copy with the Message_Code Encoder, so that the Copy has a new correct Check_Value.
4. THE Listen_Page SHALL NOT edit the bytes of a stored Message by hand.
5. WHEN the Copy is encoded, THE Listen_Page SHALL decode the bytes with the Message_Code Decoder and compare them with the Copy fields, and IF they are not equal, THEN THE Listen_Page SHALL play no sound and SHALL show the `listen.pass.err.failed` line.
6. IF the Highest_Hop_Count is 15, THEN THE Listen_Page SHALL build no Copy.
7. IF the Encoder, the Sound_Link or the self-check returns a Rejection or an error, THEN THE Listen_Page SHALL play no sound, SHALL leave the History unchanged, and SHALL show a line from the Strings_File that says the alert could not be passed on.
8. FOR ALL valid current Alerts with Hop_Count 0 to 14, the Copy SHALL decode to an Alert equal to the original except for the Passed_On_Flag set and the Hop_Count raised by 1 (property test).
9. WHEN the Alert has the TEST_Flag set, THE Copy SHALL have the TEST_Flag set, so that every phone that hears the Copy shows the TEST banner (promise 3).
10. THE Copy SHALL have the same Alert_Key as the Alert of that History entry.

### Requirement 7: Playing the Copy

**User Story:** As a listener, I want one tap to play the alert on my speaker, so that people near me can hear it.

#### Acceptance Criteria

1. WHEN the person taps the Pass_Button, THE Listen_Page SHALL create or resume the Audio_Context for playback inside that tap.
2. IF the Audio_Context for playback cannot be created or resumed, THEN THE Listen_Page SHALL play no sound, SHALL show a line from the Strings_File that says sound could not be played, and SHALL leave the Pass_Button enabled.
3. WHEN the Copy passes Requirement 6 criterion 5, THE Listen_Page SHALL turn the Copy bytes into samples with `bytesToAudio`, play them as the first Play, wait the Play_Gap, then play the same samples as the second Play.
4. THE Listen_Page SHALL play the same samples in both Plays, with no new build between them.
5. THE Listen_Page SHALL play through the existing Player interface, and SHALL NOT add a new audio path.
6. WHILE a Pass_Playback is running, THE Listen_Page SHALL show a line from the Strings_File that says the alert is being passed on, and SHALL show a Stop control.
7. WHEN the person taps the Stop control, THE Listen_Page SHALL silence the sound within 0.25 seconds and SHALL cancel the second Play.
8. WHEN the second Play ends, THE Listen_Page SHALL remove the line in criterion 6 and the Volume_Reminder.
9. THE Listen_Page SHALL play the Copy only after a tap on a Pass_Button, and SHALL NOT play a Copy because of a received alert, a timer or a page load.
10. THE Listen_Page SHALL NOT repeat a Pass_Playback after the second Play.
11. WHILE a Pass_Playback is running, THE Listen_Page SHALL show the Volume_Reminder, a line from the Strings_File with the English text "Turn your volume all the way up.", in addition to the line in criterion 6.
12. WHEN the person taps the Stop control, or the Pass_Playback is cancelled for any other reason, THE Listen_Page SHALL remove the Volume_Reminder.
13. THE Listen_Page SHALL show the Volume_Reminder only during a Pass_Playback, and SHALL treat it as a reminder only, because the page cannot read the device volume setting.
14. IF the Sound_Link_Load in Requirement 4 criterion 10 fails, THEN THE Listen_Page SHALL play no sound, SHALL show the Load_Failure_Line, SHALL keep the Pass_Button enabled, and SHALL retry the load on the next tap on the Pass_Button.
15. THE Listen_Page SHALL play the Copy samples through the Play_Link_Function, which uses the Sound_Link that is already loaded and SHALL NOT start a Sound_Link_Load.
16. WHEN a Session starts while the Sound_Link is already loaded and the sample rate of the loaded Sound_Link differs from the sample rate of the microphone, THE Listen_Page SHALL reload the Sound_Link for the microphone rate.
17. WHEN a Session starts while the Sound_Link is already loaded and the sample rate of the loaded Sound_Link equals the sample rate of the microphone, THE Listen_Page SHALL keep the loaded Sound_Link and SHALL NOT reload it.
18. THE Listen_Page SHALL NOT accept a Session start while a Sound_Link_Load runs, a Copy plays or the Echo_Guard lasts (Requirement 8 criteria 14 and 17), so that a reload at a Session start never cuts a sound that is playing.

### Requirement 8: Listening pauses while the phone plays

**User Story:** As a listener, I want the phone to stop listening while it plays, so that it never hears its own sound as a new alert.

#### Acceptance Criteria

1. WHEN the Pass_Playback starts while a Session is running, THE Listen_Page SHALL start the Listening_Pause before the first sample plays.
2. WHILE the Listening_Pause lasts, THE Listen_Page SHALL discard every block of microphone samples without giving it to a Listener, and SHALL NOT store it.
3. WHEN the Listening_Pause starts, THE Listen_Page SHALL call `reset` on the Listener, so that no part of a heard frame joins the next one.
4. WHEN the Pass_Playback ends or is stopped, THE Listen_Page SHALL keep the Listening_Pause for the Echo_Guard, then call `reset` on the Listener and resume feeding microphone samples to it.
5. WHEN the Listening_Pause ends, THE Listen_Page SHALL return to the state that it had before the pause: listening if a Session was running, and not listening if no Session was running.
6. IF a Session was not running when the person tapped the Pass_Button, THEN THE Listen_Page SHALL NOT start a Session because of the Pass_Playback.
7. WHILE the Listening_Pause lasts, THE State_Line SHALL show the pause with a line from the Strings_File and SHALL NOT show "Dead air".
8. THE Listen_Page SHALL NOT count the time of the Listening_Pause toward the Dead_Air_Window, and SHALL NOT change the Last_Heard_Time during it.
9. IF the person taps the Stop_Button during the Listening_Pause, THEN THE Listen_Page SHALL stop the Pass_Playback, end the Session, and NOT resume listening afterwards.
10. IF the page becomes hidden during the Listening_Pause, THEN THE Listen_Page SHALL follow the existing hidden-page rules for the Session, and SHALL stop the Pass_Playback.
11. IF the microphone is lost during the Pass_Playback, THEN THE Listen_Page SHALL follow the existing microphone-loss rules and SHALL let the Pass_Playback end.
12. THE Listen_Page SHALL keep microphone audio only in memory during the Listening_Pause and SHALL discard it (promise 5).
13. FOR ALL sequences of microphone blocks that arrive during the Listening_Pause, THE History SHALL be unchanged after the pause (test with a fake Listener that would report a payload if it were fed).
14. WHILE a Sound_Link_Load for a Pass_Button tap is running, or a Pass_Playback is running, or the Echo_Guard lasts, THE Listen_Page SHALL show the Start_Button disabled and SHALL show the Start_Reason_Line.
15. WHEN the Pass_Playback has ended or been cancelled and the Echo_Guard has finished, THE Listen_Page SHALL show the Start_Button enabled again and SHALL remove the Start_Reason_Line, unless an existing rule of the Listen_Page keeps the Start_Button disabled for another reason.
16. IF the Pass_Button tap ends in a failure before any sound plays, THEN THE Listen_Page SHALL show the Start_Button enabled again and SHALL remove the Start_Reason_Line.
17. IF the person taps or otherwise activates the Start_Button while it is disabled by criterion 14, THEN THE Listen_Page SHALL start no Session, SHALL leave the Pass_Playback unchanged, and SHALL NOT change the microphone state.
18. THE Start_Reason_Line SHALL say that the alert is still playing and that the person can tap Start listening when the sound has finished.

### Requirement 9: The same alert, the highest hop count

**User Story:** As a listener, I want a passed-on copy of an alert I already have to count as the same alert, so that the list stays short and shows how far the alert has travelled.

#### Acceptance Criteria

1. WHEN a payload passes the check and has the same Alert_Key as a History entry, THE History SHALL treat the payload as the same alert, SHALL raise the Heard_Count by 1, and SHALL NOT add an Alert_Card.
2. WHEN a payload passes the check and has the same Alert_Key as a History entry, THE History SHALL set the Highest_Hop_Count of that entry to the larger of its old value and the Hop_Count of the payload.
3. THE History SHALL NOT lower the Highest_Hop_Count of an entry.
4. WHEN a payload with a Hop_Count of 1 or more is the first payload with its Alert_Key, THE History SHALL add one Alert_Card with that Highest_Hop_Count.
5. THE History SHALL keep the Alert of a History entry as the first heard Alert, unedited, as before.
6. THE Listen_Page SHALL NOT call `onNewAlert` (arrival flash, vibration, speech) for a payload that is the same alert as a History entry.
7. FOR ALL sequences of payloads that pass the check, THE History SHALL hold one Alert_Card per distinct Alert_Key, AND the Highest_Hop_Count of each card SHALL equal the largest Hop_Count among the payloads with that Alert_Key (property test).
8. FOR ALL orders of the same set of payloads, THE Highest_Hop_Count of each card SHALL be the same (order does not matter).
9. THE History SHALL NOT use the Passed_On_Flag or the Hop_Count in the Alert_Key.
10. WHEN a payload is rejected by the check, THE History SHALL change nothing, including the Highest_Hop_Count (promise 1).

### Requirement 10: The "Passed on N times" line

**User Story:** As a listener, I want to see how many times an alert has been passed on, so that I know it is travelling.

#### Acceptance Criteria

1. WHILE the Highest_Hop_Count of an Alert_Card is 1 or more, THE Alert_Card SHALL show the Passed_On_Line with N equal to the Highest_Hop_Count.
2. WHILE the Highest_Hop_Count of an Alert_Card is 0, THE Alert_Card SHALL show no Passed_On_Line.
3. WHILE the Highest_Hop_Count of an Alert_Card is 1, THE Passed_On_Line SHALL read "Passed on 1 time".
4. WHILE the Highest_Hop_Count of an Alert_Card is 2 or more, THE Passed_On_Line SHALL read "Passed on N times".
5. THE Alert_Card SHALL show the Passed_On_Line in addition to the sent time, the Expiry line and the TEST banner, and SHALL NOT replace or hide any of them.
6. WHILE an Alert_Card is expired, THE Alert_Card SHALL keep showing its Passed_On_Line and its sent time.
7. THE Passed_On_Line SHALL be built by the card view function from the History entry, with no value taken from an earlier render.
8. FOR ALL History entries, THE card view SHALL show the Passed_On_Line N equal to the Highest_Hop_Count of the entry (property test).

### Requirement 11: History storage

**User Story:** As a listener, I want the highest hop count to survive closing the page, so that the card shows the same line when I open the page again.

#### Acceptance Criteria

1. THE History_Store SHALL save the Highest_Hop_Count of each entry as an integer from 0 to 15, in addition to the fields it saves now.
2. WHEN the History_Store loads an entry with no saved Highest_Hop_Count, THE History_Store SHALL use the Hop_Count of the decoded bytes of that entry.
3. WHEN the History_Store loads an entry with a saved Highest_Hop_Count, THE History_Store SHALL use the larger of the saved value and the Hop_Count of the decoded bytes.
4. IF the saved Highest_Hop_Count is not an integer from 0 to 15, THEN THE History_Store SHALL use the Hop_Count of the decoded bytes of that entry and SHALL keep the entry.
5. THE History_Store SHALL decode every saved entry again with the Message_Code, as it does now, and SHALL drop an entry whose bytes fail the check.
6. THE History_Store SHALL keep the storage key `dead-air.listen.history.v1`, so that history saved before this spec still loads (offline Requirement 6 keeps the History across updates).
7. FOR ALL Histories, saving then loading SHALL give an equal Alert, Heard_Count, Highest_Hop_Count and times (round-trip property).
8. THE History_Store SHALL NOT store any audio, and SHALL store no Copy bytes that the phone played.

### Requirement 12: Translations and icons

**User Story:** As a listener who reads Hindi, I want every new word in my language, so that I understand the button and the line (promise 6).

#### Acceptance Criteria

1. THE Strings_File SHALL hold every new text of this spec as text keys with an English text and a Hindi text: the Pass_Button label, the "Passed on 1 time" text, the "Passed on {n} times" text, the passing-on line, the Stop control label, the pause line, the Volume_Reminder ("Turn your volume all the way up."), the Start_Reason_Line, and the lines for each failure in Requirements 4, 5, 6 and 7. There is no `listen.pass.err.check` key.
2. THE new text keys SHALL be added to the key list and the placeholder list in `strings.types.ts`, so that a missing key fails the type check.
3. THE Hindi text of every new key SHALL be present and SHALL keep the placeholders of the English text.
4. THE Pass_It_On spec SHALL record each new Hindi text as Needs_Human_Check in `docs/translation-check.md`.
5. THE Pass_It_On spec SHALL pass the existing translation check of the Languages spec with zero failures.
6. WHEN the page language changes, THE Listen_Page SHALL show the Pass_Button, the Passed_On_Line and every line in this spec in the new language without a reload.
7. THE Pass_It_On spec SHALL add no new alert type, so that the icon and text of every alert type stay as they are.
8. THE Pass_It_On spec SHALL add no icon that is loaded from a URL, and SHALL show no emoji.
9. THE Spoken text of an alert SHALL stay as the Languages spec made it, and THE Pass_It_On spec SHALL NOT add the Hop_Count to it.
10. THE text of every Failure_Line SHALL say in plain words what happened and what the person can do next, in English and in Hindi, and THE Hindi text of every Failure_Line SHALL be recorded as Needs_Human_Check.
11. THE Pass_It_On spec SHALL give each Failure_Line its own text key, with no shared text such as "Something went wrong" that omits the next step.
12. THE Load_Failure_Line SHALL be the key `listen.pass.err.load` with the English text "The sound could not be loaded. Tap Pass it on to try again."
13. THE `listen.pass.err.expired-mid` line SHALL have the English text "This alert ended while it was playing, so it was not played a second time. It cannot be passed on any more."
14. THE Strings_File SHALL use these owner-approved English texts, and THE Hindi text of each SHALL be recorded as Needs_Human_Check:
    - `listen.pass.err.failed`: "The alert could not be passed on. Tap Pass it on to try again."
    - not-current line: "This alert is no longer current, so nothing was played. Only a current alert can be passed on."
    - audio line: "This phone could not play sound. Turn the volume up, switch off silent mode, then tap Pass it on again."
    - Start_Reason_Line: "The alert is still playing. Tap Start listening when the sound has finished."
    - pause line: "Not listening while this phone plays the alert."
    - passing-on line: "Playing this alert so people nearby can hear it."
    - maximum-hops line: "This alert cannot be passed on again."
15. THE Failure_Lines SHALL be exactly these keys, each with its own text: `listen.pass.err.load`, `listen.pass.err.expired-mid`, `listen.pass.err.failed`, the not-current line and the audio line.

### Requirement 13: The six promises

**User Story:** As the project owner, I want the six promises to hold for passed-on alerts, so that passing on never weakens them.

#### Acceptance Criteria

1. THE Listen_Page SHALL build a Copy only from a History entry whose bytes passed the check, and SHALL show nothing from a payload that failed the check (promise 1).
2. THE Listen_Page SHALL NOT offer or play a Copy of an expired alert, and SHALL show the sent time on every Alert_Card (promise 2).
3. THE Copy of a test alert SHALL carry the TEST_Flag, and THE Alert_Card of a test alert SHALL show the Test_Banner (promise 3).
4. THE Pass_It_On spec SHALL add no request to another site, no CDN, no font, no analytics and no outside API, and SHALL keep the existing check that the pages request only their own address (promise 4).
5. THE Listen_Page SHALL NOT record, store or send microphone audio, and SHALL NOT write the Copy audio samples to storage, to a log, or to the body of a `fetch` or `XMLHttpRequest` (promise 5).
6. THE Pass_It_On spec SHALL give every new text a translation in every Shipped_Language (promise 6).
7. THE offline File_List builder SHALL include every new file of this spec in the saved copy without a manual list, and the Offline_Check SHALL pass with zero failures.

### Requirement 14: Module boundaries and tests

**User Story:** As a maintainer, I want the new logic in pure functions, so that plain Node tests can check it.

#### Acceptance Criteria

1. THE Pass_It_On spec SHALL put the decision whether a Copy may be built, and the Copy build, in pure functions that use no browser API, no clock and no random source, and take the current time as an input.
2. THE Pass_It_On spec SHALL reach the Audio_Context, the speaker and the Sound_Link through providers that tests replace with fakes.
3. THE Pass_It_On spec SHALL add no npm dependency.
4. THE Pass_It_On spec SHALL use Vitest and fast-check, with each property test run for at least 100 cases.
5. THE Pass_It_On spec SHALL include property tests for: the Copy fields (Requirement 6.8); the refusal at or after the Expiry_Time (Requirement 5.5); the Highest_Hop_Count over sequences and orders (Requirement 9.7 and 9.8); the History round trip with hop counts (Requirement 11.7); the card line (Requirement 10.8); and no change of the History during the Listening_Pause (Requirement 8.13), and the pairing of the Passed_On_Flag and the Hop_Count in encode, decode and validate (Requirement 2.11).
6. THE Pass_It_On spec SHALL cover every other criterion in this document with example-based tests, including the Pass_Button states in Requirement 4, the retry after a failed Sound_Link_Load, the Start_Button states in Requirement 8, the Play_Link_Function, the Play_Gap, the Stop control, the Echo_Guard, and each failure line.
7. THE Pass_It_On spec SHALL include a test that plays a Copy through the real Sound_Link into a real Listener and confirms that the Listener reports the Copy bytes, with the TEST_Flag set in the alert used.
8. THE `npm run typecheck`, `npm run build` and `npx vitest --run` commands SHALL pass.

### Requirement 15: Edits to files of other specs

**User Story:** As the project owner, I want edits to other specs' files approved and kept small, so that this spec changes no more than it needs.

#### Acceptance Criteria

1. THE owner has approved the edits to files of other specs that are listed in the table in the Introduction, and THE Pass_It_On spec SHALL NOT need further per-file approval for them. THE Pass_It_On spec SHALL make no edit to a file of another spec that is not in that table without asking the owner first.
2. THE Pass_It_On spec SHALL keep each approved edit to the smallest edit that the feature needs, limited to the lines that the feature needs, and SHALL leave every other line of that file unchanged.
3. THE Pass_It_On spec SHALL record in the Report_File each file of another spec that it edited, with the reason.
4. THE existing tests of the other specs SHALL keep passing, except for tests that build an Alert literal, which change only by adding `hopCount: 0`.
5. THE Pass_It_On spec SHALL leave `sound-test/` and the Sound_Link source unchanged.

### Requirement 16: Report of what was not tested in code

**User Story:** As the project owner, I want to know what was tested on real phones, so that I can trust the feature.

#### Acceptance Criteria

1. THE Report_File SHALL list the tests that were failing before the Message_Code change (Requirement 3 criterion 2).
2. THE Report_File SHALL state whether one real phone played a Copy and a second real phone showed "Passed on 1 time", or SHALL state that this was not tested.
3. THE Report_File SHALL state whether the Echo_Guard of 1 second was enough on a real phone to stop the phone hearing its own sound, or SHALL state that this was not tested.
4. THE Report_File SHALL state whether a phone with the previous app ignored a Copy, or SHALL state that this was not tested.
5. THE Report_File SHALL list every Hindi text added, each marked Needs_Human_Check.
