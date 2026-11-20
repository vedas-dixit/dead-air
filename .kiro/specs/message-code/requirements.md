# Requirements Document

## Introduction

This document was updated to make the map point optional, using bit 0 of byte 0 as the No_Map_Point_Flag (see "Change: optional map point" below).

The Message Code turns one emergency alert into a short sequence of bytes and turns those bytes back into the same alert. It is spec 1 of 8 for Dead Air. It is a module of pure TypeScript functions. It uses no browser APIs, no UI and no sound code, so it runs and is tested in plain Node. Later specs (Listen, Broadcast, offline, languages, look) build on it and are out of scope here.

The module carries codes only. It never carries translated text. Each alert type, urgency, severity and action is a fixed code, so later specs can give each one an icon and text in every shipped language (promise 6).

### Decision: the check value is 4 bytes (CRC-32), not 2 bytes (CRC-16)

Promise 1 says a damaged alert is never shown. The check value is the only thing that enforces it, so its size is a trade between byte budget and undetected-error odds.

- **Byte budget.** ggwave carries about 8 to 16 bytes per second. Two extra bytes cost 0.125 to 0.25 seconds of airtime. A 40 byte message takes 2.5 to 5 seconds. The cost of the larger check is small. It also removes 2 of the 21 place name bytes, leaving 19.
- **Undetected-error odds.** For a random corruption, a 16-bit check lets one in 65,536 (about 0.0015 percent) through. A 32-bit check lets one in 4,294,967,296 (about 0.00000002 percent) through. A single changed byte is always caught by either size. Corruption of several bytes is not.
- **Why structure checks do not replace the larger check.** Checks on version, type codes and ranges reject most random garbage. They do not reject a real alert that has a few bytes damaged, which is the likely failure over sound. Our sound test already showed ggwave returning garbled text for "Hello dead air". For that kind of damage only the check value protects the listener.
- **Decision.** The check is 4 bytes, a CRC-32. The message is 21 to 40 bytes. The brief and the steering files already state this range.
- **Limit.** A CRC detects accidental damage. It does not stop a person who deliberately forges a message. Forgery protection is not part of any promise and is out of scope.

### Change: optional map point

The map point (latitude and longitude) is optional and is never sent as a fake 0, 0. Bit 0 of byte 0, which was reserved as zero, becomes the No_Map_Point_Flag. The Version stays 1, because no Version 1 sender ever sent a Message with bit 0 set and old decoders reject bit 0 set, which is the safe behaviour.

- The Message size of 21 to 40 bytes and the position of every field are unchanged.
- The Passed_On_Flag and every other field are unchanged.
- The three property tests named in the tech rules (round trip, any single changed byte caught, expired alert never current) must still pass.
- The Broadcast page spec (spec 3) needs this change, so that a sender can leave the map point empty.
- The Listen page spec (spec 4) must show "no map point" when latitude and longitude are both null, and must never show 0, 0 for that case.

## Glossary

