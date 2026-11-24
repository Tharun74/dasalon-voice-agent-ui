import { EMPTY_SIGNAL } from '../audio.js';
import type { AudioChannel, TranscriptEntry, VoiceAgentAdapter } from '../types.js';
import { AdapterStore } from './store.js';
import { SARVAM_LANGUAGES, VOICE_SAMPLE_RATE, readSse } from './sarvam-protocol.js';
import type { ApprovedSpeech, ChatEvent, SarvamLanguage, VoiceMetric } from './sarvam-protocol.js';
import { pumpPcm, SpeechPlayback, VoiceAudioMeter } from './sarvam-playback.js';
import { SpeechDetector, transcriptLooksComplete, wavBlob } from './sarvam-vad.js';

export { SARVAM_LANGUAGES } from './sarvam-protocol.js';
export type { SarvamLanguage, VoiceMetric } from './sarvam-protocol.js';

interface SessionData {
  token: string;
  mode: 'mock' | 'live';
  language: SarvamLanguage;
  expiresAt: number;
  greeting: ApprovedSpeech[];
  snapshots: boolean;
}

interface SarvamTurn {
  aborter: AbortController;
  playback?: SpeechPlayback;
  captions: Caption[];
  timer?: ReturnType<typeof setInterval>;
  drainage?: () => void;
  audioStarted: boolean;
  ttsFailed: boolean;
  ended: boolean;
  metrics: Set<VoiceMetric>;
  startedAt: number;
}
type Caption = { id: string; text: string; words: string[]; start: number; end: number; index: number; complete: boolean; done: boolean };

export interface SarvamAdapterOptions {
  endpoint?: string;
  language?: SarvamLanguage;
  silenceMs?: number;
  onMetric?: (name: VoiceMetric, elapsedMs: number) => void;
  onTurnStart?: () => void;
}

class VoiceHttpError extends Error {
  constructor(readonly status: number) { super('Voice request failed'); }
}

const processor = `
class VoiceCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.length = Math.round(sampleRate * 0.020);
    this.audio = new Float32Array(this.length);
    this.offset = 0;
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    let input = 0;
    while (input < channel.length) {
      const count = Math.min(this.audio.length - this.offset, channel.length - input);
      this.audio.set(channel.subarray(input, input + count), this.offset);
      this.offset += count;
      input += count;
      if (this.offset === this.audio.length) {
        this.port.postMessage(this.audio, [this.audio.buffer]);
        this.audio = new Float32Array(this.length);
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('voicekit-capture', VoiceCapture);
`;

export class SarvamAdapter extends AdapterStore implements VoiceAgentAdapter {
  private readonly speech: SpeechDetector;
  private readonly endpoint: string;
  private preferred: SarvamLanguage | undefined;
  private detected: SarvamLanguage | undefined;
  private session: SessionData | undefined;
  private connecting: Promise<SessionData> | undefined;
  private lifetime = new AbortController();
  private audio: AudioContext | undefined;
  private input: VoiceAudioMeter | undefined;
  private output: VoiceAudioMeter | undefined;
  private mic: MediaStream | undefined;
  private echoCancellation = false;
  private micSource: MediaStreamAudioSourceNode | undefined;
  private worklet: AudioWorkletNode | undefined;
  private turn: SarvamTurn | undefined;
  private preroll: Float32Array[] = [];
  private recording: Float32Array[] | undefined;
  private partial: AbortController | undefined;
  private partialCount = 0;
  private partialText = '';
  private recordingSamples = 0;
  private muted = false;
  private closed = false;
  private offline = false;
  private sequence = 0;
  private activeUserCaption = '';

  constructor(private readonly options: SarvamAdapterOptions = {}) {
    super();
    this.speech = new SpeechDetector(Math.max(550, Math.min(2500, options.silenceMs ?? 700)));
    this.endpoint = (options.endpoint ?? '/api/voice').replace(/\/$/u, '');
    this.preferred = options.language;
  }

  get mode() { return this.session?.mode; }
  get language() { return this.preferred ?? this.detected ?? this.session?.language; }
  get isOffline() { return this.offline; }
  get microphoneActive() { return Boolean(this.mic); }
  get isMuted() { return this.muted; }

  readSignal(channel: AudioChannel) {
    if (channel === 'input') return this.muted ? EMPTY_SIGNAL : this.input?.read() ?? EMPTY_SIGNAL;
    return this.output?.read() ?? EMPTY_SIGNAL;
  }
  inputLevel() { return this.readSignal('input').rms; }
  outputLevel() { return this.readSignal('output').rms; }
  frequencyData(channel = this.state === 'speaking' ? 'output' as const : 'input' as const) { return this.readSignal(channel).frequency; }

