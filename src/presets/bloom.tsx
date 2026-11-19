'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const Bloom = /* @__PURE__ */ createPreset('bloom', /* @__PURE__ */ lazyScene(() => import('./scenes/bloom.js')));
