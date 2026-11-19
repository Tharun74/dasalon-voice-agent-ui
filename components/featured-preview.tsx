'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AudioLines, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { catalog } from '@/site/catalog';
import type { PresetName } from '@/src/presets/catalog';
import { LiveVisual, PresetPoster } from '@/components/live-visual';

const picks = ['lumen', 'silk', 'bloom', 'contour'] as const;

export function FeaturedPreview() {
  const [variant, setVariant] = useState<PresetName>('lumen');
  const current = catalog.find(item => item.variant === variant)!;

  return <figure className="min-w-0">
    <div className="feature-frame">
      <div className="feature-frame-inner border border-white/5 bg-[#111114] text-zinc-50">
        <figcaption className="relative z-10 flex h-[46px] items-center justify-between gap-2 border-b border-white/10 px-4 text-[11px]">
          <span className="flex items-center gap-2 font-medium"><AudioLines aria-hidden="true" className="size-3.5 text-[#dca58e]" />{current.name}</span>
          <span className="flex items-center gap-1.5 font-mono text-zinc-400"><span className="size-1.5 rounded-full bg-[#e3b198]" />Speaking</span>
        </figcaption>
        <div className="voice-canvas h-[clamp(245px,27vw,380px)]">
          <AnimatePresence initial={false} mode="wait">
            <motion.div key={variant} className="poster-swap absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .19 }}>
              <PresetPoster variant={variant} eager />
              <LiveVisual variant={variant} state="speaking" interactive />
            </motion.div>
          </AnimatePresence>
          <ScanLine aria-hidden="true" className="pointer-events-none absolute right-3.5 bottom-3.5 size-4 text-zinc-600" />
        </div>
        <div className="flex flex-wrap gap-1.5 border-t border-white/10 p-2.5 sm:gap-2 sm:p-3" role="group" aria-label="Featured preset">
          {picks.map(choice => {
            const item = catalog.find(preset => preset.variant === choice)!;
            return <Button key={choice} type="button" size="sm" variant="ghost" aria-pressed={variant === choice} onClick={() => setVariant(choice)}
              className="h-7 rounded-md border border-transparent px-2 text-[11px] text-zinc-400 hover:bg-white/10 hover:text-white aria-pressed:border-white/15 aria-pressed:bg-white/8 aria-pressed:text-white sm:px-2.5">{item.name}</Button>;
          })}
        </div>
      </div>
    </div>
  </figure>;
}
