import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { scanBuild } from '../../src/offline/check';
import type { CheckFile } from '../../src/offline/check';

type Kind = 'html' | 'css' | 'js';

const schemeArb = fc.constantFrom('https://', 'http://', '//', 'wss://', 'ws://');
const hostArb = fc.stringMatching(/^[a-z]{3,8}$/);
const pathArb = fc.stringMatching(/^[a-z0-9]{0,8}$/);

// Each injected URL is made unique with its index, so a finding maps to one injection.
const urlsArb = fc.array(fc.tuple(schemeArb, hostArb, pathArb), { maxLength: 6 }).map((parts) =>
  parts.map(([s, h, p], i) => `${s}${h}${i}.example/${p}`),
);

const htmlForms: ((u: string) => string)[] = [
  (u) => `<img src="${u}">`,
  (u) => `<script src="${u}"></script>`,
  (u) => `<link rel="stylesheet" href="${u}">`,
  (u) => `<iframe src="${u}"></iframe>`,
  (u) => `<a href="${u}">out</a>`,
  (u) => `<style>.x{background:url(${u})}</style>`,
  (u) => `<script>var a = "${u}";</script>`,
  (u) => `<div style="background:url('${u}')"></div>`,
];
const cssForms: ((u: string) => string)[] = [
  (u) => `.a{background:url(${u})}`,
  (u) => `.b{background:url("${u}")}`,
  (u) => `@import url('${u}');`,
];
const jsForms: ((u: string) => string)[] = [
  (u) => `const a = "${u}";`,
  (u) => `const b = '${u}';`,
  (u) => `fetch("${u}");`,
  (u) => `new WebSocket('${u}');`,
];

const cleanHtml =
  '<img src="/icon.png"><a href="/listen">Listen</a><link rel="stylesheet" href="/assets/a.css"><script src="/assets/a.js"></script>';
const cleanCss = '.ok{background:url(/assets/i.png)}';
const cleanJs = 'const x = "/assets/i.png"; fetch("/listen"); const y = "plain text";';

const clean: Record<Kind, string> = { html: cleanHtml, css: cleanCss, js: cleanJs };
const ext: Record<Kind, string> = { html: 'html', css: 'css', js: 'js' };
const forms: Record<Kind, ((u: string) => string)[]> = { html: htmlForms, css: cssForms, js: jsForms };

const kindArb = fc.constantFrom<Kind>('html', 'css', 'js');
const pageArb = fc.constantFrom('listen', 'broadcast');

function build(kind: Kind, page: string, urls: string[], picks: number[], base: string): CheckFile {
  const injected = urls.map((u, i) => {
    const f = forms[kind];
    return (f[picks[i % picks.length] % f.length] as (u: string) => string)(u);
  });
  const body = kind === 'html' ? `<html><body>${clean.html}${injected.join('\n')}</body></html>` : [clean[kind], ...injected].join('\n');
  const name = kind === 'html' ? `${page}/index.html` : `assets/${page}.${ext[kind]}`;
  return { path: base + name, text: body };
}

describe('check-app property tests', () => {
  // Feature: offline, Property 10: App pages and their files accept no external URL of any kind
  // **Validates: Requirements 7.1, 7.2, 7.5, 7.6, 7.7, 7.13**
  it('Feature: offline, Property 10: App pages and their files accept no external URL of any kind', () => {
    fc.assert(
      fc.property(
        kindArb,
        pageArb,
        urlsArb,
        fc.array(fc.nat(), { minLength: 1, maxLength: 6 }),
        fc.constantFrom('/', '/dead-air/'),
        (kind, page, urls, picks, base) => {
          const file = build(kind, page, urls, picks, base);
          const result = scanBuild({ files: [file], base, callList: [], allowedUrls: [] });
          expect(result.findings.length).toBe(urls.length);
          expect(result.ok).toBe(urls.length === 0);
          const expectedPath = file.path.slice(base.length);
          for (const u of urls) {
            const hit = result.findings.filter((f) => f.detail === u);
            expect(hit.length).toBe(1);
            expect(hit[0]?.path).toBe(expectedPath);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
