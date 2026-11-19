import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { AudioEngine, DemoAdapter, MicAdapter, StateMixer, AGENT_STATES, DampedSpring, MotionEngine, motionTuning, observeMotion } from '../dist/index.js';
import { PRESETS, PRESET_NAMES, VoiceAgent } from '@dasalon/voice-agent-ui';

test('a new state retargets an in-flight blend without a discontinuity', () => {
  const mixer = new StateMixer();
  for (let i = 0; i < 9; i++) mixer.sample('listening', 1 / 60);
  const listening = { ...mixer.sample('listening', 1 / 60) };
  assert.ok(listening.idle > 0.2 && listening.listening > 0.2);
  assert.deepEqual(mixer.sample('speaking', 0), listening);
  assert.deepEqual(mixer.sample('interrupted', 0), listening);
  for (let i = 0; i < 20; i++) mixer.sample('interrupted', 1 / 60);
  const finished = mixer.sample('interrupted', 0);
  assert.equal(finished.interrupted, 1);
  assert.equal(AGENT_STATES.reduce((sum, state) => sum + finished[state], 0), 1);
});

test('state hysteresis rejects brief toggles and clamps stalled frames', () => {
  const mixer = new StateMixer();
  for (let i = 0; i < 10; i++) {
    mixer.sample('speaking', 1 / 60);
    assert.equal(mixer.sample('idle', 1 / 60).idle, 1);
  }
  assert.equal(mixer.sample('thinking', 4).thinking, 0);
  assert.ok(mixer.sample('thinking', 4).thinking > 0);
  assert.ok(mixer.sample('thinking', 4).thinking < 1);
});

test('RMS and spectrum keep separate channels and release slower than they attack', () => {
  const engine = new AudioEngine();
  const spectrum = { bins: new Float32Array(512), sampleRate: 48000 };
  spectrum.bins[3] = 1;
  const adapter = {
    state: 'listening',
    inputLevel: () => 1,
    outputLevel: () => 0,
    frequencyData: channel => channel === 'input' ? spectrum : { ...spectrum, bins: new Float32Array() },
  };
  const frame = engine.sample(adapter, 0.045);
  const attack = frame.input.rms;
  assert.ok(attack > 0.6);
  assert.ok(frame.input.bass > 0);
  assert.equal(frame.input.mid, 0);
  assert.equal(frame.output.rms, 0);
  assert.equal(frame.output.bass, 0);
  adapter.state = 'muted';
  assert.equal(engine.sample(adapter, 0.045), frame);
  assert.ok(frame.input.rms / attack > 0.75);
  assert.ok(frame.input.rms < attack);
});

test('gate holds through a low syllable tail and gain leaves headroom for loud speech', () => {
  const engine = new AudioEngine();
  let rms = 0.001;
  const adapter = { state: 'listening', inputLevel: () => rms, outputLevel: () => 0,
    frequencyData: () => ({ bins: new Float32Array(0), sampleRate: 24000 }) };
  const advance = (frames) => {
    for (let i = 0; i < frames; i++) engine.sample(adapter, 1 / 60);
    return engine.sample(adapter, 0).input;
  };
  assert.equal(advance(40).gateOpen, false);
  rms = .008;
  const quiet = advance(150).rms;
  assert.ok(quiet > .36 && quiet < .78, quiet);
  rms = .001;
  assert.equal(advance(2).gateOpen, true);
  assert.equal(advance(12).gateOpen, false);
  rms = .87;
  const loud = advance(60).rms;
  assert.ok(loud > .37 && loud < .91, loud);
});

test('simulated phrase lookahead has exact future levels and produces distinct syllable onsets', () => {
  const demo = new DemoAdapter({ manual: true });
  demo.preview('speaking');
  const lead = demo.readSignal('output', .08).rms;
  assert.ok(lead > 0);
  demo.advance(.04);
  demo.advance(.04);
  assert.equal(demo.readSignal('output').rms, lead);
  const engine = new AudioEngine();
  for (let i = 0; i < 240; i++) {
    demo.advance(1 / 60);
    engine.sample(demo, 1 / 60, motionTuning('lumen'));
  }
  const levels = engine.sample(demo, 0);
  assert.ok(levels.output.onsetCount >= 7 && levels.output.onsetCount <= 23, levels.output.onsetCount);
  assert.equal(levels.input.rawRms, 0);
});

test('physical overshoot is stable across refresh rates and motion accumulates phase monotonically', () => {
  const simulate = (rate) => {
    const spring = new DampedSpring();
    let maximum = 0;
    for (let i = 0; i < rate; i++) maximum = Math.max(maximum, spring.step(1, 1 / rate, 315, 22));
    return { maximum, value: spring.value };
  };
  const slow = simulate(30), fast = simulate(120);
  assert.ok(slow.maximum > 1.04 && slow.maximum < 1.15, slow.maximum);
  assert.ok(Math.abs(slow.value - fast.value) < 1e-8);
  const demo = new DemoAdapter({ manual: true });
  const engine = new MotionEngine(demo);
  demo.preview('speaking');
  let last = 0;
  for (let i = 0; i < 75; i++) {
    demo.advance(1 / 60);
    const frame = engine.sample(demo, i === 14 ? 7 : 1 / 60, false, motionTuning('lumen'));
    assert.ok(frame.phase > last && frame.phase - last < .09);
    assert.ok(frame.delta <= .05);
    last = frame.phase;
  }
});

