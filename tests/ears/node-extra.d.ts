// Node names used by tools/ears and tests/ears that tests/broadcast/node-extra.d.ts and
// tests/sound-link/node-fs.d.ts do not declare. No top-level import or export, so each
// `declare module` merges with the existing declarations.
declare module 'node:fs' {
  export function renameSync(from: string, to: string): void;
  export function unlinkSync(path: string): void;
  export function readdirSync(path: string): string[];
  export function mkdtempSync(prefix: string): string;
}
declare module 'node:os' {
  export function tmpdir(): string;
}
declare module 'node:crypto' {
  export function createHash(algorithm: string): {
    update(data: Uint8Array): { digest(encoding: 'hex'): string };
  };
}
declare var console: {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};
interface ImportMeta {
  readonly url: string;
}
declare function setTimeout(callback: () => void, ms?: number): unknown;
