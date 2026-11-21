import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { scanBuild } from '../../src/offline/check.ts';
import type { CheckFile } from '../../src/offline/check.ts';

// Feature: offline, Property 11: The Front_Page allows links and refuses loads
// **Validates: Requirements 7.3, 7.4, 7.5, 7.6, 7.14, 7.15**

type LoadKind =
  | 'img'
  | 'script'
  | 'stylesheet'
  | 'preload'
  | 'prefetch'
  | 'manifest'
  | 'iframe'
  | 'audio'
  | 'video'
  | 'css-import'
  | 'css-url'
  | 'js-import'
  | 'meta-refresh';

const LOAD_KINDS: LoadKind[] = [
  'img',
  'script',
  'stylesheet',
  'preload',
  'prefetch',
  'manifest',
  'iframe',
  'audio',
  'video',
  'css-import',
  'css-url',
  'js-import',
  'meta-refresh',
];

const urlArb = fc
  .record({
    scheme: fc.constantFrom('https://', 'http://', '//'),
    host: fc.stringMatching(/^[a-z]{3,8}$/),
    path: fc.stringMatching(/^[a-z0-9]{0,8}$/),
  })
  .map((u) => `${u.scheme}${u.host}.test/${u.path}`);

const loadsArb = fc.array(fc.record({ kind: fc.constantFrom(...LOAD_KINDS), url: urlArb }), { maxLength: 12 });
const linksArb = fc.array(fc.record({ tag: fc.constantFrom('a', 'area'), url: urlArb }), { maxLength: 12 });
const metaArb = fc.array(
  fc.record({ name: fc.constantFrom('description', 'theme-color', 'author'), url: urlArb }),
  { maxLength: 4 },
);

type Load = { kind: LoadKind; url: string };
type Link = { tag: string; url: string };

function linkHtml(links: Link[]): string {
  return links
    .map((l) => (l.tag === 'a' ? `<a href="${l.url}">x</a>` : `<area href="${l.url}">`))
    .join('\n');
}

function buildFront(loads: Load[], links: Link[], metas: { name: string; url: string }[]): CheckFile[] {
  const html: string[] = [];
  const css: string[] = [];
  const js: string[] = [];
  loads.forEach((l, i) => {
    switch (l.kind) {
      case 'img':
        html.push(`<img src="${l.url}">`);
        break;
      case 'script':
        html.push(`<script src="${l.url}"></script>`);
        break;
      case 'stylesheet':
      case 'preload':
      case 'prefetch':
      case 'manifest':
        html.push(`<link rel="${l.kind}" href="${l.url}">`);
        break;
      case 'iframe':
        html.push(`<iframe src="${l.url}"></iframe>`);
        break;
      case 'audio':
      case 'video':
        html.push(`<${l.kind} src="${l.url}"></${l.kind}>`);
        break;
      case 'css-import':
        css.push(`@import "${l.url}";`);
        break;
      case 'css-url':
        css.push(`.c${i}{background:url(${l.url})}`);
        break;
      case 'js-import':
        js.push(`import m${i} from "${l.url}";`);
        break;
      case 'meta-refresh':
        html.push(`<meta http-equiv="refresh" content="5; url=${l.url}">`);
        break;
    }
  });
  const files: CheckFile[] = [
    {
      path: 'index.html',
      text: [
        '<!doctype html><html><head>',
        ...metas.map((m) => `<meta name="${m.name}" content="${m.url}">`),
        '</head><body>',
        linkHtml(links),
        ...html,
        '</body></html>',
      ].join('\n'),
    },
  ];
  if (css.length > 0) files.push({ path: 'assets/front.css', text: css.join('\n') });
  if (js.length > 0) files.push({ path: 'assets/front.js', text: js.join('\n') });
  return files;
}

const run = (files: CheckFile[], base = '/') => scanBuild({ files, base, callList: [], allowedUrls: [] });

describe('Property 11: The Front_Page allows links and refuses loads', () => {
  it('links and plain meta content on the Front_Page give zero findings', () => {
    fc.assert(
      fc.property(linksArb, metaArb, (links, metas) => {
        expect(run(buildFront([], links, metas)).findings).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it('N external loads give exactly N findings, with or without links', () => {
    fc.assert(
      fc.property(loadsArb, linksArb, metaArb, (loads, links, metas) => {
        expect(run(buildFront(loads, [], [])).findings).toHaveLength(loads.length);
        expect(run(buildFront(loads, links, metas)).findings).toHaveLength(loads.length);
      }),
      { numRuns: 100 },
    );
  });

  it('works under a sub-path base', () => {
    fc.assert(
      fc.property(loadsArb, linksArb, (loads, links) => {
        const files = buildFront(loads, links, []).map((f) => ({ ...f, path: `/repo/${f.path}` }));
        expect(run(files, '/repo/').findings).toHaveLength(loads.length);
      }),
      { numRuns: 100 },
    );
  });

  it('the same links in an app page give one html-link finding each', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('listen/index.html', 'broadcast/index.html'),
        linksArb,
        (path, links) => {
          const r = run([{ path, text: `<body>${linkHtml(links)}</body>` }]);
          expect(r.findings).toHaveLength(links.length);
          expect(r.findings.every((f) => f.kind === 'html-link' && f.path === path)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
