import { describe, expect, it } from 'vitest';
import { REVOKE_AFTER_MS, createDownloader, type DownloadPlatform } from '../../src/broadcast/download';
import { FakeAudioHost, FakePlayer, FakeTimers } from './fakes';

// Validates: Requirements 12.6, 12.7

interface Rig {
  platform: DownloadPlatform;
  timers: FakeTimers;
  made: Array<{ bytes: Uint8Array; mime: string }>;
  clicks: Array<{ url: string; name: string }>;
  revoked: string[];
  fail: { make: boolean; click: boolean; revoke: boolean };
}

function rig(): Rig {
  const timers = new FakeTimers();
  const r: Rig = {
    timers,
    made: [],
    clicks: [],
    revoked: [],
    fail: { make: false, click: false, revoke: false },
    platform: undefined as unknown as DownloadPlatform,
  };
  r.platform = {
    timers,
    makeUrl(bytes, mime) {
      if (r.fail.make) throw new Error('make');
      r.made.push({ bytes, mime });
      return `blob:test/${r.made.length}`;
    },
    clickAnchor(url, name) {
      r.clicks.push({ url, name });
      if (r.fail.click) throw new Error('click');
    },
    revoke(url) {
      r.revoked.push(url);
      if (r.fail.revoke) throw new Error('revoke');
    },
  };
  return r;
}

const BYTES = new Uint8Array([1, 2, 3]);

describe('downloader', () => {
  it('revokes at 5000 ms and not before', () => {
    expect(REVOKE_AFTER_MS).toBe(5000);
    const r = rig();
    createDownloader(r.platform).save(BYTES, 'a.wav');
    r.timers.advance(4999);
    expect(r.revoked).toEqual([]);
    r.timers.advance(1);
    expect(r.revoked).toEqual(['blob:test/1']);
    r.timers.advance(20000);
    expect(r.revoked).toHaveLength(1);
  });

  it('clicks the anchor once with the given name and the made URL', () => {
    const r = rig();
    createDownloader(r.platform).save(BYTES, 'dead-air-test.wav');
    expect(r.clicks).toEqual([{ url: 'blob:test/1', name: 'dead-air-test.wav' }]);
    expect(r.made).toHaveLength(1);
    expect(r.made[0]!.mime).toBe('audio/wav');
    expect(r.made[0]!.bytes).toBe(BYTES);
  });

  it('needs no audio host and makes no unlock call', () => {
    const host = new FakeAudioHost(new FakePlayer(new FakeTimers()));
    const r = rig();
    expect(Object.keys(r.platform).sort()).toEqual(['clickAnchor', 'makeUrl', 'revoke', 'timers']);
    createDownloader(r.platform).save(BYTES, 'a.wav');
    r.timers.advance(REVOKE_AFTER_MS);
    expect(host.unlockCalls).toBe(0);
  });

  it('does not throw when makeUrl throws, and clicks nothing', () => {
    const r = rig();
    r.fail.make = true;
    expect(() => createDownloader(r.platform).save(BYTES, 'a.wav')).not.toThrow();
    expect(r.clicks).toEqual([]);
    expect(r.timers.pendingCount).toBe(0);
  });

  it('revokes the URL and does not throw when the click fails', () => {
    const r = rig();
    r.fail.click = true;
    expect(() => createDownloader(r.platform).save(BYTES, 'a.wav')).not.toThrow();
    expect(r.revoked).toEqual(['blob:test/1']);
  });

  it('does not throw when revoke throws, on the timer or after a failed click', () => {
    const r = rig();
    r.fail.revoke = true;
    const d = createDownloader(r.platform);
    expect(() => {
      d.save(BYTES, 'a.wav');
      r.timers.advance(REVOKE_AFTER_MS);
    }).not.toThrow();
    r.fail.click = true;
    expect(() => d.save(BYTES, 'b.wav')).not.toThrow();
    expect(r.revoked).toHaveLength(2);
  });
});
