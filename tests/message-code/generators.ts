import * as fc from 'fast-check';
import {
  ACTIONS,
  EVENT_TYPES,
  SCRIPT_WINDOWS,
  SEVERITIES,
  URGENCIES,
  crc32,
  encodeAlert,
} from '../../src/message-code';
import type { Alert } from '../../src/message-code';

// UTF-8 length of one code point. Written here so the tests need no TextEncoder.
function utf8Len(cp: number): number {
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/** Cut a list of characters back to whole characters that fit in 19 UTF-8 bytes. */
export function fitTo19Bytes(chars: readonly string[]): string {
  let bytes = 0;
  let out = '';
  for (const ch of chars) {
    const n = utf8Len(ch.codePointAt(0)!);
    if (bytes + n > 19) break;
    bytes += n;
    out += ch;
  }
  return out;
}

export const eventArb = fc.constantFrom(...EVENT_TYPES);
export const urgencyArb = fc.constantFrom(...URGENCIES);
export const severityArb = fc.constantFrom(...SEVERITIES);
export const actionArb = fc.constantFrom(...ACTIONS);

// Code points: printable ASCII, Latin extended, Arabic, Indic blocks, ZWNJ, ZWJ, CJK, emoji.
// No C0, DEL, C1 controls or surrogates.
export const unitArb = fc
  .oneof(
    fc.integer({ min: 0x20, max: 0x7e }),
    fc.integer({ min: 0xa0, max: 0x24f }),
    fc.integer({ min: 0x0600, max: 0x06ff }),
    fc.integer({ min: 0x0900, max: 0x0d7f }),
    fc.constantFrom(0x200c, 0x200d),
    fc.integer({ min: 0x4e00, max: 0x9fff }),
    fc.integer({ min: 0x1f300, max: 0x1f64f }),
  )
  .map((cp) => String.fromCodePoint(cp));

export const utf8FitArb = fc.array(unitArb, { maxLength: 19 }).map(fitTo19Bytes);

// Shared characters: printable ASCII, ZWNJ, ZWJ.
export const sharedArb = fc
  .oneof(fc.integer({ min: 0x20, max: 0x7e }), fc.constantFrom(0x200c, 0x200d))
  .map((cp) => String.fromCodePoint(cp));

const windowCharArb = (w: number) =>
  fc.integer({ min: 0, max: 127 }).map((i) => String.fromCodePoint(SCRIPT_WINDOWS[w]!.start + i));

/** 1 to 18 characters from window w or shared, at least one from window w. */
export const windowNameArb = (w: number) =>
  fc
    .tuple(
      fc.array(
        fc.oneof(
          { weight: 4, arbitrary: windowCharArb(w) },
          { weight: 1, arbitrary: sharedArb },
        ),
        { maxLength: 17 },
      ),
      windowCharArb(w),
      fc.nat(17),
    )
    .map(([chars, anchor, at]) => {
      const i = Math.min(at, chars.length);
      return [...chars.slice(0, i), anchor, ...chars.slice(i)].join('');
    });

export const indicNameArb = fc.integer({ min: 0, max: 8 }).chain(windowNameArb);

function inWindow(ch: string, w: number): boolean {
  const cp = ch.codePointAt(0)!;
  const start = SCRIPT_WINDOWS[w]!.start;
  return cp >= start && cp < start + 128;
}

/**
 * Two different windows, 1 to 3 characters from each, interleaved by random
 * keys, cut to whole characters within 19 UTF-8 bytes, and kept only when both
 * windows are still present after the cut. Six characters of 3 bytes are 18
 * bytes, so the cut never removes anything in practice.
 */
export const twoWindowNameArb = fc
  .tuple(
    fc.integer({ min: 0, max: 8 }),
    fc.integer({ min: 1, max: 8 }),
    fc.array(fc.integer({ min: 0, max: 127 }), { minLength: 1, maxLength: 3 }),
    fc.array(fc.integer({ min: 0, max: 127 }), { minLength: 1, maxLength: 3 }),
    fc.array(fc.nat(1000), { minLength: 6, maxLength: 6 }),
  )
  .map(([w1, shift, as, bs, keys]) => {
    const w2 = (w1 + shift) % 9;
    const tagged = [
      ...as.map((i) => String.fromCodePoint(SCRIPT_WINDOWS[w1]!.start + i)),
      ...bs.map((i) => String.fromCodePoint(SCRIPT_WINDOWS[w2]!.start + i)),
    ].map((ch, idx) => ({ ch, key: keys[idx]!, idx }));
    tagged.sort((x, y) => x.key - y.key || x.idx - y.idx);
    const name = fitTo19Bytes(tagged.map((t) => t.ch));
    const chars = [...name];
    return { name, ok: chars.some((c) => inWindow(c, w1)) && chars.some((c) => inWindow(c, w2)) };
  })
  .filter((r) => r.ok)
  .map((r) => r.name);

export const asciiNameArb = fc
  .array(
    fc.integer({ min: 0x20, max: 0x7e }).map((c) => String.fromCharCode(c)),
    { maxLength: 19 },
  )
  .map((a) => a.join(''));

/** 7 to 18 characters of one window: UTF-8 form is 21 to 54 bytes, only the compact form fits. */
export const longIndicArb = fc.integer({ min: 0, max: 8 }).chain((w) =>
  fc
    .array(windowCharArb(w), { minLength: 7, maxLength: 18 })
    .map((a) => a.join('')),
);

export const placeNameArb = fc.oneof(
  { weight: 4, arbitrary: utf8FitArb },
  { weight: 3, arbitrary: indicNameArb },
  { weight: 2, arbitrary: longIndicArb },
  { weight: 1, arbitrary: twoWindowNameArb },
  { weight: 1, arbitrary: asciiNameArb },
  { weight: 1, arbitrary: fc.constant('') },
  {
    weight: 1,
    arbitrary: fc.constantFrom('a'.repeat(19), 'म'.repeat(6) + 'a', 'म'.repeat(18), 'क\u200Cष'),
  },
);

// Generated alerts use both TEST flag values (Requirement 12.5). They are never stored.
// Every Hop_Count 0 to 15 is generated. passedOn always equals hopCount >= 1.
export const hopCountArb = fc.integer({ min: 0, max: 15 });

export const alertArb: fc.Arbitrary<Alert> = fc.record({
  test: fc.boolean(),
  hopCount: hopCountArb,
  event: eventArb,
  urgency: urgencyArb,
  severity: severityArb,
  action: actionArb,
  sentMinute: fc.integer({ min: 0, max: 4294967295 }),
  validSteps: fc.integer({ min: 1, max: 255 }),
  stationId: fc.integer({ min: 0, max: 65535 }),
  counter: fc.integer({ min: 0, max: 255 }),
  placeName: placeNameArb,
}).map((r) => ({ ...r, passedOn: r.hopCount >= 1 })).chain((base) =>
  // About one alert in four has no map point. Real points include the edges and a real 0, 0.
  fc
    .oneof(
      { weight: 6, arbitrary: fc.tuple(fc.integer({ min: -900000, max: 900000 }), fc.integer({ min: -1800000, max: 1800000 })) },
      { weight: 2, arbitrary: fc.constantFrom<[number, number]>([0, 0], [900000, 1800000], [-900000, -1800000]) },
      { weight: 3, arbitrary: fc.constant<[null, null]>([null, null]) },
    )
    .map(([latitude, longitude]): Alert => ({ ...base, latitude, longitude })),
);

/** Encodes a generated alert. Throws if the encoder rejects it, which would be a generator bug. */
export function encodeOrThrow(alert: Alert): Uint8Array {
  const r = encodeAlert(alert);
  if (!r.ok) throw new Error(`generator produced an alert the encoder rejects: ${r.field} (${r.reason})`);
  return r.bytes;
}

// ---- Byte arrays for Property 4 (Requirement 12.9) ----

type Mutation =
  | { kind: 'change'; i: number; v: number }
  | { kind: 'insert'; i: number; v: number }
  | { kind: 'remove'; i: number }
  | { kind: 'truncate'; n: number }
  | { kind: 'append'; bytes: number[] }
  | { kind: 'toggleCompactFlag' }
  | { kind: 'toggleNoMapPointFlag' }
  | { kind: 'setPointByte'; i: number; v: number }
  | { kind: 'setSelector'; v: number };

const byteArb = fc.integer({ min: 0, max: 255 });

const mutationArb: fc.Arbitrary<Mutation> = fc.oneof(
  fc.record({ kind: fc.constant('change' as const), i: fc.nat(), v: byteArb }),
  fc.record({ kind: fc.constant('insert' as const), i: fc.nat(), v: byteArb }),
  fc.record({ kind: fc.constant('remove' as const), i: fc.nat() }),
  fc.record({ kind: fc.constant('truncate' as const), n: fc.nat(60) }),
  fc.record({
    kind: fc.constant('append' as const),
    bytes: fc.array(byteArb, { minLength: 1, maxLength: 8 }),
  }),
  fc.record({ kind: fc.constant('toggleCompactFlag' as const) }),
  fc.record({ kind: fc.constant('toggleNoMapPointFlag' as const) }),
  fc.record({ kind: fc.constant('setPointByte' as const), i: fc.integer({ min: 0, max: 5 }), v: byteArb }),
  fc.record({ kind: fc.constant('setSelector' as const), v: byteArb }),
);

function applyMutation(bytes: number[], m: Mutation): number[] {
  switch (m.kind) {
    case 'change':
      if (bytes.length > 0) bytes[m.i % bytes.length] = m.v;
      return bytes;
    case 'insert':
      bytes.splice(m.i % (bytes.length + 1), 0, m.v);
      return bytes;
    case 'remove':
      if (bytes.length > 0) bytes.splice(m.i % bytes.length, 1);
      return bytes;
    case 'truncate':
      return bytes.slice(0, Math.min(m.n, bytes.length));
    case 'append':
      return [...bytes, ...m.bytes];
    case 'toggleCompactFlag':
      if (bytes.length > 0) bytes[0] = bytes[0]! ^ 0b0000_0010;
      return bytes;
    case 'toggleNoMapPointFlag':
      if (bytes.length > 0) bytes[0] = bytes[0]! ^ 0b0000_0001;
      return bytes;
    case 'setPointByte':
      if (bytes.length > 14) bytes[8 + m.i] = m.v;
      return bytes;
    case 'setSelector':
      // Offset 17 is the first place-name byte (the selector in compact form).
      if (bytes.length > 21) bytes[17] = m.v;
      return bytes;
  }
}

/**
 * Replaces the last 4 bytes with the CRC-32 of the rest, so mutated fields get
 * past the check and reach field validation. This uses `crc32` from src on
 * purpose: the generator only needs a correct check value here, and the
 * independent CRC cross-check lives in raw-message.ts and the golden tests.
 */
function recomputeCrc(bytes: number[]): number[] {
  const body = new Uint8Array(bytes.slice(0, bytes.length - 4));
  const crc = crc32(body, 0, body.length);
  const out = bytes.slice(0, bytes.length - 4);
  out.push(crc >>> 24, (crc >>> 16) & 0xff, (crc >>> 8) & 0xff, crc & 0xff);
  return out;
}

const mutatedArb = fc
  .tuple(
    alertArb,
    fc.array(mutationArb, { minLength: 1, maxLength: 3 }),
    fc.boolean(),
  )
  .map(([alert, mutations, fixCrc]) => {
    let bytes = Array.from(encodeOrThrow(alert));
    for (const m of mutations) bytes = applyMutation(bytes, m);
    if (fixCrc && bytes.length >= 5) bytes = recomputeCrc(bytes);
    return Uint8Array.from(bytes);
  });

export const byteArrayArb: fc.Arbitrary<Uint8Array> = fc.oneof(
  fc.uint8Array({ minLength: 0, maxLength: 80 }),
  alertArb.map(encodeOrThrow),
  mutatedArb,
);
