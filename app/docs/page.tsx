import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DocsSidebar, MobileDocsNavigation } from '@/components/docs-navigation';
import { TableOfContents } from '@/components/table-of-contents';
import Intro from './intro.mdx';

export const metadata: Metadata = { title: 'Introduction', description: 'Get started with the VoiceKit component library.' };
const content = [{ id: 'installation', label: 'Installation' }, { id: 'theming', label: 'Theming' }, { id: 'adapters', label: 'Adapters' }];

export default function DocsPage() {
  return <div className="site-width grid items-start gap-8 py-9 lg:grid-cols-[170px_minmax(0,1fr)] xl:grid-cols-[170px_minmax(0,1fr)_137px]">
    <DocsSidebar />
    <article className="min-w-0">
      <MobileDocsNavigation />
      <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="size-4" />Getting started</p>
      <h1 className="mb-5 text-5xl font-semibold tracking-[-.067em]">Introduction</h1>
      <div className="prose-copy mb-5"><Intro /></div>
      <Button asChild className="mt-5"><Link href="/components/lumen-orb">Open Lumen Orb <ArrowRight /></Link></Button>
    </article>
    <TableOfContents sections={content} />
  </div>;
}
