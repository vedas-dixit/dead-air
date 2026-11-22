# Kiro's ears (dead-air-ears)

A small local MCP server that lets Kiro test Dead Air sound without a speaker or a phone. It runs on your machine with Node over stdio, makes no network connection, and reuses the message code, the sound link and the Broadcast sound-file composer. It is a developer aid. It is not part of the site build.

## Prepare

Run these in the workspace root:

```sh
npm install
npm run build:ears
```

`build:ears` writes one file, `tools/ears/build/ears.mjs` (git-ignored). Run it again after any change in `tools/ears/` or `src/`. Node 20 or newer is needed.

## Turn it on in Kiro

The server is registered in `.kiro/settings/mcp.json` as `dead-air-ears`. It starts switched off, and `autoApprove` is empty, so Kiro asks before every tool call.

1. Run `npm run build:ears` (see above).
2. Open the Kiro panel for MCP Servers and switch `dead-air-ears` on. Or open `.kiro/settings/mcp.json` and change `"disabled": true` to `"disabled": false`. Kiro reconnects when the file is saved.
3. Check that the server shows as connected and lists three tools: `make_broadcast`, `hear_wav` and `round_trip`.

The path in the settings is relative, so Kiro must be opened on this workspace.

## The tools

Every alert is a TEST alert. The tools refuse `"test": false`. Noise is white noise at a signal-to-noise ratio in dB (a lower number means more noise), added to clean audio. It is not a room. Tests on real speakers and phones are still needed.

### make_broadcast

Writes the same two-play WAV file the Broadcast page saves, into `tools/ears/out/` (git-ignored), and returns the path and length.

```json
{
  "alert": {
    "test": true, "passedOn": false, "hopCount": 0, "event": "flood", "urgency": "immediate",
    "severity": "severe", "action": "evacuate", "validSteps": 24,
    "latitude": 129716, "longitude": 775946, "stationId": 1234, "counter": 1,
    "placeName": "Riverside ward 4"
  }
}
```

`sentMinute` is optional and defaults to the current minute. `sampleRate` is optional (16000 to 96000, default 48000).

### hear_wav

Runs a WAV file through the decoder the Listen page uses. A message that fails its check shows only its length and the reason.

```json
{ "path": "tools/ears/out/dead-air-0123456789abcdef.wav", "noiseDb": -10 }
```

`noiseDb` (-60 to 60) and `seed` (default 1) are optional. WAV files must be 16-bit PCM, 1 or 2 channels, 16000 to 96000 Hz, up to 20 MB.

### round_trip

Makes a broadcast, adds noise, decodes, and counts results over N tries. The same inputs give the same result.

```json
{ "alert": { "test": true, "passedOn": false, "hopCount": 0, "event": "flood", "urgency": "immediate", "severity": "severe", "action": "evacuate", "validSteps": 24, "latitude": 129716, "longitude": 775946, "stationId": 1234, "counter": 1, "placeName": "Riverside ward 4" }, "noiseDb": -10, "tries": 20 }
```

`tries` is 1 to 200 (default 20). `seed` defaults to 1. Each try ends as `ok`, `wrong-alert`, `check-failed` or `nothing-heard`. A `wrong-alert` count above zero puts a WARNING on the first line of the result.

## Quick check without Kiro

```sh
node tools/ears/build/ears.mjs --call round_trip '{"alert":{"test":true,"passedOn":false,"hopCount":0,"event":"flood","urgency":"immediate","severity":"severe","action":"evacuate","validSteps":24,"latitude":null,"longitude":null,"stationId":1,"counter":1,"placeName":"x"},"noiseDb":0,"tries":3}'
```

`--call <tool> <json>` runs one tool and prints the result. It does not start the MCP server.
