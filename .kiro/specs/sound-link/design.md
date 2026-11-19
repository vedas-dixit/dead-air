# Design Document

## Overview

The Sound Link is a folder of TypeScript, `src/sound-link/`. It wraps ggwave and has three jobs:

1. `link.bytesToAudio(bytes)` turns 21 to 40 bytes into mono Float32 samples.
2. `link.createListener()` gives an object that takes microphone samples and returns every payload it hears as bytes.
3. `audioToWav(samples, sampleRate?)` turns samples into a WAV file.

It uses no browser API, no clock and no random source. It does not play or record sound and does not look at what the bytes mean. It imports nothing from `src/message-code/`. It runs and is tested in plain Node.

This document follows the approved `requirements.md`.

## Design decisions

| Decision | Choice | Reason |
|---|---|---|
| How ggwave is loaded | `loadSoundLink(options)` calls the `ggwave` package factory, which returns one engine per call. The factory gets `print` and `printErr` set to no-ops, and the code calls `disableLog()` | The factory's own output hook stops `encode` from printing buffer sizes. `disableLog` stops the decoder from printing the decoded text (Requirement 1.6). |
| One loader, one engine, many objects | One `SoundLink` owns one engine, one encoder instance and the listeners it created | ggwave has room for four instances. The link counts them, checks for -1 from `init`, and frees all of them on `dispose` (Requirements 3.1 and 3.9). |
| Engine injection for tests | `createSoundLinkWithEngine(engine, options)` takes any object with the ggwave interface. `loadSoundLink` is that function plus the real factory | A fake engine can throw or return odd values, so error paths are tested without needing ggwave to misbehave. |
| Sample rate | Option `sampleRate`, default 48000, whole number from 16000 to 96000. Both ggwave rates are set to it | ggwave resamples to its internal 48000 Hz (checked in the probe). The Sound_Link adds no resampler. |
| Frame size | `frameSize(rate) = ceil(1024 * rate / 48000)` | Measured: 1024 at 48000, 941 at 44100, 342 at 16000. The probe's other values returned nothing. Tests check this function against real decoding at 16000, 44100, 48000 and 96000. |
| Mode | `AUDIBLE_FAST` by default. An option can choose another audible mode. The link turns off receive for the other protocols with `rxToggleProtocol` | Tests compare modes. A listener that only decodes its own mode cannot report a payload from an unrelated protocol (Requirement 4.4). |
| Result style | Every function returns `{ ok: true, ... }` or `{ ok: false, reason }` | Matches the Message Code. Bad input never throws. |
| Copy everything | The encoder copies the audio out of ggwave's shared buffer. The listener copies each payload out of ggwave's output buffer | Both buffers are overwritten by the next call (Requirements 2.3 and 3.2). |
| Strings never used | `encode` gets the `Uint8Array` | A string would be changed to UTF-8 (Requirement 2.2). |
| Listener frame buffer | A `Float32Array(frameSize)` and a fill count. Input is checked in full before any of it is copied in | A bad value in the input then leaves the listener unchanged (Requirement 3.6). |
| One narrow `try/catch` | Only around the call to `engine.decode` and `engine.encode`. A throw makes the listener or link return `engine-error` for every later call | An abort inside ggwave leaves it unusable. Reporting that is better than throwing into a page. |
| WAV writer is separate | `audioToWav` is a pure function and does not need ggwave | The Broadcast page can use it without a listener, and it is tested alone. |
| Report is generated | A test runs the sweeps and writes `report.md` | The numbers in the report are measured, not typed (Requirement 8.5). |

## Files

```
src/sound-link/
  index.ts          public entry point
  constants.ts      DEFAULT_SAMPLE_RATE, MIN_SAMPLE_RATE, MAX_SAMPLE_RATE, MIN_PAYLOAD_BYTES (21),
                    MAX_PAYLOAD_BYTES (40), MODE, OUTPUT_VOLUME, GGWAVE_FRAME_SAMPLES (1024), frameSize()
  types.ts          SoundMode, SoundLinkOptions, result and reason types, Listener and SoundLink interfaces
  ggwave.d.ts       the parts of ggwave the code uses, and the module declaration for 'ggwave'
  sound-link.ts     loadSoundLink, createSoundLinkWithEngine
  listener.ts       createListenerObject: frame buffer, decode loop, reset, dispose
  wav.ts            audioToWav
tsconfig.sound-link.json   no DOM library, types: [], includes src/sound-link only
tests/sound-link/
  harness.ts        seeded random numbers, white noise at a given SNR, linear resampler, stream feeder,
                    outcome classifier, raw ggwave helper (any length, any mode), WAV reader
  node-fs.d.ts      declares writeFileSync from node:fs, so tests can write the report without @types/node
  *.test.ts         see the test plan
.kiro/specs/sound-link/report.md   written by tests/sound-link/report.test.ts
```

