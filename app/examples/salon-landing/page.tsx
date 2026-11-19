import type { Metadata } from 'next';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import '@fontsource-variable/instrument-sans';
import './salon.css';
import { SalonExample } from './example';

export const metadata: Metadata = { title: 'Maison Serein example', description: 'Try the VoiceKit presets on a fictional salon landing page.' };
export default function SalonPage() { return <SalonExample />; }