- **Message_Code**: The module of pure functions in this spec. It holds the encoder, the decoder, the expiry check and the fixed code lists.
- **Alert**: The decoded form of a message. It has the fields listed in Requirement 1. Its `latitude` and `longitude` fields are each a number or null, and are either both numbers or both null.
- **No_Map_Point_Flag**: Bit 0 of byte 0. When set, the Message has no map point and the Alert has latitude null and longitude null. When clear, the Message has a map point and the Alert has numeric latitude and longitude.
- **Message**: The byte sequence produced by the Encoder for one Alert.
- **Encoder**: The function that turns an Alert into a Message.
- **Decoder**: The function that turns a sequence of bytes into an Alert, or into a rejection.
- **Expiry_Checker**: The function that compares an Alert with a given current time and reports the Alert's status.
- **Rejection**: A decoder or encoder result that carries a reason code and no Alert fields.
- **Check_Value**: The last 4 bytes of a Message. It is a CRC-32 (the ISO-HDLC variant used by zlib, polynomial 0x04C11DB7 reflected, initial value 0xFFFFFFFF, final XOR 0xFFFFFFFF) over every byte before it, written big-endian.
- **Version**: The 4-bit format number in the first byte. The only known Version is 1.
- **Event_Type**: One of the nine fixed alert types in Requirement 2.
- **Urgency**, **Severity**, **Action**: Fixed code lists in Requirement 2. Urgency and Severity use CAP 1.2 values. Action follows the CAP 1.2 `responseType` values.
- **Sent_Minute**: The sent time as a whole number of minutes since 1970-01-01 00:00 UTC.
- **Valid_Steps**: The valid-for period as a whole number of 15-minute steps.
- **Expiry_Time**: Sent_Minute plus Valid_Steps times 15 minutes.
- **Current_Time**: A millisecond timestamp since 1970-01-01 00:00 UTC that the caller passes in. It comes from the device clock.
- **Clock_Tolerance**: 5 minutes. It is the largest amount by which Sent_Minute may be ahead of Current_Time and still be treated as normal clock difference between devices.
- **Expiry_Status**: One of `current`, `expired`, `sent-in-future` or `clock-unknown`.
- **TEST_Flag**: The flag bit that marks an Alert as a test alert.
- **Passed_On_Flag**: The flag bit that marks an Alert as relayed from another sender.
- **Place_Name**: Optional short text naming the place. It is stored in the Message as 0 to 19 bytes, in one of two forms: UTF-8 form or compact form.
- **UTF-8_Form**: The Place_Name stored as plain UTF-8 text.
- **Compact_Form**: The Place_Name stored as one Script_Selector byte followed by one byte per character. Each following byte is either a Script_Character byte or a Shared_Character byte.
- **Compact_Place_Name_Flag**: Bit 1 of byte 0. When set, the place name bytes are in Compact_Form. When clear, they are in UTF-8_Form.
- **Script_Window**: A block of 128 consecutive code points for one Indic script. The nine Script_Windows start at these code points: Devanagari U+0900, Bengali U+0980, Gurmukhi U+0A00, Gujarati U+0A80, Odia U+0B00, Tamil U+0B80, Telugu U+0C00, Kannada U+0C80, Malayalam U+0D00.
- **Script_Selector**: The first byte of a Place_Name in Compact_Form. Values 1 to 9 select the nine Script_Windows in the order listed above.
- **Script_Character**: A byte with its top bit clear, in a Place_Name in Compact_Form. It stands for the code point equal to the start of the selected Script_Window plus the low 7 bits of the byte.
- **Shared_Character**: A byte with its top bit set, in a Place_Name in Compact_Form. Its low 7 bits are a printable ASCII code from 0x20 to 0x7E, which stands for that ASCII character. The byte values 0x80 and 0x81 stand for U+200C (ZWNJ) and U+200D (ZWJ).
- **Canonical_Place_Name_Form**: The one form the Encoder chooses for a given Place_Name text, by the rule in Requirement 10.
- **Fixture**: Any sample or example Message or Alert stored in the repository.
- **Project**: The repository skeleton that builds and tests the Message_Code.

## Requirements

### Requirement 1: Message layout

**User Story:** As a developer of the Listen and Broadcast pages, I want one exact byte layout, so that every device encodes and decodes the same way.

#### Acceptance Criteria

1. THE Message_Code SHALL define Version 1 of the Message as the following fields in this order, with all multi-byte numbers in big-endian order: version and flags (1 byte), Event_Type (1 byte), Urgency, Severity and Action (1 byte), Sent_Minute (4 bytes), Valid_Steps (1 byte), latitude (3 bytes), longitude (3 bytes), station ID (2 bytes), counter (1 byte), Place_Name (0 to 19 bytes), Check_Value (4 bytes).
2. THE Message_Code SHALL store the Version in the high 4 bits of byte 0, the TEST_Flag in bit 3, the Passed_On_Flag in bit 2, the Compact_Place_Name_Flag in bit 1, and the No_Map_Point_Flag in bit 0.
3. THE Message_Code SHALL derive the length of the place name bytes, in either form, from the Message length, as the Message length minus 21 bytes.
4. THE Message_Code SHALL produce Messages of 21 to 40 bytes.
5. THE Message_Code SHALL store latitude and longitude as signed 24-bit two's complement whole numbers in units of 0.0001 degree, in WGS 84 degrees as CAP 1.2 uses.
6. THE Message_Code SHALL accept latitude from -900000 to 900000 and longitude from -1800000 to 1800000 in those units.
7. THE Message_Code SHALL accept a station ID from 0 to 65535 and a counter from 0 to 255.
8. THE Message_Code SHALL pack Urgency, Severity and Action into one byte so that every combination of the listed values has exactly one byte value.
9. THE Message_Code SHALL represent an Alert with latitude `number | null` and longitude `number | null`, where the two are either both numbers or both null.
10. WHEN an Alert has latitude null and longitude null, THE Encoder SHALL set the No_Map_Point_Flag and write three zero bytes for latitude and three zero bytes for longitude.
11. WHEN an Alert has numeric latitude and longitude, THE Encoder SHALL clear the No_Map_Point_Flag and write the two numbers as in criterion 5, so that a real map point of 0, 0 stays possible and differs from no map point.
12. THE Message_Code SHALL keep the Version at 1 and keep the position and size of every field unchanged by the No_Map_Point_Flag.

