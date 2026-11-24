import { z } from 'zod';
import { SARVAM_LANGUAGES } from '../../src/adapters/sarvam-protocol.js';

export const languageSchema = z.enum(SARVAM_LANGUAGES);
function numberEnv(name: string, defaultValue: number, min: number, max: number) {
  const value = Number(process.env[name] || defaultValue);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : defaultValue;
}

export function voiceConfig() {
  const chatModel = process.env.SARVAM_CHAT_MODEL?.trim() || 'sarvam-105b-conversations';
  const ttsModel = process.env.SARVAM_TTS_MODEL?.trim() || 'bulbul:v3';
  const speaker = process.env.DEFAULT_SPEAKER?.trim() || (ttsModel === 'bulbul:v4-flash' ? 'shubh_enhi_ads' : 'shubh');
  return {
    key: process.env.SARVAM_API_KEY?.trim(),
    defaultLanguage: languageSchema.safeParse(process.env.DEFAULT_LANGUAGE).data ?? 'en-IN',
    secret: process.env.SESSION_SECRET,
    chatModel,
    classifierModel: process.env.SARVAM_CLASSIFIER_MODEL?.trim() || chatModel,
    sttModel: process.env.SARVAM_STT_MODEL?.trim() || 'saaras:v4',
    ttsModel,
    speaker,
    pace: numberEnv('SARVAM_SPEAKING_PACE', 1, 0.5, 2),
    allowedOrigins: (process.env.VOICE_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean),
    snapshots: process.env.SARVAM_STT_SNAPSHOTS !== 'false',
    limits: {
      ip: numberEnv('RATE_LIMIT_IP_PER_MINUTE', 60, 1, 600),
      session: numberEnv('RATE_LIMIT_SESSION_PER_MINUTE', 45, 1, 300),
      turns: numberEnv('RATE_LIMIT_SESSION_TURNS', 20, 1, 100),
      chars: numberEnv('RATE_LIMIT_SESSION_TTS_CHARACTERS', 3000, 160, 30000),
      daily: numberEnv('DAILY_BUDGET_PROVIDER_CALLS', 2000, 0, 100_000),
    },
  };
}
export type VoiceConfig = ReturnType<typeof voiceConfig>;
