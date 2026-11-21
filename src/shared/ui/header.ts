// Header markup for the Listen and Broadcast pages. Pure: no browser APIs.
// `base` is the Vite base (for example "/" or "/repo/"), always ending in "/".

export type HeaderPage = 'listen' | 'broadcast';

export function headerHtml(input: { page: HeaderPage; base: string }): string {
  const { page, base } = input;
  const current = (p: HeaderPage): string => (p === page ? ' aria-current="page"' : '');
  return [
    '<header class="site-header">',
    `  <a id="link-home" class="app-name" href="${base}">Dead Air</a>`,
    `  <nav class="page-switch" data-position="${page}">`,
    `    <a id="link-listen" href="${base}listen/" data-text="nav.switch.listen"${current('listen')}>Listen</a>`,
    `    <a id="link-broadcast" href="${base}broadcast/" data-text="nav.switch.broadcast"${current('broadcast')}>Broadcast</a>`,
    '  </nav>',
    '  <div id="language-switch" role="group"></div>',
    '</header>',
  ].join('\n');
}
