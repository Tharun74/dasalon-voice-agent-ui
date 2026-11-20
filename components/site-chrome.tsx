'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { AudioLines, BookOpen, Boxes, GitFork, Menu, Moon, PanelTop, Search, Star, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { catalog } from '@/site/catalog';
import { cn } from '@/site/utils';

const navigation = [
  { name: 'Docs', href: '/docs', icon: BookOpen },
  { name: 'Components', href: '/components', icon: Boxes },
  { name: 'Examples', href: '/examples/salon-landing', icon: PanelTop },
];
const github = process.env.NEXT_PUBLIC_GITHUB_URL ?? 'https://github.com/search?q=dasalon+voice+agent+ui&type=repositories';

export function Wordmark() {
  return <Link href="/" className="inline-flex shrink-0 items-center gap-2.5 rounded font-semibold tracking-tight">
    <span className="grid size-7 place-items-center rounded-md border bg-card"><AudioLines aria-hidden="true" className="size-4 text-[var(--rose)]" /></span>
    <span>voicekit<span className="text-[var(--rose)]">.</span></span>
  </Link>;
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [search, setSearch] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearch(open => !open);
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  function go(href: string) {
    setSearch(false);
    router.push(href);
  }

  return <TooltipProvider>
    <header className="site-nav sticky top-0 z-40 border-b">
      <div className="site-width flex h-[62px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-8">
          <Wordmark />
          <nav className="hidden items-center gap-5 md:flex" aria-label="Main navigation">
            {navigation.map(item => <Link key={item.name} href={item.href} aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
              className={cn('text-[13px] font-medium transition-colors hover:text-foreground', pathname.startsWith(item.href) ? 'text-foreground' : 'text-muted-foreground')}>{item.name}</Link>)}
          </nav>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <Button type="button" variant="outline" size="sm" className="hidden h-8 w-40 justify-start gap-2 bg-transparent text-xs text-muted-foreground sm:flex"
            onClick={() => setSearch(true)}><Search className="size-3.5" /> Search <span className="keycap ml-auto" aria-hidden="true">⌘K</span></Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Search" className="size-8 sm:hidden" onClick={() => setSearch(true)}><Search /></Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="sm" className="hidden h-8 gap-1.5 px-2.5 sm:flex">
                <a href={github} target="_blank" rel="noreferrer" aria-label="View VoiceKit on GitHub"><GitFork className="size-4" /><Star className="size-3 text-muted-foreground" /></a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>GitHub</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Toggle color theme"
                onClick={() => setTheme(resolvedTheme === 'light' ? 'dark' : 'light')}>
                <Sun className="hidden size-4 dark:block" /><Moon className="size-4 dark:hidden" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle theme</TooltipContent>
          </Tooltip>
          <Sheet open={sheet} onOpenChange={setSheet}>
            <SheetTrigger asChild><Button variant="outline" size="icon" className="size-8 md:hidden" aria-label="Open navigation"><Menu /></Button></SheetTrigger>
            <SheetContent side="right" className="w-[min(84vw,350px)]">
              <SheetHeader><SheetTitle>VoiceKit</SheetTitle><SheetDescription>Explore the library.</SheetDescription></SheetHeader>
              <nav className="grid gap-1 px-4" aria-label="Mobile navigation">
                {navigation.map(item => <Link key={item.name} href={item.href} onClick={() => setSheet(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-muted"><item.icon className="size-4" />{item.name}</Link>)}
                <a href={github} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-muted"><GitFork className="size-4" />GitHub</a>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
    <CommandDialog open={search} onOpenChange={setSearch} title="Search VoiceKit" description="Find documentation, examples and voice components.">
      <CommandInput placeholder="Search docs and components…" />
      <CommandList>
        <CommandEmpty>No matching pages.</CommandEmpty>
        <CommandGroup heading="Pages">
          {navigation.map(item => <CommandItem key={item.name} value={item.name} onSelect={() => go(item.href)}><item.icon />{item.name}</CommandItem>)}
        </CommandGroup>
        <CommandGroup heading="Components">
          {catalog.map(item => <CommandItem key={item.slug} value={`${item.name} ${item.tags.join(' ')}`}
            onSelect={() => go(`/components/${item.slug}`)}><AudioLines />{item.name}</CommandItem>)}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  </TooltipProvider>;
}

export function SiteFooter() {
  return <footer className="section-rule mt-auto">
    <div className="site-width flex flex-wrap items-center justify-between gap-5 py-7 text-xs text-muted-foreground">
      <Wordmark />
      <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
        {navigation.map(item => <Link href={item.href} key={item.name} className="hover:text-foreground">{item.name}</Link>)}
        <a href={github} target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
      </nav>
      <p>Open-source voice components for React.</p>
    </div>
  </footer>;
}