## Public interface

```ts
export type SoundMode = 'AUDIBLE_NORMAL' | 'AUDIBLE_FAST' | 'AUDIBLE_FASTEST';

export interface SoundLinkOptions {
  sampleRate?: number;   // whole number, 16000 to 96000, default 48000
  mode?: SoundMode;      // default MODE, which is 'AUDIBLE_FAST'
}

export type LoadResult =
  | { ok: true; link: SoundLink }
  | { ok: false; reason: 'bad-sample-rate' | 'bad-mode' | 'engine-load-failed' };

export interface SoundLink {
  readonly sampleRate: number;
  readonly mode: SoundMode;
  readonly frameSize: number;
  bytesToAudio(bytes: unknown): AudioResult;
  createListener(): ListenerCreateResult;
  dispose(): void;       // frees the encoder and every listener
}

export type AudioResult =
  | { ok: true; samples: Float32Array }
  | { ok: false; reason: 'not-bytes' | 'too-short' | 'too-long' | 'engine-error' | 'disposed' };

export type ListenerCreateResult =
  | { ok: true; listener: Listener }
  | { ok: false; reason: 'no-free-instance' | 'engine-error' | 'disposed' };

export interface Listener {
  feed(samples: unknown): FeedResult;
  reset(): void;
  dispose(): void;
}

export type FeedResult =
  | { ok: true; payloads: Uint8Array[] }          // every payload heard, in order, unchecked
  | { ok: false; reason: 'not-float32' | 'not-finite' | 'engine-error' | 'disposed' };

export function audioToWav(samples: unknown, sampleRate?: number): WavResult;
export type WavResult =
  | { ok: true; wav: Uint8Array }
  | { ok: false; reason: 'not-float32' | 'empty' | 'not-finite' | 'bad-sample-rate' };
```

`loadSoundLink` returns `Promise<LoadResult>`. It never rejects. A failure to load the engine becomes `engine-load-failed`.

### Encoder

`bytesToAudio` checks `bytes instanceof Uint8Array`, then the length (21 to 40), then calls `engine.encode(instance, bytes, protocolId, OUTPUT_VOLUME)`. ggwave returns an `Int8Array` view of Float32 data. The code copies the bytes into a new `ArrayBuffer` and wraps that in a `Float32Array`. The same input gives the same length.

`OUTPUT_VOLUME` is 10, the value in `sound-test/` and in the official example. A test checks that every returned sample is between -1 and 1.

### Listener

State: `frame: Float32Array(frameSize)`, `filled: number`, `state: 'open' | 'failed' | 'disposed'`.

`feed(samples)`:
1. If `state` is not `open`, return `disposed` or `engine-error`.
2. If `samples` is not a `Float32Array`, return `not-float32`. If any value is NaN or infinite, return `not-finite`. Nothing has been copied yet.
3. Walk the input. Copy samples into `frame`. Each time `filled` reaches `frameSize`, call `engine.decode(instance, new Int8Array(frame.buffer))`. If the result has more than 0 bytes, copy it to a new `Uint8Array` and add it to the list. Set `filled` to 0.
4. Return `{ ok: true, payloads }`.

The Int8Array view of `frame` is created once. `engine.decode` copies it into its own memory, so reusing `frame` for the next frame is safe.

`reset()` sets `filled` to 0, clears the frame and frees and re-creates the ggwave instance, which is the only way to clear ggwave's partial-decode state. If re-creation returns -1 the listener moves to `failed`. `dispose()` frees the instance and sets `disposed`.

At most one frame of microphone samples is in the listener at a time, and `reset` and `dispose` zero it (Requirement 3.10).

### Payload timing

ggwave reports a payload after it has seen the end marker and some silent frames. A real page keeps feeding the microphone, so this is invisible. Tests feed two seconds of silence after each sound.

