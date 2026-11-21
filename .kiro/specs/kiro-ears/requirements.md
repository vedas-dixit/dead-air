# Requirements Document

## Introduction

Kiro's ears (spec 5) is a small local MCP server in `tools/ears/`. It lets Kiro, and the developer, test Dead Air sound without a speaker or a phone. It is bundled to one JavaScript file with Vite, runs with Node over stdio and reuses the Message Code (`src/message-code`), the Sound Link (`src/sound-link`) and the Broadcast sound-file composer (`src/broadcast/compose.ts`). It does not change any of them.

It has three tools:

1. `make_broadcast` turns an alert given as JSON into a WAV file and returns the path and length.
2. `hear_wav` runs a WAV file, with optional noise, through the decoder path the Listen page uses and reports what came out and whether the check passed.
3. `round_trip` makes a broadcast, adds noise, decodes it, and counts successes and failures over N tries.

This spec also registers the server in the workspace Kiro MCP settings, explains how to turn it on, and uses it once. That use is `round_trip` at three noise levels with 20 tries each, with the results written into `docs/kiro-diary.md`.

The tool is a developer aid. It is not shipped to users and is not part of the Vite build or the offline copy. Results from white noise do not replace tests on real speakers and phones (sound rules).

### Decisions

These answers were given by the user and replace the open questions of the earlier draft.

1. **SDK.** The server uses `@modelcontextprotocol/sdk` as a `devDependency` only. `zod` is added as a `devDependency` too, because the SDK lists it as a peer. Neither package reaches the built site (`dist/`).
2. **Running the TypeScript.** `tools/ears/` is bundled to one JavaScript file with the Vite that is already installed. There is no `tsx`. An npm script runs the build. The output goes outside `dist/`, to `tools/ears/build/`, which is git-ignored. The server entry in the MCP_Settings is the relative path of that bundle. The README tells the user to run the build before turning the server on.
3. **Non-test alerts.** The tools keep rejecting `test: false` (promise 3).
4. **Noise unit.** Noise_Level is the signal-to-noise ratio in dB of white noise.
5. **Diary levels.** The three Noise_Levels for the diary run are 0 dB, -10 dB and -15 dB.
6. **Files outside the spec.** Edits to `package.json`, `.gitignore` and a new `tsconfig` for `tools/` (added to the `typecheck` script) are approved.

## Glossary

- **Ears_Server**: The local MCP server in `tools/ears/`, started by Node over stdio.
- **Tool_Handlers**: The functions behind the three tools. They take plain values and return plain values. They do not read stdin or write stdout.
- **MCP_Transport**: The part of the Ears_Server that reads requests from stdin and writes responses to stdout.
- **Alert_Input**: A JSON object with the fields of the `Alert` type in `src/message-code/types.ts`. The field `sentMinute` is optional and defaults to the current minute.
- **Message_Code**: The module in `src/message-code`, used only through its `index.ts`.
- **Sound_Link**: The module in `src/sound-link`, used only through its `index.ts`.
- **Check**: The version, length and CRC-32 check inside `decodeMessage`. Nothing from a message is read before the Check passes.
- **Broadcast_Audio**: The samples of the saved sound file from the Broadcast page: first play, a 1 second gap of silence, second play, made by `composeBroadcastAudio`.
- **Broadcast_WAV**: A WAV file of Broadcast_Audio, written by `audioToWav` (mono, 16-bit PCM).
- **Output_Directory**: The folder where `make_broadcast` writes files. The default is `tools/ears/out/`, which is git-ignored.
- **Noise_Level**: The signal-to-noise ratio in dB of added white noise, measured as the root-mean-square level of the Broadcast_Audio signal samples against the root-mean-square level of the noise. A lower number means more noise.
- **Seed**: A whole number that fixes the noise, so the same inputs give the same result.
- **Tail_Silence**: 2 seconds of zero samples added after the audio before decoding, because ggwave reports a payload only after a few silent frames. The Broadcast page uses the same fix in its Self_Check.
- **Try**: One pass of make, add noise, decode and compare, inside `round_trip`.
- **Heard_Payload**: A byte sequence the Sound_Link listener reports. It is untrusted until the Check passes.
- **Try_Outcome**: One of `ok` (the Check passed and the decoded alert equals the sent alert), `wrong-alert` (the Check passed but the alert differs), `check-failed` (a payload was heard and the Check rejected it) or `nothing-heard` (no payload was heard).
- **Diary**: The file `docs/kiro-diary.md`.
- **MCP_Settings**: The workspace file `.kiro/settings/mcp.json`.
- **Ears_Bundle**: The single JavaScript file `tools/ears/build/ears.mjs`, made by `npm run build:ears` from `tools/ears/`. It is git-ignored and is never written to `dist/`.

