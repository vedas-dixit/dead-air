import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildFileList } from '../../src/offline/file-list.ts';
import { baseArb } from './generators.ts';
import { cleanBuildArb, fileListInput } from './generators-build.ts';
import type { OutputFile } from './generators-build.ts';

// Feature: offline, Property 7: Front_Page_Image is decided by reference, not by name
// **Validates: Requirements 1.6, 1.7, 8.2, 9.3**

const RUNS = { numRuns: 100 };

describe('Feature: offline, Property 7: Front_Page_Image is decided by reference, not by name', () => {
  it('generated builds: front-only images are excluded, images reached by an app root stay in', () => {
    fc.assert(
      fc.property(cleanBuildArb, (c) => {
        const r = buildFileList(fileListInput(c));
        expect(r.frontImages).toEqual(c.expectedFrontImages);
        expect(r.files).toEqual(c.expectedFiles);
        for (const p of c.expectedFrontImages) expect(r.files).not.toContain(p);
        for (const p of c.appImages) {
          expect(r.files).toContain(p);
          expect(r.frontImages).not.toContain(p);
        }
      }),
      RUNS,
    );
  });

  // Hand-built case with random image names, including names that look like app icons or photo folders.
  const folderArb = fc.array(fc.stringMatching(/^[a-z0-9-]{1,8}$/), { maxLength: 2 });
  const nameArb = fc.oneof(
    fc.stringMatching(/^[a-z0-9-]{1,8}$/),
    fc.constantFrom('icon-192', 'icon-512', 'photos', 'cover', 'favicon', 'apple-touch-icon'),
  );
  const extArb = fc.constantFrom('png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp', 'PNG');
  const imagePathArb = fc
    .record({ folder: folderArb, name: nameArb, ext: extArb })
    .map(({ folder, name, ext }) => [...folder, `${name}.${ext}`].join('/'))
    // Keep clear of paths the fixture itself uses.
    .filter((p) => !['index.html', 'listen/index.html', 'manifest.webmanifest', 'app.js'].includes(p) && p !== 'icons/real.png');

  type Where = 'none' | 'app-page' | 'manifest' | 'app-js';

  const build = (base: string, image: string, where: Where): OutputFile[] => {
    const abs = (p: string): string => base + p;
    const text = (path: string, t: string): OutputFile => ({ path, size: t.length, hash: 'h' + path, text: t });
    const bin = (path: string): OutputFile => ({ path, size: 10, hash: 'h' + path });
    const appImg = where === 'app-page' ? `<img src="${abs(image)}" alt="">` : '';
    const manifestIcons = [{ src: abs('icons/real.png'), sizes: '192x192', type: 'image/png' }];
    if (where === 'manifest') manifestIcons.push({ src: abs(image), sizes: '512x512', type: 'image/png' });
    return [
      text('index.html', `<!doctype html><html><head><link rel="manifest" href="${abs('manifest.webmanifest')}"></head><body><img src="${abs(image)}" alt=""><a href="${abs('listen/')}">Listen</a></body></html>`),
      text('listen/index.html', `<!doctype html><html><head><link rel="manifest" href="${abs('manifest.webmanifest')}"><script type="module" src="${abs('app.js')}"></script></head><body>${appImg}</body></html>`),
      text('broadcast/index.html', `<!doctype html><html><head><script type="module" src="${abs('app.js')}"></script></head><body></body></html>`),
      text('app.js', where === 'app-js' ? `const u = "${abs(image)}";\n` : 'export const a = 1;\n'),
      text('manifest.webmanifest', JSON.stringify({ name: 'Dead Air', icons: manifestIcons })),
      bin('icons/real.png'),
      bin(image),
    ];
  };

  const whereArb = fc.constantFrom<Where>('none', 'app-page', 'manifest', 'app-js');

  it('any image name or folder: listed in frontImages only when no app root reaches it', () => {
    fc.assert(
      fc.property(baseArb, imagePathArb, whereArb, (base, image, where) => {
        const files = build(base, image, where);
        const r = buildFileList({
          base,
          files,
          appRoots: ['listen/index.html', 'broadcast/index.html', 'manifest.webmanifest'],
          frontRoots: ['index.html'],
          excludedPaths: ['sw.js', 'offline-files.json'],
          excludedPrefixes: ['sound-test/'],
          excludedSuffixes: ['.map'],
        });
        expect(r.missing).toEqual([]);
        if (where === 'none') {
          expect(r.frontImages).toEqual([image]);
          expect(r.files).not.toContain(image);
        } else {
          expect(r.frontImages).toEqual([]);
          expect(r.files).toContain(image);
        }
        // The real icon is reached by the manifest, so it always stays in.
        expect(r.files).toContain('icons/real.png');
      }),
      RUNS,
    );
  });

  it('a front-only image keeps the outcome when moved or renamed to another image path', () => {
    fc.assert(
      fc.property(baseArb, imagePathArb, imagePathArb, (base, a, b) => {
        const run = (image: string) =>
          buildFileList({
            base,
            files: build(base, image, 'none'),
            appRoots: ['listen/index.html', 'broadcast/index.html', 'manifest.webmanifest'],
            frontRoots: ['index.html'],
            excludedPaths: [],
            excludedPrefixes: [],
            excludedSuffixes: [],
          });
        const ra = run(a);
        const rb = run(b);
        expect(ra.frontImages).toEqual([a]);
        expect(rb.frontImages).toEqual([b]);
        expect(ra.files).toEqual(rb.files);
      }),
      RUNS,
    );
  });
});
