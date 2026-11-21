import { describe, expect, it } from 'vitest';
import { findCalls, scanBuild, scanCss, validateCallList } from '../../src/offline/check.ts';
import type { CheckFile } from '../../src/offline/check.ts';

const scan = (files: CheckFile[], extra: Partial<Parameters<typeof scanBuild>[0]> = {}) =>
  scanBuild({ files, base: '/', callList: [], allowedUrls: [], ...extra });

describe('HTML', () => {
  it('app page: external load and link both fail', () => {
    const html =
      '<img src="https://a.test/x.png"><a href="https://b.test/">b</a><link rel="preload" href="//c.test/f">' +
      '<meta name="x" content="https://d.test/">';
    const r = scan([{ path: 'listen/index.html', text: html }]);
    expect(r.findings.map((f) => f.kind)).toEqual(['html-load', 'html-link', 'html-load', 'html-load']);
  });

  it('front page: links and plain meta pass, loads and refresh fail', () => {
    const html =
      '<a href="https://b.test/">b</a><area href="https://b.test/"><meta name="x" content="https://d.test/">' +
      '<meta http-equiv="refresh" content="0; url=https://e.test/"><script src="https://f.test/a.js"></script>' +
      '<img srcset="/a.png 1x, https://g.test/a.png 2x">';
    const r = scan([{ path: 'index.html', text: html }]);
    expect(r.findings.map((f) => f.detail)).toEqual(['https://e.test/', 'https://f.test/a.js', 'https://g.test/a.png']);
  });

  it('uses the base to find the front page', () => {
    const r = scanBuild({
      files: [{ path: '/dead-air/index.html', text: '<a href="https://b.test/">b</a>' }],
      base: '/dead-air/',
      callList: [],
      allowedUrls: [],
    });
    expect(r.ok).toBe(true);
  });

  it('scans inline style, style attribute and inline script', () => {
    const html =
      '<style>@import "https://a.test/a.css";</style><p style="background:url(https://b.test/b.png)"></p>' +
      '<script>var u="https://c.test/c.js";</script>';
    const r = scan([{ path: 'broadcast/index.html', text: html }]);
    expect(r.findings.map((f) => f.kind)).toEqual(['css-url', 'css-url', 'js-url']);
  });
});

describe('CSS', () => {
  it('flags external url() and @import only', () => {
    expect(scanCss('a.css', 'a{background:url(/x.png)} @import url(https://x.test/a.css); b{src:url("//y.test/f")}')).toHaveLength(2);
  });
});

describe('JS', () => {
  it('flags absolute and protocol-relative URL strings, honours allowed URLs with a reason', () => {
    const text = 'a("https://a.test/");b(\'//b.test/x\');c("http://www.w3.org/2000/svg");';
    const r = scan([{ path: 'assets/a.js', text }], {
      allowedUrls: [{ url: 'http://www.w3.org/2000/svg', reason: 'XML namespace' }],
    });
    expect(r.findings.map((f) => f.detail)).toEqual(['https://a.test/', '//b.test/x']);
  });

  it('an allowed URL with an empty reason accepts nothing and is itself a finding', () => {
    const r = scan([{ path: 'a.js', text: 'x("http://www.w3.org/2000/svg")' }], {
      allowedUrls: [{ url: 'http://www.w3.org/2000/svg', reason: ' ' }],
    });
    expect(r.findings.map((f) => f.kind)).toEqual(['js-url', 'url-list-entry']);
  });

  it('call text runs to the matching parenthesis and skips strings and comments', () => {
    const calls = findCalls('x = fetch(a(")"), {b:(1)}) /* ) */; new XMLHttpRequest; navigator.sendBeacon(u, d);');
    expect(calls.map((c) => c.text)).toEqual(['fetch(a(")"), {b:(1)})', 'XMLHttpRequest', 'navigator.sendBeacon(u, d)']);
  });

  it('accepts a relative literal target, ignores method definitions and mentions', () => {
    const text = 'fetch("data/x.json"); class A{ fetch(e){return 1} } addEventListener("fetch",f); typeof WebSocket;';
    expect(scan([{ path: 'a.js', text }]).ok).toBe(true);
  });

  it('flags an unproven call, and a call list entry accepts it on file and exact text', () => {
    const files = [{ path: 'assets/g.js', text: 'fetch(e.href,t)' }];
    expect(scan(files).findings.map((f) => f.kind)).toEqual(['js-call']);
    const entry = { file: 'assets/*.js', call: 'fetch(e.href,t)', reason: 'loader' };
    expect(scan(files, { callList: [entry] }).ok).toBe(true);
    expect(scan(files, { callList: [{ ...entry, call: 'fetch(e.href, t)' }] }).findings.map((f) => f.kind)).toEqual([
      'js-call',
      'call-list-entry',
    ]);
    expect(scan(files, { callList: [{ ...entry, file: 'sw.js' }] }).findings.map((f) => f.kind)).toEqual([
      'js-call',
      'call-list-entry',
    ]);
  });
});

