import { describe, expect, it } from 'vitest';
import { buildManifest, manifestText, registrationPlan } from '../../src/offline/index.ts';

describe('registrationPlan', () => {
  it('uses the base for script and scope', () => {
    expect(registrationPlan('/')).toEqual({ scriptUrl: '/sw.js', scope: '/', updateViaCache: 'none' });
    expect(registrationPlan('/repo/')).toEqual({ scriptUrl: '/repo/sw.js', scope: '/repo/', updateViaCache: 'none' });
  });
  it('returns null for a bad base', () => {
    for (const b of ['', 'repo', '/repo', '//', '/a//b/']) expect(registrationPlan(b)).toBeNull();
  });
});

describe('buildManifest', () => {
  it('builds paths from the base', () => {
    for (const base of ['/', '/repo/']) {
      const m = buildManifest(base);
      expect(m.name).toBe('Dead Air');
      expect(m.short_name).toBe('Dead Air');
      expect(m.start_url).toBe(base + 'listen/');
      expect(m.scope).toBe(base);
      expect(m.display).toBe('standalone');
      expect(m.background_color).toBe('#000000');
      expect(m.theme_color).toBe('#000000');
      expect(m.icons.map((i) => [i.src, i.sizes])).toEqual([
        [base + 'icons/icon-192.png', '192x192'],
        [base + 'icons/icon-512.png', '512x512'],
      ]);
    }
  });
  it('text is 2-space JSON with a trailing newline', () => {
    const m = buildManifest('/');
    const t = manifestText(m);
    expect(t.endsWith('}\n')).toBe(true);
    expect(t).toContain('\n  "name": "Dead Air"');
    expect(JSON.parse(t)).toEqual(m);
  });
});
