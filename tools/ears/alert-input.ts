// Turns the caller's JSON into encoded alert bytes. Only TEST alerts pass (promise 3).
import { encodeAlert } from '../../src/message-code';
import type { Alert } from '../../src/message-code';
import { toolError } from './errors';
import type { Outcome } from './errors';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function prepareAlert(
  input: unknown,
  nowMs: number,
): Outcome<{ alert: Alert; bytes: Uint8Array }> {
  if (!isPlainObject(input)) {
    return toolError('invalid-input-type', 'The alert must be a JSON object.');
  }
  // The TEST rule comes before encoding: a non-test alert is never encoded.
  if (input.test !== true) {
    return toolError('not-a-test-alert', 'Only TEST alerts are allowed: set "test" to true.', 'test');
  }
  const copy: Record<string, unknown> = { ...input };
  if (copy.sentMinute === undefined) copy.sentMinute = Math.floor(nowMs / 60000);
  const result = encodeAlert(copy as unknown as Alert);
  if (!result.ok) {
    return toolError(result.reason, `The alert was rejected: field "${result.field}".`, result.field);
  }
  return { ok: true, alert: copy as unknown as Alert, bytes: result.bytes };
}
