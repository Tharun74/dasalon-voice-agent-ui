import type { Metadata } from 'next';
import { AudioLab } from './lab';
import { catalog } from '@/site/catalog';

export const metadata: Metadata = { title: 'Audio Lab', description: 'Tune VoiceKit motion against a microphone, demo conversation or speech recording.' };

export default async function LabPage({ searchParams }: { searchParams: Promise<{ preset?: string | string[] }> }) {
  const { preset } = await searchParams;
  const variant = catalog.find(item => item.variant === preset)?.variant ?? 'lumen';
  return <AudioLab key={variant} initialVariant={variant} />;
}
