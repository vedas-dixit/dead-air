export const VERSION = 1;
export const MIN_MESSAGE_BYTES = 21;
export const MAX_MESSAGE_BYTES = 40;
export const PLACE_NAME_MAX_BYTES = 19;
export const CHECK_BYTES = 4;
export const FIXED_PREFIX_BYTES = 17; // bytes before the place name

export const OFFSET = {
  versionFlags: 0,
  event: 1,
  usa: 2,
  sentMinute: 3,
  validSteps: 7,
  latitude: 8,
  longitude: 11,
  stationId: 14,
  counter: 16,
  placeName: 17,
} as const;

export const FLAG_TEST = 0b0000_1000; // bit 3
export const FLAG_PASSED_ON = 0b0000_0100; // bit 2
export const FLAG_COMPACT_PLACE = 0b0000_0010; // bit 1, Compact_Place_Name_Flag
export const FLAG_NO_MAP_POINT = 0b0000_0001; // bit 0, No_Map_Point_Flag

/** Writes an unsigned 32-bit value big-endian at `offset`. */
export function writeU32(bytes: Uint8Array, offset: number, value: number): void {
  const v = value >>> 0;
  bytes[offset] = v >>> 24;
  bytes[offset + 1] = (v >>> 16) & 0xff;
  bytes[offset + 2] = (v >>> 8) & 0xff;
  bytes[offset + 3] = v & 0xff;
}

/** Reads an unsigned 32-bit big-endian value at `offset`. */
export function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) |
      (bytes[offset + 1]! << 16) |
      (bytes[offset + 2]! << 8) |
      bytes[offset + 3]!) >>> 0
  );
}

/** Writes a signed 24-bit two's complement value big-endian at `offset`. */
export function writeI24(bytes: Uint8Array, offset: number, value: number): void {
  const v = value < 0 ? value + 0x1000000 : value;
  bytes[offset] = (v >>> 16) & 0xff;
  bytes[offset + 1] = (v >>> 8) & 0xff;
  bytes[offset + 2] = v & 0xff;
}

/** Reads a signed 24-bit two's complement big-endian value at `offset`. */
export function readI24(bytes: Uint8Array, offset: number): number {
  const x = (bytes[offset]! << 16) | (bytes[offset + 1]! << 8) | bytes[offset + 2]!;
  return x >= 0x800000 ? x - 0x1000000 : x;
}
