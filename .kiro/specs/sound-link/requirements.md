# Requirements Document

## Introduction

The Sound Link is a small module that moves bytes through sound. It wraps ggwave. The Broadcast page uses it to turn a message into audio, and the Listen page uses it to get bytes back from microphone samples. It is spec 2 of 10 for Dead Air. The requirements were approved with three decisions, listed at the end.

The Sound Link carries bytes and nothing else. It does not know what the bytes mean. It never checks that they are intact, because the check value of the Message Code does that (promise 1). It has no UI, no microphone code, no speaker code and no audio context. The pages own those. The Sound Link works on arrays of samples, so it runs and is tested in plain Node. The `sound-test/` folder is the working reference for how ggwave is loaded and called, and it is not changed by this spec.

### What was checked before writing this spec

The brief says to stop and report if raw bytes do not survive ggwave. A throwaway probe in Node (not committed) checked this first. ggwave 0.4.0, 48000 Hz, all three audible modes, encode then decode in memory, no noise.

- **Raw bytes survive.** `ggwave.encode` accepts a `Uint8Array`. It is bound to a C++ `std::string`, which copies the bytes as they are. Only a JavaScript string is converted to UTF-8, which would change byte values above 127. The Sound Link therefore passes a `Uint8Array` and never a string. The decoder returns the bytes as an `Int8Array` view, which must be copied to a `Uint8Array`. All 256 byte values came through in the probe.
- **ggwave is not lossless, even with no noise.** In 300 random payloads of 1 to 40 bytes, FAST mode returned the exact bytes 288 times, nothing twice and wrong bytes 10 times. Every wrong result was for a payload of 2 to 7 bytes. Message Code messages are at least 21 bytes, and none of the 148 random payloads of 21 to 40 bytes returned wrong bytes. Two payloads of 21 and 37 bytes returned nothing, and for 4 of the 148 the result depended on where the sound started inside the first 1024-sample frame. Sending again fixes a missed message. A requirement that "any byte array survives" can therefore only be a measured rate, not a guarantee. Requirement 6 says how it is measured.
- **The decoder must get whole frames.** `ggwave.decode` expects exactly 1024 samples (`samplesPerFrame`) per call. A shorter last chunk left a shared decoder in a state where it returned nothing for every later message. The Sound Link must collect samples into whole frames itself.
- **The encoder returns a view into shared memory.** The array returned by `ggwave.encode` points into one static buffer that the next call overwrites. The Sound Link must copy it.
- **ggwave resamples by itself.** ggwave works at 48000 Hz inside and has separate input and output rates. With the output rate at 44100 the encoder returned a 2.603 second sound at 44100 Hz, the same length as at 48000 Hz. A decoder with the input rate at 44100 decoded it exactly. It also decoded a sound made at 48000 Hz and resampled to 44100 Hz, and one resampled to 16000 Hz. The Frame size follows the input rate: at 44100 Hz it is 941 samples and at 16000 Hz it is 342. The values 940 and 341 returned nothing, and 1024 returned nothing at either rate. At 8000 Hz a 48000 Hz sound was not decoded.
- **ggwave has room for only four instances.** `ggwave.init` returned a valid handle three times after the encoder took one. Every later call returned -1 until instances were freed with `ggwave.free`. The Sound_Link must check for -1 and must free every instance it makes.
- **ggwave prints to the console by default.** `encode` prints buffer sizes. The decoder prints the decoded payload as text. Logging is turned off with `ggwave.disableLog()`.

Airtime in each audible mode, at 48000 Hz, from the same probe. These are the starting numbers. Requirement 8 asks for the final report, with noise results and a recommendation.

| Payload | NORMAL | FAST | FASTEST |
|---|---|---|---|
| 1 byte | 1.07 s | 0.94 s | 0.81 s |
| 19 bytes | 2.60 s | 1.96 s | 1.32 s |
| 40 bytes | 4.52 s | 3.24 s | 1.96 s |

## Glossary

