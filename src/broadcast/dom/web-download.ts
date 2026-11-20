// The real DownloadPlatform: Blob, object URL and an anchor click.

import type { DownloadPlatform } from '../download';
import { webTimers } from './web-platform';

export const webDownloadPlatform: DownloadPlatform = {
  makeUrl(bytes: Uint8Array, mime: string): string {
    return URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  },
  revoke(url: string): void {
    URL.revokeObjectURL(url);
  },
  clickAnchor(url: string, fileName: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    try {
      a.click();
    } finally {
      a.remove();
    }
  },
  timers: webTimers,
};
