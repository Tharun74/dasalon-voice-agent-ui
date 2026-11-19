'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CopyButton({ text, label = 'Copy code' }: { text: string; label?: string }) {
  const [status, setStatus] = useState<'idle' | 'done' | 'error'>('idle');
  useEffect(() => {
    if (status === 'idle') return;
    const timeout = window.setTimeout(() => setStatus('idle'), 2200);
    return () => window.clearTimeout(timeout);
  }, [status]);
  const message = status === 'done' ? 'Copied' : status === 'error' ? 'Copy failed' : label;

  return <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label={message} title={message}
    onClick={async () => {
      try {
        await navigator.clipboard.writeText(text);
        setStatus('done');
      } catch {
        const input = document.createElement('textarea');
        input.value = text;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        const active = document.activeElement;
        document.body.append(input);
        input.select();
        try { setStatus(document.execCommand('copy') ? 'done' : 'error'); }
        catch { setStatus('error'); }
        finally { input.remove(); if (active instanceof HTMLElement) active.focus(); }
      }
    }}>
    {status === 'done' ? <Check className="size-4" /> : status === 'error' ? <TriangleAlert className="size-4" /> : <Copy className="size-4" />}
    <span className="sr-only" role="status">{status !== 'idle' && message}</span>
  </Button>;
}