- **Sound_Link**: The module in this spec, in `src/sound-link/`.
- **Payload**: The bytes carried by one transmission. For Dead Air it is one Message Code message, 21 to 40 bytes. The Encoder accepts 21 to 40 bytes. The Listener reports a Payload of any length.
- **Samples**: A mono `Float32Array` of audio values from -1 to 1.
- **Sample_Rate**: The sample rate of the Samples that the Encoder returns and the Listener receives. The default is 48000 Hz, as in the official ggwave browser example. A caller may pass the real rate of its device (Requirement 1.7).
- **Frame**: The number of Samples ggwave decodes per call. It is 1024 at 48000 Hz, and for any other Sample_Rate it is 1024 times the Sample_Rate divided by 48000, rounded up.
- **Mode**: One of the ggwave audible protocols: `AUDIBLE_NORMAL`, `AUDIBLE_FAST`, `AUDIBLE_FASTEST`.
- **Encoder**: The function `bytesToAudio`.
- **Listener**: The object that takes microphone Samples and reports Payloads.
- **Wav_Writer**: The function `audioToWav`.
- **Heard_Payload**: Bytes that the Listener reports. They are not yet checked and are untrusted.
- **Outcome**: For one transmission in a test, one of `exact` (the Listener reported exactly the sent bytes and nothing else), `nothing` (it reported nothing) or `wrong` (it reported bytes that differ from the sent bytes, or more than one Payload).

## Requirements

### Requirement 1: Module boundary

**User Story:** As a developer of the Broadcast and Listen pages, I want one small module with no UI, so that both pages share the same sound code.

#### Acceptance Criteria

1. THE Sound_Link SHALL live in `src/sound-link/` and SHALL export `bytesToAudio`, `audioToWav`, a way to create a Listener, a way to load ggwave, and the constants for the default Sample_Rate, the Mode in use and the smallest and largest Payload size, and a function that gives the Frame size for a Sample_Rate.
2. THE Sound_Link SHALL NOT use `window`, `document`, `navigator`, `AudioContext`, `Blob`, `fetch`, `XMLHttpRequest` or any other browser API, so that it runs and is tested in plain Node.
3. THE Sound_Link SHALL NOT create or resume an audio context, request the microphone, or play or capture sound. The pages do that, after the user taps (sound rules).
4. THE Sound_Link SHALL NOT import from `src/message-code/` and SHALL NOT interpret Payload bytes.
5. THE Sound_Link SHALL load ggwave from the `ggwave` npm package bundled with the app. It SHALL make no network request, at load or at any later time (promise 4).
6. THE Sound_Link SHALL turn ggwave logging off when it loads ggwave, so that decoded Payloads are never written to the console.
7. THE Sound_Link SHALL use a Sample_Rate of 48000 Hz unless the caller passes another one. A caller-supplied Sample_Rate SHALL be a whole number from 16000 to 96000 Hz. Any other value SHALL be rejected with a reason code. THE Sound_Link SHALL set both the ggwave input rate and the ggwave output rate to the Sample_Rate in use, and SHALL rely on ggwave to resample to its internal 48000 Hz. It SHALL NOT resample by itself.
8. THE Sound_Link SHALL NOT change any file in `sound-test/`.

### Requirement 2: bytesToAudio

**User Story:** As the Broadcast page, I want a function that turns bytes into audio samples, so that I can play them or save them.

#### Acceptance Criteria

1. WHEN `bytesToAudio` receives a `Uint8Array` of 21 to 40 bytes, THE Encoder SHALL return Samples at Sample_Rate in the Mode in use, ready to play.
2. THE Encoder SHALL pass the bytes to ggwave as a `Uint8Array` and never as a string, so that every byte value from 0 to 255 is carried unchanged.
3. THE Encoder SHALL return a copy of the audio. The returned Samples SHALL NOT change when the Encoder is called again.
4. IF the input is not a `Uint8Array`, is shorter than 21 bytes (including empty), or is longer than 40 bytes, THEN THE Encoder SHALL return a rejection with the reason `not-bytes`, `too-short` or `too-long`, and SHALL return no Samples. It SHALL NOT throw for these inputs. 21 is the size of the shortest Message Code message and 40 is the largest.
5. WHEN the Encoder receives the same bytes twice, THE Encoder SHALL return Samples of the same length.
6. THE Encoder SHALL return Samples whose values are all within -1 to 1.
7. THE Encoder SHALL use a fixed output volume set by one named constant.
8. THE Encoder SHALL NOT read the device clock for anything that changes the audio.

