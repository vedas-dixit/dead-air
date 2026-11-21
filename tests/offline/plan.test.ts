import { describe, expect, it } from 'vitest';
import { planOffline } from '../../src/offline/plan.ts';
import { buildManifest, manifestText } from '../../src/offline/manifest.ts';
import type { OutputFile } from '../../src/offline/file-list.ts';

const f = (path: string, text?: string, size?: number): OutputFile => ({
  path,
  size: size ?? text?.length ?? 10,
  hash: 'h' + path,
  ...(text !== undefined ? { text } : {}),
});

const hashText = (t: string): string => 'abcdef0123456789abcdef' + t.length;
const page = (body: string) => `<html><head>${body}</head><body></body></html>`;

function site(base = '/'): OutputFile[] {
  return [
    f('index.html', page(`<script type="module" src="${base}assets/main.js"></script>`)),
    f('listen/index.html', page(`<link rel="manifest" href="${base}manifest.webmanifest"><script type="module" src="${base}assets/main.js"></script>`)),
    f('broadcast/index.html', page(`<script type="module" src="${base}assets/main.js"></script>`)),
    f('manifest.webmanifest', manifestText(buildManifest(base))),
    f('assets/main.js', 'export const a = 1;'),
    f('icons/icon-192.png'),
    f('icons/icon-512.png'),
    f('sw.js', 'x'),
    f('sound-test/index.html', page('')),
  ];
}

const run = (files: OutputFile[], base = '/') => planOffline({ base, files, hashText });

describe('planOffline', () => {
  it('plans a clean site at the root and under a sub-path', () => {
    for (const base of ['/', '/repo/']) {
      const r = run(site(base), base);
      expect(r.errors).toEqual([]);
      expect(r.config?.base).toBe(base);
      expect(r.config?.version).toHaveLength(16);
      expect(r.config?.files).toContain('listen/index.html');
      expect(r.config?.files).not.toContain('sw.js');
      expect(r.count).toBe(r.config?.files.length);
      expect(r.sizeLine).toContain(`${r.count} files`);
    }
  });

  it('names an invalid base and returns no config, with a size line', () => {
    const r = run(site(), '/a//b/');
    expect(r.errors.some((e) => e.includes('"/a//b/"'))).toBe(true);
    expect(r.config).toBeNull();
    expect(r.sizeLine.length).toBeGreaterThan(0);
  });

  it('reports a missing referenced file', () => {
    const files = site().map((x) => (x.path === 'assets/main.js' ? f('assets/other.js', 'x') : x));
    const r = run(files);
    expect(r.errors.some((e) => e.includes('missing file') && e.includes('/assets/main.js'))).toBe(true);
    expect(r.config).toBeNull();
  });

  it('reports an external reference', () => {
    const files = site();
    files[1] = f('listen/index.html', page('<script src="https://cdn.example.org/x.js"></script>'));
    const r = run(files);
    expect(r.errors.some((e) => e.includes('external reference') && e.includes('cdn.example.org'))).toBe(true);
    expect(r.config).toBeNull();
  });

  it('reports a reference outside scope', () => {
    const files = site('/repo/');
    files[1] = f('listen/index.html', page('<script src="/other/x.js"></script>'));
    const r = run(files, '/repo/');
    expect(r.errors.some((e) => e.includes('outside scope') && e.includes('/other/x.js'))).toBe(true);
  });

  it('reports a relative load reference in built HTML', () => {
    const files = site();
    files[2] = f('broadcast/index.html', page('<script src="../assets/main.js"></script>'));
    const r = run(files);
    expect(r.errors.some((e) => e.includes('relative load reference'))).toBe(true);
    expect(r.config).toBeNull();
  });

  it('reports an excluded file reached by a load reference', () => {
    const files = site();
    files[2] = f('broadcast/index.html', page('<script src="/sw.js"></script>'));
    const r = run(files);
    expect(r.errors).toContain('excluded file is loaded by the app: sw.js');
  });

  it('reports manifest problems: missing icon, outside scope, bad JSON', () => {
    const noIcon = site().filter((x) => x.path !== 'icons/icon-512.png');
    expect(run(noIcon).errors.some((e) => e.includes('icons/icon-512.png'))).toBe(true);

    const m = buildManifest('/');
    const bad = site().map((x) =>
      x.path === 'manifest.webmanifest' ? f(x.path, JSON.stringify({ ...m, start_url: '/x/' , scope: 'https://a.example/' })) : x,
    );
    const r = run(bad, '/');
    expect(r.errors.some((e) => e.includes('manifest: scope'))).toBe(true);

    const junk = site().map((x) => (x.path === 'manifest.webmanifest' ? f(x.path, '{nope') : x));
    expect(run(junk).errors.some((e) => e.includes('not valid JSON'))).toBe(true);
  });

  it('fails over the 2 MiB limit but still gives the size line', () => {
    const files = site().map((x) => (x.path === 'assets/main.js' ? { ...x, size: 2_097_153 } : x));
    const r = run(files);
    expect(r.errors.some((e) => e.includes('over the limit'))).toBe(true);
    expect(r.config).toBeNull();
    expect(r.totalBytes).toBeGreaterThan(2_097_152);
    expect(r.sizeLine).toContain('over the limit');
  });

  it('version changes when a listed file changes and not when an excluded one does', () => {
    const a = run(site()).config?.version;
    const changed = site().map((x) => (x.path === 'assets/main.js' ? { ...x, hash: 'other' } : x));
    const excluded = site().map((x) => (x.path === 'sw.js' ? { ...x, hash: 'other' } : x));
    const hash = (t: string): string => {
      let h = 0;
      for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      return h.toString(16).padStart(8, '0').repeat(2);
    };
    const p = (files: OutputFile[]) => planOffline({ base: '/', files, hashText: hash }).config?.version;
    expect(a).toBeDefined();
    expect(p(changed)).not.toBe(p(site()));
    expect(p(excluded)).toBe(p(site()));
  });
});
