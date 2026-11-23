import { AudioEngine, DEFAULT_AUDIO_TUNING, deltaSeconds, smooth } from './audio.js';
import type { AudioFrame, AudioTuning } from './audio.js';
import { StateMixer } from './state.js';
import type { StateWeights } from './state.js';
import type { VoiceAgentAdapter } from './types.js';
import type { AgentState } from './types.js';
import type { PresetName } from './presets/catalog.js';

export interface MotionTuning extends AudioTuning {
  readonly stiffness: number;
  readonly damping: number;
}

export const DEFAULT_MOTION_TUNING: MotionTuning = { ...DEFAULT_AUDIO_TUNING, stiffness: 287, damping: 22 };
export const MOTION_PROFILES: Readonly<Partial<Record<PresetName, MotionTuning>>> = {
  lumen: { attack: 0.022, release: 0.235, stiffness: 315, damping: 22, gain: 1.06, latency: 38 },
  silk: { attack: 0.036, release: 0.315, stiffness: 220, damping: 27, gain: 1.03, latency: 40 },
  'glass-ribbon': { attack: .040, release: .200, stiffness: 258, damping: 24, gain: 1, latency: 38 },
};

/** Idle period in seconds and a normalized amplitude for each preset. */
export const IDLE_RHYTHMS: Readonly<Record<PresetName, readonly [period: number, amplitude: number]>> = {
  "glass-ribbon": [4.76, .51],
  "kinetic-type": [10.2, .49],
  "jewel": [8.95, .64],
  "muse": [6.55, .57],
  "liquid-glass": [7.16, .43],
  "murmuration": [9.8, .92],
  "silk-veil": [7.85, .82],
  "ink-in-water": [9.35, .55],
  "aurora-veil": [8.65, .79],
  "mercury": [6.35, .68],
  lumen: [5.2, 1], silk: [6.8, 0.72], mirror: [7.5, 0.46], bloom: [5.8, 1.16],
  prism: [4.6, 0.62], stardust: [8.2, 0.87], dock: [3.8, 0.36], contour: [6.2, 0.94],
};

const LISTENING_LEAD = 0.20;
const RECOIL_WINDOW = 0.135;

