'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const SilkVeil = /* @__PURE__ */ createPreset('silk-veil', /* @__PURE__ */ lazyScene(() => import('./scenes/silk-veil.js')));
