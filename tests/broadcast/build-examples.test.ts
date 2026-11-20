// Examples for runBuild: each failure kind, listener clean-up, and the returned samples.
// All alerts come from fixtures.ts and are test alerts (promise 3).
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// Decode override. A real encode then decode always round trips, so the two decode-side
// failures can only be reached by changing what decodeMessage returns. null means pass through.
const decodeControl = vi.hoisted(() => ({
  override: null as null | ((bytes: Uint8Array) => unknown),
  real: null as null | ((bytes: Uint8Array) => any),
}));

vi.mock('../../src/message-code/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/message-code/index')>();
  decodeControl.real = actual.decodeMessage;
  return {
    ...actual,
    decodeMessage: (bytes: Uint8Array) =>
      decodeControl.override ? decodeControl.override(bytes) : actual.decodeMessage(bytes),
  };
});

import { CHECK_SILENCE_SECONDS, runBuild } from '../../src/broadcast/build';
import type { Alert } from '../../src/message-code/index';
import type { SoundLink } from '../../src/sound-link';
import { FakeLink, wrapRealLink } from './fakes';
import { alertNoPoint, alertWithPoint, alertZeroPoint } from './fixtures';
import { makeLink } from '../sound-link/harness';

let realLink: SoundLink;

beforeAll(async () => {
  realLink = await makeLink();
});

afterEach(() => {
  decodeControl.override = null;
  vi.restoreAllMocks();
});

function expectFailure(result: ReturnType<typeof runBuild>) {
  if (result.ok) throw new Error('expected a failed build');
  expect(result).not.toHaveProperty('build');
  expect(result).not.toHaveProperty('samples');
  return result.failure;
}

function expectClosed(link: FakeLink) {
  expect(link.openListeners).toBe(0);
  expect(link.maxOpenListeners).toBeLessThanOrEqual(1);
  for (const l of link.listeners) expect(l.disposed).toBe(true);
}

describe('runBuild encode rejection', () => {
  it('reports an invalid field and never makes sound or a listener', () => {
    const link = new FakeLink();
    const bad = { ...alertWithPoint, validSteps: 0 };
    const failure = expectFailure(runBuild(link, bad, false));
    expect(failure).toEqual({ kind: 'encode', reason: 'invalid-field', field: 'validSteps' });
    expect(link.bytesToAudioCalls).toBe(0);
    expect(link.createListenerCalls).toBe(0);
  });

  it('reports a place name that is too long', () => {
    const link = new FakeLink();
    const bad = { ...alertWithPoint, placeName: 'x'.repeat(60) };
    const failure = expectFailure(runBuild(link, bad, false));
    expect(failure).toEqual({ kind: 'encode', reason: 'place-name-too-long', field: 'placeName' });
    expect(link.bytesToAudioCalls).toBe(0);
  });

  it('reports one map coordinate alone as invalid', () => {
    const link = new FakeLink();
    const failure = expectFailure(runBuild(link, { ...alertWithPoint, longitude: null }, true));
    expect(failure).toMatchObject({ kind: 'encode', field: 'latitude' });
    expect(link.bytesToAudioCalls).toBe(0);
  });
});

describe('runBuild sound failures', () => {
  it('reports an audio failure with its reason and makes no listener', () => {
    const link = new FakeLink({ audioFail: 'engine-error' });
    const failure = expectFailure(runBuild(link, alertWithPoint, false));
    expect(failure).toEqual({ kind: 'audio', reason: 'engine-error' });
    expect(link.bytesToAudioCalls).toBe(1);
    expect(link.createListenerCalls).toBe(0);
  });

  it('reports an unavailable listener', () => {
    const link = new FakeLink({ createFail: 'no-free-instance' });
    const failure = expectFailure(runBuild(link, alertWithPoint, false));
    expect(failure).toEqual({ kind: 'check', why: 'listener-unavailable' });
    expect(link.openListeners).toBe(0);
  });
});

