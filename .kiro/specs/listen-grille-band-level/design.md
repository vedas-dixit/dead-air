# Listen Grille Band Level Bugfix Design

## Overview

The speaker grille on the Listen page is the level meter. `levelOf` in `src/listen/level.ts` returns the largest absolute sample of a block, capped at 1, on a straight scale. A short loud sound (a knock, a tap, a low thump) has a large peak and lights the grille. A quiet broadcast from across the room has a small peak and barely moves it. The grille therefore says nothing about the one thing the listener wants to know: is the phone hearing a Dead Air broadcast?

The fix replaces what number the grille shows, and nothing else:

1. Measure only the pitch range the sound link transmits in, using a few Goertzel filters. The range is measured, not guessed (see "Where the pitch range is determined").
2. Use the average energy of the block in that range, not the peak sample.
3. Express it in decibels.
4. Subtract a running estimate of the room background in the same band, so silence and steady room noise give 0. The estimate falls quickly (time constant 1 second) and rises slowly (about 20 seconds), and the input to the rise is capped just above the estimate. A broadcast that plays for several seconds, or twice in a row, therefore cannot drag the background up under itself and fade its own grille out.
5. Map the result above the room to 0 to 1, which the existing code already turns into 0 to 100 percent and into lit dots.

The measurement is a pure function with no browser APIs. It adds no FFT library and no dependency. The decoder still receives the same sample block in the same way. The grille drawing, the 15 draws a second limit, the reduced-motion rule, the meter role and the screen reader text are not touched.

## Glossary

- **Bug_Condition (C)**: The grille level and the presence of the sound link signal disagree. Either a broadcast is present with a low peak and the grille stays near 0, or a loud sound outside the link's pitch range is present with no broadcast and the grille is high.
- **Property (P)**: A broadcast lights more of the grille than any out-of-band sound with a larger peak, and silence or steady room noise lights none.
- **Preservation**: Decoding, centre-outwards lighting, the 15 draws a second limit, the reduced-motion rule, the meter role and its text, level 0 when not running, in-memory-only audio, no network use, and a safe 0 for empty or NaN blocks.
- **Link_Band**: The range of frequencies in hertz in which the sound link's mode (`AUDIBLE_FAST`, `MODE` in `src/sound-link/constants.ts`) puts its tones. Measured in task 1 (see below).
- **Goertzel filter**: A recursive filter that gives the signal power at one chosen frequency over one block, with a few multiplications per sample. It needs no FFT.
- **Band_Power_dB**: The summed Goertzel power of the block over the Link_Band, divided by block length, in decibels.
- **Room_Background**: A running estimate of Band_Power_dB of the room. It is the state kept between blocks. It tracks asymmetrically: it falls with time constant `TAU_DOWN` (1 second) and rises with time constant `TAU_UP` (20 seconds), and the input to the rise is capped at `CAP_DB` above the estimate.
- **TAU_UP / TAU_DOWN**: The rise and fall time constants of Room_Background, in seconds. `TAU_UP` is 20 s (fixed by requirement 2.3). `TAU_DOWN` is 1 s (chosen here, see "Background tracking").
- **CAP_DB**: The most a single block can pull Room_Background up by, in dB above the current estimate. It stops a broadcast from raising the background under itself.
- **Back_To_Back_Play**: A TEST broadcast played twice with no gap, built in memory from the sound link's `bytesToAudio` (about 14 seconds for the 37 byte test message).
- **Band_Level**: A number from 0 to 1: how far Band_Power_dB sits above Room_Background, after a small gate and over a fixed span of decibels.
- **Lit dots**: `litCount(round(level * 100))`, the number of the 37 grille dots lit, the same function the grille uses.
- **Block**: One array of microphone samples passed to the controller's `onBlock`. The controller already hands the same array to the decoder.
- **Grille**: The 37 dots drawn by `createGrille` in `src/shared/ui/dom/grille.ts`, lit from the centre outwards by `litCount`.
- **levelOf**: The current function in `src/listen/level.ts`, peak sample on a linear scale. It is replaced.
- **ears tools**: The `dead-air-ears` MCP tools `make_broadcast`, `hear_wav`, `round_trip`.

## Bug Details

### Bug Condition

