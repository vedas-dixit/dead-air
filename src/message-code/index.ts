// Public entry point of the message code. Other specs import only from this file.
// `encodePlaceName` is deliberately not exported.

export { encodeAlert } from './encode';
export { decodeMessage } from './decode';
export { checkExpiry, VALID_STEP_MINUTES, CLOCK_TOLERANCE_MINUTES } from './expiry';
export { crc32 } from './crc32';
export {
  EVENT_TYPES,
  EVENT_CODES,
  URGENCIES,
  SEVERITIES,
  ACTIONS,
  SCRIPT_WINDOWS,
} from './codes';
export {
  VERSION,
  MIN_MESSAGE_BYTES,
  MAX_MESSAGE_BYTES,
  PLACE_NAME_MAX_BYTES,
  MAX_HOP_COUNT,
} from './layout';
export type {
  EventType,
  Urgency,
  Severity,
  Action,
  Alert,
  DecodeRejectionReason,
  DecodeRejection,
  DecodeResult,
  EncodeRejection,
  EncodeResult,
  ExpiryStatus,
  ExpiryResult,
} from './types';
