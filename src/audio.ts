import type { AgentState, AudioChannel, FrequencyFrame, SignalSample, VoiceAgentAdapter } from './types.js';

export const EMPTY_FREQUENCIES: FrequencyFrame = { bins: new Float32Array(0), sampleRate: 48000 };
export const EMPTY_SIGNAL: SignalSample = { rms: 0, peak: 0, frequency: EMPTY_FREQUENCIES };
export const AUDIO_BANDS = ['bass', 'lowMid', 'mid', 'presence', 'treble'] as const;
const BAND_EDGES = [40, 220, 530, 1650, 4000, 9500];
const LOG_EDGES = Float32Array.from({ length: 49 }, (_, i) => 70 * (10000 / 70) ** (i / 48));

export interface AudioTuning {
  readonly attack: number;
  readonly release: number;
  readonly gain: number;
  /** Output compensation in milliseconds, from 0 to 80. */
  readonly latency: number;
}

export const DEFAULT_AUDIO_TUNING: AudioTuning = { attack: 0.026, release: 0.225, gain: 1, latency: 28 };

export function deltaSeconds(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(0.05, value)) : 0;
}

export function normalizedLevel(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

export function smooth(current: number, target: number, dt: number, tau: number) {
  return current + (target - current) * -Math.expm1(-dt / tau);
}

function follow(current: number, target: number, dt: number, attack: number, release: number) {
  return smooth(current, target, dt, target > current ? attack : release);
}

export function rmsLevel(samples: Float32Array) {
  let squares = 0;
  for (const sample of samples) squares += sample * sample;
  return samples.length ? normalizedLevel((Math.sqrt(squares / samples.length) - 0.008) / 0.21) : 0;
}

function levels() {
  return {
    rawRms: 0, rms: 0, peak: 0, bass: 0, lowMid: 0, mid: 0, presence: 0, treble: 0,
    centroid: 0, onset: 0, onsetCount: 0, gateOpen: false, gain: 1, spectrum: new Float32Array(48),
  };
}

export type AudioLevels = Readonly<ReturnType<typeof levels>>;
export interface AudioFrame {
  readonly input: AudioLevels;
  readonly output: AudioLevels;
}

function spectralLevel(bins: Float32Array, hzPerBin: number, low: number, high: number) {
  if (!bins.length || !Number.isFinite(hzPerBin) || hzPerBin <= 0) return 0;
  const start = Math.max(1, Math.floor(low / hzPerBin));
  const end = Math.min(bins.length, Math.max(start + 1, Math.ceil(high / hzPerBin)));
  let squares = 0;
  for (let index = start; index < end; index++) squares += normalizedLevel(bins[index]) ** 2;
  return end > start ? Math.sqrt(squares / (end - start)) : 0;
}

class SignalEnvelope {
  readonly levels = levels();
  private floor = 0.0017;
  private reference: number;
  private gateTail = 0;
  private previousRms = 0;
  private slope = 0;
  private fast = 0;
  private slow = 0;
  private cooldown = 0;

  constructor(private readonly channel: AudioChannel) {
    this.reference = channel === 'input' ? 0.040 : 0.085;
  }

  reset() {
    const f = this.levels;
    f.rawRms = f.rms = f.peak = f.centroid = f.onset = f.onsetCount = 0;
    f.bass = f.lowMid = f.mid = f.presence = f.treble = 0;
    f.gateOpen = false;
    f.gain = 1;
    f.spectrum.fill(0);
    this.floor = 0.0017;
    this.reference = this.channel === 'input' ? 0.040 : 0.085;
    this.gateTail = this.previousRms = this.slope = this.fast = this.slow = this.cooldown = 0;
  }

  update(adapter: VoiceAgentAdapter, dt: number, tuning: AudioTuning, silent: boolean) {
    const f = this.levels;
    const lead = this.channel === 'output' ? Math.max(0, Math.min(80, tuning.latency)) / 1000 : 0;
    const actual = silent ? EMPTY_SIGNAL : adapter.readSignal?.(this.channel, 0);
    const raw = silent ? 0 : normalizedLevel(actual?.rms ?? (this.channel === 'input' ? adapter.inputLevel() : adapter.outputLevel()));
    const future = lead && adapter.supportsLookahead && actual && !silent ? adapter.readSignal?.(this.channel, lead) : undefined;
    const rms = future ? normalizedLevel(future.rms) : raw;
    const signalPeak = normalizedLevel(future?.peak ?? actual?.peak ?? raw * 1.45);
    const frequency = future?.frequency ?? actual?.frequency ?? (silent ? EMPTY_FREQUENCIES : adapter.frequencyData(this.channel));
    const { bins, sampleRate } = frequency;
    const hzPerBin = bins.length ? sampleRate / (2 * bins.length) : 0;
    f.rawRms = raw;

    const threshold = Math.max(0.0031, Math.min(0.025, this.floor * 2.35 + 0.0013));
    if (!f.gateOpen && rms < threshold) this.floor = smooth(this.floor, rms, dt, 0.65);
    if (!silent && rms >= threshold * (f.gateOpen ? 0.63 : 1)) this.gateTail = 0.095;
    else this.gateTail = Math.max(0, this.gateTail - dt);
    f.gateOpen = !silent && this.gateTail > 0;

    this.slope = smooth(this.slope, (rms - this.previousRms) / dt, dt, 0.023);
    this.previousRms = rms;
    if (f.gateOpen && rms > threshold) this.reference = follow(this.reference, rms, dt, 0.18, 0.88);
    const prediction = future ? 0 : Math.min(rms * 0.36, Math.max(0, this.slope) * lead * 0.34);
    const ratio = tuning.gain / Math.max(0.006, this.reference * 1.28, rms * 0.76);
    const target = f.gateOpen ? 0.97 * Math.tanh((rms + prediction) * ratio) : 0;
    const peakTarget = f.gateOpen ? 0.98 * Math.tanh(signalPeak * ratio * 0.72) : 0;
    f.rms = follow(f.rms, target, dt, tuning.attack, tuning.release);
    f.peak = follow(f.peak, peakTarget, dt, tuning.attack * 0.65, tuning.release * 0.77);
    f.gain = ratio;

    let sum = 0, centroid = 0;
    for (let i = 0; i < f.spectrum.length; i++) {
      const signal = f.gateOpen ? spectralLevel(bins, hzPerBin, LOG_EDGES[i], LOG_EDGES[i + 1]) : 0;
      const value = signal * Math.sqrt(target);
      const power = signal * signal;
      sum += power;
      centroid += power * LOG_EDGES[i];
      f.spectrum[i] = follow(f.spectrum[i], value, dt, tuning.attack * 1.14, tuning.release);
    }
    for (let i = 0; i < AUDIO_BANDS.length; i++) {
      const band = AUDIO_BANDS[i];
      const rawBand = f.gateOpen ? spectralLevel(bins, hzPerBin, BAND_EDGES[i], BAND_EDGES[i + 1]) : 0;
      f[band] = follow(f[band], rawBand * Math.sqrt(target), dt, tuning.attack * (i < 2 ? 1.28 : .85), tuning.release * (i < 2 ? 1.05 : .8));
    }
    const brightness = sum > 0.001 ? Math.log2(1 + centroid / sum / 210) / 5.6 : 0;
    f.centroid = smooth(f.centroid, normalizedLevel(brightness), dt, 0.13);

    const body = target * 0.80 + peakTarget * 0.20;
    this.fast = smooth(this.fast, body, dt, 0.018);
    this.slow = smooth(this.slow, body, dt, 0.075);
    const edge = this.fast - this.slow;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.cooldown && f.gateOpen && target > 0.11 && edge > 0.058 + this.slow * 0.085) {
      f.onsetCount++;
      f.onset = normalizedLevel(0.32 + edge * 2.7);
      this.cooldown = 0.118;
    } else f.onset = smooth(f.onset, 0, dt, 0.079);
  }
}

