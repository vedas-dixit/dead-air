import type { EventType } from "../../../message-code/index.ts";
import { ICONS } from "../icons.ts";

// The only place in src/ that assigns markup. The source is our own bundled
// icon file (a build-time constant, never user data), parsed in an inert
// <template> so nothing runs or loads.
export function iconNode(event: EventType): SVGElement {
  const template = document.createElement("template");
  template.innerHTML = ICONS[event].trim();
  const svg = template.content.firstElementChild;
  if (!svg || svg.localName !== "svg") {
    throw new Error(`Icon for ${event} is not an svg`);
  }
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  return svg as SVGElement;
}
