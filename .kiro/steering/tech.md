# Tech rules

## Stack
- Vite, TypeScript and React. No backend.
- Sound: the `ggwave` npm package (MIT). Follow the official browser example in the ggwave repo, `examples/ggwave-js`, including how it sets sample rates.
- Tests: Vitest, with fast-check for property tests.
- Keep dependencies few. Ask before adding a new one.

## Hosting
- GitHub Pages under the `/dead-air/` path for now.
- It will later move to its own subdomain. Asset paths and the service worker scope must work both under a sub-path and at the root of a domain. Do not hard-code `/dead-air/` anywhere. Derive it from the Vite `base` setting.

## Offline
- A service worker saves every file the app needs on the first visit, then serves from that saved copy.
- Register it on all three pages (`/`, `/listen`, `/broadcast`). One visit to any of them must save the Listen and Broadcast pages for offline use.
- The Home Screen icon opens `/listen`.

## Message code
- Fields follow CAP 1.2 (Common Alerting Protocol) wherever a matching field exists.
- Total size is 40 bytes or less.
- Reject any message with an unknown version or a failed check.
- The check value is a 4-byte CRC-32. A 2-byte CRC-16 is not strong enough for promise 1 (decided in spec 1). Messages are 21 to 40 bytes.

## Testing
The message code gets property tests for three things:
- Any alert survives encode then decode.
- Any single changed byte is caught.
- An expired alert is never reported as current.