describe('runBuild listener outcomes and clean-up', () => {
  it('passes with the echo behavior and closes the listener', () => {
    const link = new FakeLink();
    const result = runBuild(link, alertWithPoint, false);
    expect(result.ok).toBe(true);
    expect(link.createListenerCalls).toBe(1);
    expectClosed(link);
    expect(link.listeners[0]!.disposeCalls).toBe(1);
  });

  it.each([
    ['none', { kind: 'none' as const }, 'no-payload'],
    ['many', { kind: 'many' as const }, 'many-payloads'],
    ['changed', { kind: 'changed' as const, index: 3 }, 'payload-differs'],
    ['feed-fail', { kind: 'feed-fail' as const }, 'feed-failed'],
    ['throw', { kind: 'throw' as const }, 'feed-failed'],
  ])('fails on %s and closes the listener', (_name, behavior, why) => {
    const link = new FakeLink({ behavior });
    const failure = expectFailure(runBuild(link, alertWithPoint, false));
    expect(failure).toEqual({ kind: 'check', why });
    expectClosed(link);
    expect(link.listeners[0]!.disposeCalls).toBe(1);
  });

  it('closes the listener when feed throws and does not let the throw escape', () => {
    const link = new FakeLink({ behavior: { kind: 'throw' } });
    expect(() => runBuild(link, alertNoPoint, true)).not.toThrow();
    expect(link.openListeners).toBe(0);
  });

  it('keeps at most one listener open across repeated builds of every outcome', () => {
    const link = new FakeLink();
    const behaviors = [
      { kind: 'echo' as const },
      { kind: 'none' as const },
      { kind: 'throw' as const },
      { kind: 'many' as const },
      { kind: 'feed-fail' as const },
      { kind: 'echo' as const },
    ];
    for (const b of behaviors) {
      link.behavior = b;
      runBuild(link, alertWithPoint, false);
      expect(link.openListeners).toBe(0);
    }
    expect(link.maxOpenListeners).toBe(1);
    expect(link.createListenerCalls).toBe(behaviors.length);
  });

  it('does not hide the result when dispose throws', () => {
    const link = new FakeLink();
    const original = link.createListener.bind(link);
    link.createListener = () => {
      const r = original();
      if (r.ok) {
        const dispose = r.listener.dispose.bind(r.listener);
        r.listener.dispose = () => {
          dispose();
          throw new Error('dispose failed');
        };
      }
      return r;
    };
    expect(runBuild(link, alertWithPoint, false).ok).toBe(true);
    expect(link.openListeners).toBe(0);
  });
});

describe('runBuild decode rejection', () => {
  it.each(['bad-check', 'unknown-version', 'invalid-field'] as const)('carries the reason %s', (reason) => {
    decodeControl.override = () => ({ ok: false, reason });
    const link = new FakeLink();
    const failure = expectFailure(runBuild(link, alertWithPoint, false));
    expect(failure).toEqual({ kind: 'check', why: 'decode-rejected', reason });
    expectClosed(link);
  });
});

