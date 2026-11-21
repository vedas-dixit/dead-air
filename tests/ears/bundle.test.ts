// Task 11.4 (replaces the spike test): the single-file bundle runs ggwave and the --call mode.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildBundle } from './bundle';
import type { BuiltBundle } from './bundle';
import { makeTempDir, removeDir } from './helpers';
import { SAMPLE_ALERT } from '../../tools/ears/handlers';

describe('ears bundle', () => {
  let built: BuiltBundle;
  let out: string;
  beforeAll(() => {
    built = buildBundle('cli');
    out = makeTempDir();
  }, 180000);
  afterAll(() => removeDir(out));

  const run = (tool: string, args: unknown) =>
    spawnSync(process.execPath, [built.path, '--call', tool, JSON.stringify(args)], {
      encoding: 'utf8',
      timeout: 60000,
      env: { ...process.env, EARS_OUT_DIR: out },
    });

  it('builds', () => {
    expect(built.status, built.output).toBe(0);
  });

  it('make_broadcast then hear_wav decode the sample alert from the single file', () => {
    const made = run('make_broadcast', { alert: SAMPLE_ALERT });
    expect(made.status, made.stderr).toBe(0);
    const path = /wrote (.+\.wav)/.exec(made.stdout)?.[1];
    expect(path).toBeDefined();
    const heard = run('hear_wav', { path });
    expect(heard.status, heard.stderr).toBe(0);
    expect(heard.stdout).toContain('2 payload(s) heard');
    expect(heard.stdout).toContain('check passed');
    expect(heard.stdout).toContain('TEST flag: true');
  });

  it('a rejected alert exits with 1 and names the reason', () => {
    const r = run('make_broadcast', { alert: { ...SAMPLE_ALERT, test: false } });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('not-a-test-alert');
  });

  it('imports no ggwave or SDK package at run time', () => {
    const text = readFileSync(built.path, 'utf8');
    expect(text).not.toMatch(/^\s*import\b[^;\n]*\bfrom\s+["']ggwave["']/m);
    expect(text).not.toMatch(/^\s*import\b[^;\n]*\bfrom\s+["']@modelcontextprotocol/m);
  });
});
