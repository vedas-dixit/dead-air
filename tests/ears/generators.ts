// fast-check generators shared by the Ears tests. Every valid alert is a TEST alert (promise 3).
import fc from 'fast-check';
import { ACTIONS, EVENT_TYPES, SEVERITIES, URGENCIES } from '../../src/message-code';
import type { Alert } from '../../src/message-code';

const placeNameArb = fc.string({ unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz ABCDEFGH0123456789'.split('')), maxLength: 19 });

const pointArb = fc.oneof(
  fc.constant<[number | null, number | null]>([null, null]),
  fc.tuple(fc.integer({ min: -900000, max: 900000 }), fc.integer({ min: -1800000, max: 1800000 })) as fc.Arbitrary<[number | null, number | null]>,
);

/** A valid TEST alert. `sentMinute` is always present. */
export const validTestAlertArb: fc.Arbitrary<Alert> = fc
  .record({
    passedOn: fc.boolean(),
    event: fc.constantFrom(...EVENT_TYPES),
    urgency: fc.constantFrom(...URGENCIES),
    severity: fc.constantFrom(...SEVERITIES),
    action: fc.constantFrom(...ACTIONS),
    sentMinute: fc.integer({ min: 0, max: 4294967295 }),
    validSteps: fc.integer({ min: 1, max: 255 }),
    point: pointArb,
    stationId: fc.integer({ min: 0, max: 65535 }),
    counter: fc.integer({ min: 0, max: 255 }),
    placeName: placeNameArb,
  })
  .map(({ point, ...rest }) => ({ test: true, latitude: point[0], longitude: point[1], ...rest }) as Alert);

/** A valid TEST alert without `sentMinute`, as the tools receive it. */
export const validTestInputArb: fc.Arbitrary<Record<string, unknown>> = validTestAlertArb.map((a) => {
  const { sentMinute: _drop, ...rest } = a;
  void _drop;
  return rest as Record<string, unknown>;
});

/** A TEST alert with a recent sentMinute, valid for 6 hours, for tests that decode it. */
export const smallTestAlertArb: fc.Arbitrary<Alert> = validTestAlertArb.map((a) => ({ ...a, sentMinute: 29000000, validSteps: 24 }));

/** One field replaced by a value that encodeAlert rejects. Returns the alert and the field. */
export const invalidAlertArb: fc.Arbitrary<{ input: Record<string, unknown>; field: string }> = fc
  .tuple(
    validTestAlertArb,
    fc.constantFrom<[string, unknown]>(
      ['event', 'nope'],
      ['urgency', 'nope'],
      ['severity', 7],
      ['action', null],
      ['validSteps', 0],
      ['validSteps', 256],
      ['stationId', -1],
      ['stationId', 70000],
      ['counter', 1.5],
      ['sentMinute', -1],
      ['passedOn', 'yes'],
    ),
  )
  .map(([a, [field, value]]) => ({ input: { ...a, [field]: value }, field }));

const trueString = String(true);
/** Values for `test` that are never the boolean true. Built at run time. */
export const nonTrueTestArb: fc.Arbitrary<unknown> = fc.constantFrom<unknown>(
  false, trueString, 1, 0, null, 'yes', {}, [], [true],
);

/** Alerts whose `test` is absent or not true. */
export const nonTestInputArb: fc.Arbitrary<Record<string, unknown>> = fc.tuple(validTestAlertArb, fc.option(nonTrueTestArb, { nil: undefined })).map(([a, t]) => {
  const copy: Record<string, unknown> = { ...a };
  if (t === undefined) delete copy.test;
  else copy.test = t;
  return copy;
});

export const nonObjectArb: fc.Arbitrary<unknown> = fc.constantFrom<unknown>(null, undefined, 'x', '{}', 5, true, false, [], [1, 2]);

export const bytesArb: fc.Arbitrary<Uint8Array> = fc.uint8Array({ minLength: 0, maxLength: 300 });

export const sampleRateArb: fc.Arbitrary<number> = fc.constantFrom(16000, 22050, 44100, 48000, 96000);

export const samplesArb: fc.Arbitrary<Float32Array> = fc
  .array(fc.double({ min: -1, max: 1, noNaN: true, noDefaultInfinity: true }), { minLength: 1, maxLength: 400 })
  .map((a) => Float32Array.from(a));

// ---- WAV builders ----
function ascii(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0));
}
function u16(v: number): number[] {
  return [v & 255, (v >> 8) & 255];
}
function u32(v: number): number[] {
  return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
}
export interface Chunk {
  id: string;
  body: number[];
}
export interface WavSpec {
  rate: number;
  channels: number;
  bits?: number;
  format?: number;
  /** Interleaved 16-bit samples. */
  pcm: number[];
  before?: Chunk[];
  between?: Chunk[];
  after?: Chunk[];
}
function chunkBytes(c: Chunk): number[] {
  const pad = c.body.length % 2 === 1 ? [0] : [];
  return [...ascii(c.id), ...u32(c.body.length), ...c.body, ...pad];
}
/** Builds WAV bytes by hand, so layouts audioToWav never writes can be tested. */
export function buildWav(spec: WavSpec): Uint8Array {
  const bits = spec.bits ?? 16;
  const fmtBody = [
    ...u16(spec.format ?? 1), ...u16(spec.channels), ...u32(spec.rate),
    ...u32(spec.rate * spec.channels * (bits / 8)), ...u16(spec.channels * (bits / 8)), ...u16(bits),
  ];
  const pcmBytes = spec.pcm.flatMap((s) => u16(s & 0xffff));
  const body = [
    ...ascii('WAVE'),
    ...(spec.before ?? []).flatMap(chunkBytes),
    ...chunkBytes({ id: 'fmt ', body: fmtBody }),
    ...(spec.between ?? []).flatMap(chunkBytes),
    ...chunkBytes({ id: 'data', body: pcmBytes }),
    ...(spec.after ?? []).flatMap(chunkBytes),
  ];
  return Uint8Array.from([...ascii('RIFF'), ...u32(body.length), ...body]);
}

const chunkIdArb = fc
  .string({ unit: fc.constantFrom(...'LISTfactabcXYZ12'.split('')), minLength: 4, maxLength: 4 })
  .filter((id) => id !== 'fmt ' && id !== 'data');
export const extraChunkArb: fc.Arbitrary<Chunk> = fc.record({
  id: chunkIdArb,
  body: fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 21 }),
});
export const extraChunksArb: fc.Arbitrary<Chunk[]> = fc.array(extraChunkArb, { maxLength: 3 });
export const pcm16Arb: fc.Arbitrary<number[]> = fc.array(fc.integer({ min: -32768, max: 32767 }), { minLength: 0, maxLength: 60 });
