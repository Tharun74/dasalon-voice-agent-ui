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
} as const;

export type PresetName = keyof typeof PRESETS;
export const PRESET_NAMES = Object.keys(PRESETS) as PresetName[];

export type PresetSize = 'sm' | 'md' | 'lg' | 'fill' | number;

export interface PresetProps {
  adapter: VoiceAgentAdapter;
  theme?: ThemeName;
  size?: PresetSize;
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
