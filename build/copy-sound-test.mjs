// Copies sound-test/ into dist/ unchanged, so it is served at <base>sound-test/.
import { cpSync } from 'node:fs';
cpSync('sound-test', 'dist/sound-test', { recursive: true });