### Requirement 2: Fixed code lists

**User Story:** As a developer of the language and look specs, I want fixed lists of codes, so that I can give every type an icon and text in every shipped language.

#### Acceptance Criteria

1. THE Message_Code SHALL define exactly nine Event_Types with these codes: flood 1, cyclone 2, fire 3, earthquake 4, heatwave 5, landslide 6, medical 7, missing person 8, all clear 9.
2. THE Message_Code SHALL define exactly five Urgency values, using the CAP 1.2 names: Immediate, Expected, Future, Past, Unknown.
3. THE Message_Code SHALL define exactly five Severity values, using the CAP 1.2 names: Extreme, Severe, Moderate, Minor, Unknown.
4. THE Message_Code SHALL define exactly six Action values: shelter, evacuate, prepare, avoid, monitor, all clear.
5. THE Message_Code SHALL export each code list as a readable constant, so that other code can check that every entry has an icon and text.
6. THE Message_Code SHALL carry codes only and SHALL contain no translated text and no display strings.
7. THE Message_Code SHALL keep every assigned code stable once defined for Version 1.
8. THE Message_Code SHALL define exactly nine Script_Selector values with these codes and Script_Window starts: Devanagari 1 (U+0900), Bengali 2 (U+0980), Gurmukhi 3 (U+0A00), Gujarati 4 (U+0A80), Odia 5 (U+0B00), Tamil 6 (U+0B80), Telugu 7 (U+0C00), Kannada 8 (U+0C80), Malayalam 9 (U+0D00).
9. THE Message_Code SHALL carry the Script_Selector list as codes and window starts only, with no script names meant for display.

### Requirement 3: Encoding

**User Story:** As a sender, I want an alert turned into bytes, so that the Broadcast page can play it as sound.

#### Acceptance Criteria

1. WHEN the Encoder receives a valid Alert, THE Encoder SHALL return a Message that follows Requirement 1 and ends with the correct Check_Value.
2. WHEN the Encoder receives the same valid Alert twice, THE Encoder SHALL return identical bytes both times.
3. THE Encoder SHALL write Version 1 in every Message.
4. IF an Alert has a field outside the ranges in Requirements 1, 2, 7 or 8, THEN THE Encoder SHALL return a Rejection that names the invalid field and SHALL return no bytes.
5. IF the shortest form allowed by Requirement 10 for the Place_Name is longer than 19 bytes, THEN THE Encoder SHALL return a Rejection and SHALL NOT shorten the Place_Name.
6. THE Encoder SHALL NOT read the device clock or any random source.
7. IF exactly one of latitude and longitude is null, THEN THE Encoder SHALL return a Rejection with the reason `invalid-field` that names the field `latitude` (the first field that is null alone), and SHALL return no bytes.

### Requirement 4: Decoding and round trip

**User Story:** As a listener, I want received bytes turned back into the sent alert, so that my phone shows what the sender meant.

#### Acceptance Criteria

