// Runs the How it works scene. The drawing and its motion are in index.html and
// front.css; this file only says when the motion may run:
//   data-live   set the first time the scene is on screen, so the story starts at its beginning
//   data-away   set while the scene is off screen, so nothing moves out of sight
//   data-paused set by the round pause button
// Under reduced motion, or without IntersectionObserver, nothing is set and the
// scene stays the finished picture.

const REDUCED = '(prefers-reduced-motion: reduce)';

export function mountHowScene(doc: Document): void {
  const root = doc.querySelector<HTMLElement>('.how');
  const stage = root?.querySelector<HTMLElement>('.how-stage') ?? null;
  const toggle = doc.getElementById('how-toggle') as HTMLButtonElement | null;
  const view = doc.defaultView;
  if (!root || !stage || !toggle || !view) return;
  if (typeof view.IntersectionObserver !== 'function' || typeof view.matchMedia !== 'function') return;

  const reduced = view.matchMedia(REDUCED);

  const still = (): void => {
    root.removeAttribute('data-live');
    root.removeAttribute('data-paused');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.hidden = true;
  };

  const observer = new view.IntersectionObserver(
    (entries) => {
      const seen = entries.some((e) => e.isIntersecting);
      if (reduced.matches) return;
      if (seen) {
        root.setAttribute('data-live', '');
        root.removeAttribute('data-away');
        toggle.hidden = false;
      } else {
        root.setAttribute('data-away', '');
      }
    },
    { threshold: 0.35 },
  );
  observer.observe(stage);

  toggle.addEventListener('click', () => {
    const paused = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(paused));
    if (paused) root.setAttribute('data-paused', '');
    else root.removeAttribute('data-paused');
  });

  reduced.addEventListener('change', () => {
    if (reduced.matches) still();
  });
}
