'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const InkInWater = /* @__PURE__ */ createPreset('ink-in-water', /* @__PURE__ */ lazyScene(() => import('./scenes/ink-in-water.js')));
