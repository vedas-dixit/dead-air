// Strict WAV reader. 16-bit PCM, 1 or 2 channels, 16000 to 96000 Hz. Never throws.
export type WavReadResult =
  | { ok: true; sampleRate: number; samples: Float32Array }
  | { ok: false; reason: 'not-wav' | 'unsupported-wav' };

const NOT_WAV: WavReadResult = { ok: false, reason: 'not-wav' };
const UNSUPPORTED: WavReadResult = { ok: false, reason: 'unsupported-wav' };

function tag(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
}

export function readWav(bytes: Uint8Array): WavReadResult {
  try {
    return read(bytes);
  } catch {
    return NOT_WAV;
  }
}

function read(bytes: Uint8Array): WavReadResult {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12) return NOT_WAV;
  if (tag(bytes, 0) !== 'RIFF' || tag(bytes, 8) !== 'WAVE') return NOT_WAV;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 12;
  let fmt: { format: number; channels: number; rate: number; bits: number } | null = null;
  let data: { start: number; length: number } | null = null;
  while (pos + 8 <= bytes.length) {
    const id = tag(bytes, pos);
    const size = view.getUint32(pos + 4, true);
    const body = pos + 8;
    if (body + size > bytes.length) return NOT_WAV; // chunk runs past the end
    if (id === 'fmt ') {
      if (size < 16) return NOT_WAV;
      fmt = {
        format: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        rate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      if (data === null) data = { start: body, length: size };
    }
    pos = body + size + (size % 2); // odd sizes have one pad byte
  }
  if (fmt === null || data === null) return NOT_WAV;
  if (fmt.format !== 1 || fmt.bits !== 16 || (fmt.channels !== 1 && fmt.channels !== 2)) return UNSUPPORTED;
  if (fmt.rate < 16000 || fmt.rate > 96000) return UNSUPPORTED;
  const toFloat = (s: number): number => (s < 0 ? s / 32768 : s / 32767);
  const frames = Math.floor(data.length / (2 * fmt.channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    if (fmt.channels === 1) {
      samples[i] = toFloat(view.getInt16(data.start + i * 2, true));
    } else {
      const l = toFloat(view.getInt16(data.start + i * 4, true));
      const r = toFloat(view.getInt16(data.start + i * 4 + 2, true));
      samples[i] = (l + r) / 2;
    }
  }
  return { ok: true, sampleRate: fmt.rate, samples };
}
