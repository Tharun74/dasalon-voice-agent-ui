'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const PrismHalo = /* @__PURE__ */ createPreset('prism', /* @__PURE__ */ lazyScene(() => import('./scenes/prism.js')));
