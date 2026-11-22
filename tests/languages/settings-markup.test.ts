// Task 17.5: order of the language switch, cards and alert settings on /listen.
// Validates: Requirements 6.7, 10.11, 12.8
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import logo from '../../src/shared/ui/logo.svg?raw';
import { headerHtml } from '../../src/shared/ui/header';
import { utf8Decode } from '../../src/message-code/utf8';

const bytes = new Uint8Array(readFileSync(join(process.cwd(), 'listen', 'index.html')));
// The build fills the header marker; the language switch comes from the shared header.
const html = (utf8Decode(bytes) ?? '').replace('<!--look:header-->', headerHtml({ page: 'listen', base: '/', logo }));

function indexOfId(id: string): number {
  return html.search(new RegExp(`\\sid="${id}"`));
}

describe('listen settings markup', () => {
  it('reads as UTF-8', () => {
    expect(html.length).toBeGreaterThan(0);
  });

  it('puts the language switch before the cards', () => {
    expect(indexOfId('language-switch')).toBeGreaterThan(-1);
    expect(indexOfId('language-switch')).toBeLessThan(indexOfId('cards'));
  });

  it('puts the alert-settings fieldset after the cards', () => {
    expect(indexOfId('alert-settings')).toBeGreaterThan(indexOfId('cards'));
    expect(html).toMatch(/<fieldset\b[^>]*\sid="alert-settings"/);
  });

  it('keeps the language switch outside the fieldset', () => {
    const start = indexOfId('alert-settings');
    const end = html.indexOf('</fieldset>', start);
    const sw = indexOfId('language-switch');
    expect(end).toBeGreaterThan(start);
    expect(sw < start || sw > end).toBe(true);
  });
});
