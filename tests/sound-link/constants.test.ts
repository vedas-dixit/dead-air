import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SAMPLE_RATE, MAX_PAYLOAD_BYTES, MAX_SAMPLE_RATE, MIN_PAYLOAD_BYTES, MIN_SAMPLE_RATE, MODE, frameSize,
} from '../../src/sound-link';
import { readdirSync, readFileSync } from 'node:fs';

describe('constants', () => {
  it('has the approved values', () => {
    expect(DEFAULT_SAMPLE_RATE).toBe(48000);
    expect(MIN_SAMPLE_RATE).toBe(16000);
    expect(MAX_SAMPLE_RATE).toBe(96000);
    expect(MIN_PAYLOAD_BYTES).toBe(21);
    expect(MAX_PAYLOAD_BYTES).toBe(40);
    expect(MODE).toBe('AUDIBLE_FAST');
  });
  it('gives the measured frame sizes', () => {
    expect(frameSize(48000)).toBe(1024);
    expect(frameSize(44100)).toBe(941);
    expect(frameSize(16000)).toBe(342);
    expect(frameSize(96000)).toBe(2048);
  });
});

describe('source files', () => {
  const dir = 'src/sound-link';
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  const code = (f: string) => readFileSync(`${dir}/${f}`, 'utf8').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

  it('finds the source files', () => {
    expect(files).toEqual(expect.arrayContaining(['index.ts', 'sound-link.ts', 'listener.ts', 'wav.ts', 'constants.ts']));
  });
  it.each(files)('%s uses no browser API and no network', (f) => {
    const text = code(f);
    for (const name of ['window', 'document', 'navigator', 'AudioContext', 'Blob', 'fetch', 'XMLHttpRequest', 'localStorage', 'indexedDB', 'console', 'URL.createObjectURL', 'WebSocket', 'sendBeacon']) {
      expect(new RegExp(`\\b${name}\\b`).test(text), `${f} mentions ${name}`).toBe(false);
    }
  });
  it.each(files)('%s imports nothing from message-code', (f) => {
    expect(code(f)).not.toMatch(/message-code/);
  });
  it.each(files)('%s makes no use of the clock or random source', (f) => {
    expect(code(f)).not.toMatch(/Date\.now|new Date|Math\.random|performance\./);
  });
});
