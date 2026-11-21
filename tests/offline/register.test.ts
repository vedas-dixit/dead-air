import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerServiceWorker } from '../../src/offline/dom/register.ts';
import { FakeClock, FakeServiceWorkerContainer, flushPromises } from './fakes.ts';

interface Setup {
  sw: FakeServiceWorkerContainer;
  clock: FakeClock;
  fireLoad: () => void;
  reloads: number[];
}

function setup(opts: { supported?: boolean; onLine?: boolean; readyState?: string } = {}): Setup {
  const sw = new FakeServiceWorkerContainer();
  const clock = new FakeClock();
  const reloads: number[] = [];
  const loadListeners: Array<() => void> = [];
  const nav: Record<string, unknown> = { onLine: opts.onLine ?? true };
  if (opts.supported !== false) nav.serviceWorker = sw;
  vi.stubGlobal('navigator', nav);
  vi.stubGlobal('document', { readyState: opts.readyState ?? 'loading' });
  vi.stubGlobal('window', {
    addEventListener: (type: string, fn: () => void) => {
      if (type === 'load') loadListeners.push(fn);
    },
    location: { reload: () => reloads.push(1) },
  });
  vi.stubGlobal('setTimeout', clock.setTimeout);
  return { sw, clock, fireLoad: () => loadListeners.splice(0).forEach((f) => f()), reloads };
}

beforeEach(() => {
  vi.stubEnv('PROD', true);
  vi.stubEnv('BASE_URL', '/repo/');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('registerServiceWorker', () => {
  it('does nothing in dev', async () => {
    const s = setup({ readyState: 'complete' });
    vi.stubEnv('PROD', false);
    registerServiceWorker();
    await flushPromises();
    expect(s.sw.registerCalls).toEqual([]);
  });

  it('does nothing when service workers are unsupported', async () => {
    const s = setup({ supported: false, readyState: 'complete' });
    expect(() => registerServiceWorker()).not.toThrow();
    await flushPromises();
    expect(s.sw.registerCalls).toEqual([]);
    expect(s.clock.pending).toBe(0);
  });

  it('registers with the plan after the load event', async () => {
    const s = setup();
    registerServiceWorker();
    expect(s.sw.registerCalls).toEqual([]);
    s.fireLoad();
    expect(s.sw.registerCalls).toEqual([
      { scriptUrl: '/repo/sw.js', options: { scope: '/repo/', updateViaCache: 'none' } },
    ]);
  });

  it('registers at once when the page has already loaded', () => {
    const s = setup({ readyState: 'complete' });
    vi.stubEnv('BASE_URL', '/');
    registerServiceWorker();
    expect(s.sw.registerCalls).toEqual([
      { scriptUrl: '/sw.js', options: { scope: '/', updateViaCache: 'none' } },
    ]);
  });

  it('checks for an update 3 seconds after registering, and not sooner', async () => {
    const s = setup({ readyState: 'complete' });
    registerServiceWorker();
    await flushPromises();
    s.clock.advance(2999);
    expect(s.sw.registration.updateCalls).toBe(0);
    s.clock.advance(1);
    expect(s.sw.registration.updateCalls).toBe(1);
    s.clock.advance(60000);
    expect(s.sw.registration.updateCalls).toBe(1);
  });

  it('swallows update errors', async () => {
    const s = setup({ readyState: 'complete' });
    s.sw.registration.updateError = new Error('offline');
    registerServiceWorker();
    await flushPromises();
    expect(() => s.clock.advance(3000)).not.toThrow();
    await flushPromises();
    expect(s.sw.registration.updateCalls).toBe(1);
  });

  it('swallows registration errors', async () => {
    const s = setup({ readyState: 'complete' });
    s.sw.registerError = new Error('denied');
    expect(() => registerServiceWorker()).not.toThrow();
    await flushPromises();
    expect(s.clock.pending).toBe(0);
  });

  it('does not call update when the device is offline', async () => {
    const s = setup({ readyState: 'complete', onLine: false });
    registerServiceWorker();
    await flushPromises();
    s.clock.advance(3000);
    expect(s.sw.registration.updateCalls).toBe(0);
  });

  it('never reloads the page', async () => {
    const s = setup();
    registerServiceWorker();
    s.fireLoad();
    await flushPromises();
    s.clock.advance(3000);
    s.sw.registration.dispatch('updatefound');
    await flushPromises();
    expect(s.reloads).toEqual([]);
  });
});