test('preview cadence preserves elapsed time and discards time spent in a hidden tab', () => {
  let sequence = 0;
  let intersect;
  const pending = new Map();
  const preference = Object.assign(new EventTarget(), { matches: false });
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    defaultView: {
      IntersectionObserver: class {
        constructor(update) { intersect = isIntersecting => update([{ isIntersecting }]); }
        observe() {}
        disconnect() {}
      },
      matchMedia: () => preference,
      requestAnimationFrame: callback => { pending.set(++sequence, callback); return sequence; },
      cancelAnimationFrame: handle => pending.delete(handle),
    },
  });
  const frames = [];
  const stop = observeMotion({ ownerDocument: document }, (delta, reduced) => frames.push({ delta, reduced }), () => 1000 / 30);
  function tick(ms) {
    const callbacks = [...pending.values()];
    pending.clear();
    for (const callback of callbacks) callback(ms);
  }
  assert.equal(pending.size, 0);
  intersect(true);
  for (const timestamp of [0, 16.6, 33.1, 49.7, 66.5]) tick(timestamp);
  assert.deepEqual(frames.map(frame => Math.round(frame.delta * 1000)), [17, 33, 33]);

  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(pending.size, 0);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange'));
  preference.matches = true;
  preference.dispatchEvent(new Event('change'));
  for (const timestamp of [1000, 1016, 1033, 1050]) tick(timestamp);
  assert.deepEqual(frames.slice(3), [{ delta: 1 / 60, reduced: true }, { delta: .05, reduced: true }]);
  intersect(false);
  assert.equal(pending.size, 0);
  stop();
});

test('speech changes the body more than the base animation rate, and pausing holds phase', () => {
  const frequency = { bins: new Float32Array(16), sampleRate: 24000 };
  const adapter = {
    state: 'idle', inputLevel: () => 0, outputLevel: () => 1, frequencyData: () => frequency,
  };
  const engine = new MotionEngine(adapter);
  const dt = 1 / 60;
  for (let i = 0; i < 90; i++) engine.sample(adapter, dt, false);
  const idleSpeed = engine.peek().features.speed;
  adapter.state = 'speaking';
  let fastest = 0;
  for (let i = 0; i < 120; i++) {
    fastest = Math.max(fastest, engine.sample(adapter, dt, false).features.speed);
  }
  const { phase, features } = engine.peek();
  assert.ok(features.outward > .6);
  assert.ok(fastest < idleSpeed * 1.7, fastest);
  assert.equal(engine.sample(adapter, 0, false).delta, 0);
  assert.equal(engine.peek().phase, phase);
});

test('demo state snapshots are stable and muting preserves the selected scene', () => {
  const demo = new DemoAdapter();
  const changes = [];
  const unsubscribe = demo.subscribe(() => changes.push(demo.state));
  demo.preview('speaking');
  const speaking = demo.getSnapshot();
  assert.equal(speaking.transcript.at(-1).speaker, 'agent');
  demo.outputLevel();
  demo.frequencyData('output');
  assert.equal(demo.getSnapshot(), speaking);
  demo.mute(true);
  demo.mute(true);
  demo.mute(false);
  demo.stop();
  unsubscribe();
  assert.deepEqual(changes, ['speaking', 'muted', 'speaking', 'idle']);
});

test('a microphone grant arriving after stop releases the late stream', async (context) => {
  const previousAudioContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let resolveCapture;
  const capture = new Promise(resolve => { resolveCapture = resolve; });
  let closed = 0;
  let stopped = 0;
  class FakeAudioContext {
    state = 'running';
    async resume() {}
    async close() { closed++; this.state = 'closed'; }
  }

  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FakeAudioContext });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia: () => capture } },
  });
  context.after(() => {
    if (previousAudioContext) Object.defineProperty(globalThis, 'AudioContext', previousAudioContext);
    else delete globalThis.AudioContext;
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else delete globalThis.navigator;
  });

  const mic = new MicAdapter();
  const starting = mic.start();
  assert.equal(mic.state, 'connecting');
  await mic.stop();
  resolveCapture({ getTracks: () => [{ stop() { stopped++; } }] });
  await starting;
  assert.equal(mic.state, 'idle');
  assert.equal(stopped, 1);
  assert.equal(closed, 1);
});

test('all published preset paths and the unified component server-render', async () => {
  const adapter = new DemoAdapter();
  for (const variant of PRESET_NAMES) {
    const named = await import(`@dasalon/voice-agent-ui/${variant}`);
    const Component = named[PRESETS[variant].component];
    const reference = new RegExp(`data-voice-variant="${variant}"`);
    assert.match(renderToString(createElement(Component, { adapter })), reference);
    assert.match(renderToString(createElement(VoiceAgent, { adapter, variant })), reference);
  }
});
