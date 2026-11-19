What Dead Air is
Dead Air is a web app that sends short emergency alerts from one device to nearby phones through sound. It is for moments when the internet and mobile networks are down but a speaker, a radio or a loudspeaker still works.
It is a hackathon entry for Kiroween 2026, in the Resurrection category. The old tech it brings back is the modem screech, Teletext, and data broadcast over radio.
Who uses it
• Sender: a control room, a community radio host, or a volunteer with a megaphone. They fill in a short form and press "Go on air". The device plays a few seconds of sound.
• Listener: anyone nearby with a phone that has opened the app once before. The phone hears the sound and shows the alert in the listener's language.
The pieces
1.  Message code. Turns an alert into 19 to 40 bytes and back. Pure functions with no browser APIs, so it is easy to test.
2.  Listen page. Microphone in, decode, check, show. Keeps a history. When nothing has been heard, it says "Dead air. Last heard N min ago."
3.  Broadcast page. The form, a "say this first" line for the sender to read aloud, Go on air, repeat every minute, save as a sound file.
4.  The look. Teletext style. This comes later. Keep the UI plain until the look spec.
Site map
One site with three addresses. The front page and the app are separated by path, not by domain.
• / is the front page: the cover photo, the story in a few lines, buttons to the two app pages, and how to try it. It is a normal web page and it is built last.
• /listen is the Listen app.
• /broadcast is the Broadcast app.
Rules for the site map:
• Build these as real static pages, so each address works on GitHub Pages when someone opens it directly.
• Register the service worker on all three pages. One visit to any of them must save the Listen and Broadcast pages for offline use.
• The app pages must not load the front page's photos. Keep the offline copy small.
• The Home Screen icon opens /listen.
• Promise 4 covers /listen and /broadcast. The front page may load its own images, but nothing from other sites.
Promises that never bend
1.  Never show a damaged alert. If the check value fails, show nothing from that message.
2.  Never show an expired alert as current. Always show the sent time.
3.  A test alert carries a TEST flag and always shows a TEST banner. Every sample and demo in the repo is a test alert.
4.  Make no network requests after the first load. No CDNs, web fonts, analytics or outside APIs.
5.  Process microphone audio in memory and discard it. Never record, store or upload it.
6.  Every alert type has an icon and has text in every language we ship.
Message code, first draft
Fields follow CAP 1.2, the Common Alerting Protocol, wherever it has a matching field.
• Version and flags, 1 byte: format version, TEST flag, passed-on flag
• Event, 1 byte: flood, cyclone, fire, earthquake, heatwave, landslide, medical, missing person, all clear
• Urgency, severity and action, 1 byte: CAP values. Action is one of shelter, evacuate, prepare, avoid, monitor, all clear
• Sent time, 4 bytes: to the minute, in UTC
• Valid for, 1 byte: steps of 15 minutes
• Place, 6 bytes: latitude and longitude, 3 bytes each
• Sender and number, 3 bytes: a 2-byte station ID and a 1-byte counter
• Place name, 0 to 21 bytes: optional short UTF-8 text
• Check, 2 bytes: CRC-16 over every byte before it
This is a starting point. Spec 1 turns it into exact rules. Suggest changes if something is wrong, but keep the total at 40 bytes or less.
Reject any message with an unknown version or a failed check. Spec 1 should also say whether a 2-byte check is strong enough for promise 1, or whether it needs 4 bytes.
Tech rules
• Vite, TypeScript and React. No backend.
• Hosted on GitHub Pages under the /dead-air/ path, for now. It will later move to its own subdomain, so asset paths and the service worker scope must work both under a sub-path and at the root of a domain.
• Sound uses the ggwave npm package (MIT license). Follow its official browser example in the ggwave repo, examples/ggwave-js, including how it sets sample rates.
• Tests use Vitest, with fast-check for property tests.
• Offline works through a service worker that saves every file the app needs on the first visit and then serves from that saved copy.
• Keep dependencies few. Ask before adding a new one.
Sound rules
• Ask for the microphone with echoCancellation, noiseSuppression and autoGainControl turned off. They are tuned for voices and can damage the tones.
• Create or resume the audio context only after the user taps something. Phone browsers block audio before that.
• The microphone only works on https or localhost.
• Never assume a transmission arrived intact. Everything received goes through the check.
• ggwave carries about 8 to 16 bytes per second, so payloads stay small.
How we work
• One spec at a time, in this order: message code, Listen page, Broadcast page, offline, languages and read aloud, the Teletext look, pass it on, samples and help.
• Requirements first, then design, then tasks. Wait for approval between phases.
• The message code gets property tests for three things: any alert survives encode then decode, any single changed byte is caught, and an expired alert is never reported as current.
• Stay inside the current spec. Ask before changing files that belong to another one.
• UI text and docs use plain words. No emoji in the UI.