'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const Jewel = /* @__PURE__ */ createPreset('jewel', /* @__PURE__ */ lazyScene(() => import('./scenes/jewel.js')));
