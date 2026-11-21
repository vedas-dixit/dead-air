// Fixture tests for the Offline_Check: counts of findings per fixture.
// Validates: Requirements 7.10, 7.13, 7.14, 7.15, 7.16
import { describe, expect, it } from 'vitest';
import { scanBuild, validateAllowedUrls } from '../../src/offline/check.ts';
import type { CheckFile } from '../../src/offline/check.ts';

const scan = (files: CheckFile[], extra: Partial<Parameters<typeof scanBuild>[0]> = {}) =>
  scanBuild({ files, base: '/', callList: [], allowedUrls: [], ...extra });

describe('7.13 app page fixture', () => {
  it('reports one finding for each external URL and unproven call', () => {
    const html = [
      '<img src="https://a.test/1.png">',
      '<img srcset="https://a.test/2.png 1x">',
      '<video poster="https://a.test/3.png"></video>',
      '<object data="https://a.test/4"></object>',
      '<form action="https://a.test/5"></form>',
      '<button formaction="https://a.test/6"></button>',
      '<a href="https://a.test/7">x</a>',
      '<area href="https://a.test/8">',
      '<a href="/x" ping="https://a.test/9">y</a>',
      '<meta name="m" content="https://a.test/10">',
      '<link rel="stylesheet" href="https://a.test/11.css">',
      '<p style="background:url(https://a.test/12.png)"></p>',
    ].join('\n');
    const css = 'a{background:url(https://a.test/13.png)}\n@import "https://a.test/14.css";';
    const js = 'a("https://a.test/15.js");\nfetch(target);';
    const inserted = 12 + 2 + 2;
    const r = scan([
      { path: 'listen/index.html', text: html },
      { path: 'assets/a.css', text: css },
      { path: 'assets/a.js', text: js },
    ]);
    expect(r.ok).toBe(false);
    expect(r.findings).toHaveLength(inserted);
    expect(r.findings.filter((f) => f.kind === 'js-call')).toHaveLength(1);
    const urls = r.findings.map((f) => f.detail);
    expect(new Set(urls).size).toBe(inserted);
  });
});

describe('7.14 front page fixture', () => {
  it('reports one finding for each external loaded URL', () => {
    const html = [
      '<img src="https://a.test/img.png">',
      '<script src="https://a.test/s.js"></script>',
      '<link rel="stylesheet" href="https://a.test/s.css">',
      '<iframe src="https://a.test/frame"></iframe>',
      '<audio src="https://a.test/a.mp3"></audio>',
      '<video src="https://a.test/v.mp4"></video>',
      '<link rel="preload" href="https://a.test/p.woff2" as="font">',
      '<link rel="prefetch" href="https://a.test/pf">',
      '<link rel="manifest" href="https://a.test/m.webmanifest">',
    ].join('\n');
    const fontCss = '@font-face{font-family:x;src:url(https://a.test/f.woff2)}';
    const importCss = '@import url("https://a.test/i.css");';
    const js = 'import "https://a.test/m.js";';
    const r = scan([
      { path: 'index.html', text: html },
      { path: 'assets/font.css', text: fontCss },
      { path: 'assets/import.css', text: importCss },
      { path: 'assets/front.js', text: js },
    ]);
    expect(r.findings).toHaveLength(12);
    expect(new Set(r.findings.map((f) => f.detail)).size).toBe(12);
  });
});

describe('7.15 External_Links', () => {
  const links = '<a href="https://a.test/1">one</a><area href="https://a.test/2"><a href="//b.test/3">three</a>';
  it('front page: no findings', () => {
    expect(scan([{ path: 'index.html', text: links }]).findings).toHaveLength(0);
  });
  it('listen page: one finding for each', () => {
    const r = scan([{ path: 'listen/index.html', text: links }]);
    expect(r.findings).toHaveLength(3);
    expect(r.findings.every((f) => f.kind === 'html-link')).toBe(true);
  });
});

describe('7.16 Loader_Call_List fixture', () => {
  it('reports one finding for each bad entry', () => {
    const files: CheckFile[] = [
      { path: 'a.js', text: 'fetch(x);fetch(x);fetch(y)' },
      { path: 'b.js', text: 'fetch(y);fetch(w)' },
    ];
    const callList = [
      { file: 'a.js', call: 'fetch(stale)', reason: 'stale' },
      { file: '*.js', call: 'fetch(y)', reason: 'two files' },
      { file: 'a.js', call: 'fetch(x)', reason: 'two calls' },
      { file: 'b.js', call: 'fetch(w)', reason: '' },
    ];
    const found = scan(files, { callList }).findings.filter((f) => f.kind === 'call-list-entry');
    expect(found).toHaveLength(4);
    expect(found.map((f) => f.detail.split(':')[0])).toEqual([
      'matches no call',
      'file pattern matches 2 files',
      'matches 2 calls',
      'empty reason',
    ]);
  });
});

describe('7.10 allowed URL list', () => {
  it('an entry with an empty reason fails the build', () => {
    const entry = { url: 'http://www.w3.org/2000/svg', reason: '' };
    expect(validateAllowedUrls([entry])).toHaveLength(1);
    const r = scan([], { allowedUrls: [entry] });
    expect(r.ok).toBe(false);
    expect(r.findings.map((f) => f.kind)).toEqual(['url-list-entry']);
  });
  it('an entry with a reason passes', () => {
    const r = scan([], { allowedUrls: [{ url: 'http://www.w3.org/2000/svg', reason: 'XML namespace' }] });
    expect(r.ok).toBe(true);
  });
});
