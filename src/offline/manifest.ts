// Pure: the web app manifest. Every path comes from base. Colours and names are placeholders for spec 8.
import { joinBase } from './paths.ts';

export interface WebManifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: 'standalone';
  background_color: string;
  theme_color: string;
  icons: { src: string; sizes: string; type: 'image/png'; purpose: 'any' }[];
}

export function buildManifest(base: string): WebManifest {
  return {
    name: 'Dead Air',
    short_name: 'Dead Air',
    start_url: joinBase(base, 'listen/'),
    scope: base,
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: joinBase(base, 'icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: joinBase(base, 'icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}

/** JSON, 2 spaces, trailing newline. */
export function manifestText(m: WebManifest): string {
  return JSON.stringify(m, null, 2) + '\n';
}