  async start() {
    if (this.mic || this.state === 'connecting') return;
    const lifetime = this.lifetime;
    this.closed = false;
    this.update({ state: 'connecting', permission: 'prompt', error: undefined });
    this.initPlayback();
    const session = this.getSession();
    // The session can fail while a permission dialog is open.
    void session.catch(() => undefined);
    try {
      await this.openMic(lifetime.signal);
      const established = await session;
      if (lifetime.signal.aborted) return;
      this.update({ permission: 'granted', state: this.turn ? this.state : this.muted ? 'muted' : 'idle' });
      if (this.transcript.length === 0) await this.greet(established);
    } catch (error) {
      if (lifetime.signal.aborted) return;
      this.releaseMic();
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      if (this.turn) {
        this.update({ permission: denied ? 'denied' : 'unavailable' });
        return;
      }
      this.offline = error instanceof VoiceHttpError || !globalThis.navigator?.onLine;
      this.update({ state: 'error', permission: denied ? 'denied' : 'unavailable',
        error: this.offline ? 'The voice service is unavailable. Please try again.' : 'Microphone access is unavailable. You can type instead.' });
    }
  }

  async stop() {
    this.lifetime.abort();
    this.lifetime = new AbortController();
    this.connecting = undefined;
    this.cancelTurn();
    this.clearCapture();
    this.releaseMic();
    const audio = this.audio;
    this.audio = this.output = undefined;
    if (audio && audio.state !== 'closed') await audio.close().catch(() => undefined);
    this.closed = false;
    this.update({ state: 'idle', error: undefined });
  }

  deleteConversation() {
    // The server retains only bounded topic IDs and counters, never transcript text.
    this.session = undefined;
    this.connecting = undefined;
    this.detected = undefined;
    const stopping = this.stop();
    this.update({ transcript: [] });
    return stopping;
  }

  mute(muted: boolean) {
    this.muted = muted;
    this.clearCapture();
    for (const track of this.mic?.getAudioTracks() ?? []) track.enabled = !muted;
    if (this.state === 'speaking' || this.state === 'thinking') {
      this.update({ ...this.getSnapshot(), transcript: this.transcript.slice() });
    } else {
      this.update({ state: muted ? 'muted' : 'idle' });
    }
  }

  setLanguage(language?: SarvamLanguage) {
    if (language && !SARVAM_LANGUAGES.includes(language)) return;
    this.preferred = language;
    this.detected = undefined;
  }

  interrupt() {
    if (!this.turn) return;
    this.cancelTurn();
    this.update({ state: 'interrupted' });
    const sequence = this.sequence;
    setTimeout(() => {
      if (this.sequence === sequence && this.state === 'interrupted') {
        this.update({ state: this.recording ? 'listening' : this.muted ? 'muted' : 'idle' });
      }
    }, 110);
  }

  async sendText(value: string) {
    const text = value.trim().slice(0, 800);
    if (!text) return;
    this.clearCapture();
    this.initPlayback();
    const turn = this.beginTurn();
    this.addCaption('user', text, true);
    await this.respond(text, this.preferred, turn);
  }

  private initPlayback() {
    try {
      if (!this.audio || this.audio.state === 'closed') {
        this.audio = new AudioContext();
        this.output = new VoiceAudioMeter(this.audio);
        this.output.node.connect(this.audio.destination);
      }
      void this.audio.resume().catch(() => undefined);
    } catch { /* captions are still available without Web Audio */ }
  }

