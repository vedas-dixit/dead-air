// Download of the saved sound file. No DOM types: the Blob, object URL and
// anchor click are injected (the real ones live in dom/web-download.ts).
// Nothing here touches audio.

import type { Downloader, Timers } from './providers';

/** The object URL is revoked this long after the download starts (limit: 10 s). */
export const REVOKE_AFTER_MS = 5000;

const WAV_MIME = 'audio/wav';

export interface DownloadPlatform {
  /** Blob and URL.createObjectURL in the browser. */
  makeUrl(bytes: Uint8Array, mime: string): string;
  revoke(url: string): void;
  clickAnchor(url: string, fileName: string): void;
  timers: Timers;
}

export function createDownloader(p: DownloadPlatform): Downloader {
  const revokeNow = (url: string): void => {
    try {
      p.revoke(url);
    } catch {
      // Revoking is cleanup only.
    }
  };

  return {
    save(bytes: Uint8Array, fileName: string): void {
      let url: string;
      try {
        url = p.makeUrl(bytes, WAV_MIME);
      } catch {
        return; // nothing was made, nothing to revoke
      }

      try {
        p.clickAnchor(url, fileName);
      } catch {
        revokeNow(url);
        return;
      }

      try {
        p.timers.setTimeout(() => revokeNow(url), REVOKE_AFTER_MS);
      } catch {
        revokeNow(url);
      }
    },
  };
}