1. WHEN the Decoder receives a Message that passes every check in Requirements 5 to 8, THE Decoder SHALL return an Alert whose fields equal the fields that were encoded.
2. FOR ALL valid Alerts, decoding the output of the Encoder SHALL produce an Alert equal to the original (round-trip property).
3. FOR ALL byte sequences that the Decoder accepts, encoding the decoded Alert SHALL produce the same bytes (canonical encoding), as checked by the random-bytes property test in Requirement 12.
4. THE Decoder SHALL return the Sent_Minute, Valid_Steps, TEST_Flag, Passed_On_Flag, Event_Type, Urgency, Severity, Action, latitude, longitude, station ID, counter and Place_Name of every accepted Message.
5. THE Decoder SHALL NOT read the device clock, so that decoding depends only on the input bytes.
6. FOR ALL byte sequences that the Decoder accepts, THE Encoder SHALL choose the same Place_Name form and the same Compact_Place_Name_Flag value as the accepted bytes have, so that the canonical encoding in criterion 3 covers the choice of form.

### Requirement 5: Check value

**User Story:** As a listener, I want damaged alerts discarded, so that I never act on wrong information (promise 1).

#### Acceptance Criteria

1. THE Message_Code SHALL compute the Check_Value as a CRC-32 as defined in the Glossary over every byte of the Message before the Check_Value.
2. THE Message_Code SHALL compute the CRC-32 of the ASCII bytes of "123456789" as 0xCBF43926.
3. WHEN the Decoder receives a Message whose last 4 bytes differ from the CRC-32 of the bytes before them, THE Decoder SHALL return a Rejection with the reason `bad-check`.
4. IF any single byte of a valid Message is changed to a different value, THEN THE Decoder SHALL return a Rejection.
5. THE Decoder SHALL verify the Check_Value before it reads or validates any other field value.
6. WHEN the Decoder returns a Rejection, THE Decoder SHALL return no field of the Message, including the Event_Type, the Place_Name and the sent time.

### Requirement 6: Version handling

**User Story:** As a listener with an older app, I want messages from a newer format refused, so that my phone never misreads them.

#### Acceptance Criteria

1. IF the Version in byte 0 is not 1, THEN THE Decoder SHALL return a Rejection with the reason `unknown-version`.
2. THE Decoder SHALL read the Version before it applies any other layout rule that depends on the Version.
3. IF a Message uses a Version other than 1, THEN THE Decoder SHALL NOT attempt to read its other fields.
4. THE Message_Code SHALL require a new Version number for any change to the layout, to the Check_Value or to the code lists in Requirement 2.

### Requirement 7: Untrusted input and rejection reasons

**User Story:** As a listener, I want any garbage from the microphone handled safely, so that the app never crashes and never shows half an alert.

#### Acceptance Criteria

1. THE Decoder SHALL treat every input as untrusted.
2. IF the input is not a sequence of bytes, THEN THE Decoder SHALL return a Rejection with the reason `not-bytes`.
3. IF the input is shorter than 21 bytes, THEN THE Decoder SHALL return a Rejection with the reason `too-short`.
4. IF the input is longer than 40 bytes, THEN THE Decoder SHALL return a Rejection with the reason `too-long`.
5. IF the Event_Type code is not one of the nine codes in Requirement 2, THEN THE Decoder SHALL return a Rejection with the reason `unknown-event`.
6. IF the packed byte for Urgency, Severity and Action does not map to a listed combination, THEN THE Decoder SHALL return a Rejection with the reason `invalid-field`.
7. IF the No_Map_Point_Flag is set and any of the 6 latitude and longitude bytes is not zero, THEN THE Decoder SHALL return a Rejection with the reason `invalid-field`.
8. IF Valid_Steps is 0, THEN THE Decoder SHALL return a Rejection with the reason `invalid-field`.
9. IF the No_Map_Point_Flag is clear and the latitude or longitude is outside the ranges in Requirement 1, THEN THE Decoder SHALL return a Rejection with the reason `invalid-field`.
10. IF the Compact_Place_Name_Flag is clear and the place name bytes are not valid UTF-8, or the decoded Place_Name contains a control character (U+0000 to U+001F or U+007F), THEN THE Decoder SHALL return a Rejection with the reason `invalid-field`.
11. THE Decoder SHALL return either a complete Alert or a Rejection, and SHALL NOT return a partly filled Alert.
12. FOR ALL inputs, THE Decoder SHALL return a result and SHALL NOT throw an error, as checked by the random-bytes property test in Requirement 12.
13. THE Decoder SHALL apply the checks in this order: input type, length, Version, Check_Value, then field values.
14. THE Decoder SHALL NOT change the input bytes it receives.
15. IF the Compact_Place_Name_Flag is set and the place name has 0 bytes, or its first byte is not a Script_Selector value from 1 to 9, THEN THE Decoder SHALL return a Rejection with the reason `invalid-field`.
16. IF the Compact_Place_Name_Flag is set and a byte after the Script_Selector is neither a Script_Character byte nor a Shared_Character byte (a byte with the top bit set whose value is not 0x80, 0x81, or 0xA0 to 0xFE), THEN THE Decoder SHALL return a Rejection with the reason `invalid-field`.
17. IF the Compact_Place_Name_Flag is set and the decoded Place_Name contains a control character (U+0000 to U+001F or U+007F), THEN THE Decoder SHALL return a Rejection with the reason `invalid-field`.
18. WHEN the Decoder has decoded a Place_Name, THE Decoder SHALL encode the decoded text by the rule in Requirement 10, and IF the result is not exactly the same place name bytes with the same Compact_Place_Name_Flag value, THEN THE Decoder SHALL return a Rejection with the reason `invalid-field`.
19. THE Decoder SHALL accept a Script_Character byte whose code point is unassigned in Unicode, and SHALL NOT keep a table of assigned code points.
20. WHEN the Decoder accepts a Message with the No_Map_Point_Flag set, THE Decoder SHALL return an Alert with latitude null and longitude null.
21. WHEN the Decoder accepts a Message with the No_Map_Point_Flag clear, THE Decoder SHALL return an Alert with numeric latitude and longitude, including a map point of exactly 0, 0.
22. THE Decoder SHALL apply the check in criterion 7 after the Check_Value passes, as part of the field value checks in criterion 13.

