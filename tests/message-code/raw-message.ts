/**
 * Test-only helper. Builds the raw bytes of a Version 1 message around chosen
 * place-name bytes and appends a correct CRC-32. It imports nothing from src,
 * so a bug in the encoder or in src/message-code/crc32.ts cannot hide a bug
 * in the decoder (Requirement 12.11).
 */

export interface RawMessageParts {
  /** Byte 0 (version nibble, TEST, passed-on, compact flag, No_Map_Point_Flag). Default 0x18: Version 1, TEST. */
  flagsByte?: number;
  /** Event code, byte 1 when `hopCount` is 0 (any value is written as given, so tests can send a bad code). Default 1. */
  event?: number;
  /** Hop count, high nibble of byte 1. Default 0. Ignored when `byte1` is given. */
  hopCount?: number;
  /** The whole of byte 1, as given. Overrides `event` and `hopCount`. The CRC-32 is still correct. */
  byte1?: number;
  /** Packed urgency, severity and action value, byte 2. Default 0. */
  usa?: number;
  /** Sent minute, unsigned 32-bit big-endian. Default 29000000. */
  sentMinute?: number;
  /** Valid steps, byte 7. Default 4. */
  validSteps?: number;
  /** Latitude in 0.0001 degree, signed 24-bit. Default 0. */
  latitude?: number;
  /** Longitude in 0.0001 degree, signed 24-bit. Default 0. */
  longitude?: number;
  /** Station ID, unsigned 16-bit. Default 1. */
  stationId?: number;
  /** Counter, byte 16. Default 0. */
  counter?: number;
  /** If given, six bytes written over the latitude and longitude bytes (bytes 8 to 13), as given. */
  pointBytes?: ArrayLike<number>;
  /** Raw place-name bytes, copied as given. Default empty. */
  placeBytes?: ArrayLike<number>;
}

// Reflected CRC-32 (ISO-HDLC, zlib), written separately from src on purpose.
const TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  TABLE.push(c >>> 0);
}

function crc32Of(bytes: ArrayLike<number>, end: number): number {
  let c = 0xffffffff;
  for (let i = 0; i < end; i++) c = TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Returns the message bytes with a correct check value. Does not validate any field. */
export function buildRaw(parts: RawMessageParts = {}): Uint8Array {
  const {
    flagsByte = 0x18,
    event = 1,
    hopCount = 0,
    byte1,
    usa = 0,
    sentMinute = 29000000,
    validSteps = 4,
    latitude = 0,
    longitude = 0,
    stationId = 1,
    counter = 0,
    placeBytes = [],
    pointBytes,
  } = parts;

  const n = placeBytes.length;
  const out = new Uint8Array(17 + n + 4);

  out[0] = flagsByte & 0xff;
  out[1] = byte1 !== undefined ? byte1 & 0xff : ((hopCount & 0x0f) << 4 | event) & 0xff;
  out[2] = usa & 0xff;

  const m = sentMinute >>> 0;
  out[3] = m >>> 24;
  out[4] = (m >>> 16) & 0xff;
  out[5] = (m >>> 8) & 0xff;
  out[6] = m & 0xff;

  out[7] = validSteps & 0xff;

  const lat = latitude < 0 ? latitude + 0x1000000 : latitude;
  out[8] = (lat >>> 16) & 0xff;
  out[9] = (lat >>> 8) & 0xff;
  out[10] = lat & 0xff;

  const lon = longitude < 0 ? longitude + 0x1000000 : longitude;
  out[11] = (lon >>> 16) & 0xff;
  out[12] = (lon >>> 8) & 0xff;
  out[13] = lon & 0xff;

  if (pointBytes) for (let i = 0; i < 6; i++) out[8 + i] = (pointBytes[i] ?? 0) & 0xff;
  out[14] = (stationId >>> 8) & 0xff;
  out[15] = stationId & 0xff;
  out[16] = counter & 0xff;

  for (let i = 0; i < n; i++) out[17 + i] = placeBytes[i]! & 0xff;

  const crc = crc32Of(out, 17 + n);
  const at = 17 + n;
  out[at] = crc >>> 24;
  out[at + 1] = (crc >>> 16) & 0xff;
  out[at + 2] = (crc >>> 8) & 0xff;
  out[at + 3] = crc & 0xff;

  return out;
}
