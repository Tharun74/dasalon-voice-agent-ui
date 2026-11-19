import { AnalyserMeter, EMPTY_FREQUENCIES, EMPTY_SIGNAL } from '../audio.js';
import type { AgentSnapshot, AgentState, AudioChannel, TranscriptEntry, VoiceAgentAdapter } from '../types.js';
import { AdapterStore } from './store.js';

export interface MediaStreams {
  input?: MediaStream;
  output?: MediaStream;
}

interface ConnectedStreams extends MediaStreams {
  release?: () => void;
}

interface Session {
  readonly context: AudioContext;
  ready?: boolean;
  streams?: ConnectedStreams;
  input?: AnalyserMeter;
  output?: AnalyserMeter;
  cleanupEnded?: () => void;
}

/** Analyses caller-owned streams. Playback and track ownership stay with the caller. */
export class MediaStreamAdapter extends AdapterStore implements VoiceAgentAdapter {
  private session?: Session;
  private muted = false;
  private liveState: AgentState = 'listening';
  private liveError?: string;

  constructor(private readonly streams: MediaStreams = {}) { super(); }

  protected acquire(): ConnectedStreams | Promise<ConnectedStreams> { return this.streams; }
  protected beforeAcquire(): Partial<AgentSnapshot> { return {}; }
  protected connected(): Partial<AgentSnapshot> { return {}; }
  protected onFailure(_error: unknown): Partial<AgentSnapshot> { return {}; }
  protected applyMute(_streams: MediaStreams, _muted: boolean) {}
  protected watchEnded(_streams: MediaStreams, _onEnded: () => void): (() => void) | undefined { return undefined; }

  async start() {
    if (this.session) return;
    this.liveState = 'listening';
    this.liveError = undefined;
    let session: Session | undefined;

    try {
      if (typeof AudioContext === 'undefined') throw new Error('Web Audio is unavailable in this browser.');
      session = { context: new AudioContext() };
      this.session = session;
      // Resume within the user gesture, before awaiting microphone permission.
      const resumed = session.context.resume().then(
        () => undefined,
        (error: unknown) => ({ error }),
      );
      this.update({ state: 'connecting', error: undefined, ...this.beforeAcquire() });
      if (this.session !== session) return;
      const streams = await this.acquire();
      if (this.session !== session) {
        streams.release?.();
        return;
      }

      session.streams = streams;
      if (!streams.input && !streams.output) throw new Error('No audio streams were provided.');
      if (streams.input) session.input = new AnalyserMeter(session.context, streams.input);
      if (streams.output) session.output = new AnalyserMeter(session.context, streams.output);
      const failure = await resumed;
      if (this.session !== session) return;
      if (failure) throw failure.error;
      this.applyMute(streams, this.muted);
      session.cleanupEnded = this.watchEnded(streams, () => {
        if (this.session !== session) return;
        void this.stop();
        this.update({ state: 'error', error: 'The microphone disconnected.' });
      });
      if (this.session !== session) return;
      session.ready = true;
      this.update({ state: this.visibleState(), error: this.liveError, ...this.connected() });
    } catch (error) {
      if (this.session !== session) return;
      this.session = undefined;
      if (session) void this.dispose(session);
      this.update({
        state: 'error',
        error: error instanceof Error ? error.message : 'Audio could not be started.',
        ...this.onFailure(error),
      });
    }
  }

  async stop() {
    const session = this.session;
    this.session = undefined;
    this.muted = false;
    this.update({ state: 'idle', error: undefined });
    if (session) await this.dispose(session);
  }

  mute(muted: boolean) {
    this.muted = muted;
    const streams = this.session?.streams;
    if (streams) this.applyMute(streams, muted);
    if (this.session?.ready) this.update({ state: this.visibleState() });
  }

  setAgentState(state: AgentState, error?: string) {
    this.liveState = state;
    this.liveError = state === 'error' ? error : undefined;
    if (this.session?.ready) {
      this.update({ state: this.visibleState(), error: this.liveError });
    }
  }

  setTranscript(transcript: readonly TranscriptEntry[]) {
    this.update({ transcript: [...transcript] });
  }

  inputLevel() { return this.muted ? 0 : this.session?.input?.level() ?? 0; }
  outputLevel() { return this.session?.output?.level() ?? 0; }

  readSignal(channel: AudioChannel) {
    if (channel === 'input' && this.muted) return EMPTY_SIGNAL;
    return this.session?.[channel]?.signal() ?? EMPTY_SIGNAL;
  }

  frequencyData(channel: AudioChannel = this.state === 'speaking' ? 'output' : 'input') {
    if (channel === 'input' && this.muted) return EMPTY_FREQUENCIES;
    return this.session?.[channel]?.frequencies() ?? EMPTY_FREQUENCIES;
  }

  private visibleState() {
    return this.muted && this.liveState !== 'error' ? 'muted' : this.liveState;
  }

  private async dispose(session: Session) {
    session.cleanupEnded?.();
    session.input?.dispose();
    session.output?.dispose();
    session.streams?.release?.();
    if (session.context.state !== 'closed') await session.context.close().catch(() => undefined);
  }
}
