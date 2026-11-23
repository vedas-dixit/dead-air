# Structure

## Site map
One site, three addresses, separated by path and not by domain.

| Path | What it is | When built |
|---|---|---|
| `/` | Front page: cover photo, the story in a few lines, buttons to the two app pages, how to try it | Last |
| `/listen` | Listen app | Spec 4 |
| `/broadcast` | Broadcast app | Spec 3 |

## Rules
- Build these as real static pages, so each address works on GitHub Pages when opened directly.
- The app pages must not load the front page's photos. Keep the offline copy small.
- The front page may load its own images, but nothing from other sites.

## Code layout
No app code exists yet. When it is added, keep these boundaries:
- The message code is its own module of pure functions with no browser APIs, so it can be tested in plain Node.
- Listen and Broadcast are separate pages. Shared UI or audio helpers go in a shared folder, not copied between them.
  - Exception (front-page spec): `src/front/` may import the demo sound code from `src/broadcast/` (build, broadcast run, web audio host), so the Broadcast spec's files stay untouched. Nothing is copied.
- Each spec owns its files. Ask before editing files that belong to another spec.

## Docs
- `docs/brief.md` is the source brief.
- Specs live in `.kiro/specs/`. Steering lives in `.kiro/steering/`.
