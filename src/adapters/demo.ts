import { EMPTY_SIGNAL } from '../audio.js';
import type { AgentState, AudioChannel, SignalSample, TranscriptEntry, VoiceAgentAdapter } from '../types.js';
import { AdapterStore } from './store.js';

const visitor: TranscriptEntry = { id: 'visitor-1', speaker: 'user', text: 'Do you have time for a gloss this Saturday?', final: true };
const concierge: TranscriptEntry = { id: 'concierge-1', speaker: 'agent', text: 'Of course. Sienna has a gloss appointment at eleven thirty.', final: true };
const interjection: TranscriptEntry = { id: 'visitor-2', speaker: 'user', text: 'Wait, what about a scalp treatment?', final: true };
const treatment: TranscriptEntry = { id: 'concierge-2', speaker: 'agent', text: 'I can walk you through the scalp ritual, too.', final: true };

const SEQUENCE = [
  ['idle', 1.3, []], ['connecting', 0.8, []], ['listening', 2.95, []], ['thinking', 1.53, [visitor]],
  ['speaking', 2.45, [visitor, concierge]], ['interrupted', 0.59, [visitor, concierge]],
  ['listening', 2.1, [visitor, concierge]], ['speaking', 2.75, [visitor, concierge, interjection, treatment]],
  ['muted', 1.35, [visitor, concierge, interjection, treatment]], ['error', 1.5, [visitor, concierge, interjection, treatment]],
] as const satisfies ReadonlyArray<readonly [AgentState, number, readonly TranscriptEntry[]]>;

interface DemoCue {
  readonly seconds: number;
  readonly label: string;
  readonly state: AgentState;
  readonly input?: number;
  readonly inputAt?: number;
  readonly output?: number;
}

interface DemoScenario {
  readonly label: string;
  readonly cues: readonly DemoCue[];
}

export const DEMO_SCENARIOS = {
  steady: { label: 'Steady speech', cues: [
    { seconds: .4, state: 'idle', label: 'Idle' },
    { seconds: 2.2, state: 'listening', input: 1, label: 'User phrase' },
    { seconds: .45, state: 'thinking', label: 'Turn gap' },
    { seconds: 2.8, state: 'speaking', output: 1, label: 'Agent reply' },
    { seconds: 1.1, state: 'idle', label: 'Release' },
  ] },
  hesitation: { label: 'Mid-sentence hesitation', cues: [
    { seconds: 1.45, state: 'speaking', output: 1, label: 'Agent starts' },
    { seconds: .46, state: 'idle', label: '460 ms hesitation' },
    { seconds: 2.2, state: 'speaking', output: 1, label: 'Same turn resumes' },
    { seconds: 1.15, state: 'idle', label: 'Turn ends' },
  ] },
  bargeIn: { label: 'User interruption (barge-in)', cues: [
    { seconds: 1.6, state: 'speaking', output: 1, label: 'Agent reply' },
    { seconds: .17, state: 'interrupted', input: .9, output: .45, label: 'User cuts in' },
    { seconds: 2.2, state: 'listening', input: 1.1, label: 'Re-focus on user' },
    { seconds: 1.1, state: 'idle', label: 'User finishes' },
  ] },
  overlap: { label: 'Overlapping speech', cues: [
    { seconds: 1.1, state: 'speaking', output: .85, label: 'Agent reply' },
    { seconds: 1.2, state: 'speaking', input: 1.4, output: .85, label: 'Both channels active' },
    { seconds: 1, state: 'speaking', output: .85, label: 'Agent continues' },
    { seconds: .42, state: 'thinking', label: 'Turn gap' },
    { seconds: 1.9, state: 'listening', input: 1, label: 'User takes the turn' },
    { seconds: 1.1, state: 'idle', label: 'Release' },
  ] },
  quietMic: { label: 'Quiet-mic input', cues: [
    { seconds: .5, state: 'idle', label: 'Idle' },
    { seconds: 3.25, state: 'listening', input: .13, label: 'User · 13% gain' },
    { seconds: 1.2, state: 'idle', label: 'Release' },
  ] },
  loudMic: { label: 'Loud-mic input', cues: [
    { seconds: .5, state: 'idle', label: 'Idle' },
    { seconds: 3.25, state: 'listening', input: 3.8, label: 'User · 380% gain' },
    { seconds: 1.2, state: 'idle', label: 'Release' },
  ] },
  recovery: { label: 'Recovery to idle', cues: [
    { seconds: 2.2, state: 'speaking', output: 1, label: 'Agent phrase' },
    { seconds: .6, state: 'idle', label: 'Anticipation hold' },
    { seconds: .55, state: 'idle', label: 'Idle blend' },
    { seconds: .045, state: 'listening', input: 3, inputAt: .16, label: '45 ms noise burst' },
    { seconds: 1.35, state: 'idle', label: 'Idle stays stable' },
  ] },
} as const satisfies Record<string, DemoScenario>;

export type DemoScenarioId = keyof typeof DEMO_SCENARIOS;

interface Syllable {
  start: number;
  length: number;
  stress: number;
  f1: number;
  f2: number;
  f3: number;
  pitch: number;
  pitchFall: number;
  breath: boolean;
}

