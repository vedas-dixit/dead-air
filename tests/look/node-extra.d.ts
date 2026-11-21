// One extra node:fs overload for the look tests, so no @types/node is needed.
// This file has no top-level import or export, so it merges with the other node:fs declarations.
declare module 'node:fs' {
  export function readdirSync(
    path: string,
    options: { withFileTypes: true },
  ): { name: string; isDirectory(): boolean }[];
}
