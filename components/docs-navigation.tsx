'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { catalog } from '@/site/catalog';
import { cn } from '@/site/utils';

const groups = [
  { name: 'Getting Started', links: [{ name: 'Introduction', href: '/docs' }, { name: 'Installation', href: '/docs#installation' }] },
  { name: 'Components', links: catalog.map(item => ({ name: item.name, href: `/components/${item.slug}` })) },
  { name: 'Adapters', links: [{ name: 'Audio sources', href: '/docs#adapters' }] },
  { name: 'Theming', links: [{ name: 'Finishes & colors', href: '/docs#theming' }] },
];

function NavList({ dismiss }: { dismiss?: boolean }) {
  const pathname = usePathname();
  return <nav aria-label="Documentation navigation" className="space-y-5">
    {groups.map(group => (
      <div key={group.name} className="space-y-1">
        <p className="mb-1 px-2.5 text-xs font-semibold">{group.name}</p>
        {group.links.map(item => {
          const active = pathname === item.href;
          const link = <Link href={item.href} prefetch={false} className={cn('block rounded-md px-2.5 py-1.5 text-[13px] hover:bg-muted hover:text-foreground',
            active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground')} aria-current={active ? 'page' : undefined}>{item.name}</Link>;
          return dismiss ? <SheetClose key={item.href} asChild>{link}</SheetClose> : <span className="block" key={item.href}>{link}</span>;
        })}
      </div>
    ))}
  </nav>;
}

export function DocsSidebar() {
  return <aside className="hidden lg:block"><div className="sticky top-22 max-h-[calc(100dvh-110px)] overflow-auto pb-6"><NavList /></div></aside>;
}

export function MobileDocsNavigation() {
  return <div className="mb-4 lg:hidden">
    <Sheet>
      <SheetTrigger asChild><Button variant="outline" size="sm" className="h-8 text-xs"><PanelLeft className="size-3.5" /> Docs menu</Button></SheetTrigger>
      <SheetContent side="left" className="w-[min(85vw,330px)] overflow-y-auto">
        <SheetHeader><SheetTitle>Documentation</SheetTitle><SheetDescription>Browse sections and components.</SheetDescription></SheetHeader>
        <div className="px-4 pb-6"><NavList dismiss /></div>
      </SheetContent>
    </Sheet>
  </div>;
}