  private async request(action: string, data: object | Blob, signal: AbortSignal, token?: string, language?: SarvamLanguage) {
    const headers: Record<string, string> = { 'Content-Type': data instanceof Blob ? 'audio/wav' : 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (language) headers['X-Voice-Language'] = language;
    let response: Response;
    try {
      response = await fetch(`${this.endpoint}/${action}`, {
        method: 'POST', headers, body: data instanceof Blob ? data : JSON.stringify(data), signal, cache: 'no-store',
      });
    } catch (error) {
      if (!signal.aborted) this.offline = true;
      throw error;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new VoiceHttpError(response.status);
    }
    return response;
  }

  private async getSession() {
    if (this.session && this.session.expiresAt > Date.now() + 10_000 && !this.closed) return this.session;
    if (!this.connecting) {
      const signal = this.lifetime.signal;
      this.connecting = this.request('session', { language: this.preferred }, signal)
        .then(async response => {
          const session: SessionData = await response.json();
          signal.throwIfAborted();
          this.session = session;
          this.closed = this.offline = false;
          return session;
        })
        .finally(() => { if (this.lifetime.signal === signal) this.connecting = undefined; });
    }
    return this.connecting;
  }

  private async requestWithSession(action: 'chat' | 'stt', data: object | Blob, signal: AbortSignal, language?: SarvamLanguage) {
    let session = await this.getSession();
    try {
      return { response: await this.request(action, data, signal, session.token, language), session };
    } catch (error) {
      if (!(error instanceof VoiceHttpError) || error.status !== 401) throw error;
      if (this.session === session) this.session = undefined;
      session = await this.getSession();
      return { response: await this.request(action, data, signal, session.token, language), session };
    }
  }

  private async openMic(signal: AbortSignal) {
    const audio = this.audio;
    if (!audio?.audioWorklet || !navigator.mediaDevices?.getUserMedia) throw new Error('Microphone unavailable');
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    if (signal.aborted || this.audio !== audio) {
      mic.getTracks().forEach(track => track.stop());
      return;
    }
    this.mic = mic;
    this.echoCancellation = mic.getAudioTracks().some(track => track.getSettings().echoCancellation === true);
    for (const track of mic.getAudioTracks()) track.enabled = !this.muted;
    const url = URL.createObjectURL(new Blob([processor], { type: 'text/javascript' }));
    try { await audio.audioWorklet.addModule(url); } finally { URL.revokeObjectURL(url); }
    signal.throwIfAborted();
    this.input = new VoiceAudioMeter(audio);
    this.micSource = audio.createMediaStreamSource(mic);
    this.worklet = new AudioWorkletNode(audio, 'voicekit-capture', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
    });
    // The worklet emits silence to the destination. The microphone is never looped back.
    this.micSource.connect(this.input.node);
    this.input.node.connect(this.worklet);
    this.worklet.connect(audio.destination);
    this.worklet.port.onmessage = (event: MessageEvent<Float32Array>) => this.capture(event.data, audio.sampleRate);
  }

  private releaseMic() {
    this.worklet?.port.close();
    this.worklet?.disconnect();
    this.input?.node.disconnect();
    this.micSource?.disconnect();
    this.mic?.getTracks().forEach(track => track.stop());
    this.worklet = this.micSource = this.input = this.mic = undefined;
    this.echoCancellation = false;
  }

  private clearCapture() {
    this.partial?.abort();
    if (this.recording && this.activeUserCaption) {
      this.update({ transcript: this.transcript.filter(entry => entry.id !== this.activeUserCaption || entry.final) });
    }
    this.partial = this.recording = undefined;
    this.partialCount = this.recordingSamples = 0;
    this.partialText = '';
    this.preroll = [];
    this.speech.reset();
  }

  private capture(block: Float32Array, rate: number) {
    if (this.muted || !this.mic || !this.session) return;
    let sum = 0;
    for (const value of block) sum += value * value;
    const rms = Math.sqrt(sum / block.length);
    const audible = this.state === 'speaking' || this.state === 'interrupted';
    if (audible && !this.echoCancellation && !this.recording) return;
    const echo = audible ? this.outputLevel() * 0.18 : 0;
    const event = this.speech.push(rms, block.length / rate * 1000, echo, transcriptLooksComplete(this.partialText), audible);
    if (!this.recording) {
      this.preroll.push(block);
      if (this.preroll.length > 10) this.preroll.shift();
    } else {
      this.recording.push(block);
      this.recordingSamples += block.length;
    }
    if (event === 'start') {
      this.interrupt();
      this.recording = this.preroll.slice();
      this.recordingSamples = this.recording.length * block.length;
      this.partialCount = 0;
      this.partialText = '';
      this.activeUserCaption = String(++this.sequence);
      if (this.state === 'interrupted') {
        const id = this.activeUserCaption;
        setTimeout(() => {
          if (this.activeUserCaption === id && this.recording && this.state === 'interrupted') this.update({ state: 'listening' });
        }, 110);
      } else {
        this.update({ state: 'listening', error: undefined });
      }
    }
    if (event === 'end' && this.recording) {
      const captured = this.recording;
      this.recording = undefined;
      const suffix = this.partialText;
      this.clearCapture();
      void this.transcribeTurn(captured, rate, suffix);
    } else if (this.recording && this.session.snapshots && !this.partial && this.partialCount < 2 &&
      this.recordingSamples / rate > 1.05 + this.partialCount * 1.3) {
      void this.transcribePartial(this.recording, rate, this.session);
    }
  }

