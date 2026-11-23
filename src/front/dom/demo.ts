// Wires the front page demo: #btn-demo, #btn-demo-stop and the #demo-line status line.
// Text is read from the current language on every render, so a language change updates it.
import type { LanguageState } from '../../languages/language-state';
import type { DemoState } from '../demo-player';
import { createWebDemo } from './web-demo';

const ERR_KEY = {
  load: 'front.demo.err.load',
  build: 'front.demo.err.build',
  audio: 'front.demo.err.audio',
  clock: 'front.demo.err.clock',
} as const;

export function mountDemo(doc: Document, language: LanguageState): void {
  const play = doc.getElementById('btn-demo') as HTMLButtonElement | null;
  const stop = doc.getElementById('btn-demo-stop') as HTMLButtonElement | null;
  const line = doc.getElementById('demo-line');
  if (!play || !stop || !line) return;

  const text = (key: string): string =>
    (language.current().strings.text as Readonly<Record<string, string>>)[key] ?? '';

  let state: DemoState = { kind: 'idle' };

  const render = (): void => {
    const busy = state.kind === 'loading';
    const playing = state.kind === 'playing';

    play.textContent = text(playing ? 'front.s1.btn.playing' : 'front.s1.btn.play');
    play.disabled = busy || playing;
    play.dataset.state = state.kind;
    if (busy) play.setAttribute('aria-busy', 'true');
    else play.removeAttribute('aria-busy');

    stop.textContent = text('btn.stop');
    stop.hidden = !playing;

    if (playing) line.textContent = text('front.demo.volume');
    else if (state.kind === 'failed') line.textContent = text(ERR_KEY[state.reason]);
    else line.textContent = '';
  };

  const demo = createWebDemo((s) => {
    state = s;
    render();
  });

  // The tap calls demo.tap() directly, with no await before it, so audio unlocks inside the tap.
  play.addEventListener('click', () => demo.tap());
  stop.addEventListener('click', () => demo.stop());
  language.subscribe(render);
  render();
}
