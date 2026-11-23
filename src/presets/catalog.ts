import type { CSSProperties } from 'react';
import type { BrandColors, ThemeName } from '../theme.js';
import type { VoiceAgentAdapter } from '../types.js';
import type { MotionPlayback } from '../motion.js';

export const PRESETS = {
  lumen: { name: 'Lumen Orb', component: 'LumenOrb', description: 'Iridescent serum suspended in a glass sphere.', accent: '#f4a6b4' },
  silk: { name: 'Silk Strands', component: 'SilkStrands', description: 'Satin ribbons sweep and ripple like styled hair.', accent: '#e6b68c' },
  mirror: { name: 'Mirror', component: 'Mirror', description: 'A gilt vanity mirror with a wavering reflection.', accent: '#ddab82' },
  bloom: { name: 'Bloom', component: 'Bloom', description: 'A luminous camellia unfurls to the rhythm of speech.', accent: '#f2a3c4' },
  prism: { name: 'Prism Halo', component: 'PrismHalo', description: 'A suspended crown of voice-driven crystal facets.', accent: '#a7aaff' },
  stardust: { name: 'Stardust', component: 'Stardust', description: 'A cloud of fine powder gathers and breaks into eddies.', accent: '#eac2fb' },
  dock: { name: 'Dock Pill', component: 'DockPill', description: 'A pocket-size concierge with flowing light under glass.', accent: '#efad99' },
  contour: { name: 'Contour', component: 'Contour', description: 'Polished metal folds through a twisting sculptural knot.', accent: '#e7ad9e' },
  "mercury": { name: "Mercury", component: "Mercury", description: "Liquid chrome pulls into a single mass, then sheds droplets on syllables.", accent: "#b4bfd8" },
  "aurora-veil": { name: "Aurora Veil", component: "AuroraVeil", description: "Layered northern lights fold inward and flare in waves.", accent: "#89f4ca" },
  "ink-in-water": { name: "Ink in Water", component: "InkInWater", description: "Two colors of ink diffuse and curl in a clear water column.", accent: "#62c6c4" },
  "silk-veil": { name: "Silk Veil", component: "SilkVeil", description: "A single satin sheet drapes, billows and catches anisotropic light.", accent: "#d282b2" },
  "murmuration": { name: "Murmuration", component: "Murmuration", description: "A luminous flock of tiny winged silhouettes banks and reforms in three dimensions.", accent: "#b49ad9" },
  "liquid-glass": { name: "Liquid Glass", component: "LiquidGlass", description: "A transparent capsule bends the page beneath it and catches prismatic light.", accent: "#8dc5e8" },
  "muse": { name: "Muse", component: "Muse", description: "An expressive line-drawn presence with blinking eyes and a voice-shaped mouth.", accent: "#e3b5a4" },
  "jewel": { name: "Jewel", component: "Jewel", description: "A suspended, faceted gem with chromatic caustics and a barge-in fracture.", accent: "#c499ed" },
  "kinetic-type": { name: "Kinetic Type", component: "KineticType", description: "Live words slide into place, stretch with syllables and breathe in depth.", accent: "#fdd6a3" },
  "glass-ribbon": { name: "Glass Ribbon", component: "GlassRibbon", description: "A smoked glass lens holds a folded, voice-reactive spectrum.", accent: "#8be6dc" },
} as const;

export type PresetName = keyof typeof PRESETS;
export const PRESET_NAMES = Object.keys(PRESETS) as PresetName[];

export type PresetSize = 'sm' | 'md' | 'lg' | 'fill' | number;
export type PresetQuality = 'preview' | 'full';

export interface PresetProps {
  adapter: VoiceAgentAdapter;
  theme?: ThemeName;
  size?: PresetSize;
  quality?: PresetQuality;
  /** Overall audio response, from 0 to 2. */
  intensity?: number;
  seed?: number;
  colors?: BrandColors;
  className?: string;
  style?: CSSProperties;
  /** Adds keyboard activation and an accessible name to the preview. */
  interactive?: boolean;
  onPushToTalk?: (held: boolean) => void;
  /** Optional manual transport, tuning, or animation-frame telemetry. */
  motion?: MotionPlayback;
}

export interface VoiceAgentProps extends PresetProps {
  variant?: PresetName;
}