### Requirement 3: Listener

**User Story:** As the Listen page, I want to feed microphone samples in and be told every payload that was heard, so that I can pass each one to the message check.

#### Acceptance Criteria

1. THE Sound_Link SHALL provide a way to create a Listener, and each Listener SHALL have its own ggwave instance, so that two Listeners never share decoder state. IF ggwave has no free instance, THEN creating a Listener SHALL return a rejection with the reason `no-free-instance`. THE Sound_Link SHALL free every ggwave instance it creates when it is disposed.
2. WHEN the caller gives the Listener Samples at the Listener's Sample_Rate, of any length, including 0, THE Listener SHALL return the list of Heard_Payloads found so far as `Uint8Array` copies, in the order heard. The list is empty when nothing was heard.
3. THE Listener SHALL collect incoming Samples into whole Frames of the size in the glossary and give ggwave only whole Frames. It SHALL keep the left-over Samples, fewer than one Frame, for the next call. The result SHALL NOT depend on how the caller splits the Samples into calls.
4. THE Listener SHALL return each Heard_Payload exactly as ggwave decoded it, whatever its length. It SHALL NOT edit, trim, check or discard bytes, except that a result of 0 bytes is not reported. A Payload shorter than 21 bytes or longer than 40 bytes is reported like any other, so that the Listen page can say it heard something it could not read.
5. THE Listener SHALL treat every Heard_Payload as untrusted. Its documentation SHALL say that bytes may be wrong or missing, and that only the Message Code check may be used to accept them (promise 1).
6. IF the input is not a `Float32Array`, or contains a value that is not a finite number, THEN THE Listener SHALL return an error result and SHALL leave its own state unchanged. It SHALL NOT throw for these inputs.
7. THE Listener SHALL NOT throw for any `Float32Array` input, including random values and very loud values.
8. THE Listener SHALL return only Heard_Payloads. It SHALL NOT return Samples, and it SHALL NOT expose the Frame buffer.
9. THE Listener SHALL provide `reset`, which discards the left-over Samples and any partial decode state, and `dispose`, which does the same and frees the ggwave instance. After `dispose`, calls SHALL return an error result.
10. THE Sound_Link SHALL keep microphone Samples only in memory, for at most one Frame in the Listener, and SHALL discard them as described in Requirement 3.9. It SHALL NOT write Samples to storage, to a log, or to the body of any request (promise 5).

### Requirement 4: Mode

**User Story:** As a project owner, I want one Mode used by both pages, so that a sender and a listener always agree.

#### Acceptance Criteria

1. THE Sound_Link SHALL use one Mode for the Encoder and the Listener, set by one exported constant.
2. THE Mode constant SHALL be one of the three audible Modes. Ultrasound Modes SHALL NOT be used, because phone speakers and microphones are not reliable above the audible range and the sound-test works in the audible range.
3. WHEN Requirement 8 recommends a Mode, THE Sound_Link SHALL use that Mode after the owner approves it. Until then the Mode is `AUDIBLE_FAST`, the Mode `sound-test/` uses.
4. THE Listener SHALL decode only the Mode in use. A caller MAY choose another audible Mode when loading the Sound_Link, so that tests can compare Modes. The Mode in use for a Sound_Link is the same for its Encoder and its Listeners.

### Requirement 5: audioToWav

**User Story:** As the Broadcast page, I want the encoded audio as a WAV file, so that a sender can save it and play it from another device.

#### Acceptance Criteria

