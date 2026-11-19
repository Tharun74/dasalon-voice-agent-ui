'use client';

import { useRef } from 'react';
import { useInView } from 'motion/react';
import { MessageSquare, PanelTop, Smartphone, SwatchBook } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LiveVisual, PresetPoster } from '@/components/live-visual';
import type { CatalogEntry } from '@/site/catalog';
import type { ThemeName } from '@/src/theme';
import { CodeBlock } from '@/components/code-block';
import { cn } from '@/site/utils';

const layouts = [
  { title: 'Compact', summary: 'A small visual beside a conversation status.', icon: Smartphone, size: 'sm', finish: 0, placement: 'w-[55%]' },
  { title: 'Alternate finish', summary: 'A different palette for the same motion.', icon: SwatchBook, size: 'md', finish: 1, placement: 'w-full' },
  { title: 'In a card', summary: 'A contained preview for a voice call panel.', icon: PanelTop, size: 'md', finish: 0, placement: 'w-[72%]' },
  { title: 'Floating widget', summary: 'Anchor the visual inside a fixed corner widget.', icon: MessageSquare, size: 'sm', finish: 1, placement: 'absolute right-1 bottom-1 h-[78%] w-[50%]' },
] as const;

function Example({ item, layout, theme }: { item: CatalogEntry; layout: (typeof layouts)[number]; theme: ThemeName }) {
  const area = useRef<HTMLDivElement>(null);
  const inView = useInView(area, { amount: 0.45 });
  const code = layout.title === 'Floating widget'
    ? `<aside className="fixed right-4 bottom-4 w-44 rounded-lg border bg-background">
  <${item.exportName} adapter={adapter} size="${layout.size}" theme="${theme}" />
</aside>`
    : layout.title === 'In a card'
      ? `<section className="max-w-sm rounded-xl border p-4">
  <${item.exportName} adapter={adapter} size="${layout.size}" theme="${theme}" />
  <p role="status">Voice concierge ready</p>
</section>`
      : `<${item.exportName} adapter={adapter} size="${layout.size}" theme="${theme}" />`;
  return <Card className="gap-0 overflow-hidden rounded-lg border bg-card py-0 shadow-none">
    <div ref={area} className="voice-canvas flex h-36 items-center justify-center sm:h-40">
      {layout.title === 'In a card' ? <span aria-hidden="true" className="absolute inset-y-3 inset-x-10 rounded-lg border border-white/12 bg-white/3" /> : null}
      {layout.title === 'Floating widget' ? <span aria-hidden="true" className="absolute right-3 bottom-3 h-20 w-28 rounded-lg border border-white/12 bg-white/5" /> : null}
      <div className={cn('relative h-full', layout.placement)}>
        {inView ? <LiveVisual variant={item.variant} theme={theme} state="listening" /> : <PresetPoster variant={item.variant} />}
      </div>
    </div>
    <div className="border-t p-3">
      <h3 className="flex items-center gap-2 text-sm font-medium"><layout.icon className="size-3.5 text-muted-foreground" />{layout.title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{layout.summary}</p>
      <details className="mt-2 min-w-0 text-xs">
        <summary className="w-fit cursor-pointer rounded text-muted-foreground hover:text-foreground">View code</summary>
        <div className="mt-2"><CodeBlock code={code} filename="voice-preview.tsx" /></div>
      </details>
    </div>
  </Card>;
}

export function PresetExamples({ item }: { item: CatalogEntry }) {
  const finishes = item.docs!.finishes;
  return <div className="grid gap-3 sm:grid-cols-2">
    {layouts.map(layout => <Example key={layout.title} item={item} layout={layout} theme={finishes[layout.finish]} />)}
  </div>;
}
