// Node names used by the offline build tests (tests/offline/site-build.test.ts, boundary.test.ts,
// report.test.ts) that tests/broadcast/node-extra.d.ts, tests/ears/node-extra.d.ts and
// tests/sound-link/node-fs.d.ts do not declare. No top-level import or export, so each
// `declare module` merges with the existing declarations. Only overloads that do not clash are added.

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string): void;
  export function cpSync(from: string, to: string, options: { recursive: boolean }): void;
}

// node:crypto createHash is already declared in tests/ears/node-extra.d.ts (update takes a
// Uint8Array). A second overload with a string argument would shadow it, so none is added here.
declare const __dirname: string; // CommonJS name that vitest provides in test files
declare class TextDecoder { decode(input: Uint8Array): string; } // Node global, not in the ES2022 lib
