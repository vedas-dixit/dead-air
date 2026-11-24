// Spec front-sprout. Checks the anchor markup in index.html.
// Validates: Requirements 1.3, 1.4, 5.3, 6.1
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '../..');
const html = readFileSync(join(root, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const main = readFileSync(join(root, 'src/front/main.ts'), 'utf8');
/** The anchor as the guide writes it. `data-sprout-letter` is optional. */
const ANCHOR = /<span class="sprout-host"><span class="sprout" data-sprout(?: data-sprout-letter="\d+")? aria-hidden="true"><\/span>/g;

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

/** Open elements at each anchor, outermost first: [tag, attributes]. */
function ancestorsOfAnchors(text: string): Array<Array<[string, string]>> {
  const stack: Array<[string, string]> = [];
  const found: Array<Array<[string, string]>> = [];
  const tag = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  for (let m = tag.exec(text); m !== null; m = tag.exec(text)) {
    const [, close, name, attrs, self] = m as unknown as [string, string, string, string, string];
    const lower = name.toLowerCase();
    if (close) {
      while (stack.length > 0 && stack.pop()![0] !== lower) {
        /* closes anything left open inside */
      }
      continue;
    }
    if (/\bdata-sprout(?:\s|$)/.test(attrs)) found.push([...stack]);
    if (self || VOID.has(lower)) continue;
    stack.push([lower, attrs]);
  }
  return found;
}

describe('sprout anchors in index.html', () => {
  const mentions = html.match(/\bdata-sprout\b(?!-)/g) ?? [];
  const anchors = [...html.matchAll(ANCHOR)];

  it('has at least one anchor, and every anchor is written exactly as the guide gives it, first in its host', () => {
    expect(anchors.length).toBeGreaterThan(0);
    expect(anchors.length).toBe(mentions.length);
  });

  it('puts the word straight after each anchor, with no space or line break between', () => {
    for (const a of anchors) {
      const after = html.slice(a.index! + a[0].length);
      expect(after[0]).not.toMatch(/\s/);
      expect(after.startsWith('</span>')).toBe(false);
    }
  });

  it('never puts an anchor inside an element whose text a language switch replaces', () => {
    const stacks = ancestorsOfAnchors(html);
    expect(stacks.length).toBe(anchors.length);
    for (const stack of stacks) {
      for (const [name, attrs] of stack) expect(`${name} ${attrs}`).not.toMatch(/\bdata-text=/);
    }
  });

  it('is mounted, and its stylesheet loaded, by the front page script', () => {
    expect(main).toMatch(/import\s+'\.\/sprout\.css';/);
    expect(main).toMatch(/import\s+\{\s*mountSprouts\s*\}\s+from\s+'\.\/dom\/sprout';/);
    expect(main).toMatch(/mountSprouts\(document\);/);
  });
});
