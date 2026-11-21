import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALLOWED_URLS, LOADER_CALL_LIST } from '../../src/offline/allow-list.ts';

const text = readFileSync('.kiro/specs/offline/report.md', 'utf8');

/** Split the report into sections that start with the given heading prefix. */
function sections(prefix: string): string[] {
  const parts = text.split(/^(?=#{2,3} )/m);
  return parts.filter((p) => p.startsWith(prefix));
}

function field(body: string, name: string): string | undefined {
  const m = new RegExp(`^${name}:[ \\t]*(.*)$`, 'm').exec(body);
  return m ? m[1]!.trim() : undefined;
}

describe('real-device report', () => {
  it('has exactly one entry for each of the eight checks', () => {
    for (let n = 1; n <= 8; n++) {
      expect(sections(`## Check ${n}:`), `check ${n}`).toHaveLength(1);
    }
    expect(sections('## Check ')).toHaveLength(8);
  });

  it('gives every check a valid Result, Date, Device and Browser', () => {
    for (let n = 1; n <= 8; n++) {
      const body = sections(`## Check ${n}:`)[0]!;
      expect(['pass', 'fail', 'not run on a real device']).toContain(field(body, 'Result'));
      const date = field(body, 'Date') ?? '';
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const d = new Date(`${date}T00:00:00Z`);
      expect(Number.isNaN(d.getTime())).toBe(false);
      expect(d.toISOString().slice(0, 10)).toBe(date);
      expect(field(body, 'Device') ?? '').not.toBe('');
      expect(field(body, 'Browser') ?? '').not.toBe('');
    }
  });

  it('gives every failed check observed and expected behaviour', () => {
    for (let n = 1; n <= 8; n++) {
      const body = sections(`## Check ${n}:`)[0]!;
      if (field(body, 'Result') === 'fail') {
        expect(field(body, 'Observed') ?? '', `check ${n} observed`).not.toBe('');
        expect(field(body, 'Expected') ?? '', `check ${n} expected`).not.toBe('');
      }
    }
  });

  it('lists every LOADER_CALL_LIST entry with file, call, occurrence and reason', () => {
    const entries = sections('### Loader call ');
    expect(entries).toHaveLength(LOADER_CALL_LIST.length);
    LOADER_CALL_LIST.forEach((e, i) => {
      const body = sections(`### Loader call ${i + 1}`)[0]!;
      expect(body, `loader call ${i + 1}`).toBeDefined();
      expect(field(body, 'File')).toBe(e.file);
      expect(field(body, 'Call')).toBe(e.call);
      expect(field(body, 'Occurrence')).toBe(e.occurrence === undefined ? 'none' : String(e.occurrence));
      expect(e.reason).not.toBe('');
      expect(field(body, 'Reason')).toBe(e.reason);
    });
  });

  it('lists every ALLOWED_URLS entry with its reason', () => {
    expect(text).toContain('## ALLOWED_URLS');
    for (const e of ALLOWED_URLS) {
      expect(text).toContain(e.url);
      expect(e.reason).not.toBe('');
      expect(text).toContain(e.reason);
    }
    if (ALLOWED_URLS.length === 0) expect(text).toMatch(/0 entries/);
  });
});
