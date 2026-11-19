'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const SilkStrands = /* @__PURE__ */ createPreset('silk', /* @__PURE__ */ lazyScene(() => import('./scenes/silk.js')));
