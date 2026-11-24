import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { languageSchema } from './config.js';
import { approvedIds } from './knowledge.js';

const localSecret = randomBytes(48).toString('base64url');
export const sessionLifetime = 10 * 60_000;
export const sessionSchema = z.object({ kind: z.literal('session'), id: z.uuid(), exp: z.number().int() }).strict();
export const grantSchema = z.object({
  kind: z.literal('speech'), sid: z.uuid(), nonce: z.uuid(), id: z.enum(approvedIds),
  index: z.number().int().min(0).max(7), lang: languageSchema, exp: z.number().int(),
  digest: z.string().regex(/^[\w-]{43}$/u),
}).strict();
export type Session = z.infer<typeof sessionSchema>;

export const speechDigest = (value: string) => createHash('sha256').update(value, 'utf8').digest('base64url');

export function createTokenSigner(secret = localSecret, clock = Date.now) {
  const mac = (body: string) => createHmac('sha256', secret).update(body).digest();
  return {
    sign(value: z.infer<typeof grantSchema> | Session) {
      const body = Buffer.from(JSON.stringify(value)).toString('base64url');
      return `${body}.${mac(body).toString('base64url')}`;
    },
    verify<T extends { exp: number }>(token: string, schema: z.ZodType<T>): T | undefined {
      if (!/^[\w-]{1,2048}\.[\w-]{43}$/u.test(token)) return;
      const [body, signature] = token.split('.');
      const bytes = Buffer.from(signature, 'base64url');
      if (!timingSafeEqual(bytes, mac(body)) || bytes.toString('base64url') !== signature) return;
      try {
        const result = schema.safeParse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')));
        if (result.success && result.data.exp > clock()) return result.data;
      } catch { /* reject malformed tokens */ }
    },
  };
}

export function issueSession(now = Date.now()): Session {
  return { kind: 'session', id: randomUUID(), exp: now + sessionLifetime };
}

export class RateLimiter {
  private readonly entries = new Map<string, { ends: number; count: number }>();
  constructor(private readonly clock = Date.now, private readonly capacity = 10_000) {}

  take(key: string, max: number, span: number, amount = 1) {
    const now = this.clock();
    let entry = this.entries.get(key);
    if (!entry || entry.ends <= now) {
      if (this.entries.size >= this.capacity) {
        for (const [id, value] of this.entries) if (value.ends <= now) this.entries.delete(id);
        if (this.entries.size >= this.capacity) return false;
      }
      entry = { ends: now + span, count: 0 };
      this.entries.set(key, entry);
    }
    if (entry.count + amount > max) return false;
    entry.count += amount;
    return true;
  }
}
