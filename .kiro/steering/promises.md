# Promises that never bend

These six rules override convenience, speed and style. If a task would break one, stop and ask.

1. **Never show a damaged alert.** If the check value fails, show nothing from that message.
2. **Never show an expired alert as current.** Always show the sent time.
3. **Test alerts are always marked.** A test alert carries a TEST flag and always shows a TEST banner. Every sample and demo in the repo is a test alert.
4. **No network requests after the first load.** No CDNs, web fonts, analytics or outside APIs. This covers `/listen` and `/broadcast`. The front page may load its own images, but nothing from other sites.
5. **Microphone audio stays in memory and is discarded.** Never record, store or upload it.
6. **Every alert type has an icon and text in every shipped language.** A missing translation or icon is a bug, not a fallback case.

## What this means in practice
- Treat everything received as untrusted until it passes the check. Never assume a transmission arrived intact.
- Decide "expired" from the sent time plus the valid-for period, compared against the device clock. Show the sent time next to every alert.
- Do not add fonts, icons or scripts loaded from a URL. Bundle them.
- Do not write audio buffers to storage, logs or any `fetch` or `XMLHttpRequest` body.