export class AudioEngine {
  private readonly input = new SignalEnvelope('input');
  private readonly output = new SignalEnvelope('output');
  private readonly frame = { input: this.input.levels, output: this.output.levels };

  reset() { this.input.reset(); this.output.reset(); }

  /** The frame and all spectra are reused. Delta is in seconds. */
  sample(adapter: VoiceAgentAdapter, delta: number, tuning: AudioTuning = DEFAULT_AUDIO_TUNING, state: AgentState = adapter.state): AudioFrame {
    const dt = deltaSeconds(delta);
    if (!dt) return this.frame;
    const silent = state === 'error' || state === 'connecting' || (state === 'idle' && adapter.state === 'idle');
    this.input.update(adapter, dt, tuning, silent || state === 'muted');
    this.output.update(adapter, dt, tuning, silent);
    return this.frame;
  }
}

export class AnalyserMeter {
  private readonly analyser: AnalyserNode;
  private readonly source: MediaStreamAudioSourceNode;
  private readonly timeData: Float32Array<ArrayBuffer>;
  private readonly spectrum: Float32Array<ArrayBuffer>;
  private readonly frame: FrequencyFrame;
  private readonly reading: { rms: number; peak: number; frequency: FrequencyFrame };
  private sampleTime = -1;

  constructor(private readonly context: AudioContext, stream: MediaStream) {
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0;
    this.analyser.minDecibels = -82;
    this.analyser.maxDecibels = -24;
    this.timeData = new Float32Array(this.analyser.fftSize);
    this.spectrum = new Float32Array(this.analyser.frequencyBinCount);
    this.frame = { bins: this.spectrum, sampleRate: context.sampleRate };
    this.reading = { rms: 0, peak: 0, frequency: this.frame };
    this.source = context.createMediaStreamSource(stream);
    this.source.connect(this.analyser);
  }

  level() {
    this.analyser.getFloatTimeDomainData(this.timeData);
    return rmsLevel(this.timeData);
  }

  frequencies() {
    this.analyser.getFloatFrequencyData(this.spectrum);
    const floor = this.analyser.minDecibels;
    const range = this.analyser.maxDecibels - floor;
    for (let i = 0; i < this.spectrum.length; i++) this.spectrum[i] = normalizedLevel((this.spectrum[i] - floor) / range);
    return this.frame;
  }

  signal(): SignalSample {
    const time = this.context.currentTime;
    if (time === this.sampleTime) return this.reading;
    this.sampleTime = time;
    this.analyser.getFloatTimeDomainData(this.timeData);
    let squares = 0, peak = 0;
    for (const value of this.timeData) {
      squares += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
    this.reading.rms = Math.sqrt(squares / this.timeData.length);
    this.reading.peak = peak;
    this.frequencies();
    return this.reading;
  }

  dispose() {
    this.source.disconnect();
    this.analyser.disconnect();
  }
}
