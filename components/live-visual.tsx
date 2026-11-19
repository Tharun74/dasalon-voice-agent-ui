'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { DemoAdapter } from '@/src/adapters';
import { VoiceAgent } from '@/src/VoiceAgent';
import type { PresetName } from '@/src/presets/catalog';
import type { AgentState } from '@/src/types';
import type { ThemeName } from '@/src/theme';

export function PresetPoster({ variant, eager = false }: { variant: PresetName; eager?: boolean }) {
  return <Image src={`/posters/${variant}.webp`} alt="" fill unoptimized sizes="(max-width: 640px) 100vw, 360px"
    loading={eager ? 'eager' : 'lazy'} className="object-contain" />;
}

export function LiveVisual({ variant, state = 'idle', theme = 'rose-gold', interactive = false }: {
  variant: PresetName; state?: AgentState; theme?: ThemeName; interactive?: boolean;
}) {
  const [adapter] = useState(() => {
    const demo = new DemoAdapter();
    demo.preview(state);
    return demo;
  });
  useEffect(() => { adapter.preview(state); }, [adapter, state]);
  return <VoiceAgent variant={variant} adapter={adapter} theme={theme} size="fill" interactive={interactive} />;
}
