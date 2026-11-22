// Decides whether a click on the card list is a tap on a Pass_Button.
// Pure over `closest`, so it needs no DOM. Same pattern as read-tap.ts.
import type { ClosestTarget } from './read-tap';

/** Returns the data-pass-key (an alertKey) of the tapped Pass_Button, or null. */
export function passButtonKey(target: unknown): string | null {
  const node = target as Partial<ClosestTarget> | null | undefined;
  if (node === null || node === undefined || typeof node.closest !== 'function') return null;
  const button = node.closest('[data-part="pass"]');
  if (button === null) return null;
  return button.getAttribute('data-pass-key');
}
