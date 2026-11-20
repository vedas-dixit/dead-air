// The parts of Node that the broadcast tests and scripts use, so no @types/node is needed.
// This file has no top-level import or export, so each `declare module` below merges with
// other declarations of the same module (tests/sound-link/node-fs.d.ts declares three
// node:fs functions). Only overloads and names that do not clash are added here.

declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array;
  export function writeFileSync(path: string, data: Uint8Array): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function statSync(path: string): {
    size: number;
    isFile(): boolean;
    isDirectory(): boolean;
  };
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function resolve(...parts: string[]): string;
  export function dirname(path: string): string;
  export function relative(from: string, to: string): string;
  export const sep: string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}

declare module 'node:child_process' {
  export interface SpawnSyncResult {
    status: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
    error?: Error;
  }
  export interface ExecOptions {
    cwd?: string;
    env?: Record<string, string | undefined>;
    encoding?: 'utf8';
    timeout?: number;
    stdio?: 'pipe' | 'inherit' | 'ignore';
  }
  export interface ChildProcess {
    pid?: number;
    stdout: { on(event: 'data', cb: (chunk: { toString(): string }) => void): void } | null;
    stderr: { on(event: 'data', cb: (chunk: { toString(): string }) => void): void } | null;
    on(event: 'exit', cb: (code: number | null, signal: string | null) => void): this;
    on(event: 'error', cb: (error: Error) => void): this;
    kill(signal?: string): boolean;
  }
  export function spawn(command: string, args?: string[], options?: ExecOptions): ChildProcess;
  export function spawnSync(command: string, args?: string[], options?: ExecOptions): SpawnSyncResult;
  export function execFileSync(command: string, args?: string[], options?: ExecOptions): string;
}

declare var process: {
  env: Record<string, string | undefined>;
  argv: string[];
  platform: string;
  execPath: string;
  cwd(): string;
  exit(code?: number): never;
  stdout: { write(text: string): boolean };
  stderr: { write(text: string): boolean };
};
