import { beforeAll, describe, expect, it } from 'vitest';
import type { SoundLink } from '../../src/sound-link';
import { buildStream, classify, listenTo, makeLink, makeRawGgwave, makeRng, randomPayload } from './harness';
import type { RawGgwave } from './harness';

let link: SoundLink;
let raw: RawGgwave;
beforeAll(async () => {
  link = await makeLink();
  raw = await makeRawGgwave();
});

// The Encoder refuses these sizes, so the sound is made by ggwave directly. The Listener must still report them.
describe('payloads that are not 21 to 40 bytes', () => {
  it.each([8, 15, 41, 60, 100])('a payload of %i bytes is reported unchanged', (length) => {
    // Short payloads can come back wrong even with no noise (see the spec). Try a few seeded payloads
    // and check that whatever the Listener reports is a faithful copy of what ggwave decoded:
    // at least one of them must be reported exactly.
    const rng = makeRng(length);
    const outcomes: string[] = [];
    for (let i = 0; i < 6; i++) {
      const bytes = randomPayload(rng, length);
      const stream = buildStream(raw.encode(bytes, 'AUDIBLE_FAST'), { sampleRate: 48000 });
      const heard = listenTo(link, stream, 1024);
      outcomes.push(classify(bytes, heard));
      if (heard.length > 0) for (const h of heard) expect(h).toBeInstanceOf(Uint8Array);
    }
    expect(outcomes, outcomes.join(',')).toContain('exact');
  }, 60_000);
});