## Requirements

### Requirement 1: Server startup and scope

**User Story:** As a developer, I want a local MCP server that exposes exactly three sound tools, so that Kiro can test Dead Air sound from a chat.

#### Acceptance Criteria

1. WHEN the Ears_Server is started with Node, THE MCP_Transport SHALL answer the MCP `initialize` request over stdio within 5 seconds and, in response to a `tools/list` request, list exactly three tools named `make_broadcast`, `hear_wav` and `round_trip`, each with a non-empty description and an input schema.
2. THE MCP_Transport SHALL write only MCP protocol messages to stdout and SHALL write all logs to stderr.
3. THE Ears_Server SHALL open no network connection, listening or outgoing, during startup, during tool calls, and during shutdown.
4. THE Ears_Server SHALL import the Message_Code and the Sound_Link only through their `index.ts` files.
5. THE Ears_Server SHALL NOT modify any file under `src/`.
6. WHEN the first tool call that needs the Sound_Link is received, THE Ears_Server SHALL load the Sound_Link once, and THE Ears_Server SHALL reuse that loaded instance for every later call in the same process.
7. THE Tool_Handlers SHALL contain no MCP protocol code, so that Vitest can call each handler directly in plain Node without starting the MCP_Transport.
8. IF a `tools/call` request names a tool that is not `make_broadcast`, `hear_wav` or `round_trip`, THEN THE MCP_Transport SHALL return an MCP error response that includes the unknown tool name, and THE Ears_Server SHALL keep running and accept the next request.
9. IF a Tool_Handler fails for any reason, THEN THE MCP_Transport SHALL return a tool result marked as an error that contains a short reason code and a message of 200 characters or fewer, SHALL write no stack trace to stdout, and THE Ears_Server SHALL keep running and accept the next request.
10. IF the Sound_Link fails to load, THEN THE Ears_Server SHALL return the error result described in criterion 9 for the affected call, and SHALL retry the load on the next call that needs it.

### Requirement 2: Alert input validation and TEST rule

**User Story:** As a developer, I want every alert the tools handle to be a TEST alert, so that no real-looking alert is ever made by this tool.

#### Acceptance Criteria

1. WHEN `make_broadcast` or `round_trip` receives an Alert_Input that is a JSON object, THE Tool_Handlers SHALL pass it to `encodeAlert` with every field unchanged, except that `sentMinute` is set by criterion 4 when it is absent.
2. IF `make_broadcast` or `round_trip` receives an Alert_Input that is not a JSON object (including null, an array, a string, a number, or a boolean), THEN THE Tool_Handlers SHALL return an error that names the problem as an invalid input type, SHALL NOT call `encodeAlert`, and SHALL NOT produce audio or a file.
3. IF the Alert_Input has a `test` field that is absent or has any value other than the boolean `true` (including the string `"true"`, the number `1`, and `false`), THEN THE Tool_Handlers SHALL return the error reason `not-a-test-alert`, SHALL NOT call `encodeAlert`, and SHALL NOT produce audio or a file.
4. WHERE `sentMinute` is absent from the Alert_Input, THE Tool_Handlers SHALL set `sentMinute` to the current UTC minute from the system clock, counted as whole minutes since the Unix epoch, before calling `encodeAlert`.
5. IF `encodeAlert` rejects the Alert_Input, THEN THE Tool_Handlers SHALL return the error reason from `encodeAlert` together with the name of the rejected field, SHALL NOT produce audio or a file, and SHALL leave no partial output from that call.
6. THE Ears_Server SHALL include in its tool descriptions for `make_broadcast` and `round_trip` one sample Alert_Input with `test` set to `true`, and that sample SHALL be accepted by `encodeAlert` without error.

### Requirement 3: make_broadcast

**User Story:** As a developer, I want to turn an alert into a WAV file, so that I can play it, inspect it, or feed it to `hear_wav`.

