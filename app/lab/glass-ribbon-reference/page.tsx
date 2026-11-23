import type { Metadata } from 'next';
import { GlassRibbonReference } from './reference-lab';

export const metadata: Metadata = {
  title: 'Glass Ribbon Reference Lab',
  description: 'Compare deterministic Glass Ribbon renders against local reference footage.',
  robots: { index: false, follow: false },
};

export default function ReferencePage() {
  return <GlassRibbonReference />;
}
