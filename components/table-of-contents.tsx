'use client';

import { useEffect, useState } from 'react';
import { ListTree } from 'lucide-react';
import { cn } from '@/site/utils';

export type ContentSection = { id: string; label: string };

export function TableOfContents({ sections }: { sections: ContentSection[] }) {
  const [current, setCurrent] = useState(sections[0]?.id);
  useEffect(() => {
    const onScroll = () => {
      const visible = sections.filter(section => (document.getElementById(section.id)?.getBoundingClientRect().top ?? Infinity) < 136);
      setCurrent(visible.at(-1)?.id ?? sections[0]?.id);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [sections]);

  return <aside className="hidden xl:block">
    <nav aria-label="On this page" className="sticky top-23 space-y-2 border-l pl-4">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold"><ListTree className="size-3.5 text-muted-foreground" /> On this page</p>
      {sections.map(section => <a key={section.id} href={`#${section.id}`} aria-current={current === section.id ? 'location' : undefined}
        className={cn('block rounded text-xs leading-5 hover:text-foreground', current === section.id ? 'font-medium text-foreground' : 'text-muted-foreground')}>{section.label}</a>)}
    </nav>
  </aside>;
}
