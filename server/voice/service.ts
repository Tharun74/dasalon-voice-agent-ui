import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import { MAX_RECORDING_MS, VOICE_SAMPLE_RATE } from '../../src/adapters/sarvam-protocol.js';
import type { ChatEvent, SarvamLanguage } from '../../src/adapters/sarvam-protocol.js';
import { languageSchema, voiceConfig } from './config.js';
import type { VoiceConfig } from './config.js';
import { answerTurn } from './guardrails.js';
import { speechLocale } from './knowledge.js';
import type { FactId, SpeechId } from './knowledge.js';
import { MockSarvam } from './mock.js';
import { SarvamProvider, utterance } from './provider.js';
import type { SpeechStream, VoiceProvider } from './provider.js';
import { createTokenSigner, grantSchema, issueSession, RateLimiter, sessionLifetime, sessionSchema, speechDigest } from './security.js';
import type { Session } from './security.js';

const sessionBody = z.object({ language: languageSchema.optional() }).strict();
const chatBody = z.object({ text: z.string().trim().min(1).max(800), language: languageSchema.optional() }).strict();
const ttsBody = z.object({ grant: z.string().max(2400) }).strict();
const encoder = new TextEncoder();
const maxWavBytes = 44 + (MAX_RECORDING_MS + 500) / 1000 * VOICE_SAMPLE_RATE * 2;
const noCache = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const fixedPhrases: ReadonlySet<SpeechId> = new Set(['greeting', 'refusal', 'smallTalk', 'sensitive', 'end', 'hours']);

class VoiceError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function readBody(request: Request, limit: number, type: string) {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== type) {
    throw new VoiceError(415, 'Unsupported voice request format.');
  }
  if (Number(request.headers.get('content-length') ?? 0) > limit) throw new VoiceError(413, 'Voice request too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new VoiceError(400, 'Missing voice request.');
  try {
    const data = new Uint8Array(limit);
    let offset = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) return data.slice(0, offset);
      if (offset + value.length > limit) throw new VoiceError(413, 'Voice request too large.');
      data.set(value, offset);
      offset += value.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function readJson<T extends z.ZodType>(request: Request, schema: T) {
  const bytes = await readBody(request, 4096, 'application/json');
  let input: unknown;
  try { input = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new VoiceError(400, 'Invalid voice request.'); }
  const result = schema.safeParse(input);
  if (!result.success) throw new VoiceError(400, 'Invalid voice request.');
  return result.data as z.infer<T>;
}

export function validTurnWav(bytes: Uint8Array) {
  if (bytes.length < 44 + 1600 || bytes.length > maxWavBytes || bytes.length % 2) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(0) === 0x52494646 && view.getUint32(4, true) === bytes.length - 8 &&
    view.getUint32(8) === 0x57415645 && view.getUint32(12) === 0x666d7420 && view.getUint32(16, true) === 16 &&
    view.getUint16(20, true) === 1 && view.getUint16(22, true) === 1 && view.getUint32(24, true) === VOICE_SAMPLE_RATE &&
    view.getUint32(28, true) === VOICE_SAMPLE_RATE * 2 && view.getUint16(32, true) === 2 &&
    view.getUint16(34, true) === 16 && view.getUint32(36) === 0x64617461 && view.getUint32(40, true) === bytes.length - 44;
}

function json(value: unknown, status = 200, cors: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { ...noCache, ...cors } });
}

function corsHeaders(request: Request, config: VoiceConfig): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin) return {};
  if (origin !== new URL(request.url).origin && !config.allowedOrigins.includes(origin)) {
    throw new VoiceError(403, 'Origin is not allowed.');
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Voice-Language',
    'Access-Control-Expose-Headers': 'X-Voice-Sample-Rate',
    Vary: 'Origin',
  };
}

function clientIP(request: Request) {
  const candidate = process.env.VERCEL === '1'
    ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim()
    : undefined;
  return candidate && isIP(candidate) ? candidate : 'local';
}

