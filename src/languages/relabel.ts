import type { Msg, Strings } from '../broadcast/strings.types';

type LabelGroup = 'field' | 'audioReason' | 'wavReason' | 'decodeReason';

const RELABEL: Partial<Record<Msg['key'], { param: string; group: LabelGroup }>> = {
  'err.encode': { param: 'field', group: 'field' },
  'check.failed.field': { param: 'field', group: 'field' },
  'err.audio': { param: 'reason', group: 'audioReason' },
  'err.wav': { param: 'reason', group: 'wavReason' },
  'check.failed.reason': { param: 'reason', group: 'decodeReason' },
};

/**
 * Re-label a stored message when the Language changes. The param holds label
 * text in `from`; it is replaced with the label of the same code in `to`.
 * When no code matches, the param is kept. Other messages are unchanged.
 */
export function relabelMsg(msg: Msg, from: Strings, to: Strings): Msg {
  const rule = RELABEL[msg.key];
  if (!rule || !msg.params) return msg;
  const current = msg.params[rule.param];
  if (current === undefined) return msg;
  const fromLabels = from.labels[rule.group] as Record<string, string>;
  const toLabels = to.labels[rule.group] as Record<string, string>;
  const code = Object.keys(fromLabels).find((c) => fromLabels[c] === current);
  if (code === undefined) return msg;
  const label = toLabels[code];
  if (label === undefined) return msg;
  return { ...msg, params: { ...msg.params, [rule.param]: label } };
}
