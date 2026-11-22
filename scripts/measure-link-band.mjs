// Measures the pitch range a Dead Air broadcast uses. Plain Node, no dependency.
//
// Usage: node scripts/measure-link-band.mjs <file.wav> [more.wav ...]
//
// Files are 16-bit PCM WAV files made from TEST alerts (for example by the
// dead-air-ears tool make_broadcast, into tools/ears/out/). Nothing is written.
//
// For every 1024-sample frame that has sound, the script takes a Hann-windowed
// DFT and adds the power per bin. It then reports the lowest and highest bin
// within 30 dB of the strongest bin, the share of total power inside that
// range, and the range in hertz. Files are grouped by sample rate, because the
// bin width (sampleRate / 1024) depends on it.
//
// It also compares Goertzel filter counts spread evenly over the measured range, with
// one Hann window over the whole block or two over its halves: how much the summed
// band power, in dB, varies from frame to frame while the broadcast plays steadily.
// This is how the filter count is chosen.
import { readFileSync } from 'node:fs';

const FRAME = 1024;
const WITHIN_DB = 30;
// A frame "has sound" when its RMS is within 40 dB of the loudest frame.
const SOUND_DB = 40;
// The band-power spread is taken over frames within 6 dB of the median frame (steady play,
// not the fade in and out at the ends).
const STEADY_DB = 6;
const FILTER_COUNTS = [8, 10, 12, 14, 16];
// Goertzel window lengths tried: the whole 1024 block, or two 512 halves summed.
const SUB_BLOCKS = [1024, 512];

export function readWav(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 44 || view.getUint32(0, false) !== 0x52494646) throw new Error('not a WAV file');
  let pos = 12;
  let channels = 1;
  let sampleRate = 0;
  let bits = 16;
  let data = null;
  while (pos + 8 <= bytes.length) {
    const id = view.getUint32(pos, false);
    const size = view.getUint32(pos + 4, true);
    const body = pos + 8;
    if (id === 0x666d7420) {
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bits = view.getUint16(body + 14, true);
    } else if (id === 0x64617461) {
      data = { start: body, length: Math.min(size, bytes.length - body) };
      break;
    }
    pos = body + size + (size % 2);
  }
  if (data === null || bits !== 16) throw new Error('need 16-bit PCM');
  const frames = Math.floor(data.length / (2 * channels));
  const samples = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += view.getInt16(data.start + (i * channels + c) * 2, true);
    samples[i] = sum / channels / 32768;
  }
  return { sampleRate, samples };
}

function hann(n) {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

// In-place radix-2 FFT.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

function goertzelPower(frame, window, freq, sampleRate) {
  const c = 2 * Math.cos((2 * Math.PI * freq) / sampleRate);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < frame.length; i++) {
    const s = frame[i] * window[i] + c * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}

const db = (p) => 10 * Math.log10(Math.max(p, 1e-30));

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  return s.length === 0 ? 0 : s[Math.floor(s.length / 2)];
}

/** Frames that have sound, with their per-bin power and summed band power. */
export function analyse(samples, sampleRate) {
  const window = hann(FRAME);
  const frames = [];
  for (let start = 0; start + FRAME <= samples.length; start += FRAME) {
    const frame = samples.subarray(start, start + FRAME);
    let sq = 0;
    for (let i = 0; i < FRAME; i++) sq += frame[i] * frame[i];
    const re = new Float64Array(FRAME);
    const im = new Float64Array(FRAME);
    for (let i = 0; i < FRAME; i++) re[i] = frame[i] * window[i];
    fft(re, im);
    const bins = new Float64Array(FRAME / 2 + 1);
    for (let k = 0; k <= FRAME / 2; k++) bins[k] = re[k] * re[k] + im[k] * im[k];
    frames.push({ frame, rms: Math.sqrt(sq / FRAME), bins });
  }
  const maxRms = Math.max(...frames.map((f) => f.rms), 1e-12);
  const sound = frames.filter((f) => 20 * Math.log10(f.rms / maxRms) > -SOUND_DB);
  return { frames, sound, window, sampleRate };
}

function bandFromTotals(total, binHz) {
  let peak = 0;
  for (let k = 1; k < total.length; k++) if (total[k] > peak) peak = total[k];
  const limit = peak / 10 ** (WITHIN_DB / 10);
  let lo = -1;
  let hi = -1;
  for (let k = 1; k < total.length; k++) {
    if (total[k] >= limit) {
      if (lo < 0) lo = k;
      hi = k;
    }
  }
  let all = 0;
  let inside = 0;
  for (let k = 0; k < total.length; k++) {
    all += total[k];
    if (k >= lo && k <= hi) inside += total[k];
  }
  return {
    loBin: lo,
    hiBin: hi,
    loHz: lo * binHz,
    hiHz: hi * binHz,
    strongestBin: total.indexOf(peak),
    share: inside / all,
    // Spread of the bins inside the range, in dB below the strongest.
    flatnessDb: db(peak) - db(Math.min(...Array.from(total.slice(lo, hi + 1)))),
  };
}