1. WHEN `audioToWav` receives Samples, THE Wav_Writer SHALL return a `Uint8Array` that holds a complete WAV file: a 44-byte RIFF header followed by 16-bit signed little-endian PCM data, 1 channel, at the Sample_Rate the caller passes, 48000 Hz by default, which follows Requirement 1.7.
2. THE Wav_Writer SHALL write correct values for the RIFF chunk size, the format chunk, the byte rate, the block align and the data chunk size.
3. THE Wav_Writer SHALL clamp each sample to -1 to 1 before converting it, so that no value wraps around.
4. IF the input is not a `Float32Array`, or is empty, or has a value that is not a finite number, THEN THE Wav_Writer SHALL return a rejection with a reason code and SHALL NOT throw.
5. THE Wav_Writer SHALL return a `Uint8Array` and SHALL NOT create a `Blob` or a URL. The page does that.
6. FOR ALL Samples that `bytesToAudio` returns, reading the WAV data back to Samples and giving them to a new Listener SHALL report the original bytes (the saved sound file still decodes). The result is measured under Requirement 6.

### Requirement 6: Tests, all in memory

**User Story:** As a project owner, I want proof that bytes survive the sound link, and numbers for when they do not.

#### Acceptance Criteria

1. THE project SHALL test the Sound_Link with no speaker, no microphone and no browser, using the ggwave package in Node.
2. THE project SHALL include a test that sends every byte value from 0 to 255, using Payloads of 21 to 40 bytes that together cover all 256 values, plus Payloads of 40 bytes of 0x00 and of 0xFF and of 21 bytes of 0x00 and of 0xFF, and checks that the Outcome is `exact` for each, with no noise. If any of these is not `exact`, the test names the Payload and the result.
3. THE project SHALL include a seeded property test with fast-check: for Payloads of 21 to 40 bytes, the Listener SHALL NOT report `wrong` with no noise, and a Payload that does not give `exact` SHALL give `nothing`. The project SHALL also send Payloads of 1 to 20 bytes through ggwave directly, as a test-only helper, and report their Outcomes. These are not asserted, because the probe saw `wrong` results at 2 to 7 bytes (see the introduction). The Listener test in Requirement 6.14 uses one such Payload.
4. THE project SHALL include a test that the Outcome is `exact` for at least a stated share of random Payloads of 21 to 40 bytes with no noise, when the sound is sent once. The share is set in the design from the measured rate, with a margin, so the test does not fail by chance.
5. THE project SHALL include a test that a Payload that gives `nothing` at one start offset can give `exact` when the same Payload is sent again at a different offset, or SHALL record that this did not happen, so the Broadcast page spec knows if "repeat every minute" helps a missed message.
6. THE project SHALL include a test that the result does not depend on how the Samples are split into calls: one call with all the Samples, calls of 1024, calls of 1 and calls of 777 samples SHALL give the same Heard_Payloads.
7. THE project SHALL include a test that a short last chunk does not break the Listener: after a Payload sent with a last call of fewer than 1024 Samples, a second Payload SHALL still be heard.
8. THE project SHALL include a test that the Listener reports each of two Payloads, one after the other in one stream, in order.
9. THE project SHALL include a test that `bytesToAudio` called twice in a row returns two independent arrays.
10. THE project SHALL include noise tests: white noise from a seeded random source is mixed into the Samples at several levels, measured as signal-to-noise ratio in dB, for example 20, 10, 5, 0 and -5 dB. For each level and each Mode, THE test SHALL send a fixed seeded set of Payloads of 19 and 40 bytes, count the Outcomes `exact`, `nothing` and `wrong`, and write the counts to a report file. THE noise tests SHALL assert only that, at the lowest noise level, the Outcome is `exact` for the share set in the design, and SHALL NOT assert that `wrong` never happens, because the Message Code check is what catches it.
11. THE noise report SHALL show, for each level, how many `wrong` results were seen, so the owner can see how often the check is the only protection.
12. THE project SHALL check that the Sound_Link uses no browser API, by running the Sound_Link tests in the `node` environment of Vitest with the DOM library left out of the TypeScript settings for `src/sound-link/`.
13. THE project SHALL include tests at Sample_Rates of 44100 and 48000 Hz and at 16000 and 96000 Hz. For each rate, a Sound_Link made for that rate SHALL send a set of Payloads of 21 to 40 bytes to a Listener made for the same rate, with the same Outcomes required as at 48000 Hz. For each pair of 44100 and 48000 Hz, a sound made at one rate and resampled to the other by a test helper SHALL be heard by a Listener at the other rate. If ggwave fails at a rate, the supported range in Requirement 1.7 SHALL be narrowed to the rates that work, and the report SHALL say so.
14. THE project SHALL include a test that the Listener reports a Payload shorter than 21 bytes, and a Payload longer than 40 bytes, when ggwave is given one, and that the reported bytes are not changed.
15. THE project SHALL include a test that the Frame size is 1024 at 48000 Hz, 941 at 44100 Hz and 342 at 16000 Hz, and that a Listener given Samples in Frames of that size hears the sound, and a test that creating more Listeners than ggwave has room for gives `no-free-instance` and that disposing a Listener makes room again.
16. THE tests SHALL use no stored audio of a real room. Any sample Payload in the repository that decodes as a Message Code message SHALL have the TEST flag set (promise 3).

