'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent } from 'react';
import Link, { useLinkStatus } from 'next/link';
import { ArrowUpRight, LoaderCircle, Play, Search, Square } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { catalog, categories } from '@/site/catalog';
import type { CatalogEntry, Category } from '@/site/catalog';
import { PresetPoster } from '@/components/live-visual';
import { DemoAdapter } from '@/src/adapters';
import { STATE_LABELS } from '@/src/state';
import { VoiceAgent } from '@/src/VoiceAgent';
import type { MotionPlayback } from '@/src/motion';
import { cn } from '@/site/utils';

const previewMotion: MotionPlayback = { maxFps: 60, maxPixelRatio: 1 };

function CardLinkIndicator() {
  const { pending } = useLinkStatus();
  return pending
    ? <LoaderCircle aria-hidden="true" className="size-4 shrink-0 text-muted-foreground motion-safe:animate-spin" />
    : <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />;
}

function GalleryTile({ item, demo, eagerPoster, prefetch }: {
  item: CatalogEntry;
  demo: DemoAdapter;
  eagerPoster: boolean;
  prefetch: boolean;
}) {
  const preview = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [intent, setIntent] = useState(false);

  useEffect(() => {
    const element = preview.current;
    if (!element) return;
    if (typeof IntersectionObserver === 'undefined') {
      setLive(true);
      return;
    }
    const observer = new IntersectionObserver(entries => setLive(entries[entries.length - 1].isIntersecting));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function point(event: PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--spot-x', `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty('--spot-y', `${event.clientY - bounds.top}px`);
  }

  return <article id={item.slug} className="scroll-mt-24 rounded-xl" onPointerMove={point}>
    <Card className="spotlight group h-full gap-0 overflow-hidden rounded-xl border bg-card py-0 shadow-sm">
      <div ref={preview} className="voice-canvas poster-swap aspect-[1.55]" data-live-preview={live || undefined}>
        <PresetPoster variant={item.variant} eager={eagerPoster} />
        {live ? <div className="absolute inset-0"><VoiceAgent variant={item.variant} adapter={demo} size="fill" interactive={false} motion={previewMotion} /></div> : null}
      </div>
      <div className="min-w-0 border-t px-4 py-4">
        <h3 className="text-sm font-semibold tracking-tight">
          <Link className="flex items-center justify-between gap-2 after:absolute after:inset-0" href={`/components/${item.slug}`}
            prefetch={prefetch || intent} onPointerEnter={() => setIntent(true)} onFocus={() => setIntent(true)}>
            {item.name}<CardLinkIndicator />
          </Link>
        </h3>
        <p className="mt-1 min-h-9 text-[13px] leading-[18px] text-muted-foreground">{item.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.map(tag => <Badge key={tag} variant="outline" className="rounded-md bg-background text-[10px] font-normal text-muted-foreground">{tag}</Badge>)}
        </div>
      </div>
    </Card>
  </article>;
}

export function GalleryGrid({ filters = false, limit }: { filters?: boolean; limit?: number }) {
  const [category, setCategory] = useState<Category>('All');
  const [query, setQuery] = useState('');
  const [demo] = useState(() => new DemoAdapter());
  const [playing, setPlaying] = useState(false);
  const { state } = useSyncExternalStore(demo.subscribe, demo.getSnapshot, demo.getSnapshot);

  useEffect(() => () => demo.stop(), [demo]);

  const items = catalog.filter(item => {
    const terms = `${item.name} ${item.description} ${item.tags.join(' ')}`.toLowerCase();
    return (category === 'All' || item.tags.includes(category)) && terms.includes(query.trim().toLowerCase());
  }).slice(0, limit);
  return <div>
    {filters ? <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
      <div className="flex flex-wrap items-center gap-1.5" aria-label="Categories" role="group">
        {categories.map(item => <Button key={item} variant={category === item ? 'secondary' : 'ghost'} size="sm" type="button"
          className={cn('h-8 px-2.5 text-xs', category === item && 'border')} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</Button>)}
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
        <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => {
          if (playing) demo.stop();
          else demo.start();
          setPlaying(!playing);
        }}>
          {playing ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
          {playing ? 'Stop voice demo' : 'Play voice demo'}
        </Button>
        <span role="status" className="min-w-[5.5rem] text-xs text-muted-foreground">{state === 'idle' ? 'Idle' : STATE_LABELS[state]}</span>
        <label className="flex h-9 min-w-32 flex-1 items-center gap-2 rounded-md border bg-card px-3 text-muted-foreground focus-within:border-ring sm:w-56 sm:flex-none">
          <Search aria-hidden="true" className="size-4 shrink-0" /><span className="sr-only">Search components</span>
          <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search components…"
            className="w-full min-w-0 bg-transparent text-xs text-foreground outline-none focus-visible:outline-none" />
        </label>
      </div>
    </div> : null}
    {items.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item, index) => <GalleryTile key={item.slug} item={item} demo={demo}
        eagerPoster={filters && index === 0} prefetch={filters && index < 2} />)}
    </div> : <p role="status" className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">No components match this search.</p>}
  </div>;
}