The bug shows whenever the level is taken from the peak sample. Peak says how loud the loudest moment was, in any pitch. It does not say whether the sound link's tones are present. Because it is on a linear scale, a quiet broadcast sits in the bottom few percent of the range, and because it is not compared with the room, steady noise shows at its own raw peak.

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type AudioBlockSequence (blocks of microphone samples, with the room before them)
  OUTPUT: boolean

  RETURN (X contains a broadcast in the Link_Band
            AND peak(X) is low
            AND levelOf(X) is near 0)
      OR (X contains a loud sound outside the Link_Band
            AND NOT X contains a broadcast
            AND levelOf(X) is high)
      OR (X is silence or steady room noise
            AND levelOf(X) > 0)
END FUNCTION
```

Requirement 2.7 adds a failure that the peak-based `levelOf` does not show but a badly tuned fix would: the grille is lit at the start of a broadcast and fades to 0 while the broadcast is still playing, because the background estimate has risen under it. `isBugCondition` is not extended for this, since it describes the current code. The check for it is part of fix checking and Property 5.

The third clause is current behavior 1.3. The requirements fold it into the fix property, and it is written here so that it is tested on its own.

### Examples

- A TEST broadcast mixed at about 2 percent of full scale (peak near 0.02): `levelOf` gives about 0.02, so 2 percent, which lights 0 or 1 dot. Expected: clearly more of the grille than any thump.
- A 70 Hz thump with peak 0.9 and no broadcast: `levelOf` gives 0.9, so about 90 percent of the grille. Expected: 0 dots, because 70 Hz is far below the Link_Band.
- A tap on the table (broadband click, peak 0.6): `levelOf` gives 0.6. Expected: much less than a broadcast. A click does put some energy in the band, but only for a few milliseconds of a block that is averaged over thousands of samples, then compared with the room.
- A TEST broadcast played twice back to back (about 14 seconds) at gain 0.05 over quiet room noise. With a single average of about 3 seconds, the background closes 99 percent of its gap to the broadcast in 14 seconds (1 - exp(-14/3)), and the grille fades out during the second play. Expected: lit for the whole of both plays.
- Fan noise, steady, peak 0.05: `levelOf` shows about 5 percent continuously. Expected: 0 once the Room_Background has caught up.
- A block of length 0, or a block of `NaN`: `levelOf` returns 0. Expected: still 0, no throw (3.8).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- The controller passes the same `Float32Array` to `listener.feed` as before. The decoding path, the check value handling and which alerts are shown do not change (3.1).
- Dots light from the centre outwards (3.2). `litCount` and `grilleDots` are not edited.
- The grille redraws at most 15 times a second (3.3). The draw limiter is not edited.
- The reduced-motion rule is followed as before (3.4).
- The meter keeps its ARIA role and the text from `listen.level.label`. The value comes from the new level (3.5). `ui-state.ts` still clamps to 0 to 1 and still reports 0 when the phase is not running (3.6).
- Audio stays in memory and is discarded. No new network request (3.7).
- An empty block or a block of NaN gives a level of 0 and does not throw (3.8).

**Scope:**
Everything except the number put in `level` by `makeOnBlock` is unaffected. This includes:
- The history, the cards, the state line and every string.
- The microphone provider and the Web Audio setup (sample rate, buffer size, the audio constraints).
- The sound link, the message code and the Broadcast page.

## Hypothesized Root Cause

This bug has no hidden cause to find. It is the design of `levelOf`, and the code shows it:

1. **Peak instead of average energy**: `levelOf` keeps the largest `Math.abs(sample)`. One loud sample decides the whole block, so a knock wins over a sustained quiet tone.
2. **No band filter**: every pitch counts equally. The sound link only uses part of the spectrum, so a thump below it and a click across everything are counted as if they were the broadcast.
3. **No reference to the room**: the value is absolute, so steady noise shows as a steady level and nothing is "above the room".
4. **Linear scale**: amplitude is mapped straight to the dots. Human loudness and the range of real rooms span far more than the 0 to 1 range, so quiet signals fall into the bottom dots.

The way the band is measured has one risk to check, not a cause of the bug. A thump at 0.9 peak is 30 dB or more above a broadcast at 0.02. A plain rectangular block leaks that energy into far-away frequencies, which could put it into the band. A Hann window on each block (a table of one block length, built once) keeps the leakage low. Task 1 and the tests in the Testing Strategy confirm it with the real numbers.

## Correctness Properties

Property 1: Bug Condition - The grille follows the sound link signal in the band

_For any_ block sequence where the bug condition holds (isBugCondition returns true), the fixed level function SHALL give a result such that a sequence containing a broadcast lights more of the grille than any sequence containing only out-of-band sound of larger peak, a loud sound outside the Link_Band with no broadcast SHALL light none of the grille, and silence or steady room noise SHALL light none of the grille. The level SHALL be built from the average energy of the block in the Link_Band, in decibels, minus the Room_Background, using Goertzel filters, with no FFT library and no new dependency.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7**

Property 2: Preservation - Everything but the number shown

_For any_ block sequence where the bug condition does NOT hold, and for every other part of the Listen page, the fixed code SHALL decode exactly the same payloads as the original code and SHALL keep the centre-outwards lighting, the limit of 15 draws a second, the reduced-motion rule, the meter role and its text, level 0 when not running, in-memory-only audio and no network use. An empty block or a block with NaN samples SHALL give level 0 and SHALL NOT throw.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

Property 3: Level is always safe to draw

_For any_ block (any length, including 0, any float values including NaN, Infinity and values above 1), any sample rate from 16000 to 96000 Hz and any prior state, the fixed level function SHALL return a finite number from 0 to 1 and a state that is finite or empty, and SHALL NOT throw.

**Validates: Requirements 2.4, 3.8**

Property 4: Level is read-only and keeps the diary line

_For any_ block, computing the level SHALL leave the block's samples unchanged. When the fix is complete, `docs/kiro-diary.md` SHALL contain a diary line saying the change came from a real-room test.

**Validates: Requirements 2.6, 3.1**

Property 5: Bug Condition - A broadcast stays lit while it plays, and the background tracks quickly down and slowly up

_For any_ TEST broadcast played twice back to back over a quiet room, at any gain from 0.005 to 0.2, the fixed level function SHALL light more than 0 grille dots, and at least `MIN_LIT_DOTS`, for every block from the start of the first play to the end of the second. _For any_ block length and sample rate, the Room_Background SHALL fall with time constant `TAU_DOWN` (1 s) and rise with time constant `TAU_UP` (20 s), computed from block length and sample rate. _For any_ input held above the background for a time `T`, the background SHALL rise by at most `(T / TAU_UP) * CAP_DB`, so a broadcast cannot raise the background under itself. Silence and steady room noise SHALL still light none, and the 70 Hz thump SHALL still light fewer dots than the quiet broadcast.

**Validates: Requirements 2.1, 2.3, 2.7**

## Fix Implementation

### Where the pitch range will be determined

The pitch range is not guessed and is not typed in from memory. It is fixed in task 1, before any level code is written, from these sources in this order:

1. **The sound link.** `src/sound-link/constants.ts` sets `MODE = 'AUDIBLE_FAST'`, sample rate 48000 Hz and a frame of 1024 samples. The ggwave library takes the tone spacing from these: 48000 / 1024 = 46.875 Hz per bin.
2. **The ggwave library.** Read the protocol table for `AUDIBLE_FAST` in the bundled `ggwave` package, to get the first bin and the number of bins. The npm package is a compiled WebAssembly build, so its source may not be readable. If it is not, this step is skipped and step 3 decides.
3. **A measurement with the ears tools.** `make_broadcast` writes a real TEST broadcast WAV. A throwaway Node script (committed as `scripts/measure-link-band.mjs`, plain Node, no dependency) takes a Hann-windowed 1024-sample DFT of every frame that has sound, adds up the power per bin, and reports the lowest and highest bin within 30 dB of the strongest and the share of the total power inside that range. `hear_wav` is run on the same file to show it decodes, so the file measured is a real working broadcast.

A first measurement was made while writing this design, on a 6.97 second, 37 byte TEST broadcast at 48000 Hz:

| Result | Value |
|---|---|
| Bins within 30 dB of the strongest | 40 to 132 |
| In hertz | about 1875 Hz to about 6190 Hz |
| Share of total power inside that range | 99.999 percent |
| Shape | flat, every bin in the range within about 14 dB of the strongest, with a sharp fall below bin 39 and above bin 132 |

So the tones sit in the range of about 1.9 kHz to 6.2 kHz and are spread evenly across it. This table is evidence for the design, not the final constant. Task 1 repeats the measurement with several different TEST alerts (so that it is not one lucky message), at 44100 Hz as well as 48000 Hz, and writes the result into `LINK_BAND` with a comment naming the source. A test then asserts that the committed `LINK_BAND` still contains the range the measurement script finds, so a change to the mode in the sound link breaks a test and not the meter.

Because the energy is spread flat over the range, the filters are spaced across the whole range. A thump at 70 Hz or a low hum is below it by more than a factor of 25 in frequency.

### Background tracking

**Per-block coefficients.** The coefficients come from block length and sample rate, not from a block count. For the usual block of 1024 samples at 48000 Hz, `blockSeconds` is 0.02133 s (46.9 blocks a second):

| Direction | Time constant | Per block, 1024 at 48000 Hz (0.02133 s) | Per block, 4096 at 44100 Hz (0.0929 s) |
|---|---|---|---|
| Rise (`alphaUp`) | 20 s | 1 - exp(-0.02133 / 20) = 0.001066 | 0.004634 |
| Fall (`alphaDown`) | 1 s | 1 - exp(-0.02133 / 1) = 0.02110 | 0.08871 |

A unit test checks that the same room settles in about the same number of seconds at block lengths 512, 1024 and 4096.

**Choice of the fall time constant: `TAU_DOWN` = 1 second.** Requirement 2.3 leaves this open. Two forces pull in opposite directions:
- *Too slow a fall* (5 s or more): after a fan is switched off or a loud room event ends, the background stays high for many seconds, and a broadcast arriving then is hidden. Closing 90 percent of the gap takes 2.3 time constants, so 1 s gives about 2.3 s and 5 s gives about 11.5 s.
- *Too fast a fall* (0.1 s, about 5 blocks): the background follows every dip in the band power of steady noise, so it sits at the bottom edge of the noise and ordinary wobble lights the grille. With 8 filters over 1024 samples the block-to-block spread of steady noise is roughly 1.5 dB (about 16 degrees of freedom, 4.34 * sqrt(2/16)). With the fall 20 times faster than the rise, the estimate settles near a low percentile of that spread, roughly 2.5 dB under the mean, and peaks of the noise sit about 6 dB above it. That is why `GATE_DB` starts at 8 dB and not 6 dB.

1 s is about 47 blocks: long enough that the estimate averages over dips and does not collapse to the minimum, short enough that a quiet room is trusted again within a few seconds. It is 20 times faster than the rise, which is the asymmetry requirement 2.3 asks for. These numbers are estimates, so 1 s is a starting value. In task 4 it is swept over 0.5, 1, 2 and 4 s with the tests below (steady noise stays at 0 lit dots, back-to-back play stays lit, recovery after a loud sound ends within 5 s). The value stays if all pass. If not, it changes, and the numbers are recorded.

**Cap and slow rise together.** Uncapped, a broadcast 20 dB above the room moves the background by `20 * (1 - exp(-14 / 20))`, about 10 dB, over the 14 seconds of the back-to-back play, and about a third of the grille is gone. With the cap, each block moves the background by at most `alphaUp * CAP_DB`, so over a time `T` the rise is at most `(T / TAU_UP) * CAP_DB`. With `CAP_DB` = 4 dB (starting value: above the typical wobble of steady noise so ordinary noise is tracked, below `GATE_DB`):

| Time under a continuous broadcast | Most the background can rise |
|---|---|
| 7 s (one play) | 1.4 dB |
| 14 s (two plays, back to back) | 2.8 dB |
| 30 s | 6 dB |

So the cap and the slow rise do not conflict. The 20 s time constant sets the speed, and the cap sets the largest step per block, so the rise cannot exceed a straight line of 0.2 dB a second whatever the broadcast's loudness. The 2.8 dB lost over two plays is under `GATE_DB` and under 10 percent of `SPAN_DB`, so the grille at the end of play 2 is nearly as high as at the start of play 1. The cost is that a lasting step up in room noise (a fan switched on) is absorbed slowly: a 20 dB step stays lit for roughly 100 seconds. This is accepted, because a grille that fades during a broadcast defeats the meter's purpose and a lit grille during a new loud steady noise is the lesser fault. If the real-room test shows it is not acceptable, the follow-up is a separate change.

**Floor on the background.** A muted or stalled microphone gives blocks of digital silence, and the fast fall would send the background to about -120 dB. With the slow, capped rise the grille would then stay lit for minutes once real room noise returned. `BACKGROUND_FLOOR_DB` prevents this. It is set in task 4 a few dB under the band power of the quietest real room measured with the ears tools, with a comment naming the source. Digital silence still gives level 0, because it is never above the background.

**Shown-level smoothing (added in task 3.6).** The band power of a steady broadcast swings about 11 to 13 dB peak to peak between blocks, so the per-block level dips under the gate between tone frames. `bandLevel` therefore keeps `shown` in the state: `level = max(instant, shown_prev * exp(-blockSeconds / SHOWN_TAU))` with `SHOWN_TAU` = 0.5 s. It rises at once and falls over about half a second. It changes only what number the grille shows, and does not touch the background. Final constants: `GATE_DB` 8, `SPAN_DB` 12, `TAU_DOWN` 1, `CAP_DB` 4, `BACKGROUND_FLOOR_DB` -55, `MIN_LIT_DOTS` 4. The floor never raises a background already under it. The broadcast window in the tests is now the blocks within 6 dB of the broadcast's own median (was 20 dB), because the first and last block of each play are only partly filled with sound. The Property 5 test domain is a broadcast at least about 15 dB over a room of at least 0.002 peak (see the comments in `level-band.ts`), because the floor treats a room under -55 dB as -55 dB.

**Known limit of warm-up.** If listening starts while a broadcast is already playing, the first block becomes the background and that play shows 0. The fast fall pulls the background down to the room when the play ends or pauses, so the next play is lit.

### Changes Required

**File**: `src/listen/level-band.ts` (new)

**Contents**: `LINK_BAND` constant: lowest and highest frequency in hertz, plus the comment with where the numbers come from. Constants for the filters, the window, the gate, the span and the background time constant, with a comment on each saying how it was chosen. Nothing here imports a browser API.

**File**: `src/listen/level.ts`

**Functions**: replaces `levelOf`. The file stays pure.

**Specific Changes**:
1. **Goertzel filters**: `goertzelPower(samples, windowTable, coefficient)` runs the recursion `s = x*w + c*s1 - s2` once over the block and returns the power at that frequency. Filter centres are spaced evenly across `LINK_BAND`. The count is 16 (`FILTER_COUNT`), spaced evenly across the band, one about every 290 Hz. Task 3.1 fixed it: with fewer filters the summed power varied too much from block to block on the measured broadcast. Each filter runs over two Hann windows of 512 samples (the two halves of a 1024 block) and the two powers are added. For blocks shorter than 1024 the window is min(512, length), and under 512 samples a single window is used.
2. **Window**: a Hann window table of `WINDOW_SAMPLES` (512) samples, or of min(512, block length) for shorter blocks, built once per window length and kept in a small cache keyed by length, so there is no allocation per sample. A cache of one entry is enough, because the block length is the same for the whole session.
3. **Average energy**: `bandPowerDb(samples, sampleRate)` sums the filter powers and divides by the block length, and returns `10 * log10(max(power, FLOOR))`. `FLOOR` is a tiny positive power, so silence gives a finite number (about -120 dB) and not minus infinity. Samples that are NaN count as 0. Samples that are infinite or above 1 are clamped to the range of -1 to 1 before use, so one bad value cannot produce infinity. Filters whose centre is at or above the Nyquist frequency (`sampleRate / 2`) are dropped. With the allowed sample rates of 16000 to 96000 Hz the whole range is below Nyquist, so this only guards bad input.
4. **Room background (asymmetric)**: the state is a plain value, `{ backgroundDb: number | null }`, and `bandLevel(state, samples, sampleRate)` returns `{ state, level }`. It is a pure function: the same state and block give the same result, and it keeps nothing in a module variable. The first block sets the background and gives level 0 (warm-up). After that, with `blockSeconds = samples.length / sampleRate`:
   - `alphaUp = 1 - exp(-blockSeconds / TAU_UP)` and `alphaDown = 1 - exp(-blockSeconds / TAU_DOWN)`, so the time constants are the same whatever block size the browser chooses.
   - If `blockDb < backgroundDb`: `backgroundDb += alphaDown * (blockDb - backgroundDb)`.
   - Otherwise: `backgroundDb += alphaUp * (min(blockDb, backgroundDb + CAP_DB) - backgroundDb)`.
   - After either update, `backgroundDb` is not allowed below `BACKGROUND_FLOOR_DB`.
   See "Background tracking" above for the numbers and why.
5. **Mapping**: `level = clamp((blockDb - backgroundDb - GATE_DB) / SPAN_DB, 0, 1)`, using the background from before this block's update. `GATE_DB` (starting guess 8 dB) keeps small wobbles in steady noise from lighting the first dot. `SPAN_DB` (starting guess 30 dB) is the rise that lights the whole grille. Both are fixed during task 4 from the measured values, not left at the guess.
6. **Safe results**: an empty block, an all-NaN block, or a bad sample rate returns the state unchanged and level 0. The function does not throw. Every result is finite.
7. **No change to the samples**: nothing writes into the block.

**File**: `src/listen/controller.ts`

**Function**: `makeOnBlock` and `endSession`

**Specific Changes**:
1. Keep one `LevelState` next to `level`. Replace `level = levelOf(samples)` with a call to `bandLevel(levelState, samples, hnd.sampleRate)`. The owner handle's `sampleRate` is already available (`ensureLink(hnd.sampleRate)` uses it). Store the owner's `sampleRate` in a local next to `linkRate` for the block handler.
2. Put the level call in its own `try`/`catch` that comes before `listener.feed(samples)`. If the level code ever threw, the decoder would still be fed, and `level` would stay at its last value. The decoder call, `applyPayload`, history saving and the new-alert callback are not touched.
3. In `endSession`, reset the state to the starting value together with `level = 0`, so the next session warms up from the new room. The "not running shows 0" rule in `ui-state.ts` stays as it is.

This is a one-spot edit to a file that belongs to the Listen page spec. It is the only place the level is taken, and the request to fix it is the user's, so it is made here. No other file in the Listen page spec, and no file of the sound link, message code, look or offline specs, is edited.

**Files not changed**: `src/shared/ui/dom/grille.ts`, `grille-layout.ts`, `draw-limiter.ts`, `src/listen/ui-state.ts`, `src/listen/dom/render.ts`, `src/listen/dom/web-microphone.ts`, `src/sound-link/*`, all strings.

**File**: `docs/kiro-diary.md`

Add a diary entry in the same style as the existing ones: the grille was driven by peak, which a knock beats a far broadcast at; the change was found by testing in a real room with a real broadcast, not by a unit test; the fix uses a band measurement, decibels and a room background; what the ears tools showed. The line states that the change came from a real-room test. The numbers in the entry are the measured ones, not estimates.

### Known limit

A broadband click (a tap on the table) has some energy in the Link_Band. After the fix it lights the grille much less, because its energy is spread over a few milliseconds of a block averaged over about 21 ms (1024 samples at 48000 Hz) or more, and the gate removes small rises. It can still light the first few dots on a hard knock close to the microphone. The requirements ask for a low-pitched thump to light less than a quiet broadcast. They do not ask for a tonal test, and adding one would be a larger change. If the real-room test shows a knock is still misleading, the follow-up is to ask for the energy to be steady over several blocks, which is a separate bugfix.

## Testing Strategy

### Validation Approach

First show the bug on the unfixed `levelOf` with the same broadcast and thump that the fixed code is tested with. Then show the fixed code passes, and that nothing else moved. The ears tools are the source of the real broadcast, so the test does not use a made-up beep.

### How the ears tools are used

The `dead-air-ears` tools run in the agent session, and Vitest cannot call them. So the work is split in two:

1. **Real broadcast, made with the tools, measured by hand.** `make_broadcast` makes a TEST broadcast WAV from a TEST alert (`"test": true` always, for every alert in this spec, so promise 3 holds). `hear_wav` confirms that the file decodes (the payload is heard and the check passed). `round_trip` at a few `noiseDb` values (for example 20, 10, 0) confirms that the broadcast is still a real, decodable broadcast when it is quiet relative to noise, so "low level" in the test is a level at which the link still works. The measuring script and the level function are run on the tool's WAV, and the numbers are written into the diary entry and into the task report. WAV files stay in `tools/ears/out/`, which is git-ignored. No WAV is added to the repository and no other audio is written to disk.
2. **The same broadcast, made in memory, in automated tests.** `make_broadcast` is built on the sound link's `bytesToAudio`. The Vitest tests build the same TEST message with the message code, call `bytesToAudio` through the sound link loaded in Node (as `tests/sound-link` and `tests/ears` already do), and keep the samples in memory. The test then mixes the broadcast at a chosen gain, adds a synthetic room, and feeds blocks of 1024 samples to the level function. Nothing is written to disk or sent anywhere (promises 3 and 5, requirement 2.5).

Both parts use the same message, and the manual part is checked against the automated numbers: if the automated test and the real WAV from the tool disagree by more than a few decibels, the test is wrong, not the tool.

### Exploratory Bug Condition Checking

**Goal**: Show the bug on the unfixed code before changing it. Confirm that peak is the cause. If the unfixed code does light the grille for a quiet broadcast, the diagnosis is wrong and must be revisited.

**Test Plan**: Write the tests below against the current `levelOf` (wrapped so the test calls one function name), run them, and record the failures. Then switch them to the new function.

**Test Cases**:
1. **Quiet broadcast**: the TEST broadcast at gain 0.02, block by block. The number of lit dots is 0 or 1 (will fail the "lights more than a thump" check on unfixed code).
2. **Loud thump**: 70 Hz decaying sine, peak 0.9, 150 ms, with no broadcast. The unfixed level is high (will fail "lights none" on unfixed code).
3. **Steady noise**: white noise at peak 0.05 for 10 seconds. The unfixed level stays near 0.05 and never settles to 0 (will fail on unfixed code).
4. **Silence**: all zeros. Unfixed code gives 0 here, which is expected and is the same after the fix.
5. **Empty and NaN blocks**: unfixed code gives 0 here too (preserved, 3.8).

**Expected Counterexamples**:
- Quiet broadcast: level of about 0.02. Thump: level of about 0.9. Steady noise: level that follows the noise.
- Cause: peak sample, linear scale, no band, no background.

### Fix Checking

**Goal**: For all inputs where the bug condition holds, the fixed function gives the expected behavior.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := grilleLevel_fixed(X)
  ASSERT (X contains a broadcast  => litDots(result) > litDots(grilleLevel_fixed(thump of larger peak)))
     AND (X is an out-of-band loud sound with no broadcast => litDots(result) = 0)
     AND (X is silence or steady room noise => litDots(result) = 0)
     AND (X is a Back_To_Back_Play over a quiet room =>
            FOR EVERY block b of the broadcast window:
              litDots(result[b]) > 0
              AND litDots(result[b]) >= MIN_LIT_DOTS)
END FOR
```

The broadcast window runs from the start of play 1 to the end of play 2: the blocks in which the broadcast alone, without the room, has band power within 20 dB of its own median, so a quiet lead-in or tail does not count. `MIN_LIT_DOTS` starts at 4 of the 37 dots and is fixed in task 4 from the measured numbers. It must be at least 1, because requirement 2.7 asks for lit, not for a particular height.

"Lit dots" is `litCount(round(level * 100))`, the same function the grille uses, so the test measures what the listener sees.

### Preservation Checking

**Goal**: For all inputs where the bug condition does NOT hold, behavior is the same as before.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT decode_original(X) = decode_fixed(X)
END FOR
```

**Testing Approach**: Property-based testing, with fast-check, is used for preservation because the input space (block lengths, sample values, sample rates, sequences) is large and the cheap properties (finite, in range, no throw, input not changed) should hold for all of it.

**Test Plan**: Run the existing controller, grille, draw limiter, ui-state, render and listen tests before the change and after, and keep them passing without edits except where they call `levelOf` by name.

**Test Cases**:
1. **Decoder gets the same block**: in the controller test with fakes, the block passed to `feed` is the same object with the same contents, for a run of blocks, before and after the fix (3.1). A level function that throws (injected through the controller test) does not stop `feed` from being called.
2. **Centre-outwards, 15 draws a second, reduced motion**: the existing grille, draw-limiter and render tests pass unchanged (3.2, 3.3, 3.4).
3. **Meter role and text**: the existing render and ui-state tests pass unchanged, and a new check shows `aria-valuenow` follows the new level (3.5).
4. **Idle, starting, stopped give 0**: existing ui-state test, plus a controller check that `endSession` resets the state, so a second session warms up again (3.6).
5. **Empty and NaN blocks**: level 0, state unchanged, no throw (3.8).

### Unit Tests

- `bandPowerDb`: silence is finite and very low; a pure tone at the centre of the band is much higher than the same tone at 70 Hz at the same amplitude; a tone at the lower and upper edge of `LINK_BAND` is counted; a tone 1 octave below the band is far lower than one in it.
- `bandLevel`: first block gives 0; constant input gives 0; a step of +20 dB lights part of the grille and is still lit after 14 s (it falls back to 0 only after about the time given in "Background tracking"); a step down of 20 dB in the room is followed by the background within about 5 s; a rise of a few dB below the gate gives 0.
- Coefficients: `alphaUp` and `alphaDown` for 1024 at 48000 Hz match 0.001066 and 0.02110 to 3 significant figures.
- The floor: a run of digital silence followed by real room noise does not leave the grille lit for more than a few seconds.
- A loud thump (70 Hz, 0.9 peak) during steady room noise does not move the background by more than the cap allows.
- The time constant is in seconds, not blocks: the same room at block lengths 512, 1024 and 4096 settles in about the same time.
- `LINK_BAND` still contains the range measured from a fresh TEST broadcast (the guard against a mode change in the sound link).
- The old `levelOf` peak tests in `tests/listen/level.test.ts` are replaced. The empty, NaN and bad-value tests are kept, rewritten for the new function.

### Property-Based Tests

- For any block length from 0 to 8192, any float values (including NaN, Infinity, -Infinity, large values), any sample rate from 16000 to 96000 and any previous state: result is finite, level is from 0 to 1, no throw (Property 3).
- For any block: the samples are unchanged after the call (Property 4).
- For any gain from 0.005 to 0.2 on the TEST broadcast, with a fixed seed for the room: the broadcast lights more dots than a 70 Hz thump of peak 0.9 (Property 1). Gain and seed come from fast-check, so it is not one lucky value.
- For any steady noise level from 0.001 to 0.3 (white noise, fixed seed): after 10 seconds of blocks, the level is 0 for every block from then on (Property 1). The time is 10 s, not 5 s, because the estimate now settles at the fall rate from the first block and then holds.
- For any gain from 0.005 to 0.2, any room noise from 0.001 to 0.02 and any seed: the Back_To_Back_Play after 3 seconds of lead-in room lights more than 0 dots for every block of the broadcast window, and at least `MIN_LIT_DOTS` for every block of the broadcast window (Property 5).
- For any constant block power `d` dB above the background, held for any time `T` from 1 to 60 seconds, at any block length from 256 to 8192 and any sample rate from 16000 to 96000: the background rise is at most `min(d, (T / TAU_UP) * CAP_DB)` plus a small tolerance (Property 5). This tests the state function directly.
- For any constant block power below the background, held for `T` seconds: the remaining gap is within a small tolerance of `exp(-T / TAU_DOWN)` times the starting gap, or the floor has been reached (Property 5).
- For any block length and sample rate, `0 < alphaUp < alphaDown < 1` (Property 5).
- For any scaling of the whole input (broadcast and room together by the same factor): the level is the same within a small tolerance, because everything is relative to the room.

### Integration Tests

- **Real TEST broadcast, low gain, against a loud thump** (Requirements 2.1, 2.5): quiet room noise for 3 seconds, then the broadcast at a low gain; separately, the same room and a 70 Hz thump with peak 0.9. The maximum lit dots over the broadcast run is higher than over the thump run.
- **Back-to-back TEST broadcast** (Requirement 2.7): build the TEST message with the message code, call `bytesToAudio` once, and join its samples to themselves in memory with no gap. Put 3 s of synthetic quiet room noise before it. Feed 1024-sample blocks to `bandLevel` at the sound link's sample rate. For every block of the broadcast window, from the start of play 1 to the end of play 2, assert lit dots > 0 and lit dots >= `MIN_LIT_DOTS`. Also assert that the mean lit dots of play 2 is at least 70 percent of the mean of play 1, so a slow fade that stays just above the minimum is caught. Run at gains 0.02 (low) and 0.2 (loud, where the background has the most to climb). Everything stays in memory.
- **Counter-example run**: the same test with `TAU_DOWN = TAU_UP = 3 s` and no cap is expected to fail the back-to-back assertion. It is run once during task 4 and recorded, to show the test can fail. It is not a shipped test.
- **Quiet-room comparisons still hold** (2.1, 2.3): in the same test file, with the asymmetric background, the quiet broadcast at gain 0.02 still lights more dots than the 70 Hz thump of peak 0.9, the thump still lights less than the quiet broadcast (it lights 0 dots, because the band measurement ignores it), and steady room noise and silence still light none.
- **Silence and steady noise** (2.3, 2.5): no dot is lit at any block after warm-up.
- **Real-room test with the ears tools** (2.5, 2.6): run `make_broadcast`, `hear_wav` and `round_trip` as above on a TEST alert. Record the Band_Power_dB of the broadcast, of a synthetic thump, and of room noise, and the chosen `GATE_DB`, `SPAN_DB`, `CAP_DB`, `TAU_DOWN` and `BACKGROUND_FLOOR_DB`, in the task report and in the diary entry.
- **Back-to-back by hand with the ears tools** (2.7): `make_broadcast` writes the TEST broadcast WAV. A throwaway Node script (plain Node, TEST alert only, output in the git-ignored `tools/ears/out/`) joins the file to itself with no gap. `hear_wav` confirms the joined file still decodes, and `round_trip` at `noiseDb` 20 and 10 confirms it is a working broadcast with room noise under it. The level function is run over the joined file block by block, and the lit dots per second across both plays go into the task report and the diary entry. The in-memory test is checked against these numbers. A disagreement of more than a few dB means the test is wrong, not the tool.
- **Decoder still works while the level runs** (3.1): in the controller test, feed the broadcast blocks and check that the same alert appears in the history with the level function in place, with the same content as the unfixed code gave.
- **Diary line** (2.6): a test or a check that `docs/kiro-diary.md` contains the new entry saying the change came from a real-room test. `tests/look/wording.test.ts` already scans docs for wording rules, so the entry is written in plain words with no emoji.
- **Offline and network** (3.7): the existing offline and boundary tests still pass. The new files import nothing from a URL and use no `fetch`.
