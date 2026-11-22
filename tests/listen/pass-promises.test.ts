// Promise tests for Pass it on (task 9.10): promise 3 (TEST), promises 4 and 5 (no network,
// no audio stored or logged), and the offline build. Test alerts only.
// Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.7
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { stringsEn } from '../../src/broadcast/strings.en';
import { createListenController } from '../../src/listen/controller';
import { parseHistory } from '../../src/listen/history-store';
import { decodeMessage } from '../../src/message-code';
import type { Alert } from '../../src/message-code';
import type { AudioResult, LoadResult } from '../../src/sound-link';
import { encodeOrThrow } from '../message-code/generators';
import {
  FakeAudioInput,
  FakeIntervalTimers,
  FakeListenClock,
  FakeListenLink,
  FakeListenStorage,
  FakePageVisibility,
  FakeWakeLock,
  flushPromises,
  makeFakeHost,
  makeFakeTimeouts,
} from './fakes';

const NOW = 29_000_000 * 60000 + 60_000;

function testAlert(over: Partial<Alert> = {}): Alert {
  return {
    test: true,
    passedOn: false,
    hopCount: 0,
    event: 'flood',
    urgency: 'immediate',
    severity: 'severe',
    action: 'evacuate',
    sentMinute: 29_000_000,
    validSteps: 8,
    latitude: null,
    longitude: null,
    stationId: 7,
    counter: 1,
    placeName: 'Test Town',
    ...over,
  };
}

/** A link that makes real-looking samples and records the bytes it was asked to play. */
class PlayableLink extends FakeListenLink {
  readonly asked: Uint8Array[] = [];
  override bytesToAudio(bytes?: unknown): AudioResult {
    this.asked.push(Uint8Array.from(bytes as Uint8Array));
    return { ok: true, samples: new Float32Array(480).fill(0.1) };
  }
}

function setup() {
  const clock = new FakeListenClock(NOW);
  const timers = new FakeIntervalTimers(clock);
  const audio = new FakeAudioInput();
  const storage = new FakeListenStorage();
  const host = makeFakeHost();
  const timeouts = makeFakeTimeouts();
  const links: PlayableLink[] = [];
  const loadLink = (rate: number): Promise<LoadResult> => {
    const link = new PlayableLink(rate);
    links.push(link);
    return Promise.resolve({ ok: true, link });
  };
  const ctl = createListenController({
    clock,
    timers,
    audio,
    loadLink,
    storage,
    wake: new FakeWakeLock(),
    visibility: new FakePageVisibility(true),
    host,
    timeouts,
    strings: stringsEn,
  });
  return { ctl, audio, storage, host, timeouts, links };
}

/** Starts a session, hears one test alert, taps Pass it on and lets both Plays finish. */
async function passFlow(s: ReturnType<typeof setup>) {
  await s.ctl.tapStart();
  await flushPromises();
  const original = encodeOrThrow(testAlert());
  s.links[0]!.lastListener!.queuePayloads(original);
  s.audio.lastHandle!.pushBlock(new Float32Array(128));
  const card = s.ctl.snapshot().cards[0]!;
  const tap = s.ctl.tapPass(card.key);
  await flushPromises();
  s.host.player.finishCurrent(); // first Play
  await flushPromises();
  s.timeouts.advance(1000); // gap
  await flushPromises();
  s.host.player.finishCurrent(); // second Play
  await flushPromises();
  await tap;
  s.timeouts.advance(1000); // Echo_Guard
  await flushPromises();
  return { card };
}

/** True when a Float32Array (or a typed array of samples) appears anywhere in the value. */
function holdsSamples(v: unknown, depth = 0): boolean {
  if (v instanceof Float32Array || v instanceof Float64Array) return true;
  if (depth > 4 || v === null || typeof v !== 'object') return false;
  return Object.values(v as Record<string, unknown>).some((x) => holdsSamples(x, depth + 1));
}