describe('validateCallList', () => {
  const files: CheckFile[] = [
    { path: 'a.js', text: 'fetch(x);fetch(x);fetch(y)' },
    { path: 'b.js', text: 'fetch(y)' },
  ];
  it('gives one finding per bad entry', () => {
    const list = [
      { file: 'a.js', call: 'fetch(z)', reason: 'r' },
      { file: '*.js', call: 'fetch(y)', reason: 'r' },
      { file: 'a.js', call: 'fetch(x)', reason: 'r' },
      { file: 'b.js', call: 'fetch(y)', reason: '  ' },
      { file: 'a.js', call: 'fetch(y)', reason: 'ok' },
    ];
    const f = validateCallList(list, files);
    expect(f.map((x) => x.detail.split(':')[0])).toEqual([
      'matches no call',
      'file pattern matches 2 files',
      'matches 2 calls',
      'empty reason',
    ]);
  });
});

describe('occurrence index', () => {
  const text = 'fetch(x);fetch(y);fetch(x);fetch(x)';
  const files: CheckFile[] = [{ path: 'a.js', text }];
  const e = (occurrence?: number) => ({ file: 'a.js', call: 'fetch(x)', reason: 'r', occurrence });

  it('accepts exactly the n-th call', () => {
    for (const n of [1, 2, 3]) {
      const r = scan(files, { callList: [e(n)] });
      expect(r.findings.filter((f) => f.kind === 'js-call')).toHaveLength(3);
    }
    const all = scan(files, { callList: [e(1), e(2), e(3), { file: 'a.js', call: 'fetch(y)', reason: 'r' }] });
    expect(all.ok).toBe(true);
  });

  it('fails an entry whose occurrence is out of range', () => {
    expect(validateCallList([e(4)], files)).toHaveLength(1);
    expect(validateCallList([e(0)], files)).toHaveLength(1);
  });

  it('accepts two entries with distinct occurrences', () => {
    expect(validateCallList([e(1), e(3)], files)).toEqual([]);
  });

  it('fails an entry with no occurrence on a repeated call', () => {
    const f = validateCallList([e()], files);
    expect(f).toHaveLength(1);
    expect(f[0]?.detail).toMatch(/^matches 3 calls/);
    const r = scan(files, { callList: [e()] });
    expect(r.findings.filter((x) => x.kind === 'js-call').map((x) => x.detail)).toContain('fetch(x)');
  });

  it('numbers calls across script bodies in an HTML file', () => {
    const html: CheckFile[] = [{ path: 'p.html', text: '<script>fetch(x)</script><script>fetch(x)</script>' }];
    const entry = { file: 'p.html', call: 'fetch(x)', reason: 'r' };
    expect(scan(html, { callList: [{ ...entry, occurrence: 1 }, { ...entry, occurrence: 2 }] }).ok).toBe(true);
    expect(scan(html, { callList: [{ ...entry, occurrence: 2 }] }).findings.some((f) => f.kind === 'js-call')).toBe(true);
  });
});