describe('runBuild field difference', () => {
  function decodeWith(change: Partial<Alert>) {
    decodeControl.override = (bytes) => {
      const r = decodeControl.real!(bytes);
      if (!r.ok) return r;
      return { ok: true, alert: { ...r.alert, ...change } };
    };
  }

  it('names the first field that differs', () => {
    decodeWith({ placeName: 'other', counter: 99 });
    const failure = expectFailure(runBuild(new FakeLink(), alertWithPoint, false));
    expect(failure).toEqual({ kind: 'check', why: 'field-differs', field: 'counter' });
  });

  it('names a changed flag', () => {
    decodeWith({ test: false });
    const failure = expectFailure(runBuild(new FakeLink(), alertWithPoint, false));
    expect(failure).toEqual({ kind: 'check', why: 'field-differs', field: 'test' });
  });

  it('treats null and null as equal for latitude and longitude', () => {
    const result = runBuild(new FakeLink(), alertNoPoint, false);
    expect(result.ok).toBe(true);
  });

  it('treats 0 and 0 as equal, and 0 against null as different', () => {
    expect(runBuild(new FakeLink(), alertZeroPoint, false).ok).toBe(true);

    decodeWith({ latitude: null, longitude: null });
    const lost = expectFailure(runBuild(new FakeLink(), alertZeroPoint, false));
    expect(lost).toEqual({ kind: 'check', why: 'field-differs', field: 'latitude' });
  });

  it('catches a point that appears where the alert had none', () => {
    decodeWith({ latitude: 0, longitude: 0 });
    const failure = expectFailure(runBuild(new FakeLink(), alertNoPoint, false));
    expect(failure).toEqual({ kind: 'check', why: 'field-differs', field: 'latitude' });
  });

  it('catches a longitude that alone differs, including null', () => {
    decodeWith({ longitude: null });
    const failure = expectFailure(runBuild(new FakeLink(), alertWithPoint, false));
    expect(failure).toEqual({ kind: 'check', why: 'field-differs', field: 'longitude' });
  });
});

describe('runBuild returned samples', () => {
  it('excludes the check silence with the fake link', () => {
    const link = new FakeLink({ audioSeconds: 1 });
    const result = runBuild(link, alertWithPoint, false);
    if (!result.ok) throw new Error('build failed');
    expect(result.build.samples.length).toBe(link.sampleRate);
    expect(result.build.sampleRate).toBe(link.sampleRate);
    // The listener was fed the sound plus the silence, but the caller gets only the sound.
    expect(link.listeners[0]!.fedSamples).toBe(link.sampleRate + CHECK_SILENCE_SECONDS * link.sampleRate);
  });

  it('excludes the check silence with the real sound link, and the check passes', () => {
    const link = wrapRealLink(realLink);
    const result = runBuild(link, alertWithPoint, false);
    if (!result.ok) throw new Error(`build failed: ${JSON.stringify(result.failure)}`);
    const direct = realLink.bytesToAudio(result.build.bytes);
    if (!direct.ok) throw new Error('direct audio failed');
    expect(result.build.samples.length).toBe(direct.samples.length);
    expect(result.build.samples).toEqual(direct.samples);
    expect(result.build.decoded).toEqual(alertWithPoint);
    expect(result.build.alert).toBe(alertWithPoint);
    expect(result.build.draft).toBe(false);
    expect(link.openListeners).toBe(0);
  });

  it('labels a draft and still follows the same path', () => {
    const link = new FakeLink();
    const result = runBuild(link, alertNoPoint, true);
    if (!result.ok) throw new Error('build failed');
    expect(result.build.draft).toBe(true);
    expect(link.bytesToAudioCalls).toBe(1);
    expect(link.createListenerCalls).toBe(1);
  });

  it('returns no samples on any failure', () => {
    const link = new FakeLink({ behavior: { kind: 'none' } });
    const result = runBuild(link, alertWithPoint, false);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('samples');
  });
});

describe('runBuild stores and logs nothing', () => {
  it('writes no console output, makes no network call and touches no storage', () => {
    const g = globalThis as unknown as Record<string, unknown>;
    const consoleObject = g.console as Record<string, (...args: unknown[]) => void>;
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(consoleObject, m).mockImplementation(() => {}),
    );
    const fetchSpy = vi.fn();
    const previousFetch = g.fetch;
    g.fetch = fetchSpy;
    try {
      for (const behavior of [{ kind: 'echo' as const }, { kind: 'none' as const }, { kind: 'throw' as const }]) {
        runBuild(new FakeLink({ behavior }), alertWithPoint, false);
      }
      runBuild(new FakeLink(), { ...alertWithPoint, validSteps: 0 }, false);
    } finally {
      g.fetch = previousFetch;
    }
    for (const s of spies) expect(s).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(g.localStorage).toBeUndefined();
    expect(g.sessionStorage).toBeUndefined();
  });
});
