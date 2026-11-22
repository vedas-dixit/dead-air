// Task 17.5: both app pages keep all visible text in data-text.
// Validates: Requirements 5.1, 6.5, 10.11, 10.12, 10.13, 12.8
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_ELEMENT_IDS as BROADCAST_IDS } from '../../src/broadcast/dom/ids';
import { TEXT_KEYS } from '../../src/broadcast/strings.types';
import { ALL_ELEMENT_IDS as LISTEN_IDS } from '../../src/listen/dom/ids';
import logo from '../../src/shared/ui/logo.svg?raw';
import { headerHtml } from '../../src/shared/ui/header';
import { utf8Decode } from '../../src/message-code/utf8';

function readPage(dir: string): string {
  const bytes = new Uint8Array(readFileSync(join(process.cwd(), dir, 'index.html')));
  const text = utf8Decode(bytes);
  if (text === null) throw new Error(`${dir}/index.html is not valid UTF-8`);
  return text;
}

const pages: { name: string; html: string; ids: readonly string[]; labelled: readonly string[] }[] = [
  { name: 'listen', html: readPage('listen'), ids: LISTEN_IDS, labelled: ['level-meter'] },
  { name: 'broadcast', html: readPage('broadcast'), ids: BROADCAST_IDS, labelled: [] },
];

for (const page of pages) {
  describe(`${page.name} markup`, () => {
    const { html } = page;

    it('uses only known TextKey values in data-text', () => {
      const keys = [...html.matchAll(/\sdata-text="([^"]*)"/g)].map((m) => m[1] as string);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect((TEXT_KEYS as readonly string[]).includes(key), key).toBe(true);
      }
    });

    it('contains every id from its ids file exactly once', () => {
      // The build fills the header marker with the shared header, which owns three ids.
      const built = html.replace('<!--look:header-->', headerHtml({ page: page.name as 'listen' | 'broadcast', base: '/', logo }));
      for (const id of page.ids) {
        expect([...built.matchAll(new RegExp(`\\sid="${id}"`, 'g'))].length, id).toBe(1);
      }
    });

    it('has no visible text outside data-text, except static title "Dead Air" and the logo link', () => {
      const titles = [...html.matchAll(/<title\b([^>]*)>([\s\S]*?)<\/title>/g)];
      expect(titles.length).toBe(1);
      const [, attrs, inner] = titles[0] as RegExpMatchArray;
      const staticTitle = (inner as string).trim();
      if (staticTitle !== '') {
        expect(staticTitle).toBe('Dead Air');
        expect(attrs).toMatch(/\sdata-text="(listen\.)?page\.title"/);
      }
      const body = html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<!doctype[^>]*>/gi, '')
        .replace(/<title\b[\s\S]*?<\/title>/g, '')
        .replace(/<script\b[\s\S]*?<\/script>/g, '')
        .replace(/<style\b[\s\S]*?<\/style>/g, '')
        // The one allowed static name: the visually hidden text inside the logo link.
        .replace(/<a\b[^>]*\bclass="app-name"[^>]*>[\s\S]*?<\/a>/, '')
        .replace(/<[^>]*>/g, '');
      expect(body.trim()).toBe('');
    });

    it('has no title attribute', () => {
      expect(html).not.toMatch(/<[a-z][^>]*\stitle\s*=/i);
    });

    it('has aria-label only on the level meter', () => {
      const tags = [...html.matchAll(/<[a-z][^>]*\saria-label\s*=[^>]*>/gi)].map((m) => m[0]);
      expect(tags.length).toBe(page.labelled.length);
      for (const [i, id] of page.labelled.entries()) {
        expect(tags[i]).toContain(`id="${id}"`);
      }
    });

    it('has the language-switch element', () => {
      const built = html.replace('<!--look:header-->', headerHtml({ page: page.name as 'listen' | 'broadcast', base: '/', logo }));
      expect([...built.matchAll(/\sid="language-switch"/g)].length).toBe(1);
    });
  });
}
