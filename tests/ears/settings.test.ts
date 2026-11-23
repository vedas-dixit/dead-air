// Task 12.3. Registration, README, dependencies and the site build.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string): string => readFileSync(p, 'utf8');

describe('MCP settings', () => {
  const settings = JSON.parse(read('.kiro/settings/mcp.json')) as {
    mcpServers: Record<string, { command: string; args: string[]; disabled: boolean; autoApprove: string[]; env?: unknown }>;
  };
  // The shipped file starts with disabled true. The developer may switch the server on, so any boolean is accepted.
  it('registers dead-air-ears with no auto-approve', () => {
    const entry = settings.mcpServers['dead-air-ears']!;
    expect(entry).toBeDefined();
    expect(entry.command).toBe('node');
    expect(entry.args).toEqual(['tools/ears/build/ears.mjs']);
    expect(typeof entry.disabled).toBe('boolean');
    expect(entry.autoApprove).toEqual([]);
    expect(entry.env).toBeUndefined();
  });
  it('has no absolute path, home folder or secret', () => {
    const text = read('.kiro/settings/mcp.json');
    expect(text).not.toMatch(/\/Users\/|\/home\/|[A-Za-z]:\\|~|token|secret|key/i);
    for (const a of settings.mcpServers['dead-air-ears']!.args) expect(a.startsWith('/')).toBe(false);
  });
});

describe('README', () => {
  const readme = read('tools/ears/README.md');
  it('lists the prepare and turn-on steps and one example per tool', () => {
    expect(readme).toContain('npm install');
    expect(readme).toContain('npm run build:ears');
    expect(readme).toContain('"disabled": false');
    for (const tool of ['make_broadcast', 'hear_wav', 'round_trip']) expect(readme).toContain(`### ${tool}`);
  });
  it('every npm script it names exists', () => {
    const scripts = (JSON.parse(read('package.json')) as { scripts: Record<string, string> }).scripts;
    for (const m of readme.matchAll(/npm run ([\w:-]+)/g)) expect(scripts[m[1]!], m[1]).toBeDefined();
  });
  it('every sample alert in it has test true', () => {
    for (const m of readme.matchAll(/"alert":\s*\{[^}]*\}/g)) expect(m[0]).toMatch(/"test":\s*true/);
  });
});

describe('package and build', () => {
  it('the MCP SDK and zod are devDependencies only, and no other dependency was added', () => {
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies)).toEqual(['ggwave', 'qrcode-generator']);
    expect(pkg.devDependencies['@modelcontextprotocol/sdk']).toMatch(/^\d/);
    expect(pkg.devDependencies.zod).toMatch(/^\d/);
  });
  it('typecheck includes the tools tsconfig, the output folders are ignored, tsx is absent', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string>; devDependencies: Record<string, string> };
    expect(pkg.scripts.typecheck).toContain('tsc -p tsconfig.tools.json --noEmit');
    expect(pkg.devDependencies.tsx).toBeUndefined();
    const ignore = read('.gitignore');
    expect(ignore).toContain('tools/ears/build/');
    expect(ignore).toContain('tools/ears/out/');
  });
  it('the site build holds nothing from tools/ and nothing from the SDK (9.4)', () => {
    const out = join(process.cwd(), 'node_modules', '.cache', 'dead-air-ears-site');
    rmSync(out, { recursive: true, force: true });
    const env: Record<string, string | undefined> = { ...process.env };
    delete env.NODE_ENV;
    for (const k of Object.keys(env)) if (k.startsWith('VITEST') || k === 'VITE_USER_NODE_ENV') delete env[k];
    const r = spawnSync(process.execPath, [join('node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', out, '--emptyOutDir'], {
      cwd: process.cwd(), env, encoding: 'utf8', timeout: 170000,
    });
    expect(r.status, r.stderr).toBe(0);
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
    for (const f of walk(out)) {
      expect(f.slice(out.length)).not.toContain('ears');
      if (/\.(js|html|css|json)$/.test(f)) {
        const t = read(f);
        expect(t, f).not.toContain('modelcontextprotocol');
        expect(t, f).not.toContain('dead-air-ears');
      }
    }
    expect(existsSync(join(out, 'tools'))).toBe(false);
    rmSync(out, { recursive: true, force: true });
  }, 180000);
});
