export const SARVAM_LANGUAGES = ['en-IN', 'hi-IN', 'ta-IN', 'bn-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'od-IN', 'pa-IN', 'te-IN'] as const;
export type SarvamLanguage = typeof SARVAM_LANGUAGES[number];
export const WAIT_FOR_SILENCE_MS = 700;
export const BARGE_IN_FADE_MS = 55;
export const MAX_RECORDING_MS = 18_000;
export const VOICE_SAMPLE_RATE = 16_000;
export const PLAYBACK_SAMPLE_RATE = 24_000;

export interface ApprovedSpeech {
  text: string;
  grant: string;
}
export type VoiceMetric = 'stt-final' | 'llm-first-token' | 'sentence-ready' | 'tts-first-chunk' | 'first-sample';
export type ChatEvent =
  | { kind: 'metric'; name: 'llm-first-token' }
  | ({ kind: 'sentence'; id: string } & ApprovedSpeech)
  | { kind: 'done'; classification: string; endSession: boolean }
  | { kind: 'error' };

export async function* readSse(body: ReadableStream<Uint8Array>, maxEventChars = 24_000) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let lines: string[] = [];
  let eventSize = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      if (done && pending.length) pending += '\n\n';
      let newline = pending.indexOf('\n');
      while (newline >= 0) {
        const line = pending.slice(0, newline).trimEnd();
        pending = pending.slice(newline + 1);
        if (line.length === 0) {
          if (lines.length) yield lines.join('\n');
          lines = [];
          eventSize = 0;
        } else if (line.startsWith('data:')) {
          eventSize += line.length;
          if (eventSize > maxEventChars) throw new Error('Voice event too long');
          lines.push(line.slice(5).trimStart());
        }
        newline = pending.indexOf('\n');
      }
      if (pending.length > maxEventChars) throw new Error('Voice event too long');
      if (done) {
        if (lines.length) yield lines.join('\n');
        return;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
