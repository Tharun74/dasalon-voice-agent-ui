import Link from 'next/link';
import { Accessibility, ArrowRight, ArrowUpRight, AudioLines, Box, Braces, Gauge, Palette, Plug, Terminal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PackageCommand } from '@/components/package-command';
import { FeaturedPreview } from '@/components/featured-preview';
import { GalleryGrid } from '@/components/gallery-grid';
import { registryOrigin } from '@/site/catalog';

const features = [
  { icon: AudioLines, label: 'Live presets', detail: 'Eight distinct shapes and motion systems for listening, thinking and speaking.', marker: <div className="flex h-6 items-center gap-1 text-[var(--rose)]" aria-hidden="true">{[3, 5, 12, 19, 9, 14, 6, 10, 4, 7, 3].map((height, i) => <i key={i} className="w-[2px] rounded-full bg-current" style={{ height }} />)}</div> },
  { icon: Palette, label: 'Five finishes', detail: 'Use a built-in palette or pass your own highlight, glow and shadow colors.', marker: <div className="flex gap-1.5" aria-hidden="true">{['#e8a39a', '#e5c286', '#aaa7f0', '#76c7ab', '#f0aec8'].map(color => <i key={color} className="size-2.5 rounded-full" style={{ background: color }} />)}</div> },
  { icon: Plug, label: 'Bring your provider', detail: 'One adapter interface for browser audio, demo conversations and your voice SDK.', marker: <span className="font-mono text-[10px] text-muted-foreground">input → preset ← output</span> },
  { icon: Terminal, label: 'Install with shadcn', detail: 'Add source files directly to your project. Use the CLI or copy them manually.' },
  { icon: Braces, label: 'React and SSR', detail: 'TypeScript props and server-renderable markup. WebGL initializes in the browser.' },
  { icon: Accessibility, label: 'Accessible motion', detail: 'Keyboard controls and a calmer experience when reduced motion is enabled.' },
  { icon: Gauge, label: 'Viewport-aware', detail: 'Gallery previews mount on demand. Canvas2D keeps the experience usable without WebGL.' },
];

export default function HomePage() {
  return (
    <>
      <section className="hero-pattern border-b">
        <div className="site-width grid items-center gap-y-7 pt-10 pb-12 sm:gap-y-9 sm:pt-16 sm:pb-18 lg:grid-cols-[.96fr_1fr] lg:grid-rows-[1fr_auto] lg:gap-x-12 lg:gap-y-6 lg:pt-[82px] lg:pb-[76px] xl:gap-x-18">
          <div className="min-w-0 lg:self-end">
            <Badge variant="outline" className="mb-5 h-7 rounded-full border-[color-mix(in_srgb,var(--rose)_31%,var(--border))] bg-background/65 px-2.5 text-[11px] font-medium text-muted-foreground">
              <span className="mr-1 size-1.5 rounded-full bg-[var(--rose)]" />8 voice presets <span className="opacity-55">·</span> Open source
            </Badge>
            <h1 className="text-[clamp(2.6rem,12vw,3.3rem)] leading-[.94] font-semibold tracking-[-.064em] sm:text-[clamp(3.6rem,6.05vw,5.95rem)]">
              Voice interfaces<br /> with a <span className="accent-word">pulse.</span>
            </h1>
            <p className="mt-5 max-w-[420px] text-sm leading-[1.75] text-muted-foreground sm:text-[15px]">
              Audio-reactive React components for voice agents. Preview the motion live and install the source you want to own.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Button asChild className="h-10 rounded-lg px-3.5"><Link href="/components">Browse components <ArrowRight className="size-4" /></Link></Button>
              <Button asChild variant="outline" className="h-10 rounded-lg px-3.5"><Link href="/docs">Get started</Link></Button>
            </div>
          </div>
          <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1"><FeaturedPreview /></div>
          <div className="min-w-0 max-w-[550px] lg:col-start-1 lg:row-start-2 lg:self-start">
            <PackageCommand command={`shadcn@latest add ${registryOrigin}/r/lumen-orb.json`} />
          </div>
        </div>
      </section>
      <section className="site-width py-12 sm:py-16">
        <div className="mb-6 max-w-xl">
          <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-.063em]">Everything you need</h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">The visual layer for a voice agent, from the first render to the live conversation.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => <Card key={feature.label}
            className={`relative min-h-34 gap-0 rounded-xl border bg-card p-4 shadow-none ${index === 0 ? 'lg:col-span-2' : ''}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="grid size-8 place-items-center rounded-md border bg-background"><feature.icon aria-hidden="true" className="size-4 text-muted-foreground" /></span>
              {feature.marker}
            </div>
            <h3 className="text-sm font-semibold">{feature.label}</h3>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{feature.detail}</p>
          </Card>)}
        </div>
      </section>
      <section className="section-rule">
        <div className="site-width py-12 sm:py-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[clamp(2rem,4vw,3rem)] font-semibold tracking-[-.063em]">Explore the components</h2>
              <p className="mt-1.5 max-w-lg text-sm leading-6 text-muted-foreground">Compare silhouettes and motion before choosing a visual for your UI.</p>
            </div>
            <Button asChild variant="outline"><Link href="/components">View gallery <ArrowUpRight className="size-4" /></Link></Button>
          </div>
          <GalleryGrid />
        </div>
      </section>
      <section className="section-rule bg-card">
        <div className="site-width flex flex-wrap items-center justify-between gap-5 py-10 sm:py-13">
          <div><h2 className="text-2xl font-semibold tracking-tight">Try it with your own voice.</h2><p className="mt-1 text-sm text-muted-foreground">The component playground supports live microphone input.</p></div>
          <Button asChild><Link href="/components/lumen-orb"><Box className="size-4" /> Open Lumen Orb</Link></Button>
        </div>
      </section>
    </>
  );
}
