import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ComponentPlayground } from '@/components/component-playground';
import { DocsSidebar, MobileDocsNavigation } from '@/components/docs-navigation';
import { InstallPreset } from '@/components/install-preset';
import { PresetExamples } from '@/components/preset-examples';
import { CodeBlock } from '@/components/code-block';
import { TableOfContents } from '@/components/table-of-contents';
import { catalog } from '@/site/catalog';
import { providerSnippets } from '@/site/snippets';

type Route = { params: Promise<{ slug: string }> };
const sections = [
  { id: 'preview', label: 'Preview' }, { id: 'installation', label: 'Installation' },
  { id: 'usage', label: 'Usage' }, { id: 'props', label: 'Props' },
  { id: 'examples', label: 'Examples' }, { id: 'notes', label: 'Notes' },
];

const properties = [
  ['adapter', 'VoiceAgentAdapter', 'Required', 'Reads agent state, audio levels, frequency data and transcript.'],
  ['size', '“sm” | “md” | “lg” | “fill” | number', '“md”', 'Sets the maximum width in pixels. Give the parent an explicit height when using fill.'],
  ['quality', '“preview” | “full”', '“preview”', 'Preview reduces pixel density and simulation complexity. Full enables the focused detail tier with adaptive quality.'],
  ['theme', 'ThemeName', '“rose-gold”', 'Uses one of the five finish palettes.'],
  ['intensity', 'number', '1', 'Scales the response to audio between 0 and 2.'],
  ['seed', 'number', '42', 'Controls repeatable geometry or shader variation.'],
  ['colors', 'BrandColors', 'Theme colors', 'Overrides the glow, highlight and shadow colors.'],
  ['interactive', 'boolean', 'true', 'Adds keyboard activation and an accessible name to the surface.'],
  ['onPushToTalk', '(held: boolean) => void', '—', 'Emits hold and release events. Your app handles transmission.'],
  ['className, style', 'string, CSSProperties', '—', 'Styles the outer preset container.'],
];

export const dynamicParams = false;

export function generateStaticParams() {
  return catalog.map(item => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Route): Promise<Metadata> {
  const { slug } = await params;
  const item = catalog.find(candidate => candidate.slug === slug);
  return item ? { title: item.name, description: item.description } : { title: 'Component not found' };
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section id={id} className="mt-10 scroll-mt-22 border-t pt-6">
    <h2 className="mb-3 text-[25px] font-semibold tracking-[-.055em]">{title}</h2>
    {children}
  </section>;
}

export default async function ComponentPage({ params }: Route) {
  const { slug } = await params;
  const index = catalog.findIndex(item => item.slug === slug);
  const item = catalog[index];
  if (!item) notFound();
  const previous = catalog[index - 1];
  const next = catalog[index + 1];
  const snippets = providerSnippets(item);
  const canvas = item.docs.renderer === 'Canvas2D' || item.variant === 'dock';

  return <div className="site-width grid items-start gap-7 py-8 sm:py-10 lg:grid-cols-[165px_minmax(0,1fr)] xl:grid-cols-[170px_minmax(0,1fr)_137px] xl:gap-8">
    <DocsSidebar />
    <article className="min-w-0">
      <MobileDocsNavigation />
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/components" className="hover:text-foreground">Components</Link><ChevronRight aria-hidden="true" className="size-3" /><span aria-current="page" className="text-foreground">{item.name}</span>
      </nav>
      <header className="mb-6">
        <h1 className="text-[clamp(2.8rem,6vw,4rem)] leading-none font-semibold tracking-[-.057em]">{item.name}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[...item.tags, 'Audio-reactive', canvas ? 'Canvas2D' : 'WebGL'].map(tag => <Badge key={tag} variant="outline" className="rounded-md bg-card text-[11px] text-muted-foreground">{tag}</Badge>)}
        </div>
      </header>
      <section id="preview" aria-label="Interactive preview" className="scroll-mt-22"><ComponentPlayground item={item} /></section>

      <Section id="installation" title="Installation"><InstallPreset item={item} /></Section>

      <Section id="usage" title="Usage">
        <p className="prose-copy mb-3">Choose an adapter for the audio source your app already uses. The demo runs with no credentials.</p>
        <Tabs defaultValue="Demo" className="min-w-0 gap-3">
          <TabsList className="h-auto max-w-full flex-wrap justify-start" aria-label="Adapter example">
            {snippets.map(snippet => <TabsTrigger key={snippet.label} value={snippet.label} className="flex-none text-xs">{snippet.label}</TabsTrigger>)}
          </TabsList>
          {snippets.map(snippet => <TabsContent className="min-w-0 space-y-2.5" key={snippet.label} value={snippet.label}>
            <p className="prose-copy">{snippet.context}</p>
            <CodeBlock code={snippet.code} filename={snippet.filename} highlight={[4]} />
          </TabsContent>)}
        </Tabs>
      </Section>

      <Section id="props" title="Props">
        <div className="overflow-x-auto rounded-lg border" role="region" aria-label="Preset props" tabIndex={0}>
          <table className="w-full min-w-[550px] border-collapse text-left text-[13px]">
            <thead className="bg-card text-xs"><tr>{['Name', 'Type', 'Default', 'Description'].map(label => <th scope="col" className="px-3 py-2.5 font-semibold" key={label}>{label}</th>)}</tr></thead>
            <tbody>{[...properties, ...(item.docs.props ?? [])].map(([name, type, initial, description]) => <tr key={name} className="border-t">
              <th scope="row" className="px-3 py-2.5 align-top font-medium"><code className="font-mono text-[11px]">{name}</code></th>
              <td className="px-3 py-2.5 align-top font-mono text-[11px] text-muted-foreground">{type}</td>
              <td className="px-3 py-2.5 align-top text-xs text-muted-foreground">{initial}</td>
              <td className="min-w-40 px-3 py-2.5 align-top text-xs leading-5 text-muted-foreground">{description}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </Section>

      <Section id="examples" title="Examples"><PresetExamples item={item} /></Section>

      <Section id="notes" title="Notes">
        <div className="prose-copy space-y-3">
          <p>{item.docs.summary} {item.docs.motion}</p>
          <p><strong className="text-foreground">Performance.</strong> {canvas ? 'This preset uses Canvas2D and pauses outside the viewport.' : 'The renderer loads on the client, pauses outside the viewport and falls back to Canvas2D when WebGL is unavailable.'}</p>
          <p><strong className="text-foreground">Accessibility.</strong> Use Enter or Space to pulse the visual. Reduced motion slows the animation and reduces movement. Your app should provide spoken-state labels and transcripts.</p>
          <p><strong className="text-foreground">SSR.</strong> Import the component from a client boundary when you create a browser adapter. The initial markup can render on the server.</p>
          <Link href={`/lab?preset=${item.variant}`} prefetch={false} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline">Tune this preset in the Audio Lab <ArrowRight aria-hidden="true" className="size-3.5" /></Link>
        </div>
      </Section>

      <nav aria-label="Adjacent components" className="mt-9 flex flex-wrap justify-between gap-2 border-t pt-5">
        <Button asChild variant="outline"><Link href={previous ? `/components/${previous.slug}` : '/components'}><ArrowLeft />{previous?.name ?? 'All components'}</Link></Button>
        <Button asChild variant="outline"><Link href={next ? `/components/${next.slug}` : '/components'}>{next?.name ?? 'All components'}<ArrowRight /></Link></Button>
      </nav>
    </article>
    <TableOfContents sections={sections} />
  </div>;
}
