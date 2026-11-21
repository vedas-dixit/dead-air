import { describe, expect, it } from 'vitest';
import { buildFileList, type FileListInput, type OutputFile } from '../../src/offline/file-list.ts';

const f = (path: string, text?: string): OutputFile => ({
  path,
  size: text?.length ?? 10,
  hash: 'h' + path,
  ...(text !== undefined ? { text } : {}),
});

const run = (files: OutputFile[], over: Partial<FileListInput> = {}) =>
  buildFileList({
    base: '/',
    files,
    appRoots: ['listen/index.html', 'broadcast/index.html', 'manifest.webmanifest'],
    frontRoots: ['index.html'],
    excludedPaths: ['sw.js', 'offline-files.json'],
    excludedPrefixes: ['sound-test/'],
    excludedSuffixes: ['.map'],
    ...over,
  });

const page = (body: string) => `<html><head>${body}</head><body></body></html>`;

const site = (): OutputFile[] => [
  f('index.html', page('<script type="module" src="/assets/front.js"></script><img src="/photos/cover.png"><a href="/listen/">Listen</a><a href="https://example.com/x.png">x</a>')),
  f('listen/index.html', page('<link rel="manifest" href="/manifest.webmanifest"><script type="module" src="/assets/listen.js"></script><a href="/">Home</a>')),
  f('broadcast/index.html', page('<script type="module" src="/assets/listen.js"></script><link rel="stylesheet" href="/assets/a.css">')),
  f('manifest.webmanifest', JSON.stringify({ icons: [{ src: '/icons/icon-192.png' }] })),
  f('assets/front.js', 'import "./shared.js";'),
  f('assets/shared.js', 'export const a = 1;'),
  f('assets/listen.js', 'import "./shared.js"; const u = "/icons/icon-192.png"; const n = "/nothing.png";'),
  f('assets/a.css', 'body{background:url(./bg.svg)}'),
  f('assets/bg.svg'),
  f('icons/icon-192.png'),
  f('photos/cover.png'),
  f('sw.js', 'x'),
  f('sound-test/index.html', page('')),
];

describe('buildFileList', () => {
  it('follows references and drops Front_Page images by reference', () => {
    const r = run(site());
    expect(r.files).toEqual([
      'assets/a.css',
      'assets/bg.svg',
      'assets/front.js',
      'assets/listen.js',
      'assets/shared.js',
      'broadcast/index.html',
      'icons/icon-192.png',
      'index.html',
      'listen/index.html',
      'manifest.webmanifest',
    ]);
    expect(r.frontImages).toEqual(['photos/cover.png']);
    expect(r.missing).toEqual([]);
    expect(r.external).toEqual([]);
    expect(r.excludedReached).toEqual([]);
  });

  it('keeps an image that an app page also references, whatever its folder', () => {
    const files = site();
    files.push(f('photos/shared.png'));
    files[0] = f('index.html', page('<img src="/photos/shared.png">'));
    files[1] = f('listen/index.html', page('<img src="/photos/shared.png">'));
    const r = run(files);
    expect(r.files).toContain('photos/shared.png');
    expect(r.frontImages).toEqual([]);
  });

  it('does not exclude a non-image only reached from the front page', () => {
    const r = run(site());
    expect(r.files).toContain('assets/front.js');
  });

  it('does not follow anchors and reports external load refs', () => {
    const files = site();
    files[1] = f('listen/index.html', page('<script src="https://cdn.example.com/a.js"></script><script src="//cdn.example.com/b.js"></script>'));
    const r = run(files);
    expect(r.external.map((e) => e.target)).toEqual(['https://cdn.example.com/a.js', '//cdn.example.com/b.js']);
    expect(r.external[0]?.from).toBe('listen/index.html');
  });

  it('reports missing load and import refs, but not JS strings that name no file', () => {
    const files = site();
    files[4] = f('assets/front.js', 'import "./gone.js"; const x = "./nothere.png";');
    files[2] = f('broadcast/index.html', page('<link rel="stylesheet" href="/assets/none.css">'));
    const r = run(files);
    expect(r.missing).toEqual(
      expect.arrayContaining([
        { target: './gone.js', from: 'assets/front.js' },
        { target: '/assets/none.css', from: 'broadcast/index.html' },
      ]),
    );
    expect(r.missing.some((m) => m.target === './nothere.png')).toBe(false);
  });

  it('reports a missing root', () => {
    const r = run(site().filter((x) => x.path !== 'broadcast/index.html'));
    expect(r.missing).toContainEqual({ target: 'broadcast/index.html', from: '(root)' });
  });

  it('reports relative loads in HTML and still follows them', () => {
    const files = site();
    files[1] = f('listen/index.html', page('<script src="../assets/shared.js"></script>'));
    const r = run(files);
    expect(r.relativeLoads).toEqual([{ target: '../assets/shared.js', from: 'listen/index.html' }]);
    expect(r.files).toContain('assets/shared.js');
  });

  it('reports refs outside the base', () => {
    const files = site();
    files[1] = f('listen/index.html', page('<script src="/other/x.js"></script>'));
    const r = run(files, { base: '/repo/' });
    expect(r.outsideScope).toContainEqual({ target: '/other/x.js', from: 'listen/index.html' });
    expect(r.files).not.toContain('other/x.js');
  });

  it('works under a sub-path base', () => {
    const files = site().map((x) =>
      x.text !== undefined ? f(x.path, x.text.replace(/"\/(?!\/)/g, '"/repo/')) : x,
    );
    const r = run(files, { base: '/repo/' });
    expect(r.missing).toEqual([]);
    expect(r.files).toContain('assets/listen.js');
    expect(r.frontImages).toEqual(['photos/cover.png']);
  });

  it('never lists excluded files and reports when reached', () => {
    const files = site();
    files[1] = f('listen/index.html', page('<script src="/sw.js"></script><img src="/sound-test/a.png"><link href="/assets/a.js.map">'));
    files.push(f('sound-test/a.png'), f('assets/a.js.map'));
    const r = run(files);
    expect(r.files).not.toContain('sw.js');
    expect(r.files.some((p) => p.startsWith('sound-test/') || p.endsWith('.map'))).toBe(false);
    expect(r.excludedReached).toEqual(['assets/a.js.map', 'sound-test/a.png', 'sw.js']);
    expect(r.missing).toEqual([]);
  });

  it('is independent of file order', () => {
    const a = run(site());
    const b = run(site().reverse());
    expect(b.files).toEqual(a.files);
  });

  it('treats a trailing slash as index.html and ignores query and fragment', () => {
    const files = site();
    files[1] = f('listen/index.html', page('<iframe src="/broadcast/?x=1#y"></iframe>'));
    const r = run(files);
    expect(r.missing).toEqual([]);
    expect(r.files).toContain('broadcast/index.html');
  });
});
