# Product: Dead Air

Dead Air is a web app that sends short emergency alerts from one device to nearby phones through sound. It is for moments when the internet and mobile networks are down but a speaker, a radio or a loudspeaker still works.

It is a Kiroween 2026 hackathon entry in the Resurrection category. The old tech it revives is the modem screech and data broadcast over radio. It wears the face of a mid-century radio.

## Users
- **Sender**: a control room, community radio host, or volunteer with a megaphone. Fills in a short form, presses "Go on air", and the device plays a few seconds of sound.
- **Listener**: anyone nearby with a phone that has opened the app once before. The phone hears the sound and shows the alert in the listener's language.

## Pieces
1. **Message code**: turns an alert into 21 to 40 bytes and back. Pure functions, no browser APIs.
2. **Listen page**: microphone in, decode, check, show. Keeps a history. When nothing has been heard, it says "Dead air. Last heard N min ago."
3. **Broadcast page**: the form, a "say this first" line for the sender to read aloud, Go on air, repeat every minute, save as a sound file.
4. **The look**: the radio look. Built later. Keep the UI plain until the look spec.

## Writing rules
- UI text and docs use plain words.
- No emoji in the UI.

## Work order
One spec at a time, in this order:
1. Message code
2. Sound link
3. Broadcast page
4. Listen page
5. Kiro's ears
6. Offline
7. Languages and read aloud
8. The radio look
9. Pass it on
10. Front page
11. Front page sprout (`.kiro/specs/front-sprout/`): the owner's flower growing out of one word on the front page
Requirements first, then design, then tasks. Wait for approval between phases. Stay inside the current spec. Ask before changing files that belong to another spec.