describe('a pass with fakes: promises 3, 4 and 5', () => {
  const fetchSpy = vi.fn();
  const xhrSpy = vi.fn();
  const consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console as unknown as Record<string, () => void>, m) as unknown as ReturnType<typeof vi.fn>);
  for (const c of consoleSpies) c.mockImplementation(() => undefined);
  const store = { setItem: vi.fn(), getItem: vi.fn(() => null), removeItem: vi.fn(), clear: vi.fn() };

  beforeEach(() => {
    fetchSpy.mockClear();
    xhrSpy.mockClear();
    for (const c of consoleSpies) c.mockClear();
    for (const f of Object.values(store)) f.mockClear();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('XMLHttpRequest', xhrSpy);
    vi.stubGlobal('localStorage', store);
    vi.stubGlobal('sessionStorage', store);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('the Copy of a test alert is a test alert and its card shows the TEST banner (promise 3)', async () => {
    const s = setup();
    const { card } = await passFlow(s);
    expect(s.host.player.playCalls).toBe(2);
    expect(s.links[0]!.asked).toHaveLength(1);

    const copy = decodeMessage(s.links[0]!.asked[0]!);
    expect(copy.ok).toBe(true);
    if (!copy.ok) return;
    expect(copy.alert.test).toBe(true);
    expect(copy.alert.passedOn).toBe(true);
    expect(copy.alert.hopCount).toBe(1);

    expect(card.testBanner).toBe(stringsEn.text['test.banner']);
    // The card still shows the banner after the pass.
    const after = s.ctl.snapshot().cards;
    expect(after).toHaveLength(1);
    expect(after[0]!.testBanner).toBe(stringsEn.text['test.banner']);
  });

  it('calls no fetch or XMLHttpRequest during a pass (promise 4)', async () => {
    const s = setup();
    await passFlow(s);
    expect(s.host.player.playCalls).toBe(2);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(xhrSpy).not.toHaveBeenCalled();
  });

  it('passes no sample array to storage or logs (promise 5)', async () => {
    const s = setup();
    await passFlow(s);
    expect(s.host.player.playCalls).toBe(2);

    for (const c of consoleSpies) for (const args of c.mock.calls) expect(holdsSamples(args)).toBe(false);
    for (const f of [store.setItem, fetchSpy, xhrSpy]) for (const args of f.mock.calls) expect(holdsSamples(args)).toBe(false);

    // Everything the controller wrote is text, and it loads back as the one heard alert with no Copy kept.
    expect(s.storage.writes.length).toBeGreaterThan(0);
    for (const w of s.storage.writes) {
      expect(typeof w).toBe('string');
      expect(w).not.toMatch(/samples|audio|float32/i);
    }
    const saved = parseHistory(s.storage.value);
    expect(saved).toHaveLength(1);
    expect(saved[0]!.alert.hopCount).toBe(0);
  });
});

// ---------------------------------------------------------------- offline build

const ROOT = process.cwd();
const VITE = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const POSTBUILD = join(ROOT, 'build', 'offline-postbuild.mjs');
const CHECK = join(ROOT, 'build', 'offline-check.mjs');
const OUT = join(ROOT, 'node_modules', '.cache', 'dead-air-pass-it-on-build');
const TIMEOUT = 170000;

function node(args: string[]) {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.BASE_PATH;
  delete env.NODE_ENV;
  for (const k of Object.keys(env)) if (k.startsWith('VITEST') || k === 'VITE_USER_NODE_ENV') delete env[k];
  const r = spawnSync(process.execPath, args, { cwd: ROOT, env, encoding: 'utf8', timeout: TIMEOUT });
  return { status: r.status, output: `${r.stdout}\n${r.stderr}` };
}

function walk(dir: string, root = dir, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, root, out);
    else out.push(full.slice(root.length + 1).split('\\').join('/'));
  }
  return out.sort();
}

describe('offline build with Pass it on', () => {
  let build: ReturnType<typeof node>;
  let post: ReturnType<typeof node>;
  let check: ReturnType<typeof node>;
  let list: { files: string[] };

  beforeAll(() => {
    rmSync(OUT, { recursive: true, force: true });
    build = node([VITE, 'build', '--outDir', OUT, '--emptyOutDir']);
    post = build.status === 0 ? node([POSTBUILD, OUT]) : { status: null, output: '' };
    check = post.status === 0 ? node([CHECK, OUT]) : { status: null, output: '' };
    if (post.status === 0) list = JSON.parse(readFileSync(join(OUT, 'offline-files.json'), 'utf8'));
  }, TIMEOUT);

  it('builds, writes the File_List and the Offline_Check passes with zero failures', () => {
    expect(build.status, build.output).toBe(0);
    expect(post.status, post.output).toBe(0);
    // The check also fails on any page that requests another address, so this covers
    // the "pages request only their own address" check on the real build.
    expect(check.status, check.output).toBe(0);
  }, TIMEOUT);

  it('lists every built file with no manual list, including the code of the new files', () => {
    const built = walk(OUT).filter((p) => p.startsWith('assets/'));
    expect(built.length).toBeGreaterThan(0);
    for (const p of built) {
      if (p.endsWith('.map')) continue;
      expect(list.files, p).toContain(p);
    }
    for (const f of list.files) expect(existsSync(join(OUT, f)), f).toBe(true);

    // The code of src/listen/pass.ts and src/listen/pass-run.ts ships in a listed JS file.
    const listed = list.files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(OUT, f), 'utf8'));
    const holds = (needle: string) => listed.some((t) => t.includes(needle));
    expect(holds('listen.pass.err.expired-mid')).toBe(true);
    expect(holds('listen.pass.btn')).toBe(true);
  }, TIMEOUT);

  it('names none of the new files in the offline sources', () => {
    for (const p of ['src/offline', 'build']) {
      for (const f of walk(join(ROOT, p)).filter((x) => /\.(ts|mjs)$/.test(x))) {
        const text = readFileSync(join(ROOT, p, f), 'utf8');
        expect(text, `${p}/${f}`).not.toMatch(/pass-run|listen\/pass/);
      }
    }
  });
});
