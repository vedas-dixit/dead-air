# Sound rules

## Microphone
- Request the microphone with `echoCancellation`, `noiseSuppression` and `autoGainControl` all set to `false`. They are tuned for voices and can damage the tones.
- The microphone only works on https or localhost.
- Process audio in memory and discard it (promise 5).

## Audio context
- Create or resume the audio context only after the user taps something. Phone browsers block audio before that.
- Follow the ggwave official browser example (`examples/ggwave-js` in the ggwave repo), including how it sets sample rates.

## Reliability
- Never assume a transmission arrived intact. Everything received goes through the check (promise 1).
- ggwave carries about 8 to 16 bytes per second, so payloads stay small. The 40 byte limit on the message code comes from this.
- Test on real speakers and phones, not only in code. Room noise affects decoding.
