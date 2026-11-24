import { createVoiceService } from '../../../../server/voice/service';

export const runtime = 'nodejs';
export const maxDuration = 30;

let service: ReturnType<typeof createVoiceService> | undefined;
type Context = { params: Promise<{ operation: string }> };

export async function POST(request: Request, context: Context) {
  service ??= createVoiceService();
  return service(request, (await context.params).operation);
}

export const OPTIONS = POST;
