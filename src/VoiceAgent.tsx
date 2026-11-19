'use client';

import { LumenOrb } from './presets/lumen.js';
import { SilkStrands } from './presets/silk.js';
import { Mirror } from './presets/mirror.js';
import { Bloom } from './presets/bloom.js';
import { PrismHalo } from './presets/prism.js';
import { Stardust } from './presets/stardust.js';
import { DockPill } from './presets/dock.js';
import { Contour } from './presets/contour.js';
import type { VoiceAgentProps } from './presets/catalog.js';

const components = {
  lumen: LumenOrb, silk: SilkStrands, mirror: Mirror, bloom: Bloom, prism: PrismHalo,
  stardust: Stardust, dock: DockPill, contour: Contour,
};

export function VoiceAgent({ variant = 'lumen', ...props }: VoiceAgentProps) {
  const Preset = components[variant];
  return <Preset {...props} />;
}
