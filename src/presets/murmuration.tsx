'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const Murmuration = /* @__PURE__ */ createPreset('murmuration', /* @__PURE__ */ lazyScene(() => import('./scenes/murmuration.js')));
