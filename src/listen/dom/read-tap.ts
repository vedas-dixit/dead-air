// Decides whether a click on the card list is a tap on a Read_Aloud_Button.
// Only the button itself starts or stops the voice. A tap on a help line, an error line
// or the rest of the [data-read] block returns null. Pure over `closest`, so it needs no DOM.

/** The smallest shape this needs from a DOM element. */
export interface ClosestTarget {
  closest(selector: string): ClosestTarget | null;
  getAttribute(name: string): string | null;
}

/** Returns the data-read key of the tapped Read_Aloud_Button, or null. */
export function readButtonKey(target: unknown): string | null {
  const node = target as Partial<ClosestTarget> | null | undefined;
  if (node === null || node === undefined || typeof node.closest !== 'function') return null;
  const button = node.closest('[data-part="button"]');
  if (button === null) return null;
  const block = button.closest('[data-read]');
  if (block === null) return null;
  return block.getAttribute('data-read');
}