#### Acceptance Criteria

1. WHEN `make_broadcast` receives a valid Alert_Input, THE Tool_Handlers SHALL encode it with `encodeAlert`, make audio with `bytesToAudio`, compose Broadcast_Audio, make a Broadcast_WAV with `audioToWav`, and write the file in the Output_Directory.
2. WHEN `make_broadcast` succeeds, THE Tool_Handlers SHALL return the absolute file path, the length in seconds rounded to two decimals, the sample rate in hertz, and the number of message bytes (an integer from 21 to 40).
3. THE Tool_Handlers SHALL name the file from a hash of the file's own content, so that two calls with the same alert and the same sample rate produce the same file name and byte-identical file content.
4. IF the Output_Directory does not exist, THEN THE Tool_Handlers SHALL create it before writing the file.
5. THE Tool_Handlers SHALL write only inside the Output_Directory and SHALL ignore any output path, file name, or directory the caller supplies, so that the returned path is always inside the Output_Directory.
6. WHERE the caller gives a sample rate that is an integer from 16000 to 96000 inclusive, THE Tool_Handlers SHALL use it for the Broadcast_WAV.
7. IF the caller gives no sample rate, THEN THE Tool_Handlers SHALL use 48000.
8. IF the caller gives a sample rate that is not an integer from 16000 to 96000 inclusive, THEN THE Tool_Handlers SHALL return an error reason indicating an invalid sample rate, SHALL NOT write a file, and SHALL NOT report a path.
9. IF the file cannot be written, THEN THE Tool_Handlers SHALL return the error reason `write-failed`, SHALL NOT report a path, and SHALL NOT leave a partial file at the target path.
10. WHEN `make_broadcast` is given the same Alert_Input and sample rate that the Broadcast page uses, THE Tool_Handlers SHALL produce a Broadcast_WAV whose samples are identical, sample for sample, to the samples the Broadcast page writes.

### Requirement 4: hear_wav

**User Story:** As a developer, I want to run a WAV file through the Listen page's decoder, so that I can see what a phone would show.

#### Acceptance Criteria

1. WHEN `hear_wav` receives a path to a WAV file that meets criterion 3, THE Tool_Handlers SHALL read the file, convert it to mono `Float32Array` samples, append Tail_Silence, feed the samples to a Sound_Link listener, and pass every Heard_Payload to `decodeMessage`.
2. THE Tool_Handlers SHALL decode with the same two calls the Listen page makes: the Sound_Link listener `feed` and `decodeMessage`.
3. THE Tool_Handlers SHALL accept WAV files with 16-bit PCM samples, 1 or 2 channels, and a sample rate from 16000 to 96000 Hz inclusive, and SHALL create the Sound_Link with the sample rate stored in the file.
4. WHEN a WAV file has 2 channels, THE Tool_Handlers SHALL convert it to mono by averaging the left and right sample of each frame.
5. IF the file is missing, unreadable, larger than 20 MB (20,971,520 bytes), not a RIFF WAVE file, or in a format other than the one in criterion 3, THEN THE Tool_Handlers SHALL return an error with the reason `file-not-found`, `file-unreadable`, `file-too-large`, `not-wav` or `unsupported-wav` respectively, and SHALL NOT feed any samples to the Sound_Link.
6. WHERE the caller gives a Noise_Level, THE Tool_Handlers SHALL add white noise at that level over the whole clip, including the Tail_Silence, before decoding.
7. WHERE the caller gives a Noise_Level, THE Tool_Handlers SHALL generate the noise from the caller's Seed, or from a default Seed of 1 when the caller gives none, so that the same file, Noise_Level and Seed always give the same result.
8. IF the Noise_Level is not a finite number from -60 to 60 inclusive, THEN THE Tool_Handlers SHALL return the error reason `bad-noise-level` and SHALL NOT decode the file.
9. WHEN `hear_wav` ends, THE Tool_Handlers SHALL return the number of payloads heard as `heard`, and for each payload its byte length, whether the Check passed, and the rejection reason from `decodeMessage` when it did not.
10. WHEN the Check passes for a payload, THE Tool_Handlers SHALL return the decoded alert fields, the sent time in UTC, the TEST flag value, and the expiry status from `checkExpiry` evaluated against the current system clock.
11. IF the Check fails for a payload, THEN THE Tool_Handlers SHALL return only that payload's byte length and rejection reason, and no decoded field (promise 1).
12. IF a decoded alert has an expiry status other than `current`, THEN THE Tool_Handlers SHALL return that status in words and SHALL NOT describe the alert as current (promise 2).
13. IF no payload is heard, THEN THE Tool_Handlers SHALL return `heard: 0` with the text "nothing heard", and SHALL NOT report this as an error.
14. WHEN a decoded alert has `test` set to false, THE Tool_Handlers SHALL report it as decoded like any other alert.

