import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stringsEn } from '../../src/broadcast/strings.en';
import { TESTED_PARAMS } from '../../src/front/dom/bind-text';
import { stringsHi } from '../../src/languages/strings.hi';
import { fillTemplate } from '../../src/shared/fill';

// Requirements 1.7, 9.4
const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');

const en = stringsEn.text as Readonly<Record<string, string>>;
const hi = stringsHi.text as Readonly<Record<string, string>>;

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

const textElements: { key: string; text: string }[] = [];
for (const m of html.matchAll(/<(\w+)\b([^>]*?)\bdata-text="([^"]+)"([^>]*)>([^<]*)<\/\1>/g)) {
  textElements.push({ key: m[3], text: decode(m[5]) });
}
const altKeys = Array.from(html.matchAll(/\bdata-alt="([^"]+)"/g), (m) => m[1]);
const allKeys = [...new Set([...textElements.map((e) => e.key), ...altKeys])];

const names = (s: string): string[] =>
  Array.from(s.matchAll(/\{(\w+)\}/g), (m) => m[1]).sort();

describe('front page strings', () => {
  it('finds the keys in index.html', () => {
    expect(textElements.length).toBeGreaterThan(40);
    expect(altKeys.length).toBe(4);
  });

  it('every data-text and data-alt key exists in English and Hindi', () => {
    for (const key of allKeys) {
      expect(typeof en[key], `en ${key}`).toBe('string');
      expect(typeof hi[key], `hi ${key}`).toBe('string');
    }
  });

  it('has no empty Hindi value for a used key', () => {
    for (const key of allKeys) {
      expect(hi[key].trim().length, `hi ${key}`).toBeGreaterThan(0);
    }
  });

  it('placeholders match between English and Hindi', () => {
    for (const key of allKeys) {
      expect(names(hi[key]), key).toEqual(names(en[key]));
    }
  });

  it('English default text in the HTML equals stringsEn', () => {
    for (const { key, text } of textElements) {
      const template = en[key];
      if (template === undefined) continue;
      const params = TESTED_PARAMS[key];
      const expected = params ? fillTemplate(template, params) : template;
      expect(text, key).toBe(expected);
    }
  });
});
