// Pass it on through the real Sound_Link: Copy bytes -> audio -> Listener -> decodeMessage.
// Validates: Requirement 14.7
import { describe, expect, it } from 'vitest';
import { decodeMessage } from '../../src/message-code';
import type { Alert } from '../../src/message-code';
import { prepareCopy } from '../../src/listen/pass';
import type { HistoryEntry } from '../../src/listen/history';
import { loadSoundLink } from '../../src/sound-link';

const SENT_MINUTE = 29000000;
const NOW_MS = (SENT_MINUTE + 5) * 60000;

const alert: Alert = {
  test: true,
  passedOn: false,
  hopCount: 0,
  event: 'flood',
  urgency: 'immediate',
  severity: 'severe',
  action: 'evacuate',
  sentMinute: SENT_MINUTE,
  validSteps: 4,
  latitude: 191760,
  longitude: 728777,
  stationId: 1,
  counter: 0,
  placeName: 'Mumbai',
};

describe('pass it on through the real Sound_Link', () => {
  it('a Copy played and heard decodes as the same alert, passed on, one hop higher', async () => {
    const entry: HistoryEntry = {
      bytes: new Uint8Array(0),
      alert,
      heardCount: 1,
      highestHop: 0,
      firstHeardMs: NOW_MS,
      lastHeardMs: NOW_MS,
    };

    const copy = prepareCopy(entry, NOW_MS);
    if (!copy.ok) throw new Error(`prepareCopy failed: ${copy.reason}`);

    const loaded = await loadSoundLink();
    if (!loaded.ok) throw new Error(`load failed: ${loaded.reason}`);
    const link = loaded.link;
    try {
      const audio = link.bytesToAudio(copy.bytes);
      if (!audio.ok) throw new Error(`bytesToAudio failed: ${audio.reason}`);

      const tail = new Float32Array(Math.round(2 * link.sampleRate));
      const stream = new Float32Array(audio.samples.length + tail.length);
      stream.set(audio.samples, 0);

      const made = link.createListener();
      if (!made.ok) throw new Error(`createListener failed: ${made.reason}`);
      const heard: Uint8Array[] = [];
      try {
        for (let i = 0; i < stream.length; i += link.frameSize) {
          const fed = made.listener.feed(stream.slice(i, i + link.frameSize));
          if (!fed.ok) throw new Error(`feed failed: ${fed.reason}`);
          heard.push(...fed.payloads);
        }
      } finally {
        made.listener.dispose();
      }

      expect(heard).toHaveLength(1);
      expect(Array.from(heard[0]!)).toEqual(Array.from(copy.bytes));

      const decoded = decodeMessage(heard[0]!);
      if (!decoded.ok) throw new Error(`decode failed: ${decoded.reason}`);
      expect(decoded.alert).toEqual({ ...alert, passedOn: true, hopCount: 1 });
      expect(decoded.alert.test).toBe(true);
    } finally {
      link.dispose();
    }
  });
});
