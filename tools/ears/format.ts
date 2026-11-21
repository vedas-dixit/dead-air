// Turns tool results into plain text for the MCP client. Numbers come from the result, never recomputed.
import type { HearWavResult, MakeBroadcastResult, RoundTripResult } from './handlers';

export function formatMake(r: MakeBroadcastResult): string {
  return [
    `make_broadcast: wrote ${r.path}`,
    `length: ${r.seconds} s, sample rate: ${r.sampleRate} Hz, message: ${r.messageBytes} bytes`,
    JSON.stringify(r, null, 2),
  ].join('\n');
}

export function formatHear(r: HearWavResult): string {
  const lines = [`hear_wav: ${r.summary} (${r.heard} payload(s), ${r.sampleRate} Hz)`];
  if (r.noise !== undefined) lines.push(`noise: ${r.noise.db} dB signal-to-noise, seed ${r.noise.seed}`);
  r.payloads.forEach((p, i) => {
    if (p.check === 'passed' && p.alert !== undefined) {
      lines.push(
        `payload ${i + 1}: check passed, ${p.bytes} bytes, sent ${p.sentUtc}, status: ${p.statusText}, TEST flag: ${p.alert.test}`,
      );
    } else {
      // A failed check shows only the length and the reason (promise 1).
      lines.push(`payload ${i + 1}: CHECK FAILED (${p.reason}), ${p.bytes} bytes, nothing shown`);
    }
  });
  lines.push(JSON.stringify(r, null, 2));
  return lines.join('\n');
}

export function formatRoundTrip(r: RoundTripResult): string {
  const lines: string[] = [];
  if (r.counts['wrong-alert'] > 0) {
    lines.push(
      `WARNING: a Check-passed alert did not match the sent alert (${r.counts['wrong-alert']} of ${r.tries} tries, fields: ${r.wrongAlertFields.join(', ') || 'unknown'})`,
    );
  }
  lines.push(
    `round_trip: ${r.tries} tries at ${r.noiseDb} dB (seed ${r.seed}, ${r.sampleRate} Hz)`,
    `successes: ${r.successes}, failures: ${r.failures}`,
    `ok: ${r.counts.ok}, wrong-alert: ${r.counts['wrong-alert']}, check-failed: ${r.counts['check-failed']}, nothing-heard: ${r.counts['nothing-heard']}`,
    `both plays heard in ${r.bothPlaysHeardTries} tries`,
    `sent alert status: ${r.sentStatusText}`,
    JSON.stringify(r, null, 2),
  );
  return lines.join('\n');
}