### WAV writer

44-byte header, then 16-bit little-endian PCM, mono. Sample value `v` is clamped to -1..1 and stored as `round(v * 32767)` for v >= 0 and `round(v * 32768)` for v < 0. Fields: `RIFF`, size `36 + dataBytes`, `WAVE`, `fmt ` of size 16, format 1, 1 channel, the sample rate, byte rate `rate * 2`, block align 2, 16 bits, `data`, `dataBytes`. It returns a `Uint8Array` and creates no Blob.

## Test plan

All tests run in Node with Vitest. Property tests use fast-check with a fixed seed.

| File | What it covers | Requirements |
|---|---|---|
| `wav.test.ts` | header fields of a known sample set, clamping, rounding, bad input, rate range, sizes for 1 and 1000 samples, round trip of values within 1/32768, a WAV of encoded audio read back and heard | 5, 6.16 |
| `constants.test.ts` | `frameSize` at 16000, 44100, 48000 and 96000, the constants, and that source files under `src/sound-link/` contain no browser API names and no import from `message-code` | 1.1, 1.2, 1.4, 6.12, 6.15 |
| `encoder.test.ts` | rejections for each bad input, copy test, same length twice, values between -1 and 1, airtime constants, the strings-not-used case with bytes above 127 | 2, 6.9 |
| `listener-unit.test.ts` | fake engine: partial frames, split-independence, failures of `decode`, bad input leaving state alone, reset, dispose, instance limits, `no-free-instance`, all instances freed on dispose, payload lengths other than 21 to 40 reported unchanged, payload of 0 bytes not reported | 3, 6.14, 6.15 |
| `byte-values.test.ts` | every byte value 0 to 255 in payloads of 21 to 40 bytes, 0x00 and 0xFF runs, at 48000 Hz and no noise | 6.2 |
| `round-trip.property.test.ts` | seeded fast-check property: any payload of 21 to 40 bytes gives `exact` or `nothing` and never `wrong`, with no noise. A seeded set of payloads is `exact` for at least the share in this document | 6.3, 6.4 |
| `stream.test.ts` | splitting of samples into calls of 1, 777, 1024 and all at once gives the same result, a short last chunk does not break later messages, two payloads in one stream arrive in order, two links with different modes do not hear each other | 6.5 to 6.8 |
| `sample-rate.test.ts` | send and listen at 16000, 44100, 48000 and 96000 Hz, cross-rate between 44100 and 48000 using the resampler, a wrong frame size returns nothing | 6.13 |
| `short-and-long.test.ts` | raw ggwave sends of 8 and 100 bytes heard by a listener, unchanged | 6.14 |
| `report.test.ts` | airtime for 19, 21 and 40 bytes in each mode, noise sweep, short-payload outcomes, retry-at-another-offset statistic, writes `report.md`, asserts the shares below | 6.3, 6.5, 6.10, 6.11, 8 |

Shares to assert, chosen from the probe's 98.6 percent with a margin so the tests do not fail by chance:
- No noise, seeded set of 60 payloads of 21 to 40 bytes in FAST mode: at least 90 percent `exact`, no `wrong`.
- 20 dB signal-to-noise ratio, same set: at least 80 percent `exact`. `wrong` is counted and reported, not asserted.

Both numbers are checked against the first full run. If the real rates are lower, the numbers are changed to a margin under the measured value, and the report says so.

### Noise

White Gaussian noise from a seeded generator is added to the whole stream, including the silence before and after the sound. The noise level is set from the signal-to-noise ratio in dB, using the root-mean-square value of the encoded sound. Levels: 20, 10, 0, -10, -15, -20, -25 and -30 dB, and a run with no noise. The first run with 20 down to -5 dB showed no failures at all, so the levels were extended until the decoder fails. For each mode and level, 20 seeded payloads of 21 bytes and 20 of 40 bytes are sent. Outcomes are counted as `exact`, `nothing` and `wrong`.

White noise is not a room. The report says a real speaker and microphone test is still needed.

## Limits

- No sound is played or recorded here.
- Nothing is resampled here. ggwave does it.
- The Listener reports; it never judges. Only the Message Code check can accept bytes.
- Browser build: the `ggwave` package is a CommonJS file. This spec tests it in Node. The Broadcast and Listen specs confirm it in a browser build when they import this module.