export function createVoiceService(config = voiceConfig(), override?: VoiceProvider) {
  const limiter = new RateLimiter();
  const signer = createTokenSigner(config.secret || undefined);
  const provider = override ?? (config.key ? new SarvamProvider(config, () => {
    if (!limiter.take('provider', config.limits.daily, 86_400_000)) throw new VoiceError(429, 'Voice budget is currently exhausted.');
  }) : new MockSarvam());
  const history = new Map<string, { recent: FactId[]; refusals: number; closed: boolean; busy: boolean; exp: number }>();
  const cache = new Map<string, { chunks: Uint8Array[]; sampleRate: number }>();

  const grantFor = (session: Session, id: SpeechId, index: number, language: SarvamLanguage, text: string) => signer.sign({
    kind: 'speech', sid: session.id, nonce: randomUUID(), id, index, lang: language,
    exp: Math.min(session.exp, Date.now() + 120_000), digest: speechDigest(text),
  });

  function chatStream(data: z.infer<typeof chatBody>, session: Session, requestSignal: AbortSignal, cors: Record<string, string>) {
    if (!limiter.take(`turn-${session.id}`, config.limits.turns, sessionLifetime)) {
      throw new VoiceError(429, 'This conversation has reached its turn limit.');
    }
    for (const [id, item] of history) if (item.exp <= Date.now()) history.delete(id);
    const turn = history.get(session.id) ?? { recent: [], refusals: 0, closed: false, busy: false, exp: session.exp };
    if (turn.closed) throw new VoiceError(410, 'This conversation has ended.');
    if (turn.busy) throw new VoiceError(409, 'Another turn is still running.');
    history.set(session.id, turn);
    turn.busy = true;

    const lang = speechLocale(data.language ?? config.defaultLanguage);
    const controller = new AbortController();
    const signal = AbortSignal.any([requestSignal, controller.signal]);
    const stream = new ReadableStream<Uint8Array>({
      async start(output) {
        const send = (event: ChatEvent) => {
          if (!signal.aborted) output.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        try {
          const result = await answerTurn({ input: data.text, language: lang, recent: turn.recent }, provider, signal, {
            firstToken: () => send({ kind: 'metric', name: 'llm-first-token' }),
            sentence: (id, index, text) => send({ kind: 'sentence', id, text, grant: grantFor(session, id, index, lang, text) }),
          }, turn.refusals);
          if (result.fact) turn.recent = [...turn.recent, result.fact].slice(-3);
          turn.refusals = result.refusal ? turn.refusals + 1 : 0;
          turn.closed = result.endSession;
          send({ kind: 'done', classification: result.classification, endSession: result.endSession });
        } catch {
          send({ kind: 'error' });
        } finally {
          turn.busy = false;
          if (!controller.signal.aborted) output.close();
        }
      },
      cancel() { controller.abort(); },
    });
    return new Response(stream, { headers: {
      ...noCache, ...cors, 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Accel-Buffering': 'no',
    } });
  }

  async function speak(id: SpeechId, index: number, lang: SarvamLanguage, signal: AbortSignal): Promise<SpeechStream> {
    const key = JSON.stringify([id, index, lang, config.speaker, config.ttsModel, config.pace]);
    const stored = cache.get(key);
    if (stored) return {
      sampleRate: stored.sampleRate,
      body: new ReadableStream({ start(out) { for (const item of stored.chunks) out.enqueue(item); out.close(); } }),
    };
    const sound = await provider.speak(id, index, lang, signal);
    if (!fixedPhrases.has(id)) return sound;
    const reader = sound.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    return {
      sampleRate: sound.sampleRate,
      body: new ReadableStream<Uint8Array>({
        async pull(out) {
          try {
            const { value, done } = await reader.read();
            if (done) {
              if (length > 0 && length <= 240_000) {
                if (cache.size >= 24) cache.delete(cache.keys().next().value!);
                cache.set(key, { sampleRate: sound.sampleRate, chunks });
              }
              reader.releaseLock();
              out.close();
            } else {
              length += value.length;
              if (length <= 240_000) chunks.push(value);
              out.enqueue(value);
            }
          } catch (error) {
            reader.releaseLock();
            out.error(error);
          }
        },
        async cancel(reason) {
          await reader.cancel(reason).catch(() => undefined);
          reader.releaseLock();
        },
      }),
    };
  }

  return async function handleVoice(request: Request, operation: string) {
    let cors: Record<string, string> = {};
    try {
      cors = corsHeaders(request, config);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, cors);
      if (provider.mode === 'live' && (!config.secret || config.secret.length < 32 || config.secret === config.key)) {
        throw new VoiceError(503, 'Voice session security is not configured.');
      }
      if (!limiter.take(`ip-${clientIP(request)}`, config.limits.ip, 60_000)) {
        throw new VoiceError(429, 'Too many voice requests. Please wait.');
      }
      if (operation === 'session') {
        const data = await readJson(request, sessionBody);
        const session = issueSession();
        const lang = speechLocale(data.language ?? config.defaultLanguage);
        const greeting = [];
        for (let index = 0; utterance('greeting', index, lang); index++) {
          const text = utterance('greeting', index, lang);
          greeting.push({ text, grant: grantFor(session, 'greeting', index, lang, text) });
        }
        return json({ token: signer.sign(session), mode: provider.mode, language: lang, snapshots: config.snapshots, greeting, expiresAt: session.exp }, 200, cors);
      }
      const aiSession = signer.verify(request.headers.get('authorization')?.match(/^Bearer (.+)$/u)?.[1] ?? '', sessionSchema);
      if (!aiSession) throw new VoiceError(401, 'Your voice session has expired. Start a new one.');
      if (!limiter.take(`req-${aiSession.id}`, config.limits.session, 60_000)) {
        throw new VoiceError(429, 'Too many voice requests. Please wait.');
      }
      if (operation === 'chat') return chatStream(await readJson(request, chatBody), aiSession, request.signal, cors);
      if (operation === 'stt') {
        const bytes = await readBody(request, maxWavBytes, 'audio/wav');
        if (!validTurnWav(bytes)) throw new VoiceError(400, 'Invalid mono 16 kHz WAV recording.');
        const preferred = languageSchema.safeParse(request.headers.get('x-voice-language')).data;
        const audio = new Blob([bytes], { type: 'audio/wav' });
        return json(await provider.transcribe(audio, preferred, request.signal), 200, cors);
      }
      if (operation === 'tts') {
        const { grant } = await readJson(request, ttsBody);
        const permission = signer.verify(grant, grantSchema);
        if (!permission || permission.sid !== aiSession.id) throw new VoiceError(403, 'Unapproved speech request.');
        const text = utterance(permission.id, permission.index, permission.lang);
        if (!text || speechDigest(text) !== permission.digest) throw new VoiceError(403, 'Unapproved speech request.');
        if (!limiter.take(`chars-${aiSession.id}`, config.limits.chars, sessionLifetime, text.length)) {
          throw new VoiceError(429, 'This conversation has reached its speech limit.');
        }
        const clip = await speak(permission.id, permission.index, permission.lang, request.signal);
        return new Response(clip.body, {
          headers: { ...noCache, ...cors, 'Content-Type': 'audio/pcm', 'X-Voice-Sample-Rate': String(clip.sampleRate) },
        });
      }
      throw new VoiceError(404, 'Voice operation not found.');
    } catch (error) {
      if (error instanceof VoiceError) return json({ error: error.message }, error.status, cors);
      return json({ error: 'The voice service is temporarily unavailable.' }, 502, cors);
    }
  };
}
