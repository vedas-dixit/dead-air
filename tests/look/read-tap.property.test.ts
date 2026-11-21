// Property 16: read aloud starts only from the button.
// Feature: radio-look, Property 16
// **Validates: Requirements 20.1, 20.2, 20.3, 20.4, 20.5**
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { readButtonKey } from '../../src/listen/dom/read-tap';

// Fake nodes with the structure buildCardElement makes:
// article > div.card-voice[data-read=key] > button/help/missing/error [data-part], plus other card parts.
class FakeNode {
  attrs: Record<string, string> = {};
  children: FakeNode[] = [];
  parent: FakeNode | null = null;
  constructor(readonly tag: string, attrs: Record<string, string> = {}) {
    this.attrs = attrs;
  }
  add(c: FakeNode): FakeNode {
    c.parent = this;
    this.children.push(c);
    return c;
  }
  getAttribute(k: string): string | null {
    return k in this.attrs ? this.attrs[k]! : null;
  }
  private matches(sel: string): boolean {
    const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(sel);
    if (m === null) throw new Error(`Unsupported selector: ${sel}`);
    const v = this.attrs[m[1]!];
    return v !== undefined && (m[2] === undefined || v === m[2]);
  }
  closest(sel: string): FakeNode | null {
    for (let n: FakeNode | null = this; n !== null; n = n.parent) if (n.matches(sel)) return n;
    return null;
  }
}

function buildCard(key: string) {
  const article = new FakeNode('article', { 'data-key': key });
  const banner = article.add(new FakeNode('div'));
  const head = article.add(new FakeNode('div'));
  const icon = head.add(new FakeNode('span'));
  const name = head.add(new FakeNode('span'));
  const sentence = article.add(new FakeNode('div'));
  const voice = article.add(new FakeNode('div', { 'data-read': key }));
  const button = voice.add(new FakeNode('button', { 'data-part': 'button' }));
  const buttonChild = button.add(new FakeNode('span'));
  const help = voice.add(new FakeNode('p', { 'data-part': 'help' }));
  const missing = voice.add(new FakeNode('p', { 'data-part': 'missing' }));
  const error = voice.add(new FakeNode('p', { 'data-part': 'error' }));
  return { article, banner, icon, name, sentence, voice, button, buttonChild, help, missing, error };
}

const keyArb = fc.string({ minLength: 1, maxLength: 20 });

describe('Property 16: read aloud starts only from the button', () => {
  it('the button and a child of the button give the card key', () => {
    fc.assert(
      fc.property(keyArb, (key) => {
        const c = buildCard(key);
        expect(readButtonKey(c.button)).toBe(key);
        expect(readButtonKey(c.buttonChild)).toBe(key);
      }),
      { numRuns: 100 },
    );
  });

  it('each Voice_Note, the [data-read] block and every other card part give null', () => {
    fc.assert(
      fc.property(keyArb, (key) => {
        const c = buildCard(key);
        for (const n of [c.help, c.missing, c.error, c.voice, c.banner, c.icon, c.name, c.sentence, c.article]) {
          expect(readButtonKey(n)).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('a null or non-element target gives null, and a button outside a [data-read] block gives null', () => {
    expect(readButtonKey(null)).toBeNull();
    expect(readButtonKey(undefined)).toBeNull();
    expect(readButtonKey({})).toBeNull();
    const loose = new FakeNode('button', { 'data-part': 'button' });
    expect(readButtonKey(loose)).toBeNull();
  });

  it('a card with a data-key but a different data-read still reads the data-read value only', () => {
    const c = buildCard('a');
    c.voice.attrs['data-read'] = 'b';
    expect(readButtonKey(c.button)).toBe('b');
  });
});
