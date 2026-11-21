import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { headerHtml } from '../src/shared/ui/header.ts';

const MARKER = '<!--look:header-->';
const LICENSE_FILE = 'fonts/ibm-plex-mono-LICENSE.txt';
const LICENSE_SOURCE = 'node_modules/@fontsource/ibm-plex-mono/LICENSE';

/** The app page a path belongs to, or null for the front page and anything else. */
function appPage(filename: string): 'listen' | 'broadcast' | null {
  const path = filename.split('?')[0]!.replace(/\\/g, '/');
  if (path.endsWith('/listen/index.html')) return 'listen';
  if (path.endsWith('/broadcast/index.html')) return 'broadcast';
  return null;
}

/**
 * Fills the header marker on the Listen and Broadcast pages, emits the font
 * licence unchanged, and links it from the head of all three pages.
 * Throws if a marker or the licence is missing.
 */
export function lookHeaderPlugin(): Plugin {
  let base = '/';
  let root = process.cwd();
  let license: string | null = null;

  return {
    name: 'dead-air-look-header',
    configResolved(config) {
      base = config.base;
      root = config.root;
      const file = resolve(root, LICENSE_SOURCE);
      if (!existsSync(file)) {
        throw new Error(`Font licence not found: ${LICENSE_SOURCE}`);
      }
      license = readFileSync(file, 'utf8');
    },
    buildStart() {
      if (license === null) throw new Error(`Font licence not found: ${LICENSE_SOURCE}`);
      this.emitFile({ type: 'asset', fileName: LICENSE_FILE, source: license });
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        let out = html;
        const page = appPage(ctx.filename);
        if (page !== null) {
          if (!out.includes(MARKER)) {
            throw new Error(`Missing ${MARKER} in ${ctx.filename}`);
          }
          out = out.split(MARKER).join(headerHtml({ page, base }));
        }
        if (!out.includes('</head>')) {
          throw new Error(`Missing </head> in ${ctx.filename}`);
        }
        const link = `<link rel="license" href="${base}${LICENSE_FILE}" />\n  </head>`;
        return out.replace('</head>', link);
      },
    },
  };
}