function smoothstep(value: number) {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

export function motionTuning(variant: PresetName, override?: Partial<MotionTuning>): MotionTuning {
  const base = MOTION_PROFILES[variant] ?? DEFAULT_MOTION_TUNING;
  const bound = (key: keyof MotionTuning, min: number, max: number) => {
    const value = override?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : base[key];
  };
  return {
    attack: bound('attack', 0.009, 0.12), release: bound('release', 0.075, 0.60),
    stiffness: bound('stiffness', 60, 600), damping: bound('damping', 6, 48),
    gain: bound('gain', .25, 2.5), latency: bound('latency', 0, 80),
  };
}

/** Exact spring solution for a target held over this frame, including critical and overdamped cases. */
export class DampedSpring {
  velocity = 0;
  constructor(public value = 0) {}

  step(target: number, dt: number, stiffness: number, damping: number) {
    if (dt <= 0) return this.value;
    const displacement = this.value - target;
    const decay = damping * 0.5;
    const squared = stiffness - decay * decay;
    const previousVelocity = this.velocity;
    const falloff = Math.exp(-decay * dt);
    let wave: number, integral: number;
    if (squared > 0.0001) {
      const frequency = Math.sqrt(squared);
      wave = Math.cos(frequency * dt) * falloff;
      integral = Math.sin(frequency * dt) / frequency * falloff;
    } else if (squared < -0.0001) {
      const frequency = Math.sqrt(-squared);
      const one = Math.exp((-decay + frequency) * dt);
      const two = Math.exp((-decay - frequency) * dt);
      wave = (one + two) * 0.5;
      integral = (one - two) / (2 * frequency);
    } else {
      wave = falloff;
      integral = dt * falloff;
    }
    this.value = target + displacement * wave + (previousVelocity + decay * displacement) * integral;
    this.velocity = previousVelocity * wave - (stiffness * displacement + decay * previousVelocity) * integral;
    return this.value;
  }
}

export interface MotionFeatures {
  readonly inward: number;
  readonly outward: number;
  readonly weight: number;
  readonly sparkle: number;
  readonly sheen: number;
  readonly recoil: number;
  readonly rim: number;
  readonly anticipation: number;
  readonly accent: number;
  readonly speed: number;
}

export interface MotionTransport {
  /** Return simulation seconds, or zero to hold the current frame. */
  advance(delta: number): number;
}

export interface MotionPlayback {
  readonly tuning?: Partial<MotionTuning>;
  readonly transport?: MotionTransport;
  readonly onFrame?: (frame: MotionFrame, realDelta: number) => void;
  /** Render rate ceiling for small previews, with a supported minimum of 20 FPS. */
  readonly maxFps?: number;
  /** Device-pixel ratio ceiling for the render surface. */
  readonly maxPixelRatio?: number;
}

export interface MotionFrame {
  readonly time: number;
  readonly phase: number;
  readonly breath: number;
  readonly state: AgentState;
  readonly weights: StateWeights;
  readonly audio: AudioFrame;
  readonly x: number;
  readonly y: number;
  readonly attention: number;
  readonly pulse: number;
  readonly reducedMotion: boolean;
  readonly delta: number;
  readonly features: MotionFeatures;
  /** Ages of the most recent three output syllable onsets, from newest to oldest. */
  readonly beats: Float32Array;
  /** Strength of the matching onset packet. Restrained for ordinary syllables. */
  readonly beatStrengths: Float32Array;
}

export class MotionEngine {
  private readonly audio = new AudioEngine();
  private readonly mixer: StateMixer;
  private readonly features = { inward: 0, outward: 0, weight: 0, sparkle: 0, sheen: 0, recoil: 0, rim: 0, anticipation: 0, accent: 0, speed: 0.67 };
  private readonly beats = new Float32Array([9, 9, 9]);
  private readonly beatStrengths = new Float32Array(3);
  private readonly inward = new DampedSpring();
  private readonly outward = new DampedSpring();
  private readonly weight = new DampedSpring();
  private readonly recoil = new DampedSpring();
  private readonly idlePeriod: number;
  private readonly idleAmplitude: number;
  private readonly frame: {
    -readonly [Key in keyof MotionFrame]: MotionFrame[Key];
  };
  private targetX = 0;
  private targetY = 0;
  private targetAttention = 0;
  private elapsedSincePulse = Infinity;
  private lastAdapter: VoiceAgentAdapter;
  private lastOnset = 0;
  private lastRequest: AgentState = 'idle';
  private listeningAge = 0;
  private interruptAge = Infinity;

  constructor(adapter: VoiceAgentAdapter, preset?: PresetName) {
    this.lastAdapter = adapter;
    [this.idlePeriod, this.idleAmplitude] = preset ? IDLE_RHYTHMS[preset] : [5, 1];
    this.mixer = new StateMixer(adapter.state === 'interrupted' ? 'idle' : adapter.state);
    this.frame = {
      time: 0, phase: 0, breath: 0, state: adapter.state, weights: this.mixer.sample(adapter.state, 0), audio: this.audio.sample(adapter, 0),
      x: 0, y: 0, attention: 0, pulse: 0, reducedMotion: false, delta: 0,
      features: this.features, beats: this.beats, beatStrengths: this.beatStrengths,
    };
  }

  point(x: number, y: number) {
    this.targetX = Math.max(-1, Math.min(1, x));
    this.targetY = Math.max(-1, Math.min(1, y));
    this.targetAttention = 1;
  }

  release() {
    this.targetX = this.targetY = this.targetAttention = 0;
  }

  pulse() { this.elapsedSincePulse = 0; }

  peek(): MotionFrame { return this.frame; }

  sample(adapter: VoiceAgentAdapter, delta: number, reducedMotion: boolean, tuning = DEFAULT_MOTION_TUNING): MotionFrame {
    const dt = deltaSeconds(delta);
    const frame = this.frame;
    frame.delta = dt;
    if (!dt) return frame;
    if (this.lastAdapter !== adapter) {
      this.lastAdapter = adapter;
      this.audio.reset();
      this.lastOnset = 0;
      this.beats.fill(9);
      this.beatStrengths.fill(0);
      this.lastRequest = 'idle';
      this.listeningAge = 0;
      this.interruptAge = Infinity;
    }
    const motion = reducedMotion ? 0.18 : 1;
    this.elapsedSincePulse += dt;
    frame.time += dt * motion;
    frame.breath = Math.sin(frame.time * (Math.PI * 2 / this.idlePeriod)) * this.idleAmplitude;
    frame.x = smooth(frame.x, this.targetX * motion, dt, 0.11);
    frame.y = smooth(frame.y, this.targetY * motion, dt, 0.11);
    frame.attention = smooth(frame.attention, this.targetAttention, dt, 0.11);
    frame.pulse = Math.exp(-this.elapsedSincePulse * 6) * motion;
    const raw = adapter.state;
    if (raw === 'interrupted' && this.lastRequest !== raw && this.interruptAge >= 0.22) {
      this.interruptAge = 0;
      this.recoil.velocity = -11.5;
    }
    this.lastRequest = raw;
    this.interruptAge += dt;
    const recovering = raw !== 'error' && raw !== 'muted';
    const request = recovering && this.interruptAge <= RECOIL_WINDOW ? 'interrupted'
      : raw === 'interrupted' ? 'listening' : raw;
    frame.weights = this.mixer.sample(request, dt);
    frame.state = this.mixer.state;
    frame.audio = this.audio.sample(adapter, dt, tuning, frame.state);
    frame.reducedMotion = reducedMotion;

    const { input, output } = frame.audio;
    const { speaking, listening, thinking, muted, error } = frame.weights;
    const f = this.features;
    const { stiffness, damping } = tuning;
    const preListen = request === 'listening';
    const isListening = frame.state === 'listening';
    const isSpeaking = frame.state === 'speaking';
    this.listeningAge = preListen ? Math.min(.32, this.listeningAge + dt)
      : isListening && request === 'idle' ? this.listeningAge : 0;
    const lead = smoothstep(this.listeningAge / LISTENING_LEAD);
    const focusRamp = smoothstep((this.listeningAge - LISTENING_LEAD) / .12);
    f.rim = preListen ? lead * (1 - focusRamp * .72) : smooth(f.rim, 0, dt, .085);
    const held = raw === 'idle' ? .36 : 1;
    const incoming = isListening ? listening * (input.rms * .78 + input.peak * .22) * focusRamp * held : 0;
    const outgoing = isSpeaking ? speaking * (output.rms * .80 + output.peak * .20) * held : 0;
    const quietTurn = isListening ? !input.gateOpen || held < 1 : isSpeaking && (!output.gateOpen || held < 1);
    f.anticipation = smooth(f.anticipation, quietTurn ? .105 : 0, dt, .12);
    const dampingFloor = 2 * Math.sqrt(stiffness) * .96;
    f.accent = smooth(f.accent, isSpeaking ? smoothstep((output.onset - .64) / .25) * output.peak : 0, dt, .046);
    f.inward = Math.max(0, this.inward.step(incoming * .82 + (isListening ? f.anticipation * focusRamp : 0), dt, stiffness * .83, Math.max(damping, dampingFloor)));
    f.outward = Math.max(0, this.outward.step(outgoing * 1.04 + (isSpeaking ? f.anticipation * .6 + f.accent * .21 : 0),
      dt, stiffness, Math.max(damping, dampingFloor) * (1 - f.accent * .43)));
    f.weight = Math.max(0, this.weight.step(outgoing * .76, dt, stiffness * .88, Math.max(damping, dampingFloor)));
    f.sparkle = smooth(f.sparkle, isSpeaking ? speaking * (output.treble * .85 + output.presence * .27)
      : isListening ? listening * (input.treble * .17 + input.presence * .1) * focusRamp : 0, dt, .047);
    f.sheen = smooth(f.sheen, (isSpeaking ? speaking * output.centroid : isListening ? listening * input.centroid * .3 * focusRamp : 0), dt, .104);
    f.recoil = this.recoil.step(0, dt, stiffness * 1.08, damping * 0.64);
    // Solve dv/dt = drive - drag * (v - cruise), then integrate that velocity over the frame.
    const cruise = .67 - thinking * .21 - (muted + error) * .25;
    const drag = 3.1;
    const equilibrium = cruise + (outgoing * 1.34 + (isSpeaking ? f.accent * .36 : 0) - incoming * .57) / drag;
    const drift = f.speed - equilibrium;
    const integratedDecay = -Math.expm1(-drag * dt) / drag;
    frame.phase += (equilibrium * dt + drift * integratedDecay) * motion;
    f.speed -= drift * drag * integratedDecay;
    for (let i = 0; i < this.beats.length; i++) this.beats[i] = Math.min(9, this.beats[i] + dt * motion);
    if (output.onsetCount !== this.lastOnset && frame.state === 'speaking') {
      this.beats[2] = this.beats[1]; this.beats[1] = this.beats[0]; this.beats[0] = 0;
      this.beatStrengths[2] = this.beatStrengths[1];
      this.beatStrengths[1] = this.beatStrengths[0];
      this.beatStrengths[0] = .37 + smoothstep((output.onset - .64) / .25) * output.peak * .63;
    }
    this.lastOnset = output.onsetCount;
    return frame;
  }
}

type FrameCallback = (now: number) => void;

const frameLoops = new WeakMap<Window, { add(draw: FrameCallback): void; remove(draw: FrameCallback): void }>();

function frameLoop(win: Window) {
  const existing = frameLoops.get(win);
  if (existing) return existing;
  const callbacks = new Set<FrameCallback>();
  let frame: number | undefined;
  function tick(now: number) {
    frame = win.requestAnimationFrame(tick);
    for (const callback of callbacks) callback(now);
  }
  const loop = {
    add(draw: FrameCallback) {
      callbacks.add(draw);
      frame ??= win.requestAnimationFrame(tick);
    },
    remove(draw: FrameCallback) {
      callbacks.delete(draw);
      if (!callbacks.size && frame !== undefined) {
        win.cancelAnimationFrame(frame);
        frame = undefined;
      }
    },
  };
  frameLoops.set(win, loop);
  return loop;
}

/** Drives visible stages only. The optional frame interval is in milliseconds. */
export function observeMotion(element: HTMLElement, draw: (delta: number, reducedMotion: boolean, now: number) => void,
  frameInterval?: () => number) {
  const win = element.ownerDocument.defaultView;
  if (!win) return () => {};
  const doc = element.ownerDocument;
  const Observer = win.IntersectionObserver;
  const preference = win.matchMedia('(prefers-reduced-motion: reduce)');
  const loop = frameLoop(win);
  let last: number | undefined;
  let deadline: number | undefined;
  let previousInterval = 0;
  let running = false;
  let visible = !Observer;
  let reduced = preference.matches;

  function tick(now: number) {
    const interval = Math.max(reduced ? 48 : 0, frameInterval?.() ?? 0);
    if (interval !== previousInterval) deadline = last === undefined ? undefined : last + interval;
    previousInterval = interval;
    if (interval && deadline !== undefined && now + .75 < deadline) return;
    const delta = last === undefined ? 1 / 60 : (now - last) / 1000;
    // Retain fractional refresh intervals without rendering catch-up frames after a stall.
    deadline = !interval || deadline === undefined || now - deadline >= interval ? now + interval : deadline + interval;
    last = now;
    draw(delta, reduced, now);
  }

  function sync() {
    const active = visible && !doc.hidden;
    if (active === running) return;
    running = active;
    if (running) loop.add(tick);
    else {
      loop.remove(tick);
      last = undefined;
      deadline = undefined;
    }
  }

  const observer = Observer ? new Observer(entries => {
    visible = entries[entries.length - 1].isIntersecting;
    sync();
  }) : undefined;
  observer?.observe(element);
  const updatePreference = () => { reduced = preference.matches; };
  preference.addEventListener('change', updatePreference);
  doc.addEventListener('visibilitychange', sync);
  sync();

  return () => {
    observer?.disconnect();
    loop.remove(tick);
    preference.removeEventListener('change', updatePreference);
    doc.removeEventListener('visibilitychange', sync);
  };
}
