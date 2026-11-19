export const AGENT_STATES = [
  'idle', 'connecting', 'listening', 'thinking', 'speaking', 'interrupted', 'muted', 'error',
] as const;

export type AgentState = (typeof AGENT_STATES)[number];
export type AudioChannel = 'input' | 'output';
export type MicrophonePermission = 'unknown' | 'prompt' | 'granted' | 'denied' | 'unavailable';

export interface TranscriptEntry {
  readonly id: string;
  readonly speaker: 'user' | 'agent';
  readonly text: string;
  readonly final: boolean;
}

export interface AgentSnapshot {
  readonly state: AgentState;
  readonly transcript: readonly TranscriptEntry[];
  readonly permission?: MicrophonePermission;
  readonly error?: string;
}

export interface FrequencyFrame {
  /** Reused, linearly spaced bins from DC to just below Nyquist. Values are normalized. */
  readonly bins: Float32Array;
  readonly sampleRate: number;
}

export interface SignalSample {
  readonly rms: number;
  readonly peak: number;
  readonly frequency: FrequencyFrame;
}

export interface VoiceAgentAdapter extends AgentSnapshot {
  inputLevel(): number;
  outputLevel(): number;
  /** Optional channel defaults to the current speaker. Read synchronously during a frame. */
  frequencyData(channel?: AudioChannel): FrequencyFrame;
  /** Ahead is in seconds. Buffered sources can supply actual future samples. */
  readSignal?(channel: AudioChannel, ahead?: number): SignalSample;
  readonly supportsLookahead?: boolean;
  start(): void | Promise<void>;
  stop(): void | Promise<void>;
  mute(muted: boolean): void | Promise<void>;
  /** Notify only for snapshot changes. Audio samples are pulled separately. */
  subscribe(listener: () => void): () => void;
  /** Return the same object until a snapshot field changes. */
  getSnapshot(): AgentSnapshot;
}