### Requirement 5: round_trip

**User Story:** As a developer, I want to run many noisy make-and-decode tries, so that I can see how often an alert survives.

#### Acceptance Criteria

1. WHEN `round_trip` receives an Alert_Input, a Noise_Level and a number of tries N, THE Tool_Handlers SHALL run N Tries, and each Try SHALL make Broadcast_Audio as in Requirement 3, add white noise at the Noise_Level, add Tail_Silence, decode as in Requirement 4, and compare the result with the sent alert.
2. THE Tool_Handlers SHALL accept N as a whole number from 1 to 200 and SHALL default N to 20 when N is not given.
3. IF N is not a whole number from 1 to 200, THEN THE Tool_Handlers SHALL return the error reason `bad-tries`, SHALL run no Try, and SHALL produce no audio.
4. THE Tool_Handlers SHALL derive the noise of each Try from the Seed and the Try number so that no two Tries in one call use the same noise, and SHALL default the Seed to 1 when the Seed is not given.
5. THE Tool_Handlers SHALL encode the alert and make the clean audio once per call and SHALL reuse that clean audio for every Try.
6. THE Tool_Handlers SHALL give each Try exactly one Try_Outcome, so that the sum of the counts of all Try_Outcomes equals N.
7. WHEN a Try ends with the Check passed and at least one decoded alert, THE Tool_Handlers SHALL compare every field of each decoded alert with the sent alert, and SHALL give the outcome `ok` only when every field of at least one decoded alert is equal to the sent alert and no Check-passed decoded alert differs from it.
8. WHEN a Check-passed alert differs from the sent alert in any field, THE Tool_Handlers SHALL give the outcome `wrong-alert` for that Try and SHALL list the names of the fields that differ.
9. WHEN `round_trip` ends, THE Tool_Handlers SHALL return the Noise_Level, N, the Seed, the sample rate, the count of each Try_Outcome (zero when a Try_Outcome did not occur), the number of successes (outcome `ok`), the number of failures (every other outcome), and the number of Tries where both plays were heard.
10. WHEN `round_trip` is called twice with the same alert, Noise_Level, N, Seed and sample rate, THE Tool_Handlers SHALL return results that are equal in every returned field.
11. IF the count of `wrong-alert` outcomes is above zero, THEN THE Tool_Handlers SHALL put a plain-text warning as the first line of the result stating that a Check-passed alert did not match the sent alert.
12. WHEN `round_trip` ends, THE Tool_Handlers SHALL include the Noise_Level and the Seed in the result so that the caller can repeat the run.
13. WHILE `round_trip` runs, THE Tool_Handlers SHALL keep all audio in memory and SHALL write no audio file, no log entry containing audio and no network request containing audio (promise 5).
14. WHEN `round_trip` is called with N = 20, THE Tool_Handlers SHALL finish within 60 seconds on the developer's machine, measured in the Vitest run.

### Requirement 6: Noise generation

**User Story:** As a developer, I want the noise to be repeatable and exact, so that a result can be repeated and compared.

#### Acceptance Criteria

1. THE Noise_Generator SHALL make white noise from a seeded pseudo-random number generator whose output depends only on the Seed, and SHALL NOT call `Math.random`.
2. WHEN the signal contains at least one non-zero sample and a Noise_Level is given, THE Noise_Generator SHALL add noise whose root-mean-square level, measured over the signal sample positions before clipping, is within 1 percent of the level the Noise_Level asks for.
3. IF the signal is empty or every sample is exactly 0, THEN THE Noise_Generator SHALL return the error reason `silent-signal`, SHALL NOT add noise, and SHALL NOT return an output clip.
4. THE Noise_Generator SHALL clip every output sample to the range -1 to 1 inclusive, and SHALL return an output with the same number of samples as the input signal.
5. WHEN noise is added twice to the same signal with the same Seed and the same Noise_Level, THE Noise_Generator SHALL return two outputs whose samples are identical (determinism).
6. WHEN noise is added to the same signal with two different Seeds and the same Noise_Level, THE Noise_Generator SHALL return outputs that differ in at least one sample.
7. WHERE the Noise_Level is 60 dB, THE Noise_Generator SHALL give a clip that the Sound_Link decodes to the same payload as the clean clip for the sample alert.

