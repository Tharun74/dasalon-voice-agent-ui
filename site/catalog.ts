import type { PresetName } from '@/src/presets/catalog';
import type { ThemeName } from '@/src/theme';

export const categories = ['All', '3D', 'Particles', 'Compact', 'Minimal'] as const;
export type Category = (typeof categories)[number];

interface ComponentConfig {
  variant: PresetName;
  slug: string;
  name: string;
  exportName: string;
  description: string;
  tags: Exclude<Category, 'All'>[];
  docs: { summary: string; motion: string; finishes: [ThemeName, ThemeName] };
}

export const catalog: ComponentConfig[] = [
  {
    variant: 'lumen', slug: 'lumen-orb', name: 'Lumen Orb', exportName: 'LumenOrb', tags: ['3D', 'Minimal'],
    description: 'An iridescent glass sphere with liquid motion.',
    docs: {
      summary: 'A volumetric voice presence built around a displaced sphere, with an iridescent rim and an inner liquid layer.',
      motion: 'Listening draws the surface inward. Speaking pushes pressure waves outward across the shell.',
      finishes: ['rose-gold', 'emerald-spa'],
    },
  },
  {
    variant: 'silk', slug: 'silk-strands', name: 'Silk Strands', exportName: 'SilkStrands', tags: ['3D'],
    description: 'Flowing satin ribbons that gather and unfurl with speech.',
    docs: {
      summary: 'Layered, shader-driven ribbons that catch light like fine satin as they move through space.',
      motion: 'Listening tightens the bundle into a narrower shape. Speaking sends waves down the individual ribbons.',
      finishes: ['champagne', 'midnight-noir'],
    },
  },
  {
    variant: 'mirror', slug: 'mirror', name: 'Mirror', exportName: 'Mirror', tags: ['3D'],
    description: 'A gilt vanity mirror with ripples in its reflection.',
    docs: { summary: 'A quick pointer movement tilts the mirror to catch the light.', motion: 'Listening draws the reflection toward the center. Speaking carries ripples across the face.', finishes: ['champagne', 'emerald-spa'] },
  },
  {
    variant: 'bloom', slug: 'bloom', name: 'Bloom', exportName: 'Bloom', tags: ['3D', 'Particles'],
    description: 'A layered camellia that opens and releases pollen.',
    docs: { summary: 'Translucent petal layers catch light as the flower turns.', motion: 'Listening cups the petals. Speaking opens them and sends pollen outward.', finishes: ['blush-pastel', 'midnight-noir'] },
  },
  {
    variant: 'prism', slug: 'prism-halo', name: 'Prism Halo', exportName: 'PrismHalo', tags: ['3D'],
    description: 'A crown of crystal facets shaped by the audio spectrum.',
    docs: { summary: 'Faceted crystals trace a ring on a tilted plane.', motion: 'Listening tightens the orbit. Individual crystals rise to their frequency bands as the agent speaks.', finishes: ['midnight-noir', 'champagne'] },
  },
  {
    variant: 'stardust', slug: 'stardust', name: 'Stardust', exportName: 'Stardust', tags: ['3D', 'Particles'],
    description: 'A cloud of fine particles that gathers and breaks into eddies.',
    docs: { summary: 'Nearly twenty thousand points make up the particle cloud.', motion: 'Listening gathers points inward. Speaking spreads them along a curling field.', finishes: ['midnight-noir', 'emerald-spa'] },
  },
  {
    variant: 'dock', slug: 'dock-pill', name: 'Dock Pill', exportName: 'DockPill', tags: ['Compact', 'Minimal'],
    description: 'A compact waveform dock that opens into voice controls.',
    docs: { summary: 'The Canvas2D dock opens conversation controls and displays the latest transcript.', motion: 'The waveform gathers around the input while listening and stretches with the output while speaking.', finishes: ['rose-gold', 'emerald-spa'] },
  },
  {
    variant: 'contour', slug: 'contour', name: 'Contour', exportName: 'Contour', tags: ['3D'],
    description: 'Polished metal rails that fold through a sculptural knot.',
    docs: { summary: 'Intertwined rails orbit through a single knot.', motion: 'Listening tightens the rails. Speaking pushes them apart and rolls light along the edges.', finishes: ['champagne', 'blush-pastel'] },
  },
];

export type CatalogEntry = (typeof catalog)[number];
export const registryOrigin = (process.env.NEXT_PUBLIC_VOICEKIT_URL || 'http://localhost:3000').replace(/\/$/, '');