  private async transcribePartial(blocks: Float32Array[], rate: number, session: SessionData) {
    const partial = new AbortController();
    this.partial = partial;
    this.partialCount++;
    const id = this.activeUserCaption;
    try {
      const response = await this.request('stt', wavBlob(blocks, rate, VOICE_SAMPLE_RATE), partial.signal, session.token, this.preferred);
      const { text }: { text: string } = await response.json();
      if (!partial.signal.aborted && this.recording && id === this.activeUserCaption && text) {
        this.partialText = text;
        this.caption(id, 'user', text, false);
      }
    } catch { /* final transcription can still succeed */ }
    finally { if (this.partial === partial) this.partial = undefined; }
  }

  private async transcribeTurn(blocks: Float32Array[], rate: number, interim: string) {
    const turn = this.beginTurn();
    const id = this.activeUserCaption;
    try {
      const audio = wavBlob(blocks, rate, VOICE_SAMPLE_RATE);
      const { response } = await this.requestWithSession('stt', audio, turn.aborter.signal, this.preferred);
      const { text, language }: { text: string; language: SarvamLanguage } = await response.json();
      this.metric(turn, 'stt-final');
      if (this.turn !== turn) return;
      if (!text.trim()) {
        if (interim) this.caption(id, 'user', interim, false);
        this.finish(turn, 'The microphone did not pick up a clear turn. Try again or type instead.');
        return;
      }
      this.detected = language;
      this.caption(id, 'user', text, true);
      await this.respond(text, this.preferred ?? language, turn);
    } catch {
      if (this.turn === turn) {
        if (interim) this.caption(id, 'user', interim, false);
        this.fail(turn, 'Transcription is unavailable. You can type instead.');
      }
    }
  }

  private beginTurn(): SarvamTurn {
    this.cancelTurn();
    const turn: SarvamTurn = {
      aborter: new AbortController(), captions: [], audioStarted: false, ttsFailed: false, ended: false,
      metrics: new Set(), startedAt: performance.now(),
    };
    if (this.audio && this.output) turn.playback = new SpeechPlayback(this.audio, this.output.node);
    this.turn = turn;
    this.offline = false;
    this.options.onTurnStart?.();
    this.update({ state: 'thinking', error: undefined });
    return turn;
  }

  private async greet(session: SessionData) {
    if (this.state === 'listening' || this.turn) return;
    const turn = this.beginTurn();
    await this.playQueue(session.greeting, session, turn);
    await this.drain(turn);
  }

  private async respond(text: string, language: SarvamLanguage | undefined, turn: SarvamTurn) {
    const signal = turn.aborter.signal;
    try {
      const { response, session } = await this.requestWithSession('chat', { text, language }, signal);
      if (!response.body) throw new Error('Missing voice events');
      let queue = Promise.resolve();
      let completed = false;
      let failed = false;
      for await (const item of readSse(response.body)) {
        signal.throwIfAborted();
        const event: ChatEvent = JSON.parse(item);
        if (event.kind === 'metric') this.metric(turn, event.name);
        if (event.kind === 'sentence') {
          this.metric(turn, 'sentence-ready');
          const prepared = this.prepareSpeech(event, session, turn);
          queue = queue.then(() => this.playSentence(event, prepared, turn));
        }
        if (event.kind === 'done') {
          this.closed = turn.ended = event.endSession;
          completed = true;
        }
        if (event.kind === 'error') failed = true;
      }
      await queue;
      if (failed || !completed) throw new Error('Conversation stream ended early');
      await this.drain(turn);
    } catch {
      if (this.turn === turn && !signal.aborted) this.fail(turn, 'The voice service did not finish the reply. Please try again.');
    }
  }

  private prepareSpeech(line: ApprovedSpeech, session: SessionData, turn: SarvamTurn) {
    if (!turn.playback || turn.playback.context.state !== 'running') return Promise.resolve(undefined);
    return this.request('tts', { grant: line.grant }, turn.aborter.signal, session.token).catch(() => undefined);
  }

  private async playQueue(lines: ApprovedSpeech[], session: SessionData, turn: SarvamTurn) {
    const requests = lines.map(line => this.prepareSpeech(line, session, turn));
    for (const [index, line] of lines.entries()) await this.playSentence(line, requests[index], turn);
  }

