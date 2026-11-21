import type { EventType } from '../../message-code/index';
import type { Strings } from '../../broadcast/strings.types';
import { labelFor } from '../labels';
import { ICONS } from './icons';

export interface EventFace {
  event: EventType;
  svg: string;
  name: string;
}

// Pairs an event's drawing with its translated name. A missing name is a bug
// (promise 6), so this throws instead of returning a half-built face.
export function eventFace(event: EventType, strings: Strings): EventFace {
  const name = labelFor(strings.labels.event, event);
  if (name === null) throw new Error(`missing event label: ${event}`);
  return { event, svg: ICONS[event], name };
}
