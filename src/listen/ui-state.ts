// Listen page UI state: everything render.ts draws, built from the model,
// the controller flags, the clock and the strings. Pure. No DOM, no browser API.
import type { Strings } from '../broadcast/strings.types';
import { buildCardView } from './card';
import type { CardView } from './card';
import type { ListenModel } from './model';
import { buildStateLine } from './state-line';
import type { ListenState } from './state-line';
import { text } from './texts';

export type Phase = 'idle' | 'starting' | 'running';

/** The one message shown in the error line, or none. */
export type Notice =
  | 'none'
  | 'listen.mic.refused'
  | 'listen.mic.none'
  | 'listen.mic.insecure'
  | 'listen.mic.audio'
  | 'listen.mic.stopped'
  | 'listen.mic.failed'
  | 'engine.failed'
  | 'listen.hidden-stop';

export interface ListenUi {
  state: ListenState;
  stateText: string;
  running: boolean; // Stop shown, Start hidden
  starting: boolean; // Start shown but taps are ignored
  level: number; // 0 to 1
  levelLabel: string;
  cards: CardView[]; // first heard newest first
  errorText: string | null; // mic, engine or hidden-stop message, one at a time
  unreadableText: string | null;
  keepOpenText: string | null; // only while running
  historyUnkeptText: string | null;
  clearEnabled: boolean; // cards.length > 0
}

export interface ListenUiInput {
  model: ListenModel;
  phase: Phase;
  notice: Notice;
  historyKept: boolean;
  level: number;
  nowMs: number;
  offsetMinutes: number;
  strings: Strings;
}

function clampLevel(level: number): number {
  if (!(level > 0)) return 0; // also catches NaN
  return level > 1 ? 1 : level;
}

export function buildListenUi(input: ListenUiInput): ListenUi {
  const { model, phase, notice, historyKept, nowMs, offsetMinutes, strings } = input;
  const running = phase === 'running';
  const level = running ? clampLevel(input.level) : 0;
  const line = buildStateLine(model, nowMs, strings);
  const cards = model.history.map((e) => buildCardView(e, nowMs, offsetMinutes, strings));

  return {
    state: line.state,
    stateText: line.text,
    running,
    starting: phase === 'starting',
    level,
    levelLabel: text(strings, 'listen.level.label', { percent: Math.round(level * 100) }),
    cards,
    errorText: notice === 'none' ? null : text(strings, notice),
    unreadableText: model.unreadable ? text(strings, 'listen.unreadable') : null,
    keepOpenText: running ? text(strings, 'listen.keep-open') : null,
    historyUnkeptText: historyKept ? null : text(strings, 'listen.history.unkept'),
    clearEnabled: cards.length > 0,
  };
}
