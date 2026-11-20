'use client';

import { createPreset } from './preset.js';
import { lazyScene } from './load-scene.js';

export const Mercury = /* @__PURE__ */ createPreset('mercury', /* @__PURE__ */ lazyScene(() => import('./scenes/mercury.js')));
