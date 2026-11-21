// Shared error types for the Ears tool handlers. No MCP code here.
export type ErrorReason =
  | 'invalid-input-type' | 'not-a-test-alert' | 'invalid-field' | 'place-name-too-long'
  | 'bad-sample-rate' | 'bad-noise-level' | 'bad-tries' | 'bad-seed'
  | 'write-failed'
  | 'file-not-found' | 'file-unreadable' | 'file-too-large' | 'not-wav' | 'unsupported-wav'
  | 'silent-signal'
  | 'sound-link-unavailable' | 'engine-error'
  | 'internal-error';

export interface ToolError {
  readonly ok: false;
  readonly reason: ErrorReason;
  /** 200 characters or fewer, one line, no stack. */
  readonly message: string;
  /** Set for invalid-field and place-name-too-long. */
  readonly field?: string;
}

export type Outcome<T> = ({ readonly ok: true } & T) | ToolError;

export const MAX_MESSAGE_CHARS = 200;

/** Collapses whitespace and cuts to 200 characters. */
export function truncateMessage(text: string): string {
  const one = String(text).replace(/\s+/g, ' ').trim();
  return one.length <= MAX_MESSAGE_CHARS ? one : one.slice(0, MAX_MESSAGE_CHARS);
}

export function toolError(reason: ErrorReason, message: string, field?: string): ToolError {
  const base = { ok: false as const, reason, message: truncateMessage(message) };
  return field === undefined ? base : { ...base, field };
}
