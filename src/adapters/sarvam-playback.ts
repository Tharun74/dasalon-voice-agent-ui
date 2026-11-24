import { EMPTY_SIGNAL } from '../audio.js';
import type { SignalSample } from '../types.js';
import { BARGE_IN_FADE_MS } from './sarvam-protocol.js';

export class VoiceAudioMeter {
  readonly node: AnalyserNode;
  private readonly samples: Float32Array<ArrayBuffer>;
  private readonly bins: Float32Array<ArrayBuffer>;
  private readonly signal: { rms: number; peak: number; frequency: SignalSample['frequency'] };
  private last = -1;

  constructor(private readonly context: AudioContext) {
    this.node = context.createAnalyser();
    this.node.fftSize = 1024;
    this.node.smoothingTimeConstant = 0;
    this.samples = new Float32Array(this.node.fftSize);
    this.bins = new Float32Array(this.node.frequencyBinCount);
    this.signal = { rms: 0, peak: 0, frequency: { bins: this.bins, sampleRate: context.sampleRate } };
  }

  read(): SignalSample {
    if (this.context.state !== 'running') return EMPTY_SIGNAL;
    if (this.last === this.context.currentTime) return this.signal;
    this.last = this.context.currentTime;
    this.node.getFloatTimeDomainData(this.samples);
    this.node.getFloatFrequencyData(this.bins);
    let sum = 0;
    let peak = 0;
    for (const sample of this.samples) {
      sum += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    for (let i = 0; i < this.bins.length; i++) this.bins[i] = Math.max(0, Math.min(1, (this.bins[i] + 82) / 58));
    this.signal.rms = Math.sqrt(sum / this.samples.length);
    this.signal.peak = peak;
    return this.signal;
  }
}

export class SpeechPlayback {
  private readonly gain: GainNode;
  private time = 0;
  private stopped = false;
  private readonly sources = new Set<AudioBufferSourceNode>();

  constructor(readonly context: AudioContext, analyser: AnalyserNode) {
    this.gain = context.createGain();
    this.gain.connect(analyser);
  }

  get endTime() { return this.time; }

  enqueue(pcm: Uint8Array<ArrayBuffer>, sampleRate: number) {
    if (this.stopped) return 0;
    const buffer = this.context.createBuffer(1, pcm.length / 2, sampleRate);
    const values = buffer.getChannelData(0);
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    for (let i = 0; i < values.length; i++) values[i] = view.getInt16(i * 2, true) / 32768;

    const next = this.context.currentTime;
    const start = this.time > next ? this.time : next + 0.045;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain);
    this.sources.add(source);
    source.onended = () => {
      source.disconnect();
      this.sources.delete(source);
    };
    source.start(start);
    this.time = start + buffer.duration;
    return start;
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    const now = this.context.currentTime;
    const end = now + BARGE_IN_FADE_MS / 1000;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(0, end);
    for (const source of this.sources) source.stop(end);
    setTimeout(() => this.gain.disconnect(), BARGE_IN_FADE_MS + 25);
  }
}

export async function pumpPcm(
  response: Response,
  playback: SpeechPlayback,
  signal: AbortSignal,
  firstChunk: () => void,
  firstScheduled: (contextTime: number) => void,
) {
  const rate = Number(response.headers.get('x-voice-sample-rate'));
  if (!response.body || !Number.isInteger(rate) || rate < 8_000 || rate > 48_000) throw new Error('Invalid audio stream');
  const reader = response.body.getReader();
  const block = new Uint8Array(Math.round(rate * 0.06) * 2);
  let used = 0;
  let received = false;
  let scheduled = false;
  const schedule = (pcm: Uint8Array<ArrayBuffer>) => {
    const start = playback.enqueue(pcm, rate);
    if (!scheduled) {
      scheduled = true;
      firstScheduled(start);
    }
  };
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { value, done } = await reader.read();
      if (done) break;
      if (!value.length) continue;
      if (!received) { received = true; firstChunk(); }
      let offset = 0;
      while (offset < value.length) {
        const count = Math.min(block.length - used, value.length - offset);
        block.set(value.subarray(offset, offset + count), used);
        used += count;
        offset += count;
        if (used === block.length) {
          schedule(block);
          used = 0;
        }
      }
    }
    signal.throwIfAborted();
    if (used % 2 || !received) throw new Error('Truncated audio stream');
    if (used > 0) schedule(block.subarray(0, used));
  } finally {
    signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
