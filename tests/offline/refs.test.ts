import { describe, expect, it } from 'vitest';
import { IMAGE_EXTENSIONS, extractRefs, kindOf } from '../../src/offline/refs.ts';

const targets = (kind: Parameters<typeof extractRefs>[0], text: string) =>
  extractRefs(kind, text).map((r) => r.target);

describe('kindOf', () => {
  it('maps extensions', () => {
    expect(kindOf('listen/index.html')).toBe('html');
    expect(kindOf('assets/a-1.css')).toBe('css');
    expect(kindOf('assets/a-1.js')).toBe('js');
    expect(kindOf('manifest.webmanifest')).toBe('manifest');
    expect(kindOf('icon.png')).toBe('other');
    expect(kindOf('noext')).toBe('other');
  });
  it('lists image extensions', () => {
    expect(IMAGE_EXTENSIONS).toEqual(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'ico', 'bmp']);
  });
});

describe('extractRefs html', () => {
  it('reads load attributes but not anchors or areas', () => {
    const html = `<!doctype html><link rel="manifest" href="/m.webmanifest">
      <a href="/home.html">x</a><area href="/area.html">
      <script type="module" src="/assets/a.js"></script>
      <img src="/i.png" srcset="/i1.png 1x, /i2.png 2x"><video poster='/p.jpg'></video>
      <!-- <img src="/commented.png"> -->`;
    expect(targets('html', html)).toEqual(['/m.webmanifest', '/assets/a.js', '/i.png', '/i1.png', '/i2.png', '/p.jpg']);
    expect(extractRefs('html', '<img src="/a.png">')[0]).toEqual({ target: '/a.png', kind: 'load', from: 'html-attr' });
  });
  it('reads inline style and script', () => {
    const html = `<style>.a{background:url(/bg.png)}</style><script>import "/x.js"; const p = "./y.css";</script>`;
    const refs = extractRefs('html', html);
    expect(refs).toContainEqual({ target: '/bg.png', kind: 'load', from: 'css' });
    expect(refs).toContainEqual({ target: '/x.js', kind: 'import', from: 'js' });
    expect(refs).toContainEqual({ target: './y.css', kind: 'load', from: 'js' });
  });
});

describe('extractRefs css', () => {
  it('reads url() and @import', () => {
    const css = `@import "a.css"; @import url('b.css'); .x{background:url( "c.png" )} .y{src:url(d.woff2)} /* url(no.png) */`;
    expect(targets('css', css)).toEqual(['b.css', 'c.png', 'd.woff2', 'a.css']);
  });
});

describe('extractRefs js', () => {
  it('separates imports from loads', () => {
    const js = `import a from "./a.js"; export * from './b.js'; import "./c.js"; const m = import("./d.js");
      const u = "/assets/e.wasm"; const w = "sound.mp3"; const s = "hello world"; // "./nope.js"
      const r = /["']/g; const t = "../f.json";`;
    const refs = extractRefs('js', js);
    const imports = refs.filter((r) => r.kind === 'import').map((r) => r.target);
    const loads = refs.filter((r) => r.kind === 'load').map((r) => r.target);
    expect(imports).toEqual(['./a.js', './b.js', './c.js', './d.js']);
    expect(loads).toEqual(['/assets/e.wasm', 'sound.mp3', '../f.json']);
  });
});

describe('extractRefs manifest', () => {
  it('reads icon sources', () => {
    const m = JSON.stringify({ icons: [{ src: '/i/192.png' }, { src: '/i/512.png' }, {}] });
    expect(extractRefs('manifest', m)).toEqual([
      { target: '/i/192.png', kind: 'load', from: 'manifest' },
      { target: '/i/512.png', kind: 'load', from: 'manifest' },
    ]);
  });
  it('gives nothing for invalid JSON and other kinds', () => {
    expect(extractRefs('manifest', '{nope')).toEqual([]);
    expect(extractRefs('other', 'url(a.png)')).toEqual([]);
  });
});