### Requirement 8: Sent time, expiry and clock edge cases

**User Story:** As a listener, I want an old alert never shown as current, so that I do not act on a warning that has ended (promise 2).

#### Acceptance Criteria

1. THE Message_Code SHALL return the Sent_Minute of every accepted Alert, so that the UI can always show the sent time.
2. THE Message_Code SHALL accept any Sent_Minute from 0 to 4294967295 in an Alert.
3. THE Expiry_Checker SHALL compute the Expiry_Time as Sent_Minute plus Valid_Steps times 15 minutes.
4. THE Expiry_Checker SHALL take the Current_Time as an input and SHALL NOT read the device clock itself.
5. WHEN the Current_Time is at or after the Expiry_Time, THE Expiry_Checker SHALL return the Expiry_Status `expired`.
6. WHEN the Current_Time is before the Expiry_Time and the sent time is not more than the Clock_Tolerance after the Current_Time, THE Expiry_Checker SHALL return the Expiry_Status `current`.
7. IF the sent time is more than the Clock_Tolerance after the Current_Time, THEN THE Expiry_Checker SHALL return the Expiry_Status `sent-in-future`.
8. IF the Current_Time is not a finite number, or is negative, THEN THE Expiry_Checker SHALL return the Expiry_Status `clock-unknown`.
9. THE Expiry_Checker SHALL return the Expiry_Status `current` only in the case in criterion 6.
10. THE Expiry_Checker SHALL return the Expiry_Time and the sent time together with the Expiry_Status, so that the UI can show both.
11. THE Message_Code SHALL give the same Expiry_Status for the same Alert and the same Current_Time on every call.

### Requirement 9: Test alerts

**User Story:** As a sender running a drill, I want test alerts marked in the message, so that nobody mistakes a drill for a real emergency (promise 3).

#### Acceptance Criteria

1. THE Message_Code SHALL carry the TEST_Flag as a bit inside the checked bytes of the Message.
2. WHEN the Encoder receives an Alert with the TEST_Flag set, THE Encoder SHALL set the TEST_Flag bit in byte 0.
3. WHEN the Decoder accepts a Message with the TEST_Flag bit set, THE Decoder SHALL return an Alert with the TEST_Flag set.
4. WHEN the Decoder accepts a Message with the TEST_Flag bit clear, THE Decoder SHALL return an Alert with the TEST_Flag clear.
5. THE Message_Code SHALL carry the Passed_On_Flag in the same way as the TEST_Flag.
6. THE Message_Code SHALL keep the TEST_Flag unchanged when an Alert is expired-checked.
7. THE Project SHALL store every Fixture with the TEST_Flag set.

