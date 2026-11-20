import { AUDIO_BANDS } from '@/src/audio';
import type { MotionFrame } from '@/src/motion';
import { AGENT_STATES } from '@/src/types';

const LENGTH = 360;
const SAMPLE_WIDTH = 11;
const TRACE = ['#7ebec4', '#f2ab8e', '#e3a56c', '#c49ff4', '#8cc7ec', '#75dfb8', '#e68fc8', '#af8bb8'];
const TRACE_FIELD = [0, 1, 2, 3, 4, 5, 6, 10];
const STATE = ['#586577', '#c19968', '#78d7c6', '#a593f3', '#f6ab85', '#f37884', '#887f9b', '#b76273'];

export class Telemetry {
  private readonly data = new Float32Array(LENGTH * SAMPLE_WIDTH);
  private cursor = 0;
  private size = 0;
  private lastOnset = -1;
  private lastChannel = '';
  private counter = 0;
  private elapsed = 0;
  private smoothedMs = 16.67;
  private node?: HTMLCanvasElement;
  private stage?: CanvasRenderingContext2D;
  private stats?: HTMLOutputElement;
  private range?: HTMLInputElement;
  private position?: HTMLOutputElement;
  private paintElapsed = 0;
  private statsElapsed = 0;
  private latest?: MotionFrame;

  connect(canvas: HTMLCanvasElement | null, stats: HTMLOutputElement | null, range: HTMLInputElement | null, position: HTMLOutputElement | null) {
    this.node = canvas ?? undefined;
    this.stage = canvas?.getContext('2d') ?? undefined;
    this.stats = stats ?? undefined;
    this.range = range ?? undefined;
    this.position = position ?? undefined;
    this.paint();
  }

  reset() {
    this.cursor = this.size = this.counter = 0;
    this.elapsed = this.statsElapsed = this.paintElapsed = 0;
    this.lastOnset = -1;
    this.lastChannel = '';
    this.latest = undefined;
    this.paint();
    if (this.stats) {
      this.stats.dataset.frames = '0';
      this.stats.dataset.rms = '0';
      this.stats.dataset.onsets = '0';
      this.stats.dataset.inward = '0';
      this.stats.dataset.outward = '0';
      this.stats.dataset.rawRms = '0';
      this.stats.dataset.inputRaw = '0';
      this.stats.dataset.outputRaw = '0';
      this.stats.dataset.rim = '0';
      this.stats.dataset.anticipation = '0';
      this.stats.textContent = '0 frames · — FPS';
    }
  }

  record(frame: MotionFrame, dt: number, clipTime?: number, single = false, cue = -1) {
    const channel = frame.state === 'speaking' ? 'output' : 'input';
    const value = frame.audio[channel];
    this.latest = frame;
    const offset = this.cursor * SAMPLE_WIDTH;
    this.data[offset] = frame.audio.input.rawRms;
    this.data[offset + 1] = value.rms;
    for (let i = 0; i < AUDIO_BANDS.length; i++) this.data[offset + 2 + i] = value[AUDIO_BANDS[i]];
    const isOnset = value.onsetCount > 0 && (channel !== this.lastChannel ? value.onset > .51 : value.onsetCount !== this.lastOnset);
    this.data[offset + 7] = Number(isOnset);
    this.data[offset + 8] = AGENT_STATES.indexOf(frame.state);
    this.data[offset + 9] = cue;
    this.data[offset + 10] = frame.audio.output.rawRms;
    this.lastOnset = value.onsetCount;
    this.lastChannel = channel;
    this.cursor = (this.cursor + 1) % LENGTH;
    this.size = Math.min(this.size + 1, LENGTH);
    this.counter++;
    this.elapsed += frame.delta;
    this.smoothedMs += (dt * 1000 - this.smoothedMs) * -Math.expm1(-Math.min(.05, dt) / .32);
    this.paintElapsed += dt;
    this.statsElapsed += dt;
    if (this.paintElapsed >= .033 || this.counter === 1 || single) {
      this.paintElapsed = 0;
      this.paint();
      if (clipTime !== undefined) this.seekReadout(clipTime);
    }
    if (this.statsElapsed >= .24 || this.counter <= 2 || single) this.flush();
  }

