// The arrival flash layer must never take a tap. The rule lives in look.css, not inline.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
const CSS_PATH = join(__dirname, '../../src/shared/ui/look.css');
/** True when a rule for the visible flash layer sets `pointer-events: none`. */
export function flashLayerIgnoresTaps(css: string): boolean {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1].split(',').map((s) => s.trim());
    if (selectors.includes(".arrival-flash[data-on='true']") || selectors.includes('.arrival-flash')) {
      if (/pointer-events\s*:\s*none\b/.test(m[2])) return true;
    }
  }
  return false;
}
describe('arrival flash layer takes no taps', () => {
  const css = readFileSync(CSS_PATH, 'utf8');
  it('look.css sets pointer-events: none on the flash layer', () => {
    expect(flashLayerIgnoresTaps(css)).toBe(true);
  });
  it('the check fails when the declaration is removed', () => {
    const mutated = css.replace(/pointer-events:\s*none;/g, '');
    expect(mutated).not.toBe(css);
    expect(flashLayerIgnoresTaps(mutated)).toBe(false);
  });
});
