// Copies sound-test/ into the output folder (default dist/) unchanged, so it is served at <base>sound-test/.
// Usage: node build/copy-sound-test.mjs [outDir]
import { cpSync } from 'node:fs';
cpSync('sound-test', `${process.argv[2] ?? 'dist'}/sound-test`, { recursive: true });
