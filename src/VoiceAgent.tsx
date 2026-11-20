'use client';

import { LumenOrb } from './presets/lumen.js';
import { SilkStrands } from './presets/silk.js';
import { Mirror } from './presets/mirror.js';
import { Bloom } from './presets/bloom.js';
import { PrismHalo } from './presets/prism.js';
import { Stardust } from './presets/stardust.js';
import { DockPill } from './presets/dock.js';
import { Contour } from './presets/contour.js';
import { Mercury } from './presets/mercury.js';
import { AuroraVeil } from './presets/aurora-veil.js';
import { InkInWater } from './presets/ink-in-water.js';
import { SilkVeil } from './presets/silk-veil.js';
import type { VoiceAgentProps } from './presets/catalog.js';

const components = {
  "silk-veil": SilkVeil,
  "ink-in-water": InkInWater,
  "aurora-veil": AuroraVeil,
  "mercury": Mercury,
  lumen: LumenOrb, silk: SilkStrands, mirror: Mirror, bloom: Bloom, prism: PrismHalo,
  stardust: Stardust, dock: DockPill, contour: Contour,
};

export function VoiceAgent({ variant = 'lumen', ...props }: VoiceAgentProps) {
  const Preset = components[variant];
  return <Preset {...props} />;
}
