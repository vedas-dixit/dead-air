// Validates: Requirements 1.1, 1.4, 1.5, 1.10, 2.3, 2.4, 6.4, 6.8, 9.5, 9.7, 9.8
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const noComments = html.replace(/<!--[\s\S]*?-->/g, '');

const count = (re: RegExp): number => (noComments.match(re) ?? []).length;
const tags = (name: string): string[] =>
  noComments.match(new RegExp(`<${name}\\b[^>]*>`, 'gi')) ?? [];
const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(tag);
  return m ? (m[2] ?? m[3] ?? '') : null;
};
const isOtherOrigin = (url: string): boolean => {
  const u = url.trim();
  return /^[a-z][a-z0-9+.-]*:/i.test(u) && !/^(data|blob):/i.test(u)
    ? true
    : u.startsWith('//');
};

describe('front page markup', () => {
  it('has one h1 and six h2', () => {
    expect(count(/<h1\b/gi)).toBe(1);
    expect(count(/<h2\b/gi)).toBe(6);
  });

  it('has sections s1 to s8 in order', () => {
    const ids = tags('section')
      .map((t) => attr(t, 'id'))
      .filter((id): id is string => id !== null && /^s\d+$/.test(id));
    expect(ids).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']);
  });

  it('has no "Kiro:" text', () => {
    const text = noComments.replace(/<[^>]*>/g, ' ');
    expect(text).not.toMatch(/Kiro\s*:/i);
  });

  it('has no emoji', () => {
    expect(noComments).not.toMatch(/\p{Extended_Pictographic}|\u{FE0F}|\u{200D}/u);
  });

  it('#dies holds only "dies" and has no style or class', () => {
    const m = /<span\b([^>]*\sid="dies"[^>]*)>([\s\S]*?)<\/span>/i.exec(noComments);
    expect(m).not.toBeNull();
    const tag = `<span ${m![1]}>`;
    expect(m![2]).toBe('dies');
    expect(attr(tag, 'style')).toBeNull();
    expect(attr(tag, 'class')).toBeNull();
  });

  it('every img has width, height, alt and data-alt', () => {
    const imgs = tags('img');
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(Number(attr(img, 'width'))).toBeGreaterThan(0);
      expect(Number(attr(img, 'height'))).toBeGreaterThan(0);
      expect((attr(img, 'alt') ?? '').trim()).not.toBe('');
      expect((attr(img, 'data-alt') ?? '').trim()).not.toBe('');
    }
  });

  it('loads nothing from another origin', () => {
    const urls: string[] = [];
    for (const name of ['img', 'script', 'source', 'iframe', 'audio', 'video']) {
      for (const t of tags(name)) {
        const v = attr(t, 'src');
        if (v !== null) urls.push(v);
        const set = attr(t, 'srcset');
        if (set !== null) for (const part of set.split(',')) urls.push(part.trim().split(/\s+/)[0] ?? '');
      }
    }
    for (const t of tags('link')) {
      const v = attr(t, 'href');
      if (v !== null) urls.push(v);
    }
    for (const m of noComments.matchAll(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi)) urls.push(m[2] ?? '');
    for (const m of noComments.matchAll(/@import\s+(?:url\(\s*)?['"]?([^'")\s;]+)/gi)) urls.push(m[1] ?? '');
    expect(urls.filter(isOtherOrigin)).toEqual([]);
  });

  it('off-site links use https', () => {
    const hrefs = tags('a')
      .map((t) => attr(t, 'href'))
      .filter((h): h is string => h !== null && isOtherOrigin(h) && !/^(mailto|tel):/i.test(h));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const h of hrefs) expect(h.startsWith('https://')).toBe(true);
  });
});
