import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeAlert } from '../../src/message-code';
import { alertArb, byteArrayArb } from './generators';

// Plain sampling, not a property test.
describe('generators sanity', () => {
  it('alertArb only produces alerts that encodeAlert accepts', () => {
    for (const alert of fc.sample(alertArb, 200)) {
      expect(encodeAlert(alert).ok).toBe(true);
    }
  });
  it('byteArrayArb produces byte arrays that decodeMessage handles', () => {
    for (const bytes of fc.sample(byteArrayArb, 200)) {
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(typeof decodeMessage(bytes).ok).toBe('boolean');
    }
  });
});

describe('fixtures sanity', () => {
  it('every fixture is a test alert and round-trips', async () => {
    const { TEST_FIXTURES } = await import('./fixtures');
    for (const f of TEST_FIXTURES) {
      expect(f.test).toBe(true);
      const e = encodeAlert(f);
      expect(e.ok).toBe(true);
      if (e.ok) expect(decodeMessage(e.bytes)).toEqual({ ok: true, alert: f });
    }
  });
});
