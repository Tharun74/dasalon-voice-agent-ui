import { gunzipSync } from 'node:zlib';
import type { SarvamLanguage } from '../../src/adapters/sarvam-protocol.js';
import { estimateDecision, toolArguments, toolNames } from './guardrails.js';
import type { Context } from './guardrails.js';
import { approvedLine, speechLocale } from './knowledge.js';
import type { FactId, SpeechId } from './knowledge.js';
import { utterance } from './provider.js';
import type { Transcript, VoiceProvider } from './provider.js';
import recordings from './mock-clips.json';

const questions = {
  'en-IN': 'What services does the salon offer?',
  'hi-IN': 'सैलून में कौन सी सेवाएं हैं?',
  'ta-IN': 'சலூனில் என்ன சேவைகள் உள்ளன?',
};

export class MockSarvam implements VoiceProvider {
  readonly mode = 'mock' as const;

  constructor(private readonly options: { ttsFailure?: boolean; networkDrop?: boolean } = {}) {}

  async classify(context: Context, signal: AbortSignal) {
    signal.throwIfAborted();
    if (this.options.networkDrop) throw new Error('Mock connection dropped');
    return estimateDecision(context);
  }

  async select(_context: Context, fact: FactId, signal: AbortSignal, firstToken: () => void) {
    signal.throwIfAborted();
    firstToken();
    return { name: toolNames[fact], args: toolArguments(fact) };
  }

  async verify(sentence: string, fact: FactId, language: SarvamLanguage, signal: AbortSignal) {
    signal.throwIfAborted();
    return approvedLine(fact, language).includes(sentence);
  }

  async transcribe(_audio: Blob, preferred: SarvamLanguage | undefined, signal: AbortSignal): Promise<Transcript> {
    signal.throwIfAborted();
    const language = speechLocale(preferred ?? 'en-IN');
    return { text: questions[language], language };
  }

  async speak(id: SpeechId, index: number, language: SarvamLanguage, signal: AbortSignal) {
    signal.throwIfAborted();
    if (this.options.ttsFailure) throw new Error('Mock TTS failed');
    const clip = (recordings as Record<string, string>)[`${speechLocale(language)}:${id}:${index}`];
    if (!clip || !utterance(id, index, language)) throw new Error('Unknown mock utterance');
    const samples = gunzipSync(Buffer.from(clip, 'base64'));
    const pcm = new Uint8Array(samples.length * 2);
    const view = new DataView(pcm.buffer);
    for (let i = 0; i < samples.length; i++) {
      view.setInt16(i * 2, (samples[i] - 128) * 256, true);
    }
    let offset = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        signal.throwIfAborted();
        const end = Math.min(pcm.length, offset + 1280);
        controller.enqueue(pcm.subarray(offset, end));
        offset = end;
        if (offset === pcm.length) controller.close();
      },
    });
    return { body, sampleRate: 8_000 };
  }
}
