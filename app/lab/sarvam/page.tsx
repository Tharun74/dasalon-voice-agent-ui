import type { Metadata } from 'next';
import { SarvamPlayground } from './playground';

export const metadata: Metadata = {
  title: 'Sarvam Voice Lab',
  description: 'Try the Maison Serein AI receptionist with voice or text.',
};

export default function SarvamLabPage() {
  return <SarvamPlayground />;
}
