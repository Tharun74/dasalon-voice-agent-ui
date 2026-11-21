import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { AudioEngine, DemoAdapter, DEMO_SCENARIOS, IDLE_RHYTHMS, MicAdapter, StateMixer, AGENT_STATES, DampedSpring, MotionEngine, motionTuning, observeMotion } from '../dist/index.js';
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

test('the listening rim leads contraction and the opposing audio channel cannot drive or tint a turn', () => {
  const model = (state, input, output) => {
    const adapter = { state: 'idle', inputLevel: () => input, outputLevel: () => output,
      frequencyData: () => ({ bins: new Float32Array(256).fill(.7), sampleRate: 24000 }) };
    const engine = new MotionEngine(adapter, 'silk');
    adapter.state = state;
    return () => engine.sample(adapter, .01, false, motionTuning('silk'));
  };
  const listen = model('listening', .09, 0), noisyListen = model('listening', .09, .94);
  const speak = model('speaking', 0, .09), noisySpeak = model('speaking', .94, .09);
  for (let i = 0; i < 120; i++) {
    const left = listen(), right = speak();
    assert.deepEqual(left.features, noisyListen().features);
    assert.deepEqual(right.features, noisySpeak().features);
    if (i === 14) { assert.ok(left.features.rim > .70); assert.equal(left.features.inward, 0); }
    if (i === 119) {
      assert.ok(left.features.inward > .4 && right.features.outward > .5);
      assert.equal(left.features.outward, 0); assert.equal(right.features.inward, 0);
    }
  }
});

test('hesitation holds the turn at low tension and a sustained release returns to stable idle', () => {
  const demo = new DemoAdapter({ manual: true });
  const engine = new MotionEngine(demo, 'lumen');
  const advance = () => { demo.advance(.01); return engine.sample(demo, .01, false); };
  demo.playScenario('hesitation');
  for (let i = 0; i < 193; i++) {
    const frame = advance();
    if (demo.scenarioCue === 1) {
      assert.equal(demo.state, 'idle');
      assert.equal(frame.state, 'speaking');
      if (demo.scenarioPosition > 1.81) assert.ok(frame.features.anticipation > .08 && frame.features.outward < .24);
    }
  }
  assert.equal(engine.peek().state, 'speaking');
  demo.playScenario('recovery');
  let sawNoise = false;
  for (let i = 0; i < 490; i++) {
    const frame = advance();
    if (demo.scenarioCue === 3) {
      sawNoise = true;
      assert.equal(frame.state, 'idle');
      assert.ok(frame.audio.input.rawRms > .01);
      assert.equal(frame.features.inward, 0);
    }
  }
  assert.ok(sawNoise);
  assert.equal(engine.peek().state, 'idle');
  assert.ok(engine.peek().weights.idle > .999);
});

test('barge-in recoils within 120 ms and then refocuses without a second impulse', () => {
  const demo = new DemoAdapter({ manual: true });
  const engine = new MotionEngine(demo, 'lumen');
  demo.preview('speaking');
  for (let i = 0; i < 90; i++) engine.sample(demo, .01, false);
  demo.preview('interrupted');
  let peak = 0;
  for (let i = 0; i < 11; i++) peak = Math.min(peak, engine.sample(demo, .01, false).features.recoil);
  assert.ok(peak < -.2, peak);
  for (let i = 0; i < 60; i++) engine.sample(demo, .01, false);
  assert.equal(engine.peek().state, 'listening');
  assert.ok(engine.peek().features.inward > .04);
  assert.ok(Math.abs(engine.peek().features.recoil) < .008);
});

test('all marked scenarios run on the manual clock and every preset has a distinct idle rhythm', () => {
  assert.equal(Object.keys(DEMO_SCENARIOS).length, 7);
  const demo = new DemoAdapter({ manual: true });
  for (const [id, scenario] of Object.entries(DEMO_SCENARIOS)) {
    demo.playScenario(id);
    const length = scenario.cues.reduce((total, cue) => total + cue.seconds, 0);
    const observed = new Set();
    let overlap = false;
    let inputPeak = 0;
    for (let tick = 0; tick <= Math.ceil(length * 100) + 2; tick++) {
      observed.add(demo.scenarioCue);
      inputPeak = Math.max(inputPeak, demo.inputLevel());
      if (demo.inputLevel() > .01 && demo.outputLevel() > .01) overlap = true;
      demo.advance(.01);
    }
    assert.equal(observed.size, scenario.cues.length);
    assert.equal(demo.state, 'idle');
    assert.equal(demo.scenarioPosition, length);
    if (id === 'overlap') assert.ok(overlap);
    if (id === 'quietMic') assert.ok(inputPeak > .006 && inputPeak < .025);
    if (id === 'loudMic') assert.ok(inputPeak > .3);
  }
  assert.equal(new Set(PRESET_NAMES.map(name => IDLE_RHYTHMS[name][0])).size, PRESET_NAMES.length);
  assert.equal(new Set(PRESET_NAMES.map(name => IDLE_RHYTHMS[name][1])).size, PRESET_NAMES.length);
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

  preference.matches = false;
  let on144Hz = 0;
  const stop144Hz = observeMotion({ ownerDocument: document }, () => { on144Hz++; }, () => 1000 / 60);
  intersect(true);
  for (let frame = 0; frame < 144; frame++) tick(2000 + frame * 1000 / 144);
  assert.equal(on144Hz, 60);
  stop144Hz();
});

test('visible presets share one frame request and unsubscribe independently', () => {
  const pending = new Map();
  let sequence = 0;
  const preference = Object.assign(new EventTarget(), { matches: false });
  const document = Object.assign(new EventTarget(), {
    hidden: false,
    defaultView: {
      matchMedia: () => preference,
      requestAnimationFrame: callback => { pending.set(++sequence, callback); return sequence; },
      cancelAnimationFrame: handle => pending.delete(handle),
    },
  });
  const frames = [];
  const drawLumen = observeMotion({ ownerDocument: document }, () => frames.push('lumen'));
  const drawSilk = observeMotion({ ownerDocument: document }, () => frames.push('silk'));
  assert.equal(pending.size, 1);
  pending.get(1)(0);
  pending.delete(1);
  assert.deepEqual(frames, ['lumen', 'silk']);
  drawLumen();
  pending.get(2)(17);
  pending.delete(2);
  assert.deepEqual(frames, ['lumen', 'silk', 'silk']);
  drawSilk();
  assert.equal(pending.size, 0);
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