  private async playSentence(line: ApprovedSpeech, prepared: Promise<Response | undefined>, turn: SarvamTurn) {
    const response = await prepared;
    if (turn.aborter.signal.aborted) {
      void response?.body?.cancel().catch(() => undefined);
      return;
    }
    const id = String(++this.sequence);
    const words = line.text.split(/\s+/u);
    const caption: Caption = { id, text: line.text, words, start: Infinity, end: Infinity, index: 0, complete: false, done: false };
    turn.captions.push(caption);
    try {
      if (!response || !turn.playback) throw new Error('Audio unavailable');
      await pumpPcm(response, turn.playback, turn.aborter.signal, () => this.metric(turn, 'tts-first-chunk'), start => {
        caption.start = start;
        caption.end = start + Math.max(0.25, words.length / 2.8);
        this.watchPlayback(turn);
      });
      caption.end = turn.playback.endTime;
      caption.complete = true;
      this.tickCaptions(turn);
    } catch {
      if (!turn.aborter.signal.aborted) {
        turn.ttsFailed = true;
        caption.done = true;
        this.caption(id, 'agent', line.text, true);
        this.update({ error: 'Audio is unavailable for part of this reply. Read the captions below.' });
      }
    }
  }

  private watchPlayback(turn: SarvamTurn) {
    if (turn.timer !== undefined) return;
    turn.timer = setInterval(() => this.tickCaptions(turn), 20);
  }

  private tickCaptions(turn: SarvamTurn) {
    if (this.turn !== turn || !turn.playback) return;
    const { context } = turn.playback;
    const timestamp = context.getOutputTimestamp?.();
    const now = timestamp?.contextTime || Math.max(0, context.currentTime - context.baseLatency - (context.outputLatency || 0));
    for (const entry of turn.captions) {
      if (entry.done || now < entry.start) continue;
      if (!turn.audioStarted) {
        turn.audioStarted = true;
        this.metric(turn, 'first-sample');
        this.update({ state: 'speaking' });
      }
      const duration = Math.max(0.20, entry.end - entry.start);
      const words = Math.max(entry.index, Math.min(entry.words.length, 1 + Math.floor((now - entry.start) / duration * entry.words.length)));
      const final = entry.complete && now >= entry.end;
      if (words !== entry.index || final) {
        entry.index = words;
        entry.done = final;
        this.caption(entry.id, 'agent', final ? entry.text : entry.words.slice(0, words).join(' '), final);
      }
    }
    if (turn.drainage && now >= turn.playback.endTime) turn.drainage();
  }

  private async drain(turn: SarvamTurn) {
    if (this.turn !== turn) return;
    if (turn.playback && turn.playback.endTime > 0) {
      await new Promise<void>(resolve => {
        turn.drainage = resolve;
        this.tickCaptions(turn);
      });
    }
    this.finish(turn);
  }

  private finish(turn: SarvamTurn, error?: string) {
    if (this.turn !== turn) return;
    this.cancelTurn();
    if (!error && !turn.ttsFailed) this.offline = false;
    this.update({ state: this.muted ? 'muted' : 'idle', error: error ?? (turn.ttsFailed ? this.error :
      turn.ended ? 'This conversation has ended. You can start a new turn.' : undefined) });
  }

  private fail(turn: SarvamTurn, error: string) {
    if (this.turn !== turn) return;
    this.cancelTurn();
    this.update({ state: 'error', error });
  }

  private cancelTurn() {
    const turn = this.turn;
    if (!turn) return;
    this.turn = undefined;
    turn.aborter.abort();
    turn.playback?.stop();
    clearInterval(turn.timer);
    turn.drainage?.();
  }

  private metric(turn: SarvamTurn, name: VoiceMetric) {
    if (turn.metrics.has(name)) return;
    turn.metrics.add(name);
    this.options.onMetric?.(name, performance.now() - turn.startedAt);
  }

  private addCaption(speaker: TranscriptEntry['speaker'], text: string, final: boolean) {
    this.caption(String(++this.sequence), speaker, text, final);
  }

  private caption(id: string, speaker: TranscriptEntry['speaker'], text: string, final: boolean) {
    const transcript = [...this.transcript];
    const index = transcript.findIndex(entry => entry.id === id);
    const entry = { id, speaker, text, final };
    if (index >= 0) transcript[index] = entry;
    else transcript.push(entry);
    this.update({ transcript: transcript.slice(-60) });
  }
}