### Requirement 7: WAV reading

**User Story:** As a developer, I want the WAV reader to be exact and strict, so that `hear_wav` decodes what is in the file and nothing else.

#### Acceptance Criteria

1. WHEN the Wav_Reader reads a WAV file made by `audioToWav`, THE Wav_Reader SHALL return the sample rate that was written and the same number of samples that were written, with each sample within 1/32768 of the sample that was written.
2. THE Wav_Reader SHALL, for every sample array accepted by `audioToWav`, return samples that `audioToWav` writes back as bytes identical to the original file (round-trip property).
3. IF a chunk size runs past the end of the file, THEN THE Wav_Reader SHALL return the reason `not-wav`, SHALL NOT read any byte outside the file, and SHALL return no samples.
4. IF the input is shorter than a complete WAV header, does not start with the RIFF and WAVE identifiers, or lacks a `fmt ` chunk or a `data` chunk, THEN THE Wav_Reader SHALL return the reason `not-wav` and no samples.
5. IF the `fmt ` chunk describes anything other than 16-bit integer PCM with one or two channels, THEN THE Wav_Reader SHALL return a failure reason that is different from `not-wav` and indicates an unsupported format, and SHALL return no samples.
6. WHERE a WAV file has two channels, THE Wav_Reader SHALL return one sample per frame, equal to the average of the left and right samples of that frame, so the number of returned samples equals the number of frames.
7. THE Wav_Reader SHALL skip every chunk other than `fmt ` and `data`, including a chunk with an odd size, whose one padding byte is also skipped, and including a chunk placed between `fmt ` and `data`.
8. THE Wav_Reader SHALL return a result for every input byte array, including an empty array, and SHALL NOT throw (error-condition property). Each result is either samples with a sample rate, or a failure reason.

### Requirement 8: Registration and how to turn it on

**User Story:** As a developer, I want the server registered in this workspace and clear steps to switch it on, so that Kiro can use it.

#### Acceptance Criteria

1. THE MCP_Settings SHALL register exactly one server named `dead-air-ears` whose start command runs the Ears_Bundle with Node, using the path `tools/ears/build/ears.mjs`, relative to the workspace root.
2. THE MCP_Settings SHALL set `disabled` to `true` for `dead-air-ears` in the committed file.
3. THE MCP_Settings SHALL set `autoApprove` to an empty list for `dead-air-ears`, so that every tool call asks for approval.
4. THE MCP_Settings SHALL contain zero secrets and zero absolute paths, including any path that names a person's home folder.
5. THE Ears_Server SHALL include a file `tools/ears/README.md` that lists the commands to prepare the server (including `npm run build:ears`, which the user must run before turning the server on), the steps to turn the server on in Kiro (through the MCP Servers panel, or by setting `disabled` to `false` in the MCP_Settings), and one example call for each tool the server provides.
6. IF the README lists a prepare command that fails when run from a clean checkout of the workspace, THEN THE Ears_Server SHALL be treated as not meeting criterion 5 until the README is corrected.
7. WHEN the work of this spec is reported, THE agent SHALL include in its reply to the user every step listed in the README for preparing and turning on the server.
8. WHEN the Ears_Server is started with the README steps, THE Ears_Server SHALL start from the Ears_Bundle without any change to the Vite build configuration, the pages, the service worker or the offline copy, and the output of `vite build` SHALL be identical with and without the Ears_Server files present.

### Requirement 9: Project fit and tests

**User Story:** As a developer, I want the tool to follow the project rules, so that it does not break the app or the build.

#### Acceptance Criteria