const VOWELS = [[290, 2260, 3040], [700, 1320, 2670], [420, 890, 2640], [510, 1850, 2520], [365, 1420, 2860]];

function phrase(input: boolean) {
  const groups = input ? [[0.72, .46], [.61, .83, .48], [.78, .59, .64, .39]]
    : [[.48, .84, .62], [.51, .73, .42, .88], [.64, .55], [.87, .62, .44]];
  const gaps = input ? [.12, .22, .35] : [.09, .28, .095, .36];
  const syllables: Syllable[] = [];
  let start = input ? .09 : .045;
  let index = 0;
  for (let group = 0; group < groups.length; group++) {
    const words = groups[group];
    for (let syllable = 0; syllable < words.length; syllable++) {
      const stress = words[syllable];
      const paced = (input ? .213 : .195) + (index % 3 - 1) * .018 + (syllable === words.length - 1 ? .042 : 0);
      const [f1, f2, f3] = VOWELS[(index * 3 + (input ? 1 : 0)) % VOWELS.length];
      const pitch = (input ? 117 : 173) + group * (input ? 7 : 3) + stress * 16 - syllable * 5;
      syllables.push({ start, length: paced, stress, f1, f2, f3, pitch, pitchFall: input ? -4 : 14, breath: false });
      start += paced + (index % 2 ? .025 : .004);
      index++;
    }
    const gap = gaps[group];
    if (gap > .2) syllables.push({ start: start + .03, length: gap * .62, stress: .11, f1: 360, f2: 2040, f3: 3550, pitch: 0, pitchFall: 0, breath: true });
    start += gap;
  }
  return { duration: start, syllables };
}

const INPUT = phrase(true);
const OUTPUT = phrase(false);
const SAMPLE_RATE = 24000;

function buffer() {
  const bins = new Float32Array(256);
  return { time: -1, reading: { rms: 0, peak: 0, frequency: { bins, sampleRate: SAMPLE_RATE } } };
}

function populate(signal: ReturnType<typeof buffer>, seconds: number, input: boolean, volume: number) {
  const { reading } = signal;
  const bins = reading.frequency.bins;
  const script = input ? INPUT : OUTPUT;
  const time = seconds % script.duration;
  let beat: Syllable | undefined;
  for (const entry of script.syllables) {
    if (time >= entry.start && time <= entry.start + entry.length) { beat = entry; break; }
  }
  if (!beat) {
    reading.rms = reading.peak = 0;
    bins.fill(0);
    return;
  }
  const p = (time - beat.start) / beat.length;
  const attack = Math.min(1, p / (beat.breath ? .35 : .19));
  const tail = Math.max(0, 1 - (p - .43) / .57);
  const consonant = beat.breath ? .9 : Math.exp(-p * 12) * .55 + Math.max(0, p - .65) * .64;
  const vowel = Math.max(0, 1 - consonant);
  const phraseShape = .83 + .17 * Math.sin(seconds * 2.26 + (input ? 1.3 : 0));
  const r = beat.stress * attack * tail ** .8 * phraseShape * volume;
  reading.rms = Math.min(1, r * (input ? .20 : .30));
  reading.peak = Math.min(1, reading.rms * (beat.breath ? 1.4 : 2.05 + consonant * .4));
  const pitch = beat.pitch - beat.pitchFall * p + 3.2 * Math.sin(p * Math.PI);
  const form1 = beat.f1 * (.91 + p * .21);
  const form2 = beat.f2 * (1.07 - p * .13);
  for (let i = 0; i < bins.length; i++) {
    const hz = i * SAMPLE_RATE / (bins.length * 2);
    const harmonic = pitch > 0 ? .60 + .4 * Math.cos(hz / pitch * Math.PI * 2) : .42;
    const fundamental = Math.exp(-((hz - pitch) ** 2) / 10500) * .36;
    const formants = Math.exp(-((hz - form1) ** 2) / 85000) * .87
      + Math.exp(-((hz - form2) ** 2) / 263000) * .57
      + Math.exp(-((hz - beat.f3) ** 2) / 315000) * .32;
    const frication = Math.exp(-((hz - 4100) ** 2) / 3800000) * (.66 + .34 * Math.sin(i * 1.51 + seconds * 8.7));
    bins[i] = Math.min(1, Math.sqrt(r) * ((fundamental + formants * harmonic) * vowel + frication * consonant));
  }
}

export class DemoAdapter extends AdapterStore implements VoiceAgentAdapter {
  readonly supportsLookahead = true;
  private readonly frames = { input: [buffer(), buffer()], output: [buffer(), buffer()] };
  private sequenceIndex = 0;
  private generation = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private epoch = 0;
  private virtualTime = 0;
  private remaining = Infinity;
  private scene: AgentState = 'idle';
  private muted = false;
  private scenario?: DemoScenario;
  private scenarioDuration = 0;
  private scenarioStart = 0;
  private activeCue = 0;

  constructor(private readonly options: { manual?: boolean } = {}) { super(); }

  start() {
    this.cancelSequence();
    this.sequenceIndex = 1;
    this.muted = false;
    this.play(this.generation);
  }

