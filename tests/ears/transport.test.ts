// Tasks 11.5 and 11.6. Property 21, static scans, tool list, and the child-process protocol test.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fc from 'fast-check';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SAMPLE_ALERT } from '../../tools/ears/handlers';
import { TOOLS, callTool, mapThrown } from '../../tools/ears/transport';
import { prepareAlert } from '../../tools/ears/alert-input';
import { buildBundle } from './bundle';
import type { BuiltBundle } from './bundle';
import { listDir, makeTempDir, removeDir } from './helpers';

describe('error mapping', () => {
  // Feature: kiro-ears, Property 21: Handler failures become short error results
  it('Property 21: any thrown value gives a short one-line error result', () => {
    const thrown = fc.oneof(
      fc.string({ maxLength: 800 }).map((m) => Object.assign(new Error(m), { stack: `Error: ${m}\n    at x (file.ts:1:1)\n    at y (file.ts:2:2)` })),
      fc.string({ maxLength: 800 }),
      fc.integer(),
      fc.constant({ a: 1 }),
      fc.constant(null),
      fc.constant(undefined),
    );
    fc.assert(
      fc.property(thrown, (t) => {
        const r = mapThrown(t);
        expect(r.isError).toBe(true);
        expect(r.content.length).toBe(1);
        const text = r.content[0]!.text;
        expect(text.length).toBeLessThanOrEqual(200);
        expect(text).not.toMatch(/[\r\n]/);
        expect(text).not.toContain('    at ');
        expect(text.startsWith('internal-error')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('a handler that throws becomes an error result and an unknown tool throws', async () => {
    const boom = { makeBroadcast: async () => { throw new Error('x\ny'); }, hearWav: async () => { throw new Error('z'); }, roundTrip: async () => { throw 5; } };
    for (const name of ['make_broadcast', 'hear_wav', 'round_trip']) {
      const r = await callTool(boom, name, {});
      expect(r.isError).toBe(true);
    }
    await expect(callTool(boom, 'nope', {})).rejects.toThrow('Unknown tool: nope');
  });
});

describe('static checks', () => {
  const files = readdirSync('tools/ears').filter((n) => n.endsWith('.ts') && n !== 'vite.config.ts');
  it('the MCP SDK is imported only in transport.ts', () => {
    for (const n of files) {
      const text = readFileSync(join('tools/ears', n), 'utf8');
      const imports = /from\s+['"]@modelcontextprotocol/.test(text);
      expect(imports, n).toBe(n === 'transport.ts');
    }
  });
  it('src/message-code and src/sound-link are imported only through index.ts', () => {
    for (const n of files) {
      const text = readFileSync(join('tools/ears', n), 'utf8');
      for (const m of text.matchAll(/from\s+'(\.\.\/\.\.\/src\/[^']+)'/g)) {
        const path = m[1]!;
        if (path.includes('/message-code') || path.includes('/sound-link')) {
          expect(/^\.\.\/\.\.\/src\/(message-code|sound-link)$/.test(path), `${n}: ${path}`).toBe(true);
        }
      }
    }
  });
  it('lists exactly three tools with descriptions, object schemas and a TEST sample', () => {
    expect(TOOLS.map((t) => t.name)).toEqual(['make_broadcast', 'hear_wav', 'round_trip']);
    for (const t of TOOLS) {
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema.type).toBe('object');
      expect(JSON.stringify(t.inputSchema)).not.toMatch(/additionalProperties|"minimum"|"maximum"/);
    }
    expect(TOOLS[0].description).toContain(JSON.stringify(SAMPLE_ALERT));
    expect(TOOLS[2].description).toContain('"test":true');
    expect(prepareAlert(SAMPLE_ALERT, Date.now()).ok).toBe(true);
  });
});

describe('MCP protocol over a child process', () => {
  let out: string;
  let built: BuiltBundle;
  beforeAll(() => {
    built = buildBundle('protocol');
    expect(built.status, built.output).toBe(0);
    out = makeTempDir();
  }, 180000);
  afterAll(() => removeDir(out));

  it('answers initialize, tools/list, a call and an unknown tool, with only protocol messages on stdout', async () => {
    const child = spawn(process.execPath, [built.path], { env: { ...process.env, EARS_OUT_DIR: out }, stdio: 'pipe' });
    let stdout = '';
    child.stdout!.on('data', (c) => { stdout += c.toString(); });
    const send = (msg: unknown): void => {
      (child as unknown as { stdin: { write(s: string): void } }).stdin.write(`${JSON.stringify(msg)}\n`);
    };
    const lines = (): unknown[] => stdout.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l) as unknown);
    const waitFor = async (id: number, ms: number): Promise<Record<string, any>> => {
      const start = Date.now();
      while (Date.now() - start < ms) {
        const hit = lines().find((m) => (m as { id?: number }).id === id);
        if (hit) return hit as Record<string, any>;
        await new Promise<void>((r) => { setTimeout(() => r(), 20); });
      }
      throw new Error(`no reply to ${id}`);
    };
    try {
      const t0 = Date.now();
      send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
      const init = await waitFor(1, 5000);
      expect(Date.now() - t0).toBeLessThan(5000);
      expect(init.result.serverInfo.name).toBe('dead-air-ears');
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });

      send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
      const list = await waitFor(2, 5000);
      expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(['make_broadcast', 'hear_wav', 'round_trip']);

      send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'make_broadcast', arguments: { alert: SAMPLE_ALERT } } });
      const call = await waitFor(3, 30000);
      expect(call.result.isError).toBeUndefined();
      const path = /wrote (.+\.wav)/.exec(call.result.content[0].text)?.[1] ?? '';
      expect(path.startsWith(out)).toBe(true);
      expect(listDir(out).length).toBe(1);

      send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'no_such_tool', arguments: {} } });
      const unknown = await waitFor(4, 5000);
      expect(unknown.error.message).toContain('no_such_tool');

      send({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'round_trip', arguments: { alert: SAMPLE_ALERT, noiseDb: 99 } } });
      const bad = await waitFor(5, 5000);
      expect(bad.result.isError).toBe(true);
      expect(bad.result.content[0].text).toContain('bad-noise-level');

      send({ jsonrpc: '2.0', id: 6, method: 'tools/list' });
      await waitFor(6, 5000); // still alive

      for (const m of lines()) {
        expect((m as { jsonrpc?: string }).jsonrpc).toBe('2.0');
      }
      expect(stdout.endsWith('\n')).toBe(true);
    } finally {
      child.kill();
    }
  }, 120000);
});
