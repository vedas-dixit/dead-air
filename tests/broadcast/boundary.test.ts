import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { statSync } from 'node:fs';

// Source scans for the Broadcast page boundaries (Requirements 2.6, 3.15, 6.2, 6.12, 9.8, 13.1, 14.1, 14.4, 14.10).

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) out.push(...listTs(path));
    else if (name.endsWith('.ts')) out.push(path);
  }
  return out.sort();
}

/** Source text without block comments and without whole-line `//` comments. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
}

function mentions(text: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(text);
}

const broadcastFiles = listTs('src/broadcast');
const domFiles = broadcastFiles.filter((f) => f.startsWith('src/broadcast/dom/'));
const pureBroadcast = broadcastFiles.filter((f) => !f.startsWith('src/broadcast/dom/'));
const sharedFiles = listTs('src/shared').filter((f) => !f.startsWith('src/shared/ui/dom/'));
const pageFiles = [...broadcastFiles, 'broadcast/main.ts'];
const allFiles = [...broadcastFiles, ...sharedFiles, 'broadcast/main.ts'];

describe('file lists', () => {
  it('finds the files to scan', () => {
    expect(pureBroadcast.length).toBeGreaterThan(10);
    expect(domFiles).toEqual(expect.arrayContaining(['src/broadcast/dom/mount.ts', 'src/broadcast/dom/web-audio.ts']));
    expect(sharedFiles.length).toBeGreaterThan(0);
  });
});

describe('pure code has no browser API', () => {
  const names = ['document', 'window', 'navigator', 'localStorage', 'fetch', 'XMLHttpRequest', 'getUserMedia', 'serviceWorker', 'speechSynthesis'];
  it.each([...pureBroadcast, ...sharedFiles])('%s uses no browser API', (f) => {
    const text = code(f);
    for (const name of names) {
      expect(mentions(text, name), `${f} mentions ${name}`).toBe(false);
    }
  });
  it.each([...pureBroadcast, ...sharedFiles])('%s does not import encodePlaceName', (f) => {
    expect(mentions(code(f), 'encodePlaceName'), `${f} mentions encodePlaceName`).toBe(false);
  });
});

describe('page code makes no network or hidden-channel calls', () => {
  const names = ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'getUserMedia', 'serviceWorker'];
  it.each([...domFiles, 'broadcast/main.ts'])('%s uses no network API', (f) => {
    const text = code(f);
    for (const name of names) {
      expect(mentions(text, name), `${f} mentions ${name}`).toBe(false);
    }
  });
});

describe('single points of use', () => {
  it('calls loadSoundLink( once, in src/broadcast/dom/mount.ts', () => {
    const sites = pageFiles.filter((f) => /\bloadSoundLink\s*\(/.test(code(f)));
    expect(sites).toEqual(['src/broadcast/dom/mount.ts']);
    const count = (code('src/broadcast/dom/mount.ts').match(/\bloadSoundLink\s*\(/g) ?? []).length;
    expect(count).toBe(1);
  });

  it('writes localStorage only in web-platform.ts', () => {
    for (const f of pageFiles) {
      if (f === 'src/broadcast/dom/web-platform.ts') continue;
      expect(mentions(code(f), 'localStorage'), `${f} mentions localStorage`).toBe(false);
    }
  });

  it('constructs AudioContext only in web-audio.ts, never at module top level', () => {
    for (const f of allFiles) {
      if (f === 'src/broadcast/dom/web-audio.ts') continue;
      expect(/\bAudioContext\s*\(/.test(code(f)), `${f} constructs AudioContext`).toBe(false);
      expect(/\bwebkitAudioContext\b/.test(code(f)), `${f} uses webkitAudioContext`).toBe(false);
    }
    const lines = code('src/broadcast/dom/web-audio.ts').split('\n');
    // The context class is looked up into `Ctor`, so construction reads `new Ctor(`.
    const constructions = lines.filter((l) => /\bnew\s+(Ctor|\w*AudioContext)\s*\(/.test(l));
    expect(constructions.length).toBeGreaterThan(0);
    for (const l of constructions) {
      expect(/^\s/.test(l), `top-level construction: ${l}`).toBe(true);
    }
  });

  it('calls getCurrentPosition only in web-location.ts', () => {
    for (const f of allFiles) {
      if (f === 'src/broadcast/dom/web-location.ts') continue;
      expect(mentions(code(f), 'getCurrentPosition'), `${f} mentions getCurrentPosition`).toBe(false);
    }
    expect(mentions(code('src/broadcast/dom/web-location.ts'), 'getCurrentPosition')).toBe(true);
  });

  it('has no console use in src/broadcast', () => {
    for (const f of broadcastFiles) {
      expect(/\bconsole\s*\./.test(code(f)), `${f} uses console`).toBe(false);
    }
  });

  it('has no /dead-air/ literal in page or shared code', () => {
    for (const f of allFiles) {
      expect(readFileSync(f, 'utf8').includes('/dead-air/'), `${f} hard-codes /dead-air/`).toBe(false);
    }
  });
});
