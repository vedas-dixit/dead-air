// Header markup for the Listen and Broadcast pages. Pure: no browser APIs.
// `logo` is the text of src/shared/ui/logo.svg, read by the caller so this file stays pure.
// `base` is the Vite base (for example "/" or "/repo/"), always ending in "/".


/**
 * The logo, ready to sit inline in a link: no fixed size (the CSS sets the
 * height), hidden from screen readers (the link carries the name as hidden text),
 * on one line, and with no ids. The people use currentColor, the signal stays orange.
 */
export function logoHtml(source: string): string {
  return source
    .replace(/<svg\b[^>]*>/, (tag: string) => {
      const viewBox = /viewBox="[^"]*"/.exec(tag)?.[0] ?? '';
      return `<svg ${viewBox} class="logo" aria-hidden="true" focusable="false">`;
    })
    .replace(/\sid="[^"]*"/g, '')
    .replace(/>\s+</g, '><')
    .trim();
}

/** The link to the front page: the logo, with the name as visually hidden text. */
export function homeLinkHtml(input: { href: string; id?: string; logo: string }): string {
  const id = input.id === undefined ? '' : ` id="${input.id}"`;
  return `<a${id} class="app-name" href="${input.href}">${logoHtml(input.logo)}<span class="sr-only">Dead Air</span></a>`;
}

export type HeaderPage = 'listen' | 'broadcast';

export function headerHtml(input: { page: HeaderPage; base: string; logo: string }): string {
  const { page, base, logo } = input;
  const current = (p: HeaderPage): string => (p === page ? ' aria-current="page"' : '');
  return [
    '<header class="site-header">',
    `  ${homeLinkHtml({ href: base, id: 'link-home', logo })}`,
    `  <nav class="page-switch" data-position="${page}">`,
    `    <a id="link-listen" href="${base}listen/" data-text="nav.switch.listen"${current('listen')}>Listen</a>`,
    `    <a id="link-broadcast" href="${base}broadcast/" data-text="nav.switch.broadcast"${current('broadcast')}>Broadcast</a>`,
    '  </nav>',
    '  <div id="language-switch" role="group"></div>',
    '</header>',
  ].join('\n');
}
