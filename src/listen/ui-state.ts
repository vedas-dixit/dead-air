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

export type PassPhase = 'idle' | 'loading' | 'playing';

/** The one pass failure line shown, or none. There is no check failure line: a failed self-check uses err.failed. */
export type PassNotice =
  | 'none'
  | 'listen.pass.err.not-current'
  | 'listen.pass.err.expired-mid'
  | 'listen.pass.err.failed'
  | 'listen.pass.err.audio'
  | 'listen.pass.err.load';

export interface PassUi {
  phase: PassPhase;
  statusText: string | null; // listen.pass.playing, only while playing
  volumeText: string | null; // listen.pass.volume, only while playing
  stopVisible: boolean; // only while playing
  errorText: string | null; // the one Failure_Line
  start: {
    enabled: boolean; // false while a load runs, a Copy plays or the Echo_Guard lasts
    reasonText: string | null; // listen.pass.start-reason exactly when a pass disables Start
  };
}

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
  pass: PassUi;
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
  pass: { phase: PassPhase; guard: boolean; notice: PassNotice };
}

function clampLevel(level: number): number {
  if (!(level > 0)) return 0; // also catches NaN
  return level > 1 ? 1 : level;
}

export function buildListenUi(input: ListenUiInput): ListenUi {
  const { model, phase, notice, historyKept, nowMs, offsetMinutes, strings, pass } = input;
  const passing = pass.phase !== 'idle' || pass.guard;
  const playing = pass.phase === 'playing';
  const running = phase === 'running';
  const level = running ? clampLevel(input.level) : 0;
  const line = buildStateLine(model, nowMs, strings);
  const cards = model.history.map((e) => buildCardView(e, nowMs, offsetMinutes, strings, { phase: pass.phase }));

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
    pass: {
      phase: pass.phase,
      statusText: playing ? text(strings, 'listen.pass.playing') : null,
      volumeText: playing ? text(strings, 'listen.pass.volume') : null,
      stopVisible: playing,
      errorText: pass.notice === 'none' ? null : text(strings, pass.notice),
      start: {
        // The Start_Button has no other disabling rule today; it is hidden while running.
        enabled: !passing,
        reasonText: passing ? text(strings, 'listen.pass.start-reason') : null,
      },
    },
  };
}
