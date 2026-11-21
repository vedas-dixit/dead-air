// Order of the parts on a Listen card. Pure, no DOM.
// The TEST banner comes first, the sent time is always present (promise 2).
import type { CardView } from './card';

export type CardPart =
  | 'test-banner'
  | 'icon-tile'
  | 'event-name'
  | 'expired-label'
  | 'sentence'
  | 'rows'
  | 'sent'
  | 'clock'
  | 'heard'
  | 'voice';

export function cardLayout(view: CardView): CardPart[] {
  const parts: CardPart[] = [];
  if (view.testBanner !== null) parts.push('test-banner');
  parts.push('icon-tile', 'event-name');
  if (view.expiryStatus === 'expired') parts.push('expired-label');
  if (view.sentence !== null) parts.push('sentence');
  parts.push('rows', 'sent');
  if (view.clockLine !== null) parts.push('clock');
  parts.push('heard', 'voice');
  return parts;
}
