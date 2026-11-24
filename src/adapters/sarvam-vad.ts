import { MAX_RECORDING_MS, WAIT_FOR_SILENCE_MS } from './sarvam-protocol.js';

export class SpeechDetector {
  private floor = 0.003;
  private onsetMs = 0;
  private quietMs = 0;
  private turnMs = 0;
  private active = false;

  constructor(private readonly silenceMs = WAIT_FOR_SILENCE_MS) {}

  reset() {
    this.onsetMs = this.quietMs = this.turnMs = 0;
    this.active = false;
  }

  push(rms: number, ms: number, echo = 0, complete = true, listeningForInterruption = false): 'start' | 'end' | undefined {
    const signal = Math.max(0, rms - echo);
    const threshold = Math.max(0.006, this.floor * 3.25);
    if (!this.active) {
      if (signal < threshold && echo < 0.002) {
        this.floor += (signal - this.floor) * (1 - Math.exp(-ms / 1200));
      }
      this.onsetMs = signal >= threshold ? this.onsetMs + ms : 0;
      if (this.onsetMs >= (listeningForInterruption ? 60 : 100)) {
        this.active = true;
        return 'start';
      }
      return;
    }
    this.quietMs = signal < threshold * 0.58 ? this.quietMs + ms : 0;
    this.turnMs += ms;
    if (this.quietMs >= this.silenceMs + (complete ? 0 : 350) || this.turnMs >= MAX_RECORDING_MS) {
      this.reset();
      return 'end';
    }
  }
}

export function transcriptLooksComplete(text: string) {
  return !/(?:\b(?:and|or|but|at|for|with|umm?|uh|to|on)|[,–—-])\s*$/iu.test(text);
}

export function wavBlob(blocks: readonly Float32Array[], sourceRate: number, targetRate: number) {
  const source = new Float32Array(blocks.reduce((samples, block) => samples + block.length, 0));
  let offset = 0;
  for (const block of blocks) {
    source.set(block, offset);
    offset += block.length;
  }
  const ratio = sourceRate / targetRate;
  const samples = Math.floor(source.length / ratio);
  const wav = new DataView(new ArrayBuffer(44 + samples * 2));
  wav.setUint32(0, 0x52494646);
  wav.setUint32(4, 36 + samples * 2, true);
  wav.setUint32(8, 0x57415645);
  wav.setUint32(12, 0x666d7420);
  wav.setUint32(16, 16, true);
  wav.setUint16(20, 1, true);
  wav.setUint16(22, 1, true);
  wav.setUint32(24, targetRate, true);
  wav.setUint32(28, targetRate * 2, true);
  wav.setUint16(32, 2, true);
  wav.setUint16(34, 16, true);
  wav.setUint32(36, 0x64617461);
  wav.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index++) {
    const start = Math.floor(index * ratio);
    const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
    let sum = 0;
    for (let input = start; input < end; input++) sum += source[input];
    wav.setInt16(44 + index * 2, Math.round(Math.max(-1, Math.min(1, sum / (end - start))) * 32767), true);
  }
  return new Blob([wav.buffer], { type: 'audio/wav' });
}