function spreadStats(valuesDb) {
  const mean = valuesDb.reduce((a, b) => a + b, 0) / valuesDb.length;
  const sd = Math.sqrt(valuesDb.reduce((a, b) => a + (b - mean) ** 2, 0) / valuesDb.length);
  return { min: Math.min(...valuesDb), max: Math.max(...valuesDb), mean, sd };
}

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : String(n));

function main(paths) {
  if (paths.length === 0) {
    console.error('Usage: node scripts/measure-link-band.mjs <file.wav> [more.wav ...]');
    process.exit(2);
  }
  const groups = new Map();
  for (const path of paths) {
    const { sampleRate, samples } = readWav(new Uint8Array(readFileSync(path)));
    const a = analyse(samples, sampleRate);
    const total = new Float64Array(FRAME / 2 + 1);
    for (const f of a.sound) for (let k = 0; k < total.length; k++) total[k] += f.bins[k];
    const band = bandFromTotals(total, sampleRate / FRAME);
    console.log(`\n${path}`);
    console.log(
      `  ${sampleRate} Hz, ${(samples.length / sampleRate).toFixed(2)} s, ${a.sound.length} of ${a.frames.length} frames with sound`,
    );
    console.log(
      `  bins ${band.loBin}-${band.hiBin} (${fmt(band.loHz, 0)}-${fmt(band.hiHz, 0)} Hz), share inside ${fmt(band.share * 100, 4)} %`,
    );
    let peakAbs = 0;
    for (const s of samples) peakAbs = Math.max(peakAbs, Math.abs(s));
    console.log(`  peak sample ${fmt(peakAbs, 4)}`);
    const g = groups.get(sampleRate) ?? { sampleRate, total: new Float64Array(FRAME / 2 + 1), sound: [], window: a.window };
    for (let k = 0; k < g.total.length; k++) g.total[k] += total[k];
    g.sound.push(...a.sound);
    groups.set(sampleRate, g);
  }

  for (const g of groups.values()) {
    const binHz = g.sampleRate / FRAME;
    const band = bandFromTotals(g.total, binHz);
    console.log(`\n=== ${g.sampleRate} Hz, all files together (bin width ${fmt(binHz, 3)} Hz) ===`);
    console.log(`lowest bin within ${WITHIN_DB} dB of the strongest: ${band.loBin} (${fmt(band.loHz, 0)} Hz)`);
    console.log(`highest bin within ${WITHIN_DB} dB of the strongest: ${band.hiBin} (${fmt(band.hiHz, 0)} Hz)`);
    console.log(`strongest bin: ${band.strongestBin} (${fmt(band.strongestBin * binHz, 0)} Hz)`);
    console.log(`share of total power inside: ${fmt(band.share * 100, 4)} %`);
    console.log(`range in hertz: ${fmt(band.loHz, 0)} to ${fmt(band.hiHz, 0)} (width ${fmt(band.hiHz - band.loHz, 0)} Hz)`);
    console.log(`weakest bin inside the range is ${fmt(band.flatnessDb, 1)} dB under the strongest (summed over all frames)`);

    // Band power per frame while the broadcast plays steadily: reference (sum of DFT bins
    // inside the range) and Goertzel sets, so the filter count is chosen from numbers.
    const medianRms = median(g.sound.map((f) => f.rms));
    const steady = g.sound.filter((f) => 20 * Math.log10(f.rms / medianRms) > -STEADY_DB);
    const reference = steady.map((f) => {
      let p = 0;
      for (let k = band.loBin; k <= band.hiBin; k++) p += f.bins[k];
      return db(p / FRAME);
    });
    const rs = spreadStats(reference);
    console.log(`frames within ${STEADY_DB} dB of the median frame: ${steady.length}`);
    console.log(
      `reference in-band power per frame (DFT bins ${band.loBin}-${band.hiBin}): peak-to-peak ${fmt(rs.max - rs.min, 1)}, sd ${fmt(rs.sd, 2)} dB`,
    );
    const windows = new Map();
    for (const sub of SUB_BLOCKS) {
      for (const n of FILTER_COUNTS) {
        const step = (band.hiHz - band.loHz) / n;
        const centres = Array.from({ length: n }, (_, i) => band.loHz + (i + 0.5) * step);
        if (!windows.has(sub)) windows.set(sub, hann(sub));
        const w = windows.get(sub);
        const levels = steady.map((f) => {
          let p = 0;
          for (let o = 0; o + sub <= FRAME; o += sub) {
            const part = f.frame.subarray(o, o + sub);
            for (const c of centres) p += goertzelPower(part, w, c, g.sampleRate);
          }
          return db(p / FRAME);
        });
        const s = spreadStats(levels);
        console.log(
          `${String(n).padStart(2)} filters, ${FRAME / sub} x ${sub}-sample Hann (every ${fmt(step, 0)} Hz): ` +
            `peak-to-peak ${fmt(s.max - s.min, 1)} dB, sd ${fmt(s.sd, 2)} dB`,
        );
      }
    }
  }
}

main(process.argv.slice(2));
