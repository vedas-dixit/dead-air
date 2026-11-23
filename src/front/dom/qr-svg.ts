// Draws the Listen_URL as a QR code in an inline svg. createElementNS only:
// no string-to-DOM API, no data URL. Colours come from CSS (--qr-paper, --qr-ink).
import { qrMatrix } from '../qr';
import { qrSvgShape } from '../qr-svg-path';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The svg for `url`, or a `<code>` element holding the URL when the code cannot be made. */
export function buildQr(doc: Document, url: string): SVGSVGElement | HTMLElement {
  const matrix = qrMatrix(url);
  if (matrix === null) {
    const code = doc.createElement('code');
    code.textContent = url;
    return code;
  }
  const { size, d } = qrSvgShape(matrix);
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', url);
  svg.setAttribute('class', 'front-qr');
  svg.setAttribute('shape-rendering', 'crispEdges');
  const paper = doc.createElementNS(SVG_NS, 'rect');
  paper.setAttribute('width', String(size));
  paper.setAttribute('height', String(size));
  paper.setAttribute('class', 'front-qr-paper');
  const ink = doc.createElementNS(SVG_NS, 'path');
  ink.setAttribute('d', d);
  ink.setAttribute('class', 'front-qr-ink');
  svg.append(paper, ink);
  return svg;
}

/** Replaces the container's content with the QR code (or the URL as text). */
export function mountQr(container: HTMLElement, url: string): void {
  container.replaceChildren(buildQr(container.ownerDocument, url));
}
