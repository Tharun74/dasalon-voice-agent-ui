import type { Metadata } from 'next';
import { GalleryGrid } from '@/components/gallery-grid';

export const metadata: Metadata = { title: 'Components', description: 'Browse audio-reactive voice components for React.' };

export default function ComponentsIndex() {
  return <div className="site-width py-10 sm:py-14">
    <header className="mb-8 max-w-2xl sm:mb-9">
      <h1 className="text-5xl font-semibold tracking-[-.072em] sm:text-6xl">Components</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Explore the live presets. Play the voice demo to see them react to a conversation.</p>
    </header>
    <GalleryGrid filters />
  </div>;
}
