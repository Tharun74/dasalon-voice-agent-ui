import { AdapterStore } from '@/src/adapters/store';
import { EMPTY_SIGNAL, normalizedLevel } from '@/src/audio';
import type { AudioChannel, VoiceAgentAdapter } from '@/src/types';

const FFT_SIZE = 1024;
const RATE = 24000;
const AUDIO_FADE = 0.012;
const HANN = Float32Array.from({ length: FFT_SIZE }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (FFT_SIZE - 1)));
const COSINE = Float32Array.from({ length: FFT_SIZE / 2 }, (_, i) => Math.cos(-2 * Math.PI * i / FFT_SIZE));
const SINE = Float32Array.from({ length: FFT_SIZE / 2 }, (_, i) => Math.sin(-2 * Math.PI * i / FFT_SIZE));
const REVERSE = Uint16Array.from({ length: FFT_SIZE }, (_, value) => {
  let index = 0;
  for (let i = 0; i < 10; i++) { index = (index << 1) | (value & 1); value >>= 1; }
  return index;
});

function measurement() {
  return { rms: 0, peak: 0, frequency: { bins: new Float32Array(FFT_SIZE / 2), sampleRate: RATE } };
}

class ClipAnalysis {
  private readonly real = new Float32Array(FFT_SIZE);
  private readonly imag = new Float32Array(FFT_SIZE);
  private readonly frames = [measurement(), measurement()];
  private readonly positions = [-1, -1];
  private readonly channels: Float32Array[];

  constructor(buffer: AudioBuffer) {
    this.channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  }

  read(seconds: number, ahead: boolean) {
    const page = Number(ahead);
    const center = Math.round(seconds * RATE / 64) * 64;
    const analysis = this.frames[page];
    if (center === this.positions[page]) return analysis;
    this.positions[page] = center;

    let squares = 0, peak = 0;
    let strongest = -1;
    let samples = this.channels[0];
    const start = center - FFT_SIZE / 2;
    // Measure power before combining channels so stereo phase cannot cancel the motion signal.
    for (const channel of this.channels) {
      let power = 0;
      for (let i = center - FFT_SIZE / 4; i < center + FFT_SIZE / 4; i++) {
        const value = channel[i] ?? 0;
        power += value * value;
        peak = Math.max(peak, Math.abs(value));
      }
      squares += power;
      if (power > strongest) {
        strongest = power;
        samples = channel;
      }
    }
    // One FFT on the strongest channel retains syllable detail without extra transforms for stereo.
    for (let i = 0; i < FFT_SIZE; i++) {
      this.real[REVERSE[i]] = (samples[start + i] ?? 0) * HANN[i];
      this.imag[REVERSE[i]] = 0;
    }
    analysis.rms = Math.sqrt(squares / (FFT_SIZE / 2 * this.channels.length));
    analysis.peak = peak;

    for (let length = 2; length <= FFT_SIZE; length *= 2) {
      const half = length / 2;
      const stride = FFT_SIZE / length;
      for (let offset = 0; offset < FFT_SIZE; offset += length) {
        for (let j = 0; j < half; j++) {
          const left = offset + j, right = left + half, twiddle = j * stride;
          const r = this.real[right] * COSINE[twiddle] - this.imag[right] * SINE[twiddle];
          const i = this.real[right] * SINE[twiddle] + this.imag[right] * COSINE[twiddle];
          this.real[right] = this.real[left] - r;
          this.imag[right] = this.imag[left] - i;
          this.real[left] += r;
          this.imag[left] += i;
        }
      }
    }
    const bins = analysis.frequency.bins;
    for (let i = 0; i < bins.length; i++) {
      const magnitude = Math.hypot(this.real[i], this.imag[i]) * 4 / FFT_SIZE;
      bins[i] = normalizedLevel((20 * Math.log10(Math.max(magnitude, 1e-7)) + 82) / 58);
    }
    return analysis;
  }
}

export class ClipAdapter extends AdapterStore implements VoiceAgentAdapter {
  readonly supportsLookahead = true;
  private readonly analysis: ClipAnalysis;
  private context?: AudioContext;
  private voice?: { source: AudioBufferSourceNode; gain: GainNode };
  private offset = 0;
  private started = 0;
  private rate = 1;
  private generation = 0;
  private direction: 'listening' | 'speaking' = 'speaking';
  private muted = false;

