'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const LumenOrb = /* @__PURE__ */ createPreset('lumen', /* @__PURE__ */ lazyScene(() => import('./scenes/lumen.js')));
