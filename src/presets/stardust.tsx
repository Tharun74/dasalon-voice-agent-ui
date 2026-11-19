'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const Stardust = /* @__PURE__ */ createPreset('stardust', /* @__PURE__ */ lazyScene(() => import('./scenes/stardust.js')));
