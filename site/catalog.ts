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
  docs: { summary: string; motion: string; finishes: [ThemeName, ThemeName]; renderer?: 'Canvas2D' | 'WebGL'; props?: [string, string, string, string][] };
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
  {
    variant: "mercury", slug: "mercury", name: "Mercury", exportName: "Mercury", tags: ["3D"],
    description: "Liquid chrome pulls into a single mass, then sheds droplets on syllables.",
    docs: { summary: "Raymarched metaballs reflect a procedural studio. Surface tension frees and reabsorbs droplets.", motion: "Listening draws the mass together. Speaking pushes the shoulder outward and pinches off droplets.", finishes: ["midnight-noir", "champagne"] },
  },
  {
    variant: "aurora-veil", slug: "aurora-veil", name: "Aurora Veil", exportName: "AuroraVeil", tags: ["3D"],
    description: "Layered northern lights fold inward and flare in waves.",
    docs: { summary: "Three folded emission volumes are sampled front to back to give each luminous curtain its own depth.", motion: "Listening draws the curtains together. Speaking sweeps a flare down the layered light.", finishes: ["emerald-spa", "blush-pastel"] },
  },
  {
    variant: "ink-in-water", slug: "ink-in-water", name: "Ink in Water", exportName: "InkInWater", tags: ["3D"],
    description: "Two colors of ink diffuse and curl in a clear water column.",
    docs: { summary: "A WebGL2 stable-fluids solver advects dye, enforces near-incompressibility with a pressure projection, and curls the plume under the pointer.", motion: "Listening draws the dye toward the nozzle. Speaking injects dye and velocity into expanding eddies. Move the pointer through the water to stir it.", finishes: ["emerald-spa", "midnight-noir"] },
  },
  {
    variant: "silk-veil", slug: "silk-veil", name: "Silk Veil", exportName: "SilkVeil", tags: ["3D"],
    description: "A single satin sheet drapes, billows and catches anisotropic light.",
    docs: { summary: "A pinned satin sheet is solved on floating-point textures with Verlet integration and structural, shear and bending constraints. The pointer supplies wind.", motion: "Listening gathers the hanging sheet. Speaking sweeps wind toward the open edge. Move the pointer to billow the cloth.", finishes: ["champagne", "midnight-noir"] },
  },
  {
    variant: "murmuration", slug: "murmuration", name: "Murmuration", exportName: "Murmuration", tags: ["3D","Particles"],
    description: "A luminous flock of tiny winged silhouettes banks and reforms in three dimensions.",
    docs: { summary: "Thousands of starlings trace an aerial ring, then gather into moving silhouettes.", motion: "Listening pulls the flock inward from user audio. Agent syllables send it outward through a sphere, wave, heart and spiral. Thinking banks the flock into a vortex.", finishes: ["rose-gold", "midnight-noir"] },
  },
  {
    variant: "liquid-glass", slug: "liquid-glass", name: "Liquid Glass", exportName: "LiquidGlass", tags: ["3D","Compact","Minimal"],
    description: "A transparent capsule bends the page beneath it and catches prismatic light.",
    docs: { summary: 'A rim-lit lens distorts the live backdrop in browsers that support SVG backdrop filters. Other engines retain frosted glass and the chromatic rim.', motion: 'Listening contracts the lens from user audio. Agent syllables stretch it outward and run a ripple along its rim.', finishes: ['midnight-noir', 'emerald-spa'], props: [['floating', 'boolean', 'false', 'Pins the lens to the lower-right corner and enables backdrop distortion. Use the LiquidGlass export for this prop.']] },
  },
  {
    variant: "muse", slug: "muse", name: "Muse", exportName: "Muse", tags: ["Minimal","Particles"],
    description: "An expressive line-drawn presence with blinking eyes and a voice-shaped mouth.",
    docs: { summary: "An abstract face drawn in projected lines and particles. RMS opens its mouth and spectral bands shape the vowel.", motion: "The face gathers inward and looks toward the user while listening. Agent speech opens the mouth and sends the surrounding particles outward.", finishes: ["champagne", "blush-pastel"], renderer: 'Canvas2D' },
  },
  {
    variant: "jewel", slug: "jewel", name: "Jewel", exportName: "Jewel", tags: ["3D","Particles"],
    description: "A suspended, faceted gem with chromatic caustics and a barge-in fracture.",
    docs: { summary: "A custom-cut gemstone with procedural reflection, RGB refraction, facet highlights and a caustic below.", motion: "User input contracts the stone. Agent output expands it and carries bass through the facets, with treble on the glints. Barge-in separates the facets and then reforms the crystal.", finishes: ["midnight-noir", "champagne"] },
  },
  {
    variant: "kinetic-type", slug: "kinetic-type", name: "Kinetic Type", exportName: "KineticType", tags: ["Minimal"],
    description: "Live words slide into place, stretch with syllables and breathe in depth.",
    docs: { summary: "A caption renderer with dimensional word layers, directional tracking and syllable-timed reveals.", motion: "User input draws tracking inward. Agent output opens the typesetting and lifts the word layers. The display reads captions directly from the adapter.", finishes: ["champagne", "emerald-spa"], renderer: 'Canvas2D' },
  },
];

export type CatalogEntry = (typeof catalog)[number];
export const registryOrigin = (process.env.NEXT_PUBLIC_VOICEKIT_URL || 'http://localhost:3000').replace(/\/$/, '');
