'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const AuroraVeil = /* @__PURE__ */ createPreset('aurora-veil', /* @__PURE__ */ lazyScene(() => import('./scenes/aurora-veil.js')));
