// Turns samples into a WAV file: 44-byte header, 16-bit signed little-endian PCM, mono.
import { DEFAULT_SAMPLE_RATE, isValidSampleRate } from './constants';
import type { WavResult } from './types';

const HEADER_BYTES = 44;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

export function audioToWav(samples: unknown, sampleRate: number = DEFAULT_SAMPLE_RATE): WavResult {
  if (!(samples instanceof Float32Array)) return { ok: false, reason: 'not-float32' };
  if (samples.length === 0) return { ok: false, reason: 'empty' };
  if (!isValidSampleRate(sampleRate)) return { ok: false, reason: 'bad-sample-rate' };
  for (let i = 0; i < samples.length; i++) {
    if (!Number.isFinite(samples[i])) return { ok: false, reason: 'not-finite' };
  }
  const dataBytes = samples.length * 2;
  const wav = new Uint8Array(HEADER_BYTES + dataBytes);
  const view = new DataView(wav.buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // format chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(HEADER_BYTES + i * 2, Math.round(v < 0 ? v * 32768 : v * 32767), true);
  }
  return { ok: true, wav };
}
