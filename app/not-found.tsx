import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return <div className="site-width py-24 sm:py-32">
    <p className="mb-2 font-mono text-xs text-muted-foreground">404</p>
    <h1 className="text-4xl font-semibold tracking-[-.06em] sm:text-6xl">Page not found</h1>
    <p className="mt-3 text-sm text-muted-foreground">Browse the gallery to find a VoiceKit preset.</p>
    <Button asChild className="mt-6"><Link href="/components">Browse components</Link></Button>
  </div>;
}