### Requirement 7: Type setup

**User Story:** As a developer, I want ggwave typed, so that mistakes are caught when the code is compiled.

#### Acceptance Criteria

1. THE project SHALL add the `ggwave` package as a dependency, pinned to one version. The tech rules name this package, so no other new package is added. If a type package or `@types/node` seems needed, THE work SHALL stop and ask first.
2. THE Sound_Link SHALL include a small type declaration for the parts of ggwave it uses, because the package ships no types.
3. THE Sound_Link SHALL be type-checked without the DOM library, as `src/message-code/` is.

### Requirement 8: Airtime report and Mode recommendation

**User Story:** As a project owner, I want to know how long a message takes in each Mode, so that I can choose one.

#### Acceptance Criteria

1. THE project SHALL measure and report, for each audible Mode, the seconds of audio for a 19-byte Payload and for a 40-byte Payload, at 48000 Hz. The 19-byte figure comes from ggwave directly, since the Encoder takes 21 bytes or more. The report SHALL also give the 21-byte figure from the Encoder.
2. THE report SHALL list, for each Mode, the noise results from Requirement 6.10 next to the airtime.
3. THE report SHALL recommend one Mode with the reason, and SHALL state that a speaker and microphone test is still needed, because the in-memory noise is white noise and a room is not (sound rules: test on real speakers and phones).
4. THE project SHALL NOT switch the Mode in use until the owner approves the recommendation (Requirement 4.3).
5. THE report SHALL be a Markdown file in the spec folder, written from the measured numbers, not typed by hand.

### Requirement 9: Limits of this spec

**User Story:** As a project owner, I want the edges of this spec stated, so that nothing is built twice.

#### Acceptance Criteria

1. THE spec SHALL NOT include any page, button, form, audio playback, microphone capture, history or repeat timer. These belong to the Broadcast and Listen specs.
2. THE spec SHALL NOT change files that belong to another spec. The only files it changes outside its own are `package.json` and the lock file, to add `ggwave`.
3. THE spec SHALL NOT resample audio and SHALL NOT play a Payload more than once. The Broadcast page plays each alert twice.
4. THE spec SHALL NOT change the Sound_Link Mode away from `AUDIBLE_FAST` until the owner approves the recommendation.

## Decisions at approval

1. **Sample rate.** The default is 48000 Hz and the caller may pass the real device rate. The probe showed that ggwave resamples by itself, so the Sound_Link accepts 16000 to 96000 Hz and tests 44100 and 48000 Hz in memory (Requirements 1.7 and 6.13).
2. **Playing twice.** The Sound_Link encodes one Payload once. The Broadcast page plays each alert twice.
3. **Sizes.** The Encoder accepts 21 to 40 bytes only. The Listener reports every Payload it hears, of any length (Requirements 2.4 and 3.4).
4. **Mode.** `AUDIBLE_FAST` stays in use for now.