  flush() {
    const frame = this.latest;
    const stats = this.stats;
    if (!frame || !stats) return;
    const value = frame.audio[frame.state === 'speaking' ? 'output' : 'input'];
    this.statsElapsed = 0;
    stats.dataset.frames = String(this.counter);
    stats.dataset.rawRms = value.rawRms.toFixed(4);
    stats.dataset.rms = value.rms.toFixed(4);
    stats.dataset.onsets = String(value.onsetCount);
    stats.dataset.inward = frame.features.inward.toFixed(3);
    stats.dataset.outward = frame.features.outward.toFixed(3);
    stats.dataset.inputRaw = frame.audio.input.rawRms.toFixed(4);
    stats.dataset.outputRaw = frame.audio.output.rawRms.toFixed(4);
    stats.dataset.rim = frame.features.rim.toFixed(3);
    stats.dataset.anticipation = frame.features.anticipation.toFixed(3);
    stats.textContent = `${Math.round(1000 / this.smoothedMs)} FPS · ${this.smoothedMs.toFixed(1)} ms · ${this.counter} frames · ${this.elapsed.toFixed(2)} s`;
  }

  seekReadout(seconds: number, updateControl = true) {
    if (this.range && updateControl) this.range.value = String(seconds);
    if (this.position) this.position.textContent = `${seconds.toFixed(2)} s`;
  }

  private paint() {
    const { node, stage } = this;
    if (!node || !stage) return;
    const width = node.clientWidth, height = node.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(1.5, node.ownerDocument.defaultView?.devicePixelRatio ?? 1);
    if (node.width !== Math.round(width * ratio) || node.height !== Math.round(height * ratio)) {
      node.width = Math.round(width * ratio); node.height = Math.round(height * ratio);
    }
    stage.setTransform(ratio, 0, 0, ratio, 0, 0);
    stage.fillStyle = '#101014';
    stage.fillRect(0, 0, width, height);
    const pad = 12, area = width - pad * 2, top = 13, rmsHeight = height * .33, bandTop = top + rmsHeight + 22;
    const bandHeight = height * .31, timeline = height - 17;
    stage.strokeStyle = '#ffffff19';
    stage.lineWidth = 1;
    stage.beginPath();
    for (let i = 0; i <= 4; i++) {
      const x = pad + area * i / 4;
      stage.moveTo(x, top); stage.lineTo(x, timeline);
    }
    for (let i = 0; i <= 4; i++) {
      stage.moveTo(pad, top + rmsHeight * i / 4); stage.lineTo(width - pad, top + rmsHeight * i / 4);
      stage.moveTo(pad, bandTop + bandHeight * i / 4); stage.lineTo(width - pad, bandTop + bandHeight * i / 4);
    }
    stage.stroke();
    const first = (this.cursor - this.size + LENGTH) % LENGTH;
    const step = area / Math.max(119, this.size - 1);
    const startX = width - pad - (this.size - 1) * step;
    for (let channel = 0; channel < TRACE.length; channel++) {
      const field = TRACE_FIELD[channel];
      const isRms = field < 2 || field === 10;
      stage.strokeStyle = TRACE[channel];
      stage.lineWidth = channel === 1 ? 1.75 : 1.15;
      stage.beginPath();
      for (let i = 0; i < this.size; i++) {
        const value = this.data[((first + i) % LENGTH) * SAMPLE_WIDTH + field];
        const x = startX + i * step;
        const y = isRms ? top + rmsHeight * (1 - value) : bandTop + bandHeight * (1 - value);
        if (i === 0) stage.moveTo(x, y); else stage.lineTo(x, y);
      }
      stage.stroke();
    }
    let previousCue = -1;
    for (let i = 0; i < this.size; i++) {
      const offset = ((first + i) % LENGTH) * SAMPLE_WIDTH;
      const x = startX + i * step;
      stage.fillStyle = STATE[this.data[offset + 8]];
      stage.fillRect(x, timeline, Math.max(1, step + .15), 6);
      const cue = this.data[offset + 9];
      if (cue >= 0 && cue !== previousCue) {
        stage.fillStyle = '#fafafa85';
        stage.fillRect(x, top, 1, timeline - top + 8);
      }
      previousCue = cue;
      if (this.data[offset + 7]) {
        stage.fillStyle = '#f6bd8d';
        stage.fillRect(x, top, 1, rmsHeight);
        stage.fillRect(x - 1, timeline - 8, 3, 6);
      }
    }
  }
}