  static async decode(bytes: ArrayBuffer) {
    const decoder = new OfflineAudioContext(1, 1, RATE);
    return new ClipAdapter(await decoder.decodeAudioData(bytes));
  }

  private constructor(private readonly buffer: AudioBuffer) {
    super();
    this.analysis = new ClipAnalysis(buffer);
    this.update({ state: this.direction });
  }

  get duration() { return this.buffer.duration; }
  get playing() { return this.voice !== undefined; }

  position() {
    return this.voice && this.context
      ? Math.min(this.duration, this.offset + (this.context.currentTime - this.started) * this.rate)
      : this.offset;
  }

  setDirection(direction: 'listening' | 'speaking') {
    this.direction = direction;
    if (!this.muted) this.update({ state: direction, error: undefined });
  }

  setRate(rate: number) {
    this.offset = this.position();
    this.rate = rate;
    if (this.voice && this.context) {
      this.started = this.context.currentTime;
      this.voice.source.playbackRate.setValueAtTime(rate, this.started);
    }
  }

  async start() {
    if (this.voice) return;
    const generation = ++this.generation;
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
      if (this.generation !== generation || this.voice) return;
      if (this.offset >= this.duration - .001) this.offset = 0;
      this.play();
      this.update({ state: this.muted ? 'muted' : this.direction, error: undefined });
    } catch {
      if (this.generation === generation) this.update({ state: 'error', error: 'This browser could not start audio playback.' });
    }
  }

  private play() {
    const context = this.context;
    if (!context || this.offset >= this.duration) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const voice = { source, gain };
    source.buffer = this.buffer;
    source.playbackRate.value = this.rate;
    this.started = context.currentTime;
    gain.gain.setValueAtTime(0, this.started);
    gain.gain.linearRampToValueAtTime(this.muted ? 0 : 1, this.started + AUDIO_FADE);
    source.connect(gain);
    gain.connect(context.destination);
    this.voice = voice;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (this.voice !== voice) return;
      this.voice = undefined;
      this.offset = this.duration;
      this.update({ state: 'idle' });
    };
    source.start(this.started, this.offset);
  }

  stop() {
    this.generation++;
    this.offset = this.position();
    const voice = this.voice;
    if (!voice || !this.context) return;
    this.voice = undefined;
    const now = this.context.currentTime;
    this.fade(voice.gain.gain, 0, now);
    voice.source.stop(now + AUDIO_FADE);
  }

  seek(seconds: number) {
    const playing = this.playing;
    this.stop();
    this.offset = Math.max(0, Math.min(this.duration, seconds));
    if (!this.muted) this.update({ state: this.direction });
    if (playing && this.offset < this.duration) this.play();
    else if (playing) this.update({ state: 'idle' });
  }

  mute(muted: boolean) {
    this.muted = muted;
    if (this.voice && this.context) this.fade(this.voice.gain.gain, muted ? 0 : 1, this.context.currentTime);
    this.update({ state: muted ? 'muted' : this.direction });
  }

  dispose() {
    this.stop();
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
  }

  private fade(gain: AudioParam, value: number, now: number) {
    if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(now);
    else {
      const current = gain.value;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(current, now);
    }
    gain.linearRampToValueAtTime(value, now + AUDIO_FADE);
  }

  readSignal(channel: AudioChannel, ahead = 0) {
    const expected = this.direction === 'speaking' ? 'output' : 'input';
    if (channel !== expected || this.muted) return EMPTY_SIGNAL;
    let time = this.position();
    if (this.voice && this.context) {
      const stamp = this.context.getOutputTimestamp?.();
      if (stamp?.contextTime !== undefined && stamp.performanceTime !== undefined && stamp.performanceTime > 0) {
        const heardTime = stamp.contextTime + Math.max(0, (performance.now() - stamp.performanceTime) / 1000);
        time = this.offset + Math.max(0, heardTime - this.started) * this.rate;
      }
    }
    return this.analysis.read(Math.min(this.duration, time + ahead * this.rate), ahead > 0);
  }

  inputLevel() { return this.readSignal('input').rms; }
  outputLevel() { return this.readSignal('output').rms; }
  frequencyData(channel: AudioChannel = this.direction === 'speaking' ? 'output' : 'input') { return this.readSignal(channel).frequency; }
}