  stop() {
    this.cancelSequence();
    this.muted = false;
    this.change('idle', []);
  }

  mute(muted: boolean) {
    this.muted = muted;
    this.update({ state: this.visibleState() });
  }

  preview(state: AgentState) {
    this.cancelSequence();
    this.muted = false;
    this.change(state, state === 'speaking' ? [visitor, concierge] : state === 'thinking' ? [visitor] : []);
  }

  playScenario(id: DemoScenarioId) {
    this.cancelSequence();
    this.muted = false;
    this.scenario = DEMO_SCENARIOS[id];
    this.scenarioDuration = this.scenario.cues.reduce((duration, cue) => duration + cue.seconds, 0);
    this.scenarioStart = this.now();
    this.activeCue = -1;
    this.play(this.generation);
  }

  get scenarioPosition() { return this.scenario ? Math.min(this.scenarioDuration, this.now() - this.scenarioStart) : 0; }
  get scenarioCue() { return this.scenario ? Math.min(this.activeCue, this.scenario.cues.length - 1) : -1; }

  /** Advances manually clocked demos. The default demo uses a monotonic wall clock. */
  advance(seconds: number) {
    if (!this.options.manual || !Number.isFinite(seconds) || seconds <= 0) return;
    let step = Math.min(seconds, .05);
    while (step >= this.remaining) {
      this.virtualTime += this.remaining;
      step -= this.remaining;
      this.play(this.generation);
    }
    this.virtualTime += step;
    this.remaining -= step;
  }

  readSignal(channel: AudioChannel, ahead = 0): SignalSample {
    const input = channel === 'input';
    const cue = this.scenario?.cues[this.activeCue];
    if (this.scenario) {
      const gain = input ? cue?.input : cue?.output;
      const lead = Math.max(0, Math.min(.08, ahead));
      if (!cue || !gain || (input && this.muted) || this.now() - this.epoch + lead >= cue.seconds) return EMPTY_SIGNAL;
      // Reuse the same phrase clock across overlapping turns and artificial gaps.
      const clock = this.scenarioPosition + lead;
      const seconds = input ? cue.inputAt ?? clock : clock;
      return this.signalFor(channel, ahead, seconds, gain);
    }
    const interrupted = this.scene === 'interrupted';
    if (input ? this.muted || (this.scene !== 'listening' && !interrupted) : this.scene !== 'speaking' && !interrupted) return EMPTY_SIGNAL;
    const elapsed = this.now() - this.epoch + Math.max(0, Math.min(.08, ahead));
    if (interrupted && (input ? elapsed < .055 : elapsed > .105)) return EMPTY_SIGNAL;
    const sceneTime = interrupted ? input ? elapsed + .15 : elapsed + 1.39 : Math.max(0, elapsed);
    return this.signalFor(channel, ahead, sceneTime, interrupted && !input ? Math.max(0, 1 - elapsed / .105) : 1);
  }

  private signalFor(channel: AudioChannel, ahead: number, seconds: number, gain: number) {
    const buffer = this.frames[channel][ahead > 0 ? 1 : 0];
    const time = Math.floor(seconds * 150) / 150;
    if (time !== buffer.time) {
      buffer.time = time;
      populate(buffer, time, channel === 'input', gain);
    }
    return buffer.reading;
  }

  inputLevel() { return this.readSignal('input').rms; }
  outputLevel() { return this.readSignal('output').rms; }
  frequencyData(channel: AudioChannel = this.state === 'speaking' ? 'output' : 'input') { return this.readSignal(channel).frequency; }

  private now() { return this.options.manual ? this.virtualTime : performance.now() / 1000; }

  private cancelSequence() {
    this.generation++;
    this.scenario = undefined;
    this.remaining = Infinity;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private play(generation: number) {
    if (this.scenario) {
      const cue = this.scenario.cues[++this.activeCue];
      if (!cue) {
        this.remaining = Infinity;
        this.change('idle', []);
        return;
      }
      this.change(cue.state, cue.state === 'speaking' ? [visitor, concierge] : []);
      if (generation === this.generation) this.schedule(cue.seconds, generation);
      return;
    }
    const [state, duration, transcript] = SEQUENCE[this.sequenceIndex];
    this.change(state, transcript);
    if (generation !== this.generation) return;
    this.sequenceIndex = (this.sequenceIndex + 1) % SEQUENCE.length;
    this.schedule(duration, generation);
  }

  private schedule(seconds: number, generation: number) {
    if (this.options.manual) this.remaining = seconds;
    else this.timer = setTimeout(() => this.play(generation), seconds * 1000);
  }

  private change(state: AgentState, transcript: readonly TranscriptEntry[]) {
    this.epoch = this.now();
    this.scene = state;
    this.frames.input[0].time = this.frames.input[1].time = this.frames.output[0].time = this.frames.output[1].time = -1;
    this.update({ state: this.visibleState(), transcript, error: state === 'error' ? 'Demo concierge is temporarily offline.' : undefined });
  }

  private visibleState() { return this.muted && this.scene !== 'error' ? 'muted' : this.scene; }
}