### Requirement 10: Place name

**User Story:** As a sender, I want to add a short place name in my own script, so that listeners can read where the alert applies.

#### Acceptance Criteria

1. THE Message_Code SHALL accept a Place_Name whose chosen form, by this requirement, is 0 to 19 bytes, including names with multi-byte characters.
2. WHEN the Place_Name is empty, THE Encoder SHALL use UTF-8_Form and produce a Message of 21 bytes.
3. WHEN the chosen form of the Place_Name is 19 bytes, THE Encoder SHALL produce a Message of 40 bytes.
4. THE Decoder SHALL return the Place_Name as text exactly as encoded, with no trimming and no change of case.
5. THE Encoder SHALL treat a Place_Name as eligible for Compact_Form only when every character is a Shared_Character, or lies in one single Script_Window, and at least one character lies in that Script_Window.
6. WHEN the Place_Name is eligible for Compact_Form and the Compact_Form is at most 19 bytes and strictly shorter than the UTF-8_Form (or the UTF-8_Form is longer than 19 bytes), THE Encoder SHALL use Compact_Form and set the Compact_Place_Name_Flag.
7. WHEN the Place_Name is not eligible for Compact_Form, or the Compact_Form is not strictly shorter than a UTF-8_Form that is at most 19 bytes, THE Encoder SHALL use UTF-8_Form and clear the Compact_Place_Name_Flag.
8. THE Encoder SHALL count the Script_Selector byte in the length of a Compact_Form, so that a Compact_Form holds one Script_Selector byte and at most 18 character bytes.
9. WHEN the Place_Name is a Latin-only or ASCII-only name, THE Encoder SHALL use UTF-8_Form.
10. WHEN the Place_Name contains characters from two different Script_Windows, THE Encoder SHALL use UTF-8_Form.
11. WHEN the Place_Name is "नई दिल्ली", THE Encoder SHALL use Compact_Form with a 10-byte place name and produce a Message of 31 bytes.
12. WHEN the Place_Name contains U+200C (ZWNJ) or U+200D (ZWJ) together with characters of one Script_Window, THE Encoder SHALL carry each of them as the Shared_Character byte 0x80 or 0x81 in Compact_Form when Compact_Form is chosen.
13. WHERE the Place_Name has a character outside the Shared_Characters and outside every Script_Window, THE Encoder SHALL use UTF-8_Form.
14. THE Message_Code SHALL NOT cover scripts outside the nine Script_Windows in Compact_Form, including Arabic script for Urdu, and SHALL carry such names in UTF-8_Form only.

### Requirement 11: Project skeleton and module boundary

**User Story:** As a developer, I want a small project that builds and tests the Message_Code in plain Node, so that later specs can build on it.

#### Acceptance Criteria

1. THE Project SHALL contain only the dependencies Vite, TypeScript, Vitest and fast-check, and no others.
2. THE Project SHALL place the Message_Code in its own folder, `src/message-code/`, as pure functions.
3. THE Message_Code SHALL NOT import from outside its own folder, and SHALL NOT use browser APIs, `Date.now`, `Math.random`, `fetch`, or storage.
4. THE Project SHALL compile the Message_Code with a TypeScript setting that excludes the DOM type library, so that use of a browser API fails the type check.
5. THE Project SHALL run all tests in a Node environment with a single command that exits after one run.
6. THE Project SHALL set the Vite `base` option in one place in the Vite config, read from a build setting, and SHALL NOT contain the text `/dead-air/` in any source or config file.
7. WHEN the build setting for the base path is changed, THE Project SHALL build with that base path without any other file change.
8. THE Project SHALL contain no Listen, Broadcast, offline, language, sound or look files.
9. THE Project SHALL include no network request in the Message_Code and no web font, script or asset loaded from a URL.

### Requirement 12: Property tests

**User Story:** As a developer, I want property tests on the three core guarantees, so that the promises hold for all inputs and not only for examples.

#### Acceptance Criteria

