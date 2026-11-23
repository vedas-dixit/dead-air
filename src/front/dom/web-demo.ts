// Real deps for the front page Demo_Player: device clock, timers, web audio, and the sound link
// loaded on the first tap. Nothing here runs at load, and no microphone or network call is made.
import type { LinkLike } from '../../broadcast/build';
import { createWebAudioHost } from '../../broadcast/dom/web-audio';
import { createDemo } from '../demo-player';
import type { Demo, DemoState } from '../demo-player';

/** Dynamic import, so the sound link and ggwave load in a separate chunk on the first tap. */
async function loadLink(): Promise<LinkLike | null> {
  try {
    const { loadSoundLink } = await import('../../sound-link/index');
    const r = await loadSoundLink();
    return r.ok ? r.link : null;
  } catch {
    return null;
  }
}

export function createWebDemo(onState: (s: DemoState) => void): Demo {
  return createDemo({
    clock: { now: () => Date.now() },
    timers: {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    },
    audio: createWebAudioHost(),
    loadLink,
    onState,
  });
}