1. THE Ears_Server SHALL keep its code in `tools/ears/`, with Tool_Handlers, noise and WAV reading in plain TypeScript files that import no MCP code, and MCP_Transport in its own file.
2. THE Ears_Server SHALL add as dependencies only `@modelcontextprotocol/sdk` and `zod`, both as `devDependencies`, and neither SHALL appear in `dist/`.
3. WHERE this spec edits a file owned by another spec, THE Ears_Server SHALL limit the edit to: new scripts and the two devDependencies in `package.json`; the Output_Directory line in `.gitignore`; and a `build:ears` script; and one new `tsconfig` for `tools/` added to the `typecheck` script. The Ears_Bundle output folder `tools/ears/build/` is also a `.gitignore` line.
4. WHEN `npm run build` completes, THE Ears_Server SHALL have contributed 0 files from `tools/` to `dist/`.
5. WHEN `npm test` runs, THE Tool_Handlers SHALL be covered by Vitest tests in `tests/ears/`, and all tests that existed before this spec SHALL pass.
6. THE tests SHALL include fast-check property tests for: the WAV round trip (Requirement 7.2), the noise level (Requirement 6.2), the same-Seed result (Requirement 6.5), and the TEST rule, where any Alert_Input with `test` not equal to `true` gives `not-a-test-alert` and writes 0 files.
7. THE tests SHALL include example tests for: the three tool results on the sample alert at 60 dB; one `hear_wav` call on a file with one changed byte in the message, which gives `check-failed` and no alert fields (promise 1); and one `round_trip` call on an expired alert, which reports the alert as not current (promise 2).
8. THE tests SHALL include one test that starts the MCP_Transport as a child process, sends `initialize`, `tools/list` and one `tools/call`, and checks that every line on stdout is a valid protocol message and that stdout holds nothing else.
9. THE tests SHALL set `test: true` in every stored or generated alert (promise 3).
10. WHEN `npm run typecheck` runs, THE Ears_Server SHALL be type-checked with the new `tsconfig` for `tools/`, and the script SHALL exit with a non-zero code if that check reports any error.
11. THE Ears_Server SHALL write audio only to files inside the Output_Directory, and SHALL write no audio data to stdout, stderr or any log (promise 5).
12. IF a test would write a file, THEN THE tests SHALL write it only inside the Output_Directory or a temporary folder, and SHALL delete files created in the temporary folder when the test ends.

### Requirement 10: First use and the diary entry

**User Story:** As a developer, I want the tool used once for real and the numbers written down, so that the diary shows what Kiro's ears found.

#### Acceptance Criteria

1. WHEN the server has been turned on, THE agent SHALL run `round_trip` once on one TEST sample alert at each of three Noise_Levels, with N = 20 tries per Noise_Level (60 tries in total) and with the default Seed.
2. THE three Noise_Levels SHALL be 0 dB, -10 dB and -15 dB, as decided by the user.
3. IF the server cannot be turned on from the agent session, THEN THE agent SHALL call the Tool_Handlers directly from a Node script with the same sample alert, the same three Noise_Levels, the same N and the same Seed, and THE Diary entry SHALL state that it did so.
4. WHEN all three runs have ended, THE agent SHALL append a section titled "Spec 5: Kiro's ears" to the Diary. The section SHALL contain the date of the runs, the file names and code locations of the tool, a results table with the columns Noise level, Tries, Successes, Failures and Failure outcomes (one row per Noise_Level), the Seed value, and the sample rate in Hz.
5. THE results table SHALL copy the Tries, Successes, Failures and Failure outcomes values from the `round_trip` output without rounding, recalculation or rewording.
6. THE Diary entry SHALL state three facts: the noise is white noise added to clean audio, the noise is not a room, and tests on real speakers and phones are still needed.
7. THE Diary entry SHALL list the decisions made and the problems found while building the tool, as separate lists, in the same heading and list style as the earlier Diary entries.
8. THE agent SHALL add the new section after the last existing line of the Diary and SHALL leave every existing line of the Diary unchanged.
9. IF any run reports one or more `wrong-alert` outcomes, THEN THE Diary entry SHALL include a finding that names the Noise_Level and the count of `wrong-alert` outcomes, AND THE agent SHALL tell the user about it in its final message before the work ends.
10. IF a `round_trip` run fails to finish or returns an error, THEN THE agent SHALL NOT write a results row for that Noise_Level with invented values, AND THE Diary entry SHALL state which Noise_Level failed and the error reported.
