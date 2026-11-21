import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { findFontProblems, type FontInput, type FontProblem } from '../../src/shared/ui/font-rules';

// Feature: radio-look, Property 14: The font checker allows one family and rejects the rest
// **Validates: Requirements 12.4, 12.6, 12.10, 16.9, 16.10**

const RANGE = 'U+0000-00FF, U+0131, U+0152-0153';

interface Face {
  family: string;
  weight: string;
  display: string;
  range: string | null;
  src: string;
}

function faceCss(f: Face): string {
  const lines = [
    `font-family: '${f.family}';`,
    'font-style: normal;',
    `font-display: ${f.display};`,
    `font-weight: ${f.weight};`,
    `src: ${f.src};`,
  ];
  if (f.range !== null) lines.push(`unicode-range: ${f.range};`);
  return `@font-face { ${lines.join(' ')} }`;
}

const hash = fc.stringMatching(/^[A-Za-z0-9_-]{4,12}$/);
const host = fc.stringMatching(/^[a-z]{3,10}\.(com|net|org)$/);

const fixture = fc
  .record({
    h400: hash,
    h600: hash,
    cssHash: hash,
    base: fc.constantFrom('/', '/dead-air/', '/a/b/'),
    absolute: fc.boolean(),
  })
  .map(({ h400, h600, cssHash, base, absolute }) => {
    const f400 = `assets/ibm-plex-mono-latin-400-normal-${h400}.woff2`;
    const f600 = `assets/ibm-plex-mono-latin-600-normal-${h600}.woff2`;
    const ref = (file: string): string =>
      absolute ? `url(${base}${file}) format('woff2')` : `url(./${file.slice('assets/'.length)}) format('woff2')`;
    const faces: Face[] = [
      { family: 'IBM Plex Mono', weight: '400', display: 'swap', range: RANGE, src: ref(f400) },
      { family: 'IBM Plex Mono', weight: '600', display: 'swap', range: RANGE, src: ref(f600) },
    ];
    return { faces, files: [f400, f600, `assets/index-${cssHash}.css`], cssPath: `assets/index-${cssHash}.css`, base, ref };
  });

type Fixture = typeof fixture extends fc.Arbitrary<infer T> ? T : never;

function build(fx: Fixture, faces: Face[], extraFiles: string[] = [], files = fx.files): FontInput {
  return {
    files: [...files, ...extraFiles],
    css: [{ path: fx.cssPath, text: faces.map(faceCss).join('\n') }],
    base: fx.base,
  };
}

function rules(problems: FontProblem[]): Set<string> {
  return new Set(problems.map((p) => p.rule));
}

describe('Property 14: the font checker allows one family and rejects the rest', () => {
  it('returns no problems for a valid fixture', () => {
    fc.assert(
      fc.property(fixture, (fx) => {
        expect(findFontProblems(build(fx, fx.faces))).toEqual([]);
      }),
      { numRuns: 100 },
    );
  });

  it('flags a third weight', () => {
    fc.assert(
      fc.property(
        fixture,
        fc.constantFrom('100', '300', '500', '700', '900', 'bold', '400', '600'),
        (fx, weight) => {
          const extra: Face = { ...fx.faces[0]!, weight };
          expect(rules(findFontProblems(build(fx, [...fx.faces, extra])))).toContain('bad-weight');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('flags another family', () => {
    fc.assert(
      fc.property(
        fixture,
        fc.constantFrom(0, 1),
        fc.stringMatching(/^[A-Za-z][A-Za-z0-9 ]{0,20}$/).filter((s) => s !== 'IBM Plex Mono'),
        (fx, i, family) => {
          const faces = fx.faces.map((f, k) => (k === i ? { ...f, family } : f));
          expect(rules(findFontProblems(build(fx, faces)))).toContain('other-family');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('flags a src on another site or starting with //', () => {
    fc.assert(
      fc.property(
        fixture,
        fc.constantFrom(0, 1),
        host,
        fc.constantFrom('https://', 'http://', '//'),
        hash,
        (fx, i, h, prefix, name) => {
          const src = `url(${prefix}${h}/${name}.woff2) format('woff2')`;
          const faces = fx.faces.map((f, k) => (k === i ? { ...f, src } : f));
          expect(rules(findFontProblems(build(fx, faces)))).toContain('other-site');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('flags a font file not in the allowed names', () => {
    fc.assert(
      fc.property(
        fixture,
        hash,
        fc.constantFrom('woff2', 'woff', 'ttf', 'otf'),
        fc.constantFrom('assets/other-', 'assets/ibm-plex-mono-latin-700-normal-', 'fonts/ibm-plex-mono-latin-400-normal-'),
        fc.boolean(),
        (fx, name, ext, stem, referenced) => {
          const file = `${stem}${name}.${ext}`;
          let faces = fx.faces;
          if (referenced) {
            const src = `url(${fx.base}${file}) format('woff2')`;
            faces = fx.faces.map((f, k) => (k === 0 ? { ...f, src } : f));
          }
          const problems = findFontProblems(build(fx, faces, [file]));
          expect(rules(problems)).toContain('font-file-not-allowed');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('flags a missing file', () => {
    fc.assert(
      fc.property(fixture, fc.constantFrom(0, 1), (fx, i) => {
        const gone = fx.files[i]!;
        const files = fx.files.filter((f) => f !== gone);
        expect(rules(findFontProblems(build(fx, fx.faces, [], files)))).toContain('src-missing');
      }),
      { numRuns: 100 },
    );
  });

  it('flags a missing unicode-range', () => {
    fc.assert(
      fc.property(fixture, fc.constantFrom(0, 1), fc.constantFrom<string | null>(null, '', '  '), (fx, i, range) => {
        const faces = fx.faces.map((f, k) => (k === i ? { ...f, range } : f));
        expect(rules(findFontProblems(build(fx, faces)))).toContain('no-unicode-range');
      }),
      { numRuns: 100 },
    );
  });
});