1. THE Project SHALL include exactly four fast-check property tests for the Message_Code, each run for at least 100 cases.
2. THE Project SHALL include a property test that FOR ALL valid Alerts, decoding the encoded Message returns an Alert equal to the original.
3. THE Project SHALL include a property test that FOR ALL valid Alerts, all byte positions and all different replacement values, the Decoder rejects the Message with that one byte changed.
4. THE Project SHALL include a property test that FOR ALL valid Alerts and all Current_Time values at or after the Expiry_Time, the Expiry_Checker never returns `current`.
5. THE Project SHALL generate Alerts for these tests from every Event_Type, Urgency, Severity and Action value, both flag values, the full ranges in Requirement 1, alerts with a map point and alerts with no map point (latitude and longitude both null), and Place_Names whose chosen form is 0 to 19 bytes. THE Project SHALL generate Place_Names that include multi-byte characters, names in each of the nine Script_Windows, names that mix one Script_Window with ASCII, names with ZWNJ and ZWJ, names that mix two Script_Windows, names that are ASCII only, and names whose UTF-8_Form is longer than 19 bytes but whose Compact_Form fits.
6. THE Project SHALL cover every other acceptance criterion in this document with example-based unit tests, including the CRC-32 check string, each rejection reason, input that is not bytes, lengths of 0, 20, 21, 40 and 41 bytes, and the Expiry_Status boundaries at Expiry_Time and at the Clock_Tolerance.
7. THE Project SHALL include an example-based test that runs the Decoder on a fixed set of seeded pseudo-random byte sequences of every length from 0 to 64 and confirms that no call throws.
8. THE Project SHALL include a fourth property test that FOR ALL generated byte arrays, the Decoder does not throw, and WHEN the Decoder accepts the bytes, encoding the decoded Alert returns exactly the same bytes.
9. THE Project SHALL generate the byte arrays for the fourth property test from two sources: arbitrary byte arrays with arbitrary byte values and lengths from 0 to 64 and beyond, and valid Messages that have been mutated by changing, inserting or removing bytes, with the Check_Value recomputed after mutation for a share of the cases, so that the Decoder accepts many of the generated inputs. THE Project SHALL include in the mutations a change of the Compact_Place_Name_Flag bit, a change of the Script_Selector byte, and a change of the No_Map_Point_Flag bit and of the latitude and longitude bytes, so that non-canonical compact forms and a flag set with non-zero point bytes reach the Decoder. THE fourth property test SHALL therefore cover the canonical encoding of the No_Map_Point_Flag.
10. THE Project SHALL include example-based unit tests for the Compact_Form that cover: one name in each of the nine Script_Windows; the "नई दिल्ली" case in Requirement 10.11; a name of exactly 19 compact bytes; a name that fits only in Compact_Form; a name where Compact_Form is not strictly shorter and UTF-8_Form is used; an ASCII-only name; a name mixing two Script_Windows; ZWNJ and ZWJ carried as 0x80 and 0x81; an Urdu name in UTF-8_Form; and a Script_Character whose code point is unassigned being accepted.
11. THE Project SHALL include example-based unit tests that the Decoder rejects with the reason `invalid-field`: the No_Map_Point_Flag set with a non-zero latitude or longitude byte; the Compact_Place_Name_Flag set with an empty place name; a Script_Selector of 0 and of 10; a Shared_Character byte of 0x82, 0x9F and 0xFF; a Shared_Character byte whose low 7 bits are a control character; the flag set on an ASCII-only name; the flag set with a Compact_Form that is not strictly shorter than the UTF-8_Form; a Script_Selector that does not match the characters; and a name that is canonical in UTF-8_Form but carries the flag set, each with a correct Check_Value so that the check does not reject it first.
12. THE Project SHALL include example-based unit tests for the optional map point: a round trip of an Alert with no map point; the No_Map_Point_Flag set with a non-zero latitude or longitude byte rejected with the reason `invalid-field`, built with the raw-message helper with a correct Check_Value; the Encoder rejecting an Alert with exactly one of latitude and longitude null, with the reason `invalid-field` naming `latitude`; a real map point of 0, 0 that round trips as the numbers 0 and 0 and has the No_Map_Point_Flag clear; and byte 0 equal to 0x11 for a plain Alert with no map point and 0x19 for the same Alert with the TEST_Flag set.
13. THE Project SHALL keep the four property tests in criterion 1 passing, with the round-trip, single-changed-byte and expired-never-current properties unchanged in meaning.
